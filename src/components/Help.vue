<template>
    <div class="help-container">
        <el-tabs v-model="activeTab" tab-position="left" class="help-tabs">
            <!-- 快捷键 -->
            <el-tab-pane label="快捷键" name="shortcuts">
                <div class="tab-content">
                    <h3>界面操作</h3>
                    <p><span class="key-combo"><kbd>Ctrl</kbd><span class="key-separator">+</span><kbd>滚轮</kbd></span> 缩放界面（0.8x - 1.5x）</p>
                    <p><span class="key-combo"><kbd>Ctrl</kbd><span class="key-separator">+</span><kbd>S</kbd></span> 保存当前编辑内容</p>
                    <p><span class="key-combo"><kbd>Esc</kbd></span> 关闭搜索/替换面板</p>

                    <h3>编辑器操作 (CodeMirror)</h3>
                    <p><span class="key-combo"><kbd>Ctrl</kbd><span class="key-separator">+</span><kbd>F</kbd></span> 搜索</p>
                    <p><span class="key-combo"><kbd>Ctrl</kbd><span class="key-separator">+</span><kbd>H</kbd></span> 搜索并替换</p>
                    <p><span class="key-combo"><kbd>Ctrl</kbd><span class="key-separator">+</span><kbd>G</kbd></span> 跳转到下一个搜索结果</p>
                    <p><span class="key-combo"><kbd>Ctrl</kbd><span class="key-separator">+</span><kbd>Shift</kbd><span class="key-separator">+</span><kbd>G</kbd></span> 跳转到上一个搜索结果</p>
                    <p><span class="key-combo"><kbd>Ctrl</kbd><span class="key-separator">+</span><kbd>D</kbd></span> 选中当前词</p>
                    <p><span class="key-combo"><kbd>Ctrl</kbd><span class="key-separator">+</span><kbd>Home</kbd></span> 跳转到文件开头</p>
                    <p><span class="key-combo"><kbd>Ctrl</kbd><span class="key-separator">+</span><kbd>End</kbd></span> 跳转到文件末尾</p>
                </div>
            </el-tab-pane>

            <!-- 使用说明 -->
            <el-tab-pane label="使用说明" name="usage">
                <div class="tab-content">
                    <h3>应用说明</h3>
                    <p>CB HostsBox 是一个便捷的 Hosts 文件管理工具，支持多个配置的切换和管理。</p>
                    <p><strong>系统 Hosts：</strong>显示当前系统 /etc/hosts 文件的原始内容（只读）</p>
                    <p><strong>默认配置：</strong>基础 hosts 配置，始终会被应用</p>
                    <p><strong>自定义配置：</strong>可创建多个独立配置，支持单独启用/禁用</p>

                    <h3>Hosts 文件格式</h3>
                    <p>hosts 文件每行格式为：<code>IP地址 域名1 域名2 ...</code></p>
                    <p>示例：</p>
                    <pre>127.0.0.1 localhost
127.0.0.1 example.com test.example.com
10.0.0.1 dev.internal.com</pre>

                    <h3>权限说明</h3>
                    <p>写入系统 hosts 文件需要管理员/root 权限。</p>
                    <p>应用 hosts 时会弹出提权确认框，请确认后点击允许。</p>
                    <p><strong>注意：</strong>如果取消提权操作，hosts 配置不会生效，且配置状态会恢复原样。</p>

                    <h3>注意事项</h3>
                    <ul>
                        <li>修改 hosts 后可能需要重启浏览器才能生效</li>
                        <li>某些 DNS 缓存服务可能需要等待 TTL 过期</li>
                        <li>hosts 文件格式错误可能导致系统解析异常</li>
                        <li>建议在重要操作前先备份 hosts 文件</li>
                    </ul>
                </div>
            </el-tab-pane>

            <!-- 关于 -->
            <el-tab-pane label="关于" name="about">
                <div class="tab-content about-content">
                    <div class="header">
                        <h1>CB HostsBox</h1>
                        <p class="subtitle">便捷的 Hosts 文件管理工具</p>
                    </div>
                    <div class="info-list">
                        <div class="info-item">
                            <span class="label">版本</span>
                            <span class="value">1.0.0</span>
                        </div>
                        <div class="info-item">
                            <span class="label">作者</span>
                            <span class="value">rexlevin</span>
                        </div>
                        <div class="info-item">
                            <span class="label">邮箱</span>
                            <span class="value">56460263@qq.com</span>
                        </div>
                        <div class="info-item">
                            <span class="label">GitHub 仓库</span>
                            <a href="https://github.com/rexlevin/cb-hostsbox" target="_blank" class="value link">github.com/rexlevin/cb-hostsbox</a>
                        </div>
                        <div class="info-item">
                            <span class="label">Gitee 仓库</span>
                            <a href="https://gitee.com/lizl6/cb-hostsbox" target="_blank" class="value link">gitee.com/lizl6/cb-hostsbox</a>
                        </div>
                    </div>
                    <div class="footer">
                        <p>© 2025 CB HostsBox. All rights reserved.</p>
                    </div>
                </div>
            </el-tab-pane>
        </el-tabs>
    </div>
</template>

<script setup>
import { ref } from 'vue'

const activeTab = ref('shortcuts')
</script>

<style scoped>
.help-container {
    height: 100vh;
    overflow: hidden;
}

.help-tabs {
    height: 100%;
}

.help-tabs .el-tabs__content {
    height: 100%;
}

.help-tabs .el-tab-pane {
    height: 100%;
}

.tab-content {
    padding: 20px;
    height: 100%;
    overflow-y: auto;
    color: #303133;
}

.tab-content h3 {
    font-size: 18px;
    font-weight: 600;
    margin: 20px 0 12px 0;
    color: #409EFF;
}

.tab-content h3:first-child {
    margin-top: 0;
}

.tab-content p {
    margin-bottom: 12px;
    line-height: 1.6;
    color: #606266;
}

.tab-content pre {
    background: #f5f7fa;
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;
    margin-bottom: 12px;
}

.tab-content code {
    background: #f5f7fa;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
}

.tab-content ul {
    list-style-position: inside;
    color: #606266;
}

.tab-content ul li {
    margin-bottom: 8px;
}

.key-combo {
    display: inline-flex;
    align-items: center;
    background: #f0f2f5;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    padding: 4px 8px;
    margin: 0 4px;
    font-family: 'Courier New', monospace;
    font-size: 14px;
}

.key-combo kbd {
    padding: 0 2px;
    font-weight: 600;
}

.key-separator {
    margin: 0 4px;
    color: #909399;
}

/* 关于页面 */
.about-content {
    display: flex;
    flex-direction: column;
    max-width: 600px;
}

.header {
    text-align: center;
    margin-bottom: 32px;
}

.header h1 {
    font-size: 32px;
    color: #409EFF;
    margin: 0 0 8px 0;
}

.subtitle {
    font-size: 14px;
    color: #909399;
    margin: 0;
}

.info-list {
    flex: 1;
}

.info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #ebeef5;
}

.info-item:last-child {
    border-bottom: none;
}

.label {
    font-weight: 500;
    color: #606266;
}

.value {
    color: #303133;
}

.value.link {
    color: #409EFF;
    text-decoration: none;
}

.value.link:hover {
    text-decoration: underline;
}

.footer {
    margin-top: 32px;
    text-align: center;
}

.footer p {
    font-size: 12px;
    color: #909399;
    margin: 0;
}
</style>
