<template>
    <div class="main-container" :style="{ '--zoom-level': zoomLevel }">
        <!-- 左侧边栏 -->
        <aside class="sidebar" :style="{ width: sidebarWidth + 'px' }">
            <div class="sidebar-fixed">
                <!-- 系统 Hosts -->
                <div class="nav-item" :class="{ active: activeTab === 'system' }" @click="handleMenuSelect('system')">
                    <el-icon><Monitor /></el-icon>
                    <span>系统 Hosts</span>
                    <el-tooltip content="设置（Ctrl+,）" placement="bottom">
                        <svg class="settings-button" viewBox="0 0 24 24" aria-label="设置" @click.stop="openHelpWindow">
                            <path
                                d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                        </svg>
                    </el-tooltip>
                </div>

                <!-- 默认配置 -->
                <div class="nav-item" :class="{ active: activeTab === 'default' }" @click="handleMenuSelect('default')">
                    <el-icon><Document /></el-icon>
                    <span>默认</span>
                    <el-button
                        type="success"
                        size="small"
                        class="default-edit-button"
                        @click.stop="handleDefaultButtonClick">
                        {{ isEditingDefault ? '保存生效' : '编辑' }}
                    </el-button>
                </div>

                <div class="divider" />

                <!-- 自定义配置标题 -->
                <div class="section-header">
                    <span>自定义配置</span>
                    <el-tooltip content="新增 ctrl+n" placement="bottom">
                        <el-button type="primary" size="small" :icon="Plus" @click="showAddEntryDialog" circle />
                    </el-tooltip>
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

        <!-- 左右分栏拖拽手柄 -->
        <div class="sidebar-resizer" title="拖动调整左侧栏宽度" @mousedown.prevent="startResize"></div>

        <!-- 右侧内容区 -->
        <main class="content-area">
            <!-- 顶部工具栏 -->
            <div class="editor-toolbar">
                <el-button v-if="activeEntryId && !isReadOnly" type="danger" size="small" :icon="Delete"
                    @click="confirmDeleteEntry">删除配置</el-button>
                <el-tooltip :content="wrapEnabled ? '关闭自动换行（Alt+Z）' : '开启自动换行（Alt+Z）'" placement="bottom">
                    <button type="button" class="wrap-btn" :class="{ on: wrapEnabled }"
                        :aria-label="wrapEnabled ? '关闭自动换行' : '开启自动换行'" @click="toggleWrap">换行</button>
                </el-tooltip>
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
import { EditorState, Compartment } from '@codemirror/state'
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

// 左侧栏宽度（可拖拽调整，持久化到 canbox store）
const sidebarWidth = ref(320)
const MIN_SIDEBAR_WIDTH = 220
const MAX_SIDEBAR_WIDTH = 640

// 编辑器自动换行
const wrapEnabled = ref(false)
const wrapCompartment = new Compartment()

// 初始化
onMounted(async () => {
    await initApp()

    // 恢复保存的缩放级别（使用 hostsbox API，异步 IPC）
    const savedZoom = await window.hostsbox.getZoomLevel()
    if (savedZoom !== null && savedZoom !== undefined) {
        zoomLevel.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, savedZoom))
        window.hostsbox.setZoom(zoomLevel.value)
    }

    // 恢复保存的左侧栏宽度
    const savedSidebarWidth = await window.hostsbox.getSidebarWidth()
    if (savedSidebarWidth !== null && savedSidebarWidth !== undefined) {
        sidebarWidth.value = clampSidebarWidth(savedSidebarWidth)
    }

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
                wrapCompartment.of(wrapExtension(wrapEnabled.value)),
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
            wrapCompartment.of(wrapExtension(wrapEnabled.value)),
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

// 自动换行扩展：开启时软换行，不出现横向滚动条
function wrapExtension(on) {
    return on ? EditorView.lineWrapping : []
}

// 切换自动换行
function toggleWrap() {
    wrapEnabled.value = !wrapEnabled.value
    if (editorView) {
        editorView.dispatch({
            effects: wrapCompartment.reconfigure(wrapExtension(wrapEnabled.value))
        })
    }
}

