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
      content: `#--------- ${name} ---------\n# 在此编辑 hosts 配置\n`,
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
    const result = await window.hostsboxDB.updateEntry({
            ...entry,
            active: newState
        })

        if (!result.success) {
            ElMessage.error('操作失败：' + result.msg)
            return false
        }

        // 更新本地数据
        entry.active = newState
        entry._rev = result.rev

        // 重新生成 hosts 并应用到系统
        try {
            await applyHostsToSystem()
        } catch (error) {
            ElMessage.error('生效失败：' + error.message)
            // 回滚状态
            entry.active = !newState
            await window.hostsboxDB.updateEntry({
                ...entry,
                active: !newState
            })
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
                newHosts += '\n# ' + entry.name + '\n'
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
        clearCurrentSelection
    }
}
