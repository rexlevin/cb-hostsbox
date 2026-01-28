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

                <!-- 默认配置 -->
                <div class="nav-item" :class="{ active: activeTab === 'default' }" @click="handleMenuSelect('default')">
                    <el-icon><Document /></el-icon>
                    <span>默认</span>
                    <el-button v-if="activeTab === 'default'" size="small" link @click.stop="handleEditDefaultClick">
                        {{ isEditingDefault ? '取消编辑' : '编辑' }}
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
                    <el-icon><Document /></el-icon>
                    <span>{{ entry.name }}</span>
                    <el-switch v-model="entry.active" @click.stop
                        @change="(val) => handleToggleEntryActive(entry, val)" class="entry-switch" size="small" />
                </div>

                <div v-if="entries.filter(e => e.name !== 'default').length === 0" class="empty-state">
                    <span>暂无配置</span>
                </div>
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
                <el-button @click="confirmDialogVisible = false">取消</el-button>
                <el-button type="primary" @click="handleConfirm">确定</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Check, Delete, Monitor, Document } from '@element-plus/icons-vue'
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
    createEntry,
    saveCurrentEntry,
    deleteEntry,
    toggleEntryActive,
    selectSystemHosts,
    selectDefault,
    editDefault,
    saveDefault,
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

// 编辑器引用和实例
const editorRef = ref(null)
let editorView = null
let isUpdatingFromWatch = false

// 初始化
onMounted(async () => {
    await initApp()
    document.addEventListener('keyup', handleKeyPress)
    nextTick(() => {
        initEditor()
    })
})

onBeforeUnmount(() => {
    document.removeEventListener('keyup', handleKeyPress)
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

// 编辑默认配置
function handleEditDefaultClick() {
    if (isEditingDefault.value) {
        // 取消编辑
        selectDefault()
    } else {
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
</script>

<style scoped>
@import '../assets/Hosts.css';
</style>
