<template>
    <div class="main-container">
        <!-- 左侧边栏 -->
        <aside class="sidebar">
            <div class="sidebar-fixed">
                <!-- 系统 Hosts -->
                <div class="nav-item" :class="{ active: activeTab === 'system' }" @click="handleMenuSelect('system')">
                    <el-icon><Monitor /></el-icon>
                    <span>系统 Hosts</span>
                </div>

                <div class="divider" />

                <!-- 自定义配置标题 -->
                <div class="section-header">
                    <span>自定义配置</span>
                    <el-button type="primary" size="small" :icon="Plus" @click="showAddEntryDialog" circle />
                </div>
            </div>

            <!-- 自定义配置列表 -->
            <div class="sidebar-scroll" style="margin: 0; padding: 0;">
                <div v-for="entry in entries" :key="entry._id" class="nav-item"
                    :class="{ active: activeEntryId === entry._id }" @click="handleMenuSelect(entry._id)">
                    <el-icon><Document /></el-icon>
                    <span>{{ entry.name }}</span>
                    <el-switch v-model="entry.active" @click.stop
                        @change="(val) => handleToggleEntryActive(entry, val)" class="entry-switch" size="small" />
                </div>

                <div v-if="entries.length === 0" class="empty-state">
                    <span>暂无配置</span>
                </div>
            </div>
        </aside>

        <!-- 右侧内容区 -->
        <main class="content-area">
            <div class="editor-area">
                <pre class="language-hosts line-numbers"><code ref="highlightRef" class="language-hosts" contenteditable="true" @input="handleEditorInput" @blur="handleEditorBlur">{{ currentContent }}</code></pre>
            </div>
        </main>

        <!-- 新增配置对话框 -->
        <el-dialog v-model="addDialogVisible" title="新增 Hosts 配置" width="400px">
            <el-form :model="newEntry" label-width="80px">
                <el-form-item label="配置名称">
                    <el-input v-model="newEntry.name" placeholder="输入配置名称，如：开发环境" @keyup.enter="confirmAddEntry" />
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
    </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Check, Delete, Monitor, Document } from '@element-plus/icons-vue'
import { useHostsEntries } from '../composables/useHostsEntries.js'
import Prism from 'prismjs'
import 'prismjs/themes/prism-tomorrow.css'
import 'prismjs/plugins/line-numbers/prism-line-numbers.css'
import 'prismjs/plugins/line-numbers/prism-line-numbers.js'

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
const highlightRef = ref(null)
const isEditing = ref(false)

// 初始化
onMounted(async () => {
    await initApp()
    document.addEventListener('keyup', handleKeyPress)
    highlightCode()
})

onBeforeUnmount(() => {
    document.removeEventListener('keyup', handleKeyPress)
})

// 菜单选择处理
function handleMenuSelect(index) {
    if (index === 'system') {
        selectSystemHosts()
        nextTick(() => {
            highlightCode()
        })
    } else {
        selectEntry(index)
    }
}

// 打开 hosts 目录
function openHostsDirectory() {
    const result = window.hostsbox.openHostsDir()
    if (!result.success) {
        ElMessage.error('打开目录失败：' + result.msg)
    }
}

// 监听当前内容变化，用于高亮显示
watch([currentContent, activeTab], () => {
    nextTick(() => {
        highlightCode()
    })
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
            if (highlightRef.value) {
                highlightRef.value.focus()
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

// 处理确认对话框
async function handleConfirm() {
    if (confirmAction.value) {
        await confirmAction.value()
    }
    confirmDialogVisible.value = false
    confirmAction.value = null
}

// 处理编辑器输入
function handleEditorInput(e) {
    currentContent.value = e.target.textContent
    highlightCode()
}

// 处理编辑器失焦，自动保存
async function handleEditorBlur() {
    if (activeEntryId.value && !isReadOnly.value) {
        await saveCurrentEntry()
    }
}

// 高亮代码
function highlightCode() {
    nextTick(() => {
        if (highlightRef.value) {
            Prism.highlightElement(highlightRef.value)
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

<style scoped>
@import './Hosts.css';
</style>
