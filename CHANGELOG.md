# Changelog

本文件记录项目的所有版本变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/)。

## [1.1.1] - 2026-07-17

### feat | 新功能 / Features

迁移到 canbox-core 新架构，通过注入启动并获得统一运行时环境
实现跨平台提权写入 hosts（Linux pkexec / macOS osascript / Windows PowerShell）
新增 Ctrl+N 快捷键快速创建自定义配置
新增 Ctrl+= / Ctrl+- 快捷键缩放界面
为自定义配置的添加按钮增加 tooltip 提示
帮助页快捷键说明补充 Ctrl+N、Ctrl+=、Ctrl+- 描述
配置 GitHub Actions 自动发布工作流
修复创建配置时 missing_id 错误，自动生成文档 _id
开发环境以 detach 模式打开 DevTools

Migrate to canbox-core architecture, launched via injection with unified runtime
Implement cross-platform privilege escalation for hosts writing (Linux pkexec / macOS osascript / Windows PowerShell)
Add Ctrl+N shortcut to quickly create custom configuration
Add Ctrl+= / Ctrl+- shortcuts to zoom interface
Add tooltip to the add button for custom configurations
Update help page shortcuts with Ctrl+N, Ctrl+=, Ctrl+- descriptions
Configure GitHub Actions auto-release workflow
Fix missing_id error when creating configuration by auto-generating document _id
Open DevTools in detach mode during development

## [1.1.0] - 2026-07-17

### feat | 新功能 / Features

迁移到 canbox 新架构，基于 canbox-core 注入机制运行
添加 GitHub Actions 自动发布工作流
实现跨平台提权写入 hosts（Linux pkexec / macOS osascript / Windows PowerShell）

Migrate to canbox new architecture, running on canbox-core injection mechanism
Add GitHub Actions auto-release workflow
Implement cross-platform privilege escalation for hosts writing (Linux pkexec / macOS osascript / Windows PowerShell)

### refactor | 重构 / Refactoring

移除 app.json/cb.build.json/uat.dev.json，改用 package.json 作为 APP 元数据
hosts 文件操作迁移到主进程 IPC，通过 contextBridge 暴露给渲染进程
缩放级别持久化改用 canbox-core store

Remove app.json/cb.build.json/uat.dev.json, use package.json as APP metadata
Migrate hosts file operations to main process IPC, exposed to renderer via contextBridge
Zoom level persistence now uses canbox-core store

## [1.0.1] - 2025-01-29

### 改进

重构帮助窗口，从独立 HTML 改为 Vue Router 路由组件
帮助窗口现在共享主应用依赖，加载速度更快、更稳定
优化批量操作中用户取消提权的处理逻辑，避免 Document update conflict
添加版本历史记录文件 HISTORY.md
添加 MIT 开源许可证

## [1.0.0] - 2025-01-29

### 新功能

Hosts文件管理功能，支持查看和编辑系统hosts文件
默认配置功能，提供基础hosts配置，始终会被应用
自定义配置功能，支持创建多个独立配置
配置激活/失效切换，可单独启用或禁用自定义配置
批量操作功能，支持批量删除、批量激活、批量失效
CodeMirror编辑器集成，提供代码高亮和编辑功能
界面缩放功能，支持Ctrl+滚轮缩放（0.8x - 1.5x）
缩放级别持久化，重启应用后恢复缩放设置
帮助窗口，包含快捷键、使用说明和关于信息

### 技术特性

基于Canbox平台开发
Vue 3 + Composition API
Element Plus UI组件库
PouchDB本地数据存储
CodeMirror编辑器
跨平台支持（Windows/macOS/Linux）
