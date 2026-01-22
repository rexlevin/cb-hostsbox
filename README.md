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
│   ├── App.vue                 # 主应用组件（UI层）
│   ├── main.js                 # 入口文件
│   ├── style.css               # 样式文件
│   ├── composables/
│   │   └── useHostsEntries.js  # hosts 配置管理业务逻辑
│   └── utils/
│       └── hostsHighlight.js   # 代码高亮工具函数
├── public/
│   └── logo*.png               # 图标资源
├── types/
│   └── canbox.d.ts             # Canbox 类型定义
├── app.json                    # Canbox 应用配置
├── preload.js                  # 预加载脚本（包含 hosts 操作和数据库API）
├── cb.build.json               # 打包配置
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

## 安全说明

### 权限处理机制

- **Windows**: `sudo-prompt` 通过 UAC 提示用户确认
- **Linux**: `sudo-prompt` 使用 pkexec (PolicyKit) 提示输入密码
- **macOS**: `sudo-prompt` 使用 sudo 提示输入密码

## 许可证

Apache-2.0
