<template>
    <div class="main-container" :style="{ '--zoom-level': zoomLevel }">
        <!-- 左侧边栏 -->
        <aside class="sidebar">
            <div class="sidebar-fixed">
                <!-- 系统 Hosts -->
                <div class="nav-item" :class="{ active: activeTab === 'system' }" @click="handleMenuSelect('system')">
                    <el-icon><Monitor /></el-icon>
                    <span>系统 Hosts</span>
                </div>

                <!-- 默认配置 -->
                <div class="nav-item" :class="{ active: activeTab === 'default' }" @click="handleMenuSelect('default')">
                    <el-icon><Document /></el-icon>
                    <span>默认</span>
                    <el-button
                        v-if="activeTab === 'default'"
                        type="success"
                        size="small"
                        @click.stop="handleDefaultButtonClick">
                        {{ isEditingDefault ? '保存生效' : '编辑' }}
                    </el-button>
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
                <div v-for="entry in entries.filter(e => e.name !== 'default')" :key="entry._id" class="nav-item"
                    :class="{ active: activeEntryId === entry._id }" @click="handleMenuSelect(entry._id)">
                    <el-checkbox
                        :model-value="selectedEntryIds.has(entry._id)"
                        @click.stop
                        @change="(val) => toggleEntrySelection(entry._id, val)"
                        class="entry-checkbox" />
                    <el-icon><Document /></el-icon>
                    <span>{{ entry.name }}</span>
                    <el-switch :model-value="getEntrySwitchState(entry)" @click.stop
                        @change="(val) => handleToggleEntryActive(entry, val)" class="entry-switch" size="small" />
                </div>

                <div v-if="entries.filter(e => e.name !== 'default').length === 0" class="empty-state">
                    <span>暂无配置</span>
                </div>
            </div>

            <!-- 批量操作栏 -->
            <div v-if="hasSelection" class="batch-actions">
                <span class="selected-count">已选中 {{ selectedCount }} 项</span>
                <el-button type="danger" size="small" @click="handleBatchDelete" title="删除全部">
                    <el-icon><Delete /></el-icon>
                </el-button>
                <el-button type="success" size="small" @click="handleBatchActivate" title="全部生效">
                    <el-icon><Select /></el-icon>
                </el-button>
                <el-button type="warning" size="small" @click="handleBatchDeactivate" title="全部失效">
                    <el-icon><Close /></el-icon>
                </el-button>
            </div>
        </aside>

        <!-- 右侧内容区 -->
        <main class="content-area">
            <!-- 顶部工具栏 -->
            <div v-if="activeEntryId && !isReadOnly" class="editor-toolbar">
                <el-button type="danger" size="small" :icon="Delete" @click="confirmDeleteEntry">删除配置</el-button>
            </div>
            <div ref="editorRef" class="editor-area"></div>
        </main>

        <!-- 新增配置对话框 -->
        <el-dialog v-model="addDialogVisible" title="新增 Hosts 配置" width="400px">
            <el-form :model="newEntry" label-width="80px" @submit.prevent="confirmAddEntry">
                <el-form-item label="配置名称">
                    <el-input v-model="newEntry.name" placeholder="输入配置名称，如：开发环境" @keyup.enter.prevent="confirmAddEntry" />
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
                <el-button @click="handleCancelDialog">取消</el-button>
                <el-button type="primary" @click="handleConfirm">确定</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Check, Delete, Monitor, Document, Select, Close, CircleCheck } from '@element-plus/icons-vue'
import { useHostsEntries } from '../composables/useHostsEntries.js'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { StreamLanguage } from '@codemirror/language'
import { properties } from '@codemirror/legacy-modes/mode/properties'

// 防抖保存定时器
let saveTimer = null
const AUTO_SAVE_DELAY = 800 // 自动保存延迟（毫秒）

// 使用 composable
const {
    entries,
    systemHosts,
    activeTab,
    activeEntryId,
    currentContent,
    isReadOnly,
    currentTitle,
    defaultEntry,
    isEditingDefault,
    selectedEntryIds,
    selectedCount,
    hasSelection,
    createEntry,
    saveCurrentEntry,
    deleteEntry,
    toggleEntryActive,
    selectSystemHosts,
    selectDefault,
    editDefault,
    saveDefault,
    saveDefaultAndApply,
    selectEntry,
    getCurrentEntry,
    clearCurrentSelection,
    toggleEntrySelection,
    toggleAllEntrySelection,
    deleteSelectedEntries,
    activateSelectedEntries,
    deactivateSelectedEntries,
    initApp
} = useHostsEntries()



