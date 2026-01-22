<template>
  <el-container class="main-container">
    <!-- 左侧边栏 -->
    <el-aside width="280px" class="sidebar">
      <div class="sidebar-header">
        <span class="title">Hosts 配置</span>
        <el-button type="primary" size="small" :icon="Plus" @click="showAddEntryDialog" circle />
      </div>

      <el-scrollbar class="nav-scroll">
        <el-menu
          :default-active="activeTab === 'system' ? 'system' : activeEntryId"
          class="nav-menu"
          @select="handleMenuSelect"
        >
          <el-menu-item index="system">
            <el-icon><Monitor /></el-icon>
            <span>系统 Hosts</span>
          </el-menu-item>

          <el-divider style="margin: 8px 0" />

          <el-menu-item
            v-for="entry in entries"
            :key="entry._id"
            :index="entry._id"
          >
            <el-icon><Document /></el-icon>
            <span>{{ entry.name }}</span>
            <el-switch
              v-model="entry.active"
              @click.stop
              @change="(val) => handleToggleEntryActive(entry, val)"
              style="margin-left: auto"
              size="small"
            />
          </el-menu-item>

          <el-empty
            v-if="entries.length === 0"
            description="暂无配置"
            :image-size="60"
            style="padding: 20px"
          />
        </el-menu>
      </el-scrollbar>
    </el-aside>

    <!-- 右侧内容区 -->
    <el-main class="content-area">
      <el-page-header @back="selectSystemHosts" class="page-header">
        <template #content>
          <div class="page-header-content">
            <span class="title">{{ currentTitle }}</span>
            <div class="actions">
              <el-button v-if="activeTab === 'system'" :icon="FolderOpened" @click.stop="openHostsDirectory">
                打开目录
              </el-button>
              <template v-if="activeTab !== 'system'">
                <el-button type="primary" :icon="Check" @click="saveEntry">保存</el-button>
                <el-button :icon="Delete" type="danger" @click="confirmDeleteEntry" v-if="activeEntryId">
                  删除
                </el-button>
              </template>
            </div>
          </div>
        </template>
      </el-page-header>

      <div class="editor-container">
        <el-input
          v-if="!isReadOnly"
          ref="editorRef"
          type="textarea"
          :rows="20"
          v-model="currentContent"
          @input="handleEditorInput"
          placeholder="# 在此编辑 hosts 配置..."
          class="hosts-editor"
        />
        <div v-else class="readonly-editor">
          <pre><code ref="highlightRef" class="language-hosts">{{ currentContent }}</code></pre>
        </div>
      </div>
    </el-main>

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
  </el-container>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Check, Delete, Monitor, FolderOpened, Document } from '@element-plus/icons-vue'
import { useHostsEntries } from './composables/useHostsEntries.js'
import { highlightHosts } from './utils/hostsHighlight.js'

// 使用 composable
const {
  entries,
  systemHosts,
  activeTab,
  activeEntryId,
  currentContent,
  isReadOnly,
  currentTitle,
  createEntry,
  saveCurrentEntry,
  deleteEntry,
  toggleEntryActive,
  selectSystemHosts,
  selectEntry,
  getCurrentEntry,
  openHostsDirectory,
  clearCurrentSelection,
  initApp
} = useHostsEntries()

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

// 编辑器引用
const editorRef = ref(null)
const highlightRef = ref(null)

// 计算属性
// 已移动到 composable 中

// 初始化
onMounted(async () => {
  await initApp()
  document.addEventListener('keyup', handleKeyPress)
})

onBeforeUnmount(() => {
  document.removeEventListener('keyup', handleKeyPress)
})

// 菜单选择处理
function handleMenuSelect(index) {
  if (index === 'system') {
    selectSystemHosts()
  } else {
    selectEntry(index)
  }
}

// 监听当前内容变化，用于高亮显示
watch(currentContent, () => {
  if (activeTab.value === 'system') {
    highlightCode()
  }
})

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

  const entryId = await createEntry(name)
  if (entryId) {
    addDialogVisible.value = false
    selectEntry(entryId)
    nextTick(() => {
      if (editorRef.value) {
        editorRef.value.focus()
      }
    })
  }
}

// 切换配置激活状态（带确认）
function handleToggleEntryActive(entry, newState) {
  const actionName = newState ? '激活' : '失效'

  confirmTitle.value = `确认${actionName}配置`
  confirmMessage.value = `${actionName} "${entry.name}" 将修改系统 hosts 文件${newState ? '，需要管理员权限' : ''}。是否继续？`
  confirmAction.value = async () => {
    const success = await toggleEntryActive(entry, newState)
    if (success) {
      ElMessage.success(`${actionName}配置成功`)
    } else {
      // 如果失败，恢复开关状态
      entry.active = !newState
    }
  }
  confirmDialogVisible.value = true
}

// 保存配置内容
async function saveEntry() {
  await saveCurrentEntry()
}

// 确认删除配置
function confirmDeleteEntry() {
  const entry = getCurrentEntry()
  if (!entry) {
    return
  }

  const message = entry.active
    ? `"${entry.name}" 当前处于激活状态，删除后将失效配置。是否确认删除？`
    : `确认删除配置 "${entry.name}"？`

  confirmTitle.value = '确认删除'
  confirmMessage.value = message
  confirmAction.value = async () => {
    const success = await deleteEntry(entry)
    if (success) {
      clearCurrentSelection()
      ElMessage.success('删除成功')
    }
  }
  confirmDialogVisible.value = true
}

// 右键菜单已移除，使用菜单项内的操作

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
      highlightRef.value.innerHTML = highlightHosts(currentContent.value)
    }
  })
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
</script>
