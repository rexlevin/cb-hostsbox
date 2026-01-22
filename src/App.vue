<template>
  <div class="main-container">
    <!-- 左侧边栏 -->
    <div class="sidebar">
      <div class="sidebar-header">
        <h2>Hosts 配置</h2>
        <el-button type="primary" size="small" :icon="Plus" @click="showAddEntryDialog" circle />
      </div>

      <div class="nav-list">
        <div class="section-title">系统</div>
        <div
          class="nav-item"
          :class="{ active: activeTab === 'system' }"
          @click="selectSystemHosts"
        >
          <div class="nav-item-icon">
            <el-icon><Monitor /></el-icon>
            <span class="nav-item-text">系统 Hosts</span>
          </div>
        </div>

        <div class="section-title">自定义</div>
        <div
          v-for="entry in entries"
          :key="entry._id"
          class="nav-item"
          :class="{ active: activeEntryId === entry._id }"
          @click="selectEntry(entry._id)"
          @contextmenu.prevent="showContextMenu($event, entry)"
        >
          <div class="nav-item-text">{{ entry.name }}</div>
          <button
            class="toggle-btn"
            :class="{ active: entry.active }"
            @click.stop="toggleEntryActive(entry)"
            :title="entry.active ? '点击失效' : '点击激活'"
          >
            {{ entry.active ? '✓' : '○' }}
          </button>
        </div>

        <div v-if="entries.length === 0" class="nav-item" style="color: #909399; cursor: default;">
          <span class="nav-item-text">暂无配置</span>
        </div>
      </div>
    </div>

    <!-- 右侧内容区 -->
    <div class="content-area">
      <div class="content-header">
        <h3>{{ currentTitle }}</h3>
        <div class="content-actions">
          <el-button v-if="activeTab === 'system'" :icon="FolderOpened" @click="openHostsDirectory">
            打开 Hosts 目录
          </el-button>
          <template v-if="activeTab !== 'system'">
            <el-button type="primary" :icon="Check" @click="saveEntry">保存</el-button>
            <el-button :icon="Delete" type="danger" @click="confirmDeleteEntry" v-if="activeEntryId">
              删除
            </el-button>
          </template>
        </div>
      </div>

      <div class="editor-container">
        <textarea
          v-if="!isReadOnly"
          ref="editorRef"
          class="hosts-editor"
          v-model="currentContent"
          @input="handleEditorInput"
          placeholder="# 在此编辑 hosts 配置..."
        ></textarea>
        <pre v-else class="language-hosts"><code ref="highlightRef" class="language-hosts">{{ currentContent }}</code></pre>
      </div>
    </div>

    <!-- 新增配置对话框 -->
    <el-dialog v-model="addDialogVisible" title="新增 Hosts 配置" width="400px">
      <el-form :model="newEntry" label-width="80px">
        <el-form-item label="配置名称">
          <el-input
            v-model="newEntry.name"
            placeholder="输入配置名称，如：开发环境"
            @keyup.enter="confirmAddEntry"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmAddEntry">确定</el-button>
      </template>
    </el-dialog>

    <!-- 确认对话框 -->
    <el-dialog v-model="confirmDialogVisible" :title="confirmTitle" width="400px">
      <p>{{ confirmMessage }}</p>
      <template #footer>
        <el-button @click="confirmDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleConfirm">确定</el-button>
      </template>
    </el-dialog>

    <!-- 右键菜单 -->
    <div
      v-if="contextMenuVisible"
      class="context-menu"
      :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
    >
      <div class="context-menu-item" @click="toggleEntryActive(contextMenuEntry)">
        {{ contextMenuEntry?.active ? '失效配置' : '激活配置' }}
      </div>
      <div class="context-menu-item danger" @click="deleteEntryFromMenu">删除配置</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Check, Delete, Monitor, Setting, FolderOpened } from '@element-plus/icons-vue'
import Prism from 'prismjs'

// 数据状态
const activeTab = ref('system')
const activeEntryId = ref('')
const entries = ref([])
const currentContent = ref('')
const systemHosts = ref('')
const isReadOnly = ref(true)

// 对话框状态
const addDialogVisible = ref(false)
const confirmDialogVisible = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmAction = ref(null)

// 新增配置表单
const newEntry = ref({
  name: ''
})

// 右键菜单
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuEntry = ref(null)

// 编辑器引用
const editorRef = ref(null)
const highlightRef = ref(null)

// 计算属性
const currentTitle = computed(() => {
  if (activeTab.value === 'system') {
    return '系统 Hosts（只读）'
  }
  const entry = entries.value.find(e => e._id === activeEntryId.value)
  return entry ? `编辑：${entry.name}` : '请选择配置'
})

// 初始化
onMounted(async () => {
  await initApp()
  document.addEventListener('click', hideContextMenu)
  document.addEventListener('keyup', handleKeyPress)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', hideContextMenu)
  document.removeEventListener('keyup', handleKeyPress)
})