// 对话框状态
const addDialogVisible = ref(false)
const confirmDialogVisible = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmAction = ref(null)

// 开关的临时状态，用于在确认对话框显示期间保持原始状态
const pendingEntryToggle = ref(null)

// 新增配置表单
const newEntry = ref({
    name: ''
})

// 编辑器引用和实例
const editorRef = ref(null)
let editorView = null
let isUpdatingFromWatch = false

// 缩放功能
const zoomLevel = ref(1)
const MIN_ZOOM = 0.8
const MAX_ZOOM = 1.5
const ZOOM_STEP = 0.1

// 初始化
onMounted(async () => {
    await initApp()
    document.addEventListener('keyup', handleKeyPress)
    document.addEventListener('wheel', handleWheel, { passive: false })
    nextTick(() => {
        initEditor()
    })
})

onBeforeUnmount(() => {
    document.removeEventListener('keyup', handleKeyPress)
    document.removeEventListener('wheel', handleWheel)
    if (saveTimer) {
        clearTimeout(saveTimer)
    }
    if (editorView) {
        editorView.destroy()
    }
})

// 监听当前内容变化，用于更新编辑器
watch(currentContent, (newContent) => {
    if (editorView && !isUpdatingFromWatch) {
        isUpdatingFromWatch = true
        const transaction = editorView.state.update({
            changes: {
                from: 0,
                to: editorView.state.doc.length,
                insert: newContent || ''
            }
        })
        editorView.dispatch(transaction)
        nextTick(() => {
            isUpdatingFromWatch = false
        })
    }
})

// 初始化编辑器
function initEditor() {
    nextTick(() => {
        if (editorRef.value) {
            const extensions = [
                basicSetup,
                oneDark,
                StreamLanguage.define(properties),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged && !isUpdatingFromWatch) {
                        currentContent.value = update.state.doc.toString()
                        // 自动保存（防抖）
                        triggerAutoSave()
                    }
                }),
                EditorView.theme({
                    '&': {
                        height: '100%'
                    },
                    '.cm-scroller': {
                        overflow: 'auto',
                        fontFamily: "'Liberation Mono', 'DejaVu Sans Mono', 'Noto Mono', monospace"
                    },
                    '.cm-content': {
                        fontFamily: "'Liberation Mono', 'DejaVu Sans Mono', 'Noto Mono', monospace"
                    }
                }),
                EditorState.readOnly.of(isReadOnly.value)
            ]

            editorView = new EditorView({
                state: EditorState.create({
                    doc: currentContent.value || '',
                    extensions: extensions
                }),
                parent: editorRef.value
            })
        }
    })
}

// 触发自动保存（防抖）
function triggerAutoSave() {
    // 只在编辑自定义配置时自动保存
    if (isReadOnly.value || !activeEntryId.value) {
        return
    }

    if (saveTimer) {
        clearTimeout(saveTimer)
    }

    saveTimer = setTimeout(async () => {
        const success = await saveCurrentEntry()
        if (success) {
            // 使用更轻量的提示方式，或者完全不提示（可选）
            // ElMessage.success('已自动保存')
        }
    }, AUTO_SAVE_DELAY)
}

// 监听只读状态变化
watch(isReadOnly, (newVal) => {
    if (editorView) {
        const readOnlyExtension = EditorState.readOnly.of(newVal)
        // 重新创建编辑器以应用新的只读状态
        const newExtensions = [
            basicSetup,
            oneDark,
            StreamLanguage.define(properties),
            EditorView.updateListener.of((update) => {
                if (update.docChanged && !isUpdatingFromWatch) {
                    currentContent.value = update.state.doc.toString()
                    // 自动保存（防抖）
                    triggerAutoSave()
                }
            }),
            EditorView.theme({
                '&': {
                    height: '100%'
                },
                '.cm-scroller': {
                    overflow: 'auto',
                    fontFamily: "'Liberation Mono', 'DejaVu Sans Mono', 'Noto Mono', monospace"
                },
                '.cm-content': {
                    fontFamily: "'Liberation Mono', 'DejaVu Sans Mono', 'Noto Mono', monospace"
                }
            }),
            readOnlyExtension
        ]
        editorView.destroy()
        editorView = new EditorView({
            state: EditorState.create({
                doc: currentContent.value || '',
                extensions: newExtensions
            }),
            parent: editorRef.value
        })
    }
})

// 菜单选择处理
function handleMenuSelect(index) {
    if (index === 'system') {
        selectSystemHosts()
        nextTick(() => {
            initEditorIfNeeded()
        })
    } else if (index === 'default') {
        selectDefault()
        nextTick(() => {
            initEditorIfNeeded()
        })
    } else {
        selectEntry(index)
        nextTick(() => {
            initEditorIfNeeded()
        })
    }
}

