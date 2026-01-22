# HostsBox

基于 Canbox 的 hosts 文件管理工具。

## 功能特性

- ✅ 创建、编辑、删除 hosts 配置
- ✅ 一键激活/失效 hosts 配置
- ✅ 只读查看系统 hosts 文件
- ✅ 语法高亮显示（注释、IP地址、域名）
- ✅ 支持多平台（Windows、macOS、Linux）
- ✅ 权限提升和危险操作确认
- ✅ 数据持久化存储（canbox.db）
- ✅ 快捷键支持（Ctrl+S 保存）

## 开发

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 预览构建结果

```bash
npm run preview
```

## 集成到 Canbox

### 作为开发应用加载（推荐用于开发测试）

1. 启动 Canbox
2. 点击 "添加开发应用"
3. 选择 cb-hostsbox 的 `app.json` 文件
4. 在应用列表中找到 HostsBox 并启动

### 作为生产应用打包（推荐用于发布）

#### 步骤 1: 构建前端

```bash
npm run build
```

#### 步骤 2: 准备打包目录

确保 `cb.build.json` 文件存在。

#### 步骤 3: 使用 Canbox 打包工具

通过 Canbox UI 将 cb-hostsbox 打包成 asar 文件。

## 技术栈

- **框架**: Vue 3 + Vite
- **UI组件**: Element Plus
- **代码高亮**: Prism.js
- **图标**: @element-plus/icons-vue
- **提权**: sudo-prompt（Windows: UAC, Linux: pkexec, macOS: sudo）
- **存储**: Canbox PouchDB (canbox.db)

## 项目结构

```
cb-hostsbox/
├── src/
│   ├── App.vue           # 主应用组件
│   ├── main.js           # 入口文件
│   └── style.css         # 样式文件
├── public/
│   └── vite.svg          # 图标
├── types/
│   └── canbox.d.ts       # Canbox 类型定义
├── app.json              # Canbox 应用配置
├── preload.js            # 预加载脚本（包含 hosts 操作逻辑）
├── cb.build.json         # 打包配置
├── package.json
└── vite.config.js
```

## 数据结构

### Hosts Entry (存储在 canbox.db)

```javascript
{
  _id: string,           // 文档 ID
  _rev: string,          // 版本号
  type: 'hosts_entry',   // 文档类型
  name: string,          // 配置名称
  content: string,       // hosts 内容
  active: boolean,       // 是否激活
  createTime: number     // 创建时间
}
```

## API 说明

### 前端 API (通过 preload.js 暴露)

```javascript
// 读取系统 hosts（同步）
window.hostsbox.getHosts()
// 返回: { success: boolean, data: string, msg?: string }

// 应用 hosts 到系统（异步，使用 sudo-prompt 提权）
window.hostsbox.applyHosts(content: string)
// 返回: Promise<{ success: boolean, code: string, msg?: string }>
// code: 'success' | 'cancel' | 'failed'

// 打开 hosts 所在目录（同步）
window.hostsbox.openHostsDir()
// 返回: { success: boolean, msg?: string }

// 备份 hosts 文件（同步）
window.hostsbox.backupHosts()
// 返回: { success: boolean, msg?: string }
```

## 安全说明

- 修改系统 hosts 文件需要管理员权限（通过 sudo-prompt 提权）
- Windows: 使用 UAC（用户账户控制）
- Linux: 使用 pkexec (PolicyKit)
- macOS: 使用 sudo
- 所有危险操作都会弹出确认对话框
- 写入 hosts 前会自动备份原文件到应用数据目录

## 架构设计

### 为什么不需要侵入 canbox 主进程？

原 hostsbox 项目已经在 preload.js 中直接使用 sudo-prompt 进行提权操作，这种方式：

1. **符合 Canbox 平台设计**: 应用自包含，不侵入平台
2. **简单高效**: 直接在 preload 中处理，无需额外的 IPC 通信
3. **跨平台**: sudo-prompt 自动处理不同平台的提权机制

### 权限处理机制

- **Windows**: `sudo-prompt` 通过 UAC 提示用户确认
- **Linux**: `sudo-prompt` 使用 pkexec (PolicyKit) 提示输入密码
- **macOS**: `sudo-prompt` 使用 sudo 提示输入密码

## 故障排查

### 问题: "写入 hosts 失败"

**原因**:
- 用户取消提权操作
- 密码输入错误
- hosts 文件被占用

**解决方案**:
- 检查 hosts 文件是否被其他程序锁定
- 确认用户密码正确
- 检查磁盘空间

### 问题: 权限对话框不显示

**原因**:
- sudo-prompt 未正确安装
- Flatpak 环境下的权限限制

**解决方案**:
- 检查 sudo-prompt 是否正确安装
- 在非 Flatpak 环境中测试

## 许可证

Apache-2.0