// 初始化应用
async function initApp() {
  try {
    // 从数据库加载所有配置
    await loadEntries()

    // 尝试获取系统 hosts
    try {
      if (window.hostsbox && window.hostsbox.getHosts) {
        const result = window.hostsbox.getHosts() // 同步调用
        if (result.success) {
          systemHosts.value = result.data
        } else {
          systemHosts.value = `# 获取系统 hosts 失败\n# 错误: ${result.msg}\n`
        }
      } else {
        systemHosts.value = '# 系统 hosts 文件\n# hostsbox API 未初始化\n'
      }
    } catch (e) {
      console.error('获取系统 hosts 失败:', e)
      systemHosts.value = '# 系统 hosts 文件\n# 错误: ' + e.message + '\n'
    }

    // 默认显示系统 hosts
    selectSystemHosts()
  } catch (error) {
    ElMessage.error('初始化失败：' + error.message)
  }
}

// 加载所有配置
async function loadEntries() {
  try {
    if (!window.canbox) {
      console.warn('canbox 未初始化')
      return
    }

    // 查询所有 hosts_entry 文档
    const result = await window.canbox.db.get({
      selector: {
        type: 'hosts_entry'
      }
    })

    if (result && result.docs) {
      entries.value = result.docs.map(doc => ({
        ...doc,
        active: doc.active || false
      }))
    }
  } catch (error) {
    console.error('加载配置失败：', error)
  }
}

// 选择系统 hosts
function selectSystemHosts() {
  activeTab.value = 'system'
  activeEntryId.value = ''
  currentContent.value = systemHosts.value
  isReadOnly.value = true
  highlightCode()
}

// 选择配置
function selectEntry(entryId) {
  activeTab.value = 'entry'
  activeEntryId.value = entryId
  const entry = entries.value.find(e => e._id === entryId)
  if (entry) {
    currentContent.value = entry.content || `# ${entry.name}\n# 在此编辑 hosts 配置\n`
    isReadOnly.value = false
    nextTick(() => {
      if (editorRef.value) {
        editorRef.value.focus()
      }
    })
  }
}

// 显示新增配置对话框
function showAddEntryDialog() {
  newEntry.value.name = ''
  addDialogVisible.value = true
  nextTick(() => {
    const input = document.querySelector('.el-dialog input')
    if (input) input.focus()
  })
}

// 确认新增配置
async function confirmAddEntry() {
  const name = newEntry.value.name.trim()
  if (!name) {
    ElMessage.warning('请输入配置名称')
    return
  }

  try {
    const entry = {
      type: 'hosts_entry',
      name: name,
      content: `# ${name}\n# 在此编辑 hosts 配置\n`,
      active: false,
      createTime: Date.now()
    }

    const result = await window.canbox.db.put(entry)

    // 更新本地数据
    entries.value.push({
      ...entry,
      _id: result.id,
      _rev: result.rev
    })

    addDialogVisible.value = false
    ElMessage.success('配置创建成功')

    // 自动选中新创建的配置
    selectEntry(result.id)
  } catch (error) {
    ElMessage.error('创建配置失败：' + error.message)
  }
}

// 切换配置激活状态
async function toggleEntryActive(entry) {
  const newState = !entry.active

  // 如果激活配置，需要危险操作确认
  if (newState) {
    confirmTitle.value = '确认激活配置'
    confirmMessage.value = `激活 "${entry.name}" 将修改系统 hosts 文件，需要管理员权限。是否继续？`
    confirmAction.value = async () => {
      await performToggleActive(entry, newState)
    }
    confirmDialogVisible.value = true
  } else {
    // 失效操作也提示
    confirmTitle.value = '确认失效配置'
    confirmMessage.value = `失效 "${entry.name}" 将修改系统 hosts 文件。是否继续？`
    confirmAction.value = async () => {
      await performToggleActive(entry, newState)
    }
    confirmDialogVisible.value = true
  }
}

// 执行激活/失效
async function performToggleActive(entry, newState) {
  try {
    // 更新数据库
    await window.canbox.db.put({
      _id: entry._id,
      _rev: entry._rev,
      ...entry,
      active: newState
    })

    // 更新本地数据
    entry.active = newState
    entry._rev = (entry._rev ? parseInt(entry._rev.split('-')[0]) : 0) + 1 + '-' + Date.now()

    // 重新生成 hosts 并应用到系统
    await applyHostsToSystem()

    ElMessage.success(`${newState ? '激活' : '失效'}配置成功`)
  } catch (error) {
    ElMessage.error('操作失败：' + error.message)
  }
}