// 处理默认配置按钮点击
async function handleDefaultButtonClick() {
    if (isEditingDefault.value) {
        // 点击"保存生效"，保存并应用到系统
        await saveDefaultAndApply()
    } else {
        // 点击"编辑"，进入编辑模式
        editDefault()
        nextTick(() => {
            initEditorIfNeeded()
        })
    }
}

// 初始化编辑器（如果需要）
function initEditorIfNeeded() {
    if (!editorView && editorRef.value) {
        initEditor()
    }
}

// 打开 hosts 目录
function openHostsDirectory() {
    const result = window.hostsbox.openHostsDir()
    if (!result.success) {
        ElMessage.error('打开目录失败：' + result.msg)
    }
}



// 显示新增配置对话框
function showAddEntryDialog() {
    newEntry.value.name = ''
    addDialogVisible.value = true

    // Dialog 可能有异步动画，需要延迟执行 focus
    setTimeout(() => {
        const inputs = document.querySelectorAll('.el-input__inner')
        if (inputs.length > 0) {
            const lastInput = inputs[inputs.length - 1]
            lastInput.focus()
        }
    }, 100)
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
            if (editorView) {
                editorView.focus()
            }
        })
    }
}

// 获取 entry 的开关显示状态
function getEntrySwitchState(entry) {
    // 如果当前有待处理的切换操作，返回临时状态
    if (pendingEntryToggle.value && pendingEntryToggle.value.entryId === entry._id) {
        return pendingEntryToggle.value.newState
    }
    // 否则返回实际状态
    return entry.active
}

// 切换配置激活状态（带确认）
function handleToggleEntryActive(entry, newState) {
    const actionName = newState ? '激活' : '失效'

    // 记录待处理的切换操作
    pendingEntryToggle.value = {
        entryId: entry._id,
        newState: newState,
        originalState: entry.active
    }

    confirmTitle.value = `确认${actionName}配置`
    confirmMessage.value = `${actionName} "${entry.name}" 将修改系统 hosts 文件${newState ? '，需要管理员权限' : ''}。是否继续？`
    confirmAction.value = async () => {
        const success = await toggleEntryActive(entry, newState)
        if (success) {
            ElMessage.success(`${actionName}配置成功`)
            // 清除待处理状态
            pendingEntryToggle.value = null
        } else {
            // 如果失败，清除待处理状态，开关会自动恢复原状态
            pendingEntryToggle.value = null
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

// 处理取消对话框
function handleCancelDialog() {
    // 清除待处理的切换操作，开关会自动恢复原状态
    pendingEntryToggle.value = null
    confirmDialogVisible.value = false
    confirmAction.value = null
}

// 批量删除选中的 entry
async function handleBatchDelete() {
    const success = await deleteSelectedEntries()
    if (success) {
        // 清空当前选中的 entry（如果它被删除了）
        const currentEntry = getCurrentEntry()
        if (currentEntry && selectedEntryIds.value.has(currentEntry._id)) {
            clearCurrentSelection()
        }
    }
}

// 批量生效选中的 entry
async function handleBatchActivate() {
    await activateSelectedEntries()
}

// 批量失效选中的 entry
async function handleBatchDeactivate() {
    await deactivateSelectedEntries()
}

// 处理编辑器失焦，自动保存
async function handleEditorBlur() {
    if (activeEntryId.value && !isReadOnly.value) {
        await saveCurrentEntry()
    }
}

// 处理按键事件
function handleKeyPress(event) {
    // Ctrl+S 保存
    if (event.ctrlKey && (event.key === 's' || event.key === 'S')) {
        event.preventDefault()
        if (activeTab.value === 'default' && isEditingDefault.value) {
            saveDefaultEntry()
        } else if (activeEntryId.value) {
            saveEntry()
        }
    }
}

// 保存默认配置（包装方法以匹配现有逻辑）
async function saveDefaultEntry() {
    await saveDefault()
}

// 处理鼠标滚轮缩放
function handleWheel(event) {
    // 只有在按住 Ctrl 键时才处理缩放
    if (event.ctrlKey) {
        event.preventDefault()

        if (event.deltaY < 0) {
            // 向上滚动，放大
            zoomLevel.value = Math.min(zoomLevel.value + ZOOM_STEP, MAX_ZOOM)
        } else {
            // 向下滚动，缩小
            zoomLevel.value = Math.max(zoomLevel.value - ZOOM_STEP, MIN_ZOOM)
        }
    }
}
</script>

<style scoped>
@import '../assets/Hosts.css';
</style>