// 左侧栏宽度范围约束（同时不超过窗口宽度的 60%）
function clampSidebarWidth(width) {
    const max = Math.min(MAX_SIDEBAR_WIDTH, window.innerWidth * 0.6)
    return Math.round(Math.min(max, Math.max(MIN_SIDEBAR_WIDTH, Number(width) || 320)))
}

// 拖拽左侧栏右边界调整宽度
function startResize(event) {
    const startX = event.clientX
    const startWidth = sidebarWidth.value

    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    const onMouseMove = (moveEvent) => {
        sidebarWidth.value = clampSidebarWidth(startWidth + moveEvent.clientX - startX)
    }

    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
        window.hostsbox.saveSidebarWidth(sidebarWidth.value)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
}

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
        // 点击"编辑"，进入编辑模式（若当前不在默认配置页，先切换过去）
        if (activeTab.value !== 'default') {
            selectDefault()
        }
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
async function openHostsDirectory() {
    const result = await window.hostsbox.openHostsDir()
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
        // deleteSelectedEntries 已经清空了 selectedEntryIds，这里只需要处理当前编辑的 entry
        const currentEntry = getCurrentEntry()
        if (currentEntry) {
            // 检查当前 entry 是否还存在（可能被删除了）
            const entryExists = entries.value.find(e => e._id === currentEntry._id)
            if (!entryExists) {
                clearCurrentSelection()
            }
        }
    }
}

// 批量生效选中的 entry
async function handleBatchActivate() {
    const success = await activateSelectedEntries()
    if (success) {
        // 清空所有选中状态
        selectedEntryIds.value.clear()
    }
}

// 批量失效选中的 entry
async function handleBatchDeactivate() {
    const success = await deactivateSelectedEntries()
    if (success) {
        // 清空所有选中状态
        selectedEntryIds.value.clear()
    }
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
        return
    }

    // Ctrl+N 新增自定义配置
    if (event.ctrlKey && (event.key === 'n' || event.key === 'N')) {
        event.preventDefault()
        // 对话框已打开时不重复触发，避免清空正在输入的名称
        if (!addDialogVisible.value && !confirmDialogVisible.value) {
            showAddEntryDialog()
        }
        return
    }

    // Ctrl+, 打开设置
    if (event.ctrlKey && event.key === ',') {
        event.preventDefault()
        if (!addDialogVisible.value && !confirmDialogVisible.value) {
            openHelpWindow()
        }
        return
    }

    // Alt+Z 切换自动换行
    if (event.altKey && !event.ctrlKey && !event.metaKey && (event.key === 'z' || event.key === 'Z')) {
        event.preventDefault()
        toggleWrap()
        return
    }

    // Ctrl+= 放大界面
    if (event.ctrlKey && (event.key === '=' || event.key === '+')) {
        event.preventDefault()
        zoomLevel.value = Math.min(zoomLevel.value + ZOOM_STEP, MAX_ZOOM)
        window.hostsbox.setZoom(zoomLevel.value)
        window.hostsbox.saveZoomLevel(zoomLevel.value)
        return
    }

    // Ctrl+- 缩小界面
    if (event.ctrlKey && event.key === '-') {
        event.preventDefault()
        zoomLevel.value = Math.max(zoomLevel.value - ZOOM_STEP, MIN_ZOOM)
        window.hostsbox.setZoom(zoomLevel.value)
        window.hostsbox.saveZoomLevel(zoomLevel.value)
        return
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

        // 应用缩放到 webFrame
        window.hostsbox.setZoom(zoomLevel.value)
        // 保存缩放级别（使用 hostsbox API）
        window.hostsbox.saveZoomLevel(zoomLevel.value)
    }
}

// 打开帮助窗口
function openHelpWindow() {
    window.hostsbox.openHelpWindow()
}
</script>

<style scoped>
@import '../assets/Hosts.css';
</style>