// 应用 hosts 到系统
async function applyHostsToSystem() {
  try {
    // 收集所有激活的配置
    const activeEntries = entries.value.filter(e => e.active)

    // 生成新的 hosts 内容
    let newHosts = '# ========== HostsBox Managed ==========\n'
    for (const entry of activeEntries) {
      newHosts += '\n# ' + entry.name + '\n'
      newHosts += entry.content + '\n'
    }
    newHosts += '\n# ========== End of HostsBox ==========\n'

    // 通过 hostsbox API 应用
    if (window.hostsbox && window.hostsbox.applyHosts) {
      const result = await window.hostsbox.applyHosts(newHosts)
      if (!result.success) {
        throw new Error(result.msg)
      }
    } else {
      throw new Error('hostsbox API 未初始化')
    }
  } catch (error) {
    console.error('应用 hosts 失败：', error)
    throw error
  }
}

// 保存配置内容
async function saveEntry() {
  if (!activeEntryId.value) {
    return
  }

  const entry = entries.value.find(e => e._id === activeEntryId.value)
  if (!entry) {
    return
  }

  try {
    await window.canbox.db.put({
      _id: entry._id,
      _rev: entry._rev,
      ...entry,
      content: currentContent.value
    })

    entry.content = currentContent.value
    ElMessage.success('保存成功')
  } catch (error) {
    ElMessage.error('保存失败：' + error.message)
  }
}

// 确认删除配置
function confirmDeleteEntry() {
  if (!activeEntryId.value) {
    return
  }

  const entry = entries.value.find(e => e._id === activeEntryId.value)
  if (!entry) {
    return
  }

  const message = entry.active
    ? `"${entry.name}" 当前处于激活状态，删除后将失效配置。是否确认删除？`
    : `确认删除配置 "${entry.name}"？`

  confirmTitle.value = '确认删除'
  confirmMessage.value = message
  confirmAction.value = async () => {
    await performDeleteEntry(entry)
  }
  confirmDialogVisible.value = true
}

// 执行删除配置
async function performDeleteEntry(entry) {
  try {
    // 删除数据库记录
    await window.canbox.db.remove({
      _id: entry._id,
      _rev: entry._rev
    })

    // 如果配置是激活的，需要重新应用 hosts
    if (entry.active) {
      entries.value = entries.value.filter(e => e._id !== entry._id)
      await applyHostsToSystem()
    } else {
      entries.value = entries.value.filter(e => e._id !== entry._id)
    }

    // 清空当前选中的配置
    activeEntryId.value = ''
    currentContent.value = ''
    isReadOnly.value = true

    ElMessage.success('删除成功')
  } catch (error) {
    ElMessage.error('删除失败：' + error.message)
  }
}

// 显示右键菜单
function showContextMenu(event, entry) {
  contextMenuEntry.value = entry
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  contextMenuVisible.value = true
}

// 隐藏右键菜单
function hideContextMenu() {
  contextMenuVisible.value = false
}

// 从右键菜单删除配置
function deleteEntryFromMenu() {
  if (contextMenuEntry.value) {
    confirmTitle.value = '确认删除'
    confirmMessage.value = `确认删除配置 "${contextMenuEntry.value.name}"？`
    confirmAction.value = async () => {
      await performDeleteEntry(contextMenuEntry.value)
    }
    confirmDialogVisible.value = true
  }
  hideContextMenu()
}

// 处理确认对话框
async function handleConfirm() {
  if (confirmAction.value) {
    await confirmAction.value()
  }
  confirmDialogVisible.value = false
  confirmAction.value = null
}

// 处理编辑器输入
function handleEditorInput() {
  // 可以在这里添加自动保存等逻辑
}

// 高亮代码
function highlightCode() {
  nextTick(() => {
    if (highlightRef.value) {
      // 简单的 hosts 语法高亮
      const content = currentContent.value
      const lines = content.split('\n')
      const highlighted = lines.map(line => {
        if (line.trim().startsWith('#')) {
          return `<span class="token comment">${escapeHtml(line)}</span>`
        } else if (line.trim() === '') {
          return '<span class="token hosts-line">&nbsp;</span>'
        } else {
          // 尝试匹配 IP 和域名
          const ipMatch = line.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+(.*)$/)
          if (ipMatch) {
            return `<span class="token ip">${ipMatch[1]}</span> <span class="token domain">${escapeHtml(ipMatch[2])}</span>`
          }
          return `<span class="token hosts-line">${escapeHtml(line)}</span>`
        }
      }).join('\n')

      highlightRef.value.innerHTML = highlighted
    }
  })
}

// HTML 转义
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// 处理按键事件
function handleKeyPress(event) {
  // Ctrl+S 保存
  if (event.ctrlKey && (event.key === 's' || event.key === 'S')) {
    event.preventDefault()
    if (activeEntryId.value) {
      saveEntry()
    }
  }
}

// 打开 hosts 目录
function openHostsDirectory() {
  try {
    if (window.hostsbox && window.hostsbox.openHostsDir) {
      const result = window.hostsbox.openHostsDir() // 同步调用
      if (!result.success) {
        ElMessage.error('打开目录失败：' + result.msg)
      }
    } else {
      ElMessage.error('hostsbox API 未初始化')
    }
  } catch (error) {
    ElMessage.error('打开目录失败：' + error.message)
  }
}
</script>
