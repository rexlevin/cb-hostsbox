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

  // 计算属性
  const currentTitle = computed(() => {
    if (activeTab.value === 'system') {
      return '系统 Hosts（只读）'
    }
    const entry = entries.value.find(e => e._id === activeEntryId.value)
    return entry ? `编辑：${entry.name}` : '请选择配置'
  })

  const activeEntries = computed(() => {
    return entries.value.filter(e => e.active)
  })

  /**
   * 初始化应用
   */
  async function initApp() {
    try {
      // 加载所有配置
      const result = await window.hostsboxDB.getAllEntries()
      if (result.success) {
        entries.value = result.data
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
   * 选择系统 hosts
   */
  function selectSystemHosts() {
    activeTab.value = 'system'
    activeEntryId.value = ''
    currentContent.value = systemHosts.value
    isReadOnly.value = true
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
    const entry = {
      name,
      content: `# ${name}\n# 在此编辑 hosts 配置\n`,
      active: false
    }

    const result = await window.hostsboxDB.createEntry(entry)
    if (!result.success) {
      ElMessage.error('创建配置失败：' + result.msg)
      return null
    }

    // 更新本地数据
    entries.value.push({
      ...entry,
      _id: result.id,
      _rev: result.rev
    })

    ElMessage.success('配置创建成功')
    return result.id
  }

  /**
   * 保存当前配置内容
   * @returns {Promise<boolean>} - 是否成功
   */
  async function saveCurrentEntry() {
    const entry = getCurrentEntry()
    if (!entry) {
      return false
    }

    const result = await window.hostsboxDB.updateEntry({
      ...entry,
      content: currentContent.value
    })

    if (!result.success) {
      ElMessage.error('保存失败：' + result.msg)
      return false
    }

    entry.content = currentContent.value
    ElMessage.success('保存成功')
    return true
  }

  /**
   * 删除配置
   * @param {Object} entry - 要删除的配置
   * @returns {Promise<boolean>} - 是否成功
   */
  async function deleteEntry(entry) {
    const result = await window.hostsboxDB.deleteEntry(entry._id, entry._rev)
    if (!result.success) {
      ElMessage.error('删除失败：' + result.msg)
      return false
    }

    // 如果配置是激活的，需要重新应用 hosts
    const wasActive = entry.active
    entries.value = entries.value.filter(e => e._id !== entry._id)

    if (wasActive) {
      await applyHostsToSystem()
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
    await applyHostsToSystem()

    return true
  }

  /**
   * 应用 hosts 到系统
   */
  async function applyHostsToSystem() {
    // 生成新的 hosts 内容
    let newHosts = '# ========== HostsBox Managed ==========\n'
    for (const entry of activeEntries.value) {
      newHosts += '\n# ' + entry.name + '\n'
      newHosts += entry.content + '\n'
    }
    newHosts += '\n# ========== End of HostsBox ==========\n'

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

    // 方法
    initApp,
    selectSystemHosts,
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
