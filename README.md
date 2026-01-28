# HostsBox

基于 Canbox 的 hosts 文件管理工具。

## 功能特性

- ✅ 创建、编辑、删除 hosts 配置
- ✅ 一键激活/失效 hosts 配置
- ✅ 查看系统 hosts 文件内容（只读）
- ✅ 编辑默认 hosts 配置并应用到系统
- ✅ 语法高亮显示（CodeMirror + properties）
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
- **提权**: sudo-prompt（Windows: UAC, Linux: sudo, macOS: sudo）
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

所有 hosts 配置（包括系统默认配置和用户自定义配置）都存储在 canbox.db 的 `hosts_entry` 类型文档中。

```json
{
  _id: string,           // 文档 ID（自动生成）
  _rev: string,          // 版本号（CouchDB/PouchDB 自动管理）
  type: 'hosts_entry',   // 文档类型标识，用于区分不同类型的数据
  name: string,          // 配置名称
  content: string,       // hosts 文件内容
  active: boolean,       // 是否激活（true 表示应用到系统 hosts 文件）
  createTime: number     // 创建时间戳（毫秒）
}
```

### 配置类型

#### 1. 系统默认配置（default）

- **name**: 固定为 `"default"`
- **content**: 系统原始 hosts 文件的完整内容
- **active**: 始终为 `false`
- **保存时机**：
  - 第一次启动应用时，自动备份系统 hosts 文件并保存到数据库
  - 后续启动时，如果数据库中已存在 `name="default"` 的配置，则不再重复保存
- **用途**：保存系统原始 hosts，方便恢复和参考

#### 2. 用户自定义配置

- **name**: 用户指定的配置名称，如 `"test01"`、`"开发环境"` 等
- **content**: 用户编辑的 hosts 配置内容
- **active**: 可切换激活状态
- **保存时机**：
  - 创建配置时立即保存到数据库
  - 编辑配置内容时实时更新
  - 激活/失效配置时更新状态
- **用途**：用户创建的 hosts 配置，可以激活应用到系统

### 数据区分方式

系统 hosts 和用户配置通过以下方式区分：

1. **查询方式**：使用 `selector: { type: 'hosts_entry' }` 查询所有 hosts 配置
2. **区分字段**：通过 `name` 字段区分
   - `name === 'default'`：默认配置（首次启动时保存的系统 hosts）
   - 其他值：用户自定义配置
3. **应用方式**：
   - **系统 Hosts**：显示当前系统 hosts 文件内容 = default + 所有激活的配置（只读）
   - **默认配置**：可编辑，保存后会将 default + 所有激活的配置合并并覆盖系统 hosts 文件
   - **用户自定义配置**：只有 `active === true` 的配置会被合并并写入系统 hosts 文件

### 界面说明

#### 左侧导航栏

1. **系统 Hosts**：显示当前系统 hosts 文件的实际内容（default + 所有激活的配置），只读不可编辑
2. **默认**：显示保存的 default 配置内容，默认只读，点击"编辑"按钮后可编辑，保存后应用到系统
3. **自定义配置**：用户创建的 hosts 配置列表，可激活/失效

## 安全说明

### 权限处理机制

- **Windows**: `sudo-prompt` 通过 UAC 提示用户确认
- **macOS/Linux**: `sudo-prompt` 使用 sudo 提示输入密码

## 许可证

Apache-2.0
