/**
 * hosts 配置管理 Composable
 * 封装所有与 hosts 配置管理相关的业务逻辑
 */

import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'

export function useHostsEntries() {
    // 状态
    const entries = ref([])
    const systemHosts = ref('')
    const activeTab = ref('system')
    const activeEntryId = ref('')
    const currentContent = ref('')
    const isReadOnly = ref(true)
    const isEditingDefault = ref(false) // 是否在编辑默认配置
    const selectedEntryIds = ref(new Set()) // 选中的 entry ID 集合

    // 计算属性
    const currentTitle = computed(() => {
        if (activeTab.value === 'system') {
            return '系统 Hosts（只读）'
        } else if (activeTab.value === 'default') {
            return isEditingDefault.value ? '编辑默认配置' : '默认配置（只读）'
        }
        const entry = entries.value.find(e => e._id === activeEntryId.value)
        return entry ? `编辑：${entry.name}` : '请选择配置'
    })

    const activeEntries = computed(() => {
        return entries.value.filter(e => e.active)
    })

    const defaultEntry = computed(() => {
        return entries.value.find(e => e.name === 'default')
    })

    // 选中的 entry 数量
    const selectedCount = computed(() => {
        return selectedEntryIds.value.size
    })

    // 选中的 entry 对象数组
    const selectedEntries = computed(() => {
        return entries.value.filter(e => selectedEntryIds.value.has(e._id))
    })

    // 是否有选中的 entry
    const hasSelection = computed(() => {
        return selectedEntryIds.value.size > 0
    })

  /**
   * 初始化应用
   */
  async function initApp() {
    try {
      // 加载所有配置
      const result = await window.hostsboxDB.getAllEntries()
      if (result.success) {
        console.log('initApp 加载到的 entries:', result.data)

        // 去重：只保留每个 name 的最新版本（按 createTime）
        const uniqueEntries = {}
        for (const entry of result.data) {
          const key = entry.name
          if (!uniqueEntries[key] || entry.createTime > uniqueEntries[key].createTime) {
            uniqueEntries[key] = entry
          }
        }
        entries.value = Object.values(uniqueEntries)
        console.log('initApp 去重后的 entries:', entries.value)
      }

      // 获取系统 hosts
      const hostsResult = window.hostsbox.getHosts()
      if (hostsResult.success) {
        systemHosts.value = hostsResult.data
      } else {
        systemHosts.value = `# 获取系统 hosts 失败\n# 错误: ${hostsResult.msg}\n`
      }

      // 默认显示系统 hosts
      selectSystemHosts()
    } catch (error) {
      ElMessage.error('初始化失败：' + error.message)
    }
  }

    /**
     * 选择系统 hosts（显示当前系统 hosts 文件内容）
     */
    function selectSystemHosts() {
        activeTab.value = 'system'
        activeEntryId.value = ''
        isEditingDefault.value = false

        // 直接读取系统 hosts 文件
        const hostsResult = window.hostsbox.getHosts()
        if (hostsResult.success) {
            currentContent.value = hostsResult.data
        } else {
            currentContent.value = `# 获取系统 hosts 失败\n# 错误: ${hostsResult.msg}\n`
        }

        isReadOnly.value = true
    }

    /**
     * 选择原始配置
     */
    function selectDefault() {
        activeTab.value = 'default'
        activeEntryId.value = ''
        isEditingDefault.value = false

        const entry = defaultEntry.value
        if (entry) {
            currentContent.value = entry.content
        } else {
            // 如果 default 还不存在，显示当前系统 hosts
            currentContent.value = systemHosts.value
        }
        isReadOnly.value = true
    }

    /**
     * 编辑原始配置
     */
    function editDefault() {
        // 如果 defaultEntry 不存在，先创建
        if (!defaultEntry.value) {
            currentContent.value = systemHosts.value
        }
        isEditingDefault.value = true
        isReadOnly.value = false
    }

    /**
     * 保存原始配置并生效
     */
    async function saveDefaultAndApply() {
        let entry = defaultEntry.value
        let originalContent = entry ? entry.content : null

        // 检查内容是否发生变化
        if (entry && entry.content === currentContent.value) {
            console.log('default 配置内容未变化，跳过保存')
            isEditingDefault.value = false
            isReadOnly.value = true
            ElMessage.info('内容未变化')
            return true
        }

        // 如果 defaultEntry 不存在，创建新的
        if (!entry) {
            const result = await window.hostsboxDB.createEntry({
                name: 'default',
                content: currentContent.value,
                active: false
            })

            if (!result.success) {
                ElMessage.error('创建失败：' + result.msg)
                return false
            }

            // 添加到 entries
            entry = {
                name: 'default',
                content: currentContent.value,
                active: false,
                _id: result.id,
                _rev: result.rev
            }
            entries.value.push(entry)
        } else {
            const result = await window.hostsboxDB.updateEntry({
                ...entry,
                content: currentContent.value
            })

            if (!result.success) {
                ElMessage.error('保存失败：' + result.msg)
                return false
            }

            entry.content = currentContent.value
            entry._rev = result.rev
        }

        // 应用到系统：default + 所有激活的 entry
        try {
            await applyHostsToSystem()
        } catch (error) {
            ElMessage.error('生效失败：' + error.message)
            // 回滚内容
            if (originalContent !== null) {
                const rollbackResult = await window.hostsboxDB.updateEntry({
                    ...entry,
                    content: originalContent
                })
                if (rollbackResult.success) {
                    entry.content = originalContent
                    entry._rev = rollbackResult.rev
                }
            } else {
                // 如果是新建的，删除它
                await window.hostsboxDB.deleteEntry(entry._id, entry._rev)
                entries.value = entries.value.filter(e => e._id !== entry._id)
            }
            return false
        }

        // 如果当前在"系统 Hosts"页面，刷新显示内容
        if (activeTab.value === 'system') {
            selectSystemHosts()
        }

        ElMessage.success('保存并生效成功')
        isEditingDefault.value = false
        isReadOnly.value = true
        return true
    }

    /**
     * 保存原始配置（不生效）
     */
    async function saveDefault() {
        let entry = defaultEntry.value

        // 如果 defaultEntry 不存在，创建新的
        if (!entry) {
            const result = await window.hostsboxDB.createEntry({
                name: 'default',
                content: currentContent.value,
                active: false
            })

            if (!result.success) {
                ElMessage.error('创建失败：' + result.msg)
                return false
            }

            // 添加到 entries
            entries.value.push({
                name: 'default',
                content: currentContent.value,
                active: false,
                _id: result.id,
                _rev: result.rev
            })
        } else {
            const result = await window.hostsboxDB.updateEntry({
                ...entry,
                content: currentContent.value
            })

            if (!result.success) {
                ElMessage.error('保存失败：' + result.msg)
                return false
            }

            entry.content = currentContent.value
            entry._rev = result.rev
        }

        ElMessage.success('保存成功')
        isEditingDefault.value = false
        isReadOnly.value = true
        return true
    }

    /**
     * 选择配置
     * @param {string} entryId - 配置 ID
     */
    function selectEntry(entryId) {
        activeTab.value = 'entry'
        activeEntryId.value = entryId
        const entry = entries.value.find(e => e._id === entryId)
        if (entry) {
            currentContent.value = entry.content || `# ${entry.name}\n# 在此编辑 hosts 配置\n`
            isReadOnly.value = false
        }
    }

    /**
     * 获取当前选中的配置
     */
    function getCurrentEntry() {
        return entries.value.find(e => e._id === activeEntryId.value)
    }

  /**
   * 创建新配置
   * @param {string} name - 配置名称
   * @returns {Promise<boolean>} - 是否成功
   */
  async function createEntry(name) {
    console.log('createEntry 开始，name:', name)
    const entry = {
      name,
      content: `# 在此编辑 hosts 配置\n`,
      active: false
    }

    console.log('准备调用 createEntry:', entry)
    const result = await window.hostsboxDB.createEntry(entry)
    console.log('createEntry 返回结果:', result)

    if (!result.success) {
      ElMessage.error('创建配置失败：' + result.msg)
      return null
    }

    // 更新本地数据，使用返回的完整文档（包含 type 字段）
    const newEntry = {
      ...result.doc,
      _id: result.id,
      _rev: result.rev
    }
    console.log('准备添加到 entries.value:', newEntry)
    entries.value.push(newEntry)
    console.log('添加后 entries.value.length:', entries.value.length)

    ElMessage.success('配置创建成功')
    return result.id
  }

  /**
   * 保存当前配置内容
   * @param {boolean} showMessage - 是否显示保存提示
   * @returns {Promise<boolean>} - 是否成功
   */
  async function saveCurrentEntry(showMessage = true) {
    const entry = getCurrentEntry()
    if (!entry) {
      return false
    }

    const result = await window.hostsboxDB.updateEntry({
      ...entry,
      content: currentContent.value
    })

    if (!result.success) {
      if (showMessage) ElMessage.error('保存失败：' + result.msg)
      return false
    }

    // 更新本地 entry 的 content 和 _rev
    entry.content = currentContent.value
    entry._rev = result.rev
    if (showMessage) ElMessage.success('保存成功')
    return true
  }

    /**
     * 删除配置
     * @param {Object} entry - 要删除的配置
     * @returns {Promise<boolean>} - 是否成功
     */
    async function deleteEntry(entry) {
        const wasActive = entry.active
        const entryId = entry._id
        const entryRev = entry._rev

        const result = await window.hostsboxDB.deleteEntry(entry._id, entry._rev)
        if (!result.success) {
            ElMessage.error('删除失败：' + result.msg)
            return false
        }

        // 从本地列表中移除
        entries.value = entries.value.filter(e => e._id !== entry._id)

        // 如果配置是激活的，需要重新应用 hosts
        if (wasActive) {
            try {
                await applyHostsToSystem()
                // 如果当前在"系统 Hosts"页面，刷新显示内容
                if (activeTab.value === 'system') {
                    selectSystemHosts()
                }
            } catch (error) {
                ElMessage.error('生效失败：' + error.message)
                // 回滚删除
                const restoreResult = await window.hostsboxDB.createEntry({
                    ...entry,
                    _id: entryId,
                    _rev: entryRev
                })
                if (restoreResult.success) {
                    entry._rev = restoreResult.rev
                    entries.value.push(entry)
                }
                return false
            }
        }

        return true
    }

  /**
   * 切换配置激活状态
   * @param {Object} entry - 要切换的配置
   * @param {boolean} newState - 新的激活状态
   * @returns {Promise<boolean>} - 是否成功
   */
  async function toggleEntryActive(entry, newState) {
    // 从 entries 中获取最新的 entry 对象，确保使用最新的 _rev
    const latestEntry = entries.value.find(e => e._id === entry._id)
    if (!latestEntry) {
      ElMessage.error('配置不存在')
      return false
    }

    const result = await window.hostsboxDB.updateEntry({
            ...latestEntry,
            active: newState
        })

        if (!result.success) {
            ElMessage.error('操作失败：' + result.msg)
            return false
        }

        // 更新本地数据
        latestEntry.active = newState
        latestEntry._rev = result.rev

        // 重新生成 hosts 并应用到系统
        try {
            await applyHostsToSystem()
        } catch (error) {
            ElMessage.error('生效失败：' + error.message)
            // 回滚状态
            latestEntry.active = !newState
            const rollbackResult = await window.hostsboxDB.updateEntry({
                ...latestEntry,
                active: !newState
            })
            if (rollbackResult.success) {
                latestEntry._rev = rollbackResult.rev
            }
            return false
        }

        // 如果当前在"系统 Hosts"页面，刷新显示内容
        if (activeTab.value === 'system') {
            selectSystemHosts()
        }

        ElMessage.success(newState ? '已生效' : '已失效')
        return true
    }

    /**
     * 应用 hosts 到系统
     */
    async function applyHostsToSystem() {
        // 生成新的 hosts 内容：default + 所有激活的 entry
        let newHosts = ''
        const defEntry = defaultEntry.value

        if (defEntry) {
            newHosts = defEntry.content
        }

        for (const entry of activeEntries.value) {
            if (entry.name !== 'default') {
                newHosts += '\n#--------- ' + entry.name + ' ---------\n'
                newHosts += entry.content + '\n'
            }
        }
        console.info('newHosts: %s', newHosts);

        // 通过 hostsbox API 应用
        const result = await window.hostsbox.applyHosts(newHosts)
        if (!result.success) {
            throw new Error(result.msg)
        }
    }

    /**
     * 打开 hosts 目录
     */
    function openHostsDirectory() {
        const result = window.hostsbox.openHostsDir()
        if (!result.success) {
            ElMessage.error('打开目录失败：' + result.msg)
        }
    }

    /**
     * 清空当前选中状态
     */
    function clearCurrentSelection() {
        activeEntryId.value = ''
        currentContent.value = ''
        isReadOnly.value = true
    }

    /**
     * 切换 entry 的选中状态
     * @param {string} entryId - entry ID
     * @param {boolean} selected - 是否选中
     */
    function toggleEntrySelection(entryId, selected) {
        if (selected) {
            selectedEntryIds.value.add(entryId)
        } else {
            selectedEntryIds.value.delete(entryId)
        }
    }

    /**
     * 切换所有 entry 的选中状态
     * @param {boolean} selected - 是否选中
     */
    function toggleAllEntrySelection(selected) {
        if (selected) {
            // 选中所有自定义配置
            entries.value
                .filter(e => e.name !== 'default')
                .forEach(e => selectedEntryIds.value.add(e._id))
        } else {
            selectedEntryIds.value.clear()
        }
    }

    /**
     * 全部删除选中的 entry
     * @returns {Promise<boolean>} - 是否成功
     */
    async function deleteSelectedEntries() {
        const entriesToDelete = selectedEntries.value
        if (entriesToDelete.length === 0) {
            return true
        }

        // 检查是否有激活的 entry
        const hasActiveEntries = entriesToDelete.some(e => e.active)
        const message = hasActiveEntries
            ? `即将删除 ${entriesToDelete.length} 个配置，其中包括 ${entriesToDelete.filter(e => e.active).length} 个已激活的配置。删除后这些配置将失效，是否继续？`
            : `确认删除 ${entriesToDelete.length} 个配置？`

        // 使用 confirm 对话框
        if (!window.confirm(message)) {
            return false
        }

        // 记录被激活的 entry，用于失败时回滚
        const activatedEntryIds = entriesToDelete.filter(e => e.active).map(e => ({ id: e._id, rev: e._rev }))

        try {
            // 删除所有选中的 entry
            for (const entry of entriesToDelete) {
                const result = await window.hostsboxDB.deleteEntry(entry._id, entry._rev)
                if (!result.success) {
                    throw new Error(`删除 "${entry.name}" 失败：${result.msg}`)
                }
            }

            // 从本地列表中移除
            entries.value = entries.value.filter(e => !selectedEntryIds.value.has(e._id))

            // 如果删除了激活的 entry，需要重新应用 hosts
            if (hasActiveEntries) {
                try {
                    await applyHostsToSystem()
                    // 如果当前在"系统 Hosts"页面，刷新显示内容
                    if (activeTab.value === 'system') {
                        selectSystemHosts()
                    }
                } catch (error) {
                    ElMessage.error('应用 hosts 失败：' + error.message)
                    // 回滚删除（简化处理，只提示错误）
                    return false
                }
            }

            // 清空选中
            selectedEntryIds.value.clear()

            ElMessage.success(`成功删除 ${entriesToDelete.length} 个配置`)
            return true
        } catch (error) {
            ElMessage.error('删除失败：' + error.message)
            return false
        }
    }

    /**
     * 全部生效选中的 entry
     * @returns {Promise<boolean>} - 是否成功
     */
    async function activateSelectedEntries() {
        const entriesToActivate = selectedEntries.value.filter(e => !e.active)
        if (entriesToActivate.length === 0) {
            ElMessage.info('选中的配置都已处于激活状态')
            return true
        }

        try {
            // 先保存原始状态用于回滚
            const originalStates = new Map()
            for (const entry of entriesToActivate) {
                originalStates.set(entry._id, entry.active)
            }

            // 先在内存中更新状态，用于生成 hosts
            for (const entry of entriesToActivate) {
                const latestEntry = entries.value.find(e => e._id === entry._id)
                if (!latestEntry) continue
                latestEntry.active = true
            }

            // 重新生成 hosts 并应用到系统
            try {
                await applyHostsToSystem()
            } catch (error) {
                console.info('[useHostsEntries.js] 批量生效 error: ', error);
                // 判断是否是用户取消操作
                if (error.message && error.message.includes('cancel')) {
                    ElMessage.info('用户取消授权，终止 hosts 变更')
                    // 用户取消时，只回滚 UI 状态，不更新数据库
                    for (const entry of entriesToActivate) {
                        const latestEntry = entries.value.find(e => e._id === entry._id)
                        if (!latestEntry) continue
                        const originalState = originalStates.get(entry._id)
                        latestEntry.active = originalState
                    }
                    return false
                } else {
                    ElMessage.error('应用 hosts 失败：' + error.message)
                    // 其他错误时，回滚 UI 状态，不更新数据库（因为还没更新过）
                    for (const entry of entriesToActivate) {
                        const latestEntry = entries.value.find(e => e._id === entry._id)
                        if (!latestEntry) continue
                        const originalState = originalStates.get(entry._id)
                        latestEntry.active = originalState
                    }
                    return false
                }
            }

            // 应用成功后，才更新数据库状态
            for (const entry of entriesToActivate) {
                const latestEntry = entries.value.find(e => e._id === entry._id)
                if (!latestEntry) continue

                const result = await window.hostsboxDB.updateEntry({
                    ...latestEntry,
                    active: true
                })

                if (!result.success) {
                    throw new Error(`激活 "${entry.name}" 失败：${result.msg}`)
                }

                latestEntry._rev = result.rev
            }

            // 如果当前在"系统 Hosts"页面，刷新显示内容
            if (activeTab.value === 'system') {
                selectSystemHosts()
            }

            ElMessage.success(`成功激活 ${entriesToActivate.length} 个配置`)
            return true
        } catch (error) {
            ElMessage.error('激活失败：' + error.message)
            return false
        }
    }

    /**
     * 全部失效选中的 entry
     * @returns {Promise<boolean>} - 是否成功
     */
    async function deactivateSelectedEntries() {
        const entriesToDeactivate = selectedEntries.value.filter(e => e.active)
        if (entriesToDeactivate.length === 0) {
            ElMessage.info('选中的配置都未激活')
            return true
        }

        try {
            // 先保存原始状态用于回滚
            const originalStates = new Map()
            for (const entry of entriesToDeactivate) {
                originalStates.set(entry._id, entry.active)
            }

            // 先在内存中更新状态，用于生成 hosts
            for (const entry of entriesToDeactivate) {
                const latestEntry = entries.value.find(e => e._id === entry._id)
                if (!latestEntry) continue
                latestEntry.active = false
            }

            // 重新生成 hosts 并应用到系统
            try {
                await applyHostsToSystem()
            } catch (error) {
                console.info('[useHostsEntries.js] 批量失效 error: ', error);
                // 判断是否是用户取消操作
                if (error.message && error.message.includes('cancel')) {
                    ElMessage.info('用户取消授权，终止 hosts 变更')
                    // 用户取消时，只回滚 UI 状态，不更新数据库
                    for (const entry of entriesToDeactivate) {
                        const latestEntry = entries.value.find(e => e._id === entry._id)
                        if (!latestEntry) continue
                        const originalState = originalStates.get(entry._id)
                        latestEntry.active = originalState
                    }
                    return false
                } else {
                    ElMessage.error('应用 hosts 失败：' + error.message)
                    // 其他错误时，回滚 UI 状态，不更新数据库（因为还没更新过）
                    for (const entry of entriesToDeactivate) {
                        const latestEntry = entries.value.find(e => e._id === entry._id)
                        if (!latestEntry) continue
                        const originalState = originalStates.get(entry._id)
                        latestEntry.active = originalState
                    }
                    return false
                }
            }

            // 应用成功后，才更新数据库状态
            for (const entry of entriesToDeactivate) {
                const latestEntry = entries.value.find(e => e._id === entry._id)
                if (!latestEntry) continue

                const result = await window.hostsboxDB.updateEntry({
                    ...latestEntry,
                    active: false
                })

                if (!result.success) {
                    throw new Error(`失效 "${entry.name}" 失败：${result.msg}`)
                }

                latestEntry._rev = result.rev
            }

            // 如果当前在"系统 Hosts"页面，刷新显示内容
            if (activeTab.value === 'system') {
                selectSystemHosts()
            }

            ElMessage.success(`成功失效 ${entriesToDeactivate.length} 个配置`)
            return true
        } catch (error) {
            ElMessage.error('失效失败：' + error.message)
            return false
        }
    }

    /**
     * 清空当前选中状态（自定义配置列表）
     */
    function openHostsDirectory() {
        const result = window.hostsbox.openHostsDir()
        if (!result.success) {
            ElMessage.error('打开目录失败：' + result.msg)
        }
    }

    /**
     * 清空当前选中状态
     */
    function clearCurrentSelection() {
        activeEntryId.value = ''
        currentContent.value = ''
        isReadOnly.value = true
    }

    return {
        // 状态
        entries,
        systemHosts,
        activeTab,
        activeEntryId,
        currentContent,
        isReadOnly,
        currentTitle,
        activeEntries,
        defaultEntry,
        isEditingDefault,
        selectedEntryIds,
        selectedCount,
        hasSelection,

        // 方法
        initApp,
        selectSystemHosts,
        selectDefault,
        editDefault,
        saveDefault,
        saveDefaultAndApply,
        selectEntry,
        getCurrentEntry,
        createEntry,
        saveCurrentEntry,
        deleteEntry,
        toggleEntryActive,
        applyHostsToSystem,
        openHostsDirectory,
        clearCurrentSelection,
        toggleEntrySelection,
        toggleAllEntrySelection,
        deleteSelectedEntries,
        activateSelectedEntries,
        deactivateSelectedEntries
    }
}
