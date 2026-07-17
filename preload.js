/**
 * cb-hostsbox preload
 *
 * 通过 ipcRenderer.invoke 调用 IPC 通道，再用 contextBridge 暴露给渲染进程。
 *
 * 对外暴露 window.hostsbox 与 window.hostsboxDB，保持与旧架构一致的 API，
 * 前端组件无需改动：
 * - hostsbox.getHosts()         读取系统 hosts（APP 自有 IPC）
 * - hostsbox.applyHosts(content) 写入系统 hosts（APP 自有 IPC，含提权）
 * - hostsbox.openHostsDir()      打开 hosts 所在目录
 * - hostsbox.backupHosts()       备份 hosts
 * - hostsbox.getZoomLevel()      获取缩放级别（canbox-core store）
 * - hostsbox.saveZoomLevel(level) 保存缩放级别
 * - hostsbox.openHelpWindow()    打开帮助窗口
 * - hostsboxDB.getAllEntries()   获取所有配置（canbox.db.allDocs）
 * - hostsboxDB.createEntry(entry) 创建配置（canbox.db.put）
 * - hostsboxDB.updateEntry(entry) 更新配置（canbox.db.put）
 * - hostsboxDB.deleteEntry(id,rev) 删除配置（canbox.db.remove）
 */
const { contextBridge, ipcRenderer, webFrame } = require('electron');
const path = require('path');
const pkg = require(path.join(__dirname, 'package.json'));

// 校验 canbox-core 是否已通过 -r injection.js 注入
ipcRenderer.invoke('canbox.misc.hello').then(() => {
    console.log('[cb-hostsbox preload] canbox-core 已加载');
}).catch(err => {
    console.error('[cb-hostsbox preload] canbox-core 未加载: %o', err);
});

window.addEventListener('DOMContentLoaded', () => {
    document.title = pkg.description + ' - v' + pkg.version;
});

// hostsbox API
contextBridge.exposeInMainWorld('hostsbox', {
    // 获取系统 hosts 内容
    getHosts: () => ipcRenderer.invoke('hostsbox.readHosts'),

    // 应用 hosts 内容到系统
    applyHosts: (content) => ipcRenderer.invoke('hostsbox.applyHosts', content),

    // 打开 hosts 所在目录
    openHostsDir: () => ipcRenderer.invoke('hostsbox.openHostsDir'),

    // 备份 hosts 文件
    backupHosts: () => ipcRenderer.invoke('hostsbox.backupHosts'),

    // 获取缩放级别
    getZoomLevel: async () => {
        try {
            const level = await ipcRenderer.invoke('hostsbox.getZoomLevel');
            return level;
        } catch (error) {
            console.error('[cb-hostsbox preload] 获取缩放级别失败:', error);
            return 1;
        }
    },

    // 保存缩放级别
    saveZoomLevel: (level) => {
        ipcRenderer.invoke('hostsbox.saveZoomLevel', level).catch(err => {
            console.error('[cb-hostsbox preload] 保存缩放级别失败:', err);
        });
    },

    // 打开帮助窗口
    openHelpWindow: () => {
        ipcRenderer.invoke('hostsbox.openHelpWindow').catch(err => {
            console.error('[cb-hostsbox preload] 打开帮助窗口失败:', err);
        });
    },

    // 设置 webFrame 缩放
    setZoom: (factor) => {
        webFrame.setZoomFactor(factor);
    }
});

// 数据库操作 API
contextBridge.exposeInMainWorld('hostsboxDB', {
    // 获取所有配置
    getAllEntries: async () => {
        try {
            const result = await ipcRenderer.invoke('canbox.db.allDocs', { include_docs: true });
            if (result && result.rows) {
                const docs = result.rows
                    .map(row => row.doc)
                    .filter(doc => doc && doc.type === 'hosts_entry');
                return { success: true, data: docs.map(doc => ({ ...doc, active: doc.active || false })) };
            }
            return { success: true, data: [] };
        } catch (error) {
            console.error('[cb-hostsbox preload] 获取所有 entry 失败:', error);
            return { success: false, msg: error.message };
        }
    },

    // 创建配置
    createEntry: async (entry) => {
        try {
            const { randomUUID } = require('crypto');
            const doc = {
                type: 'hosts_entry',
                ...entry,
                createTime: Date.now()
            };
            // PouchDB put 要求必须有 _id，未提供时自动生成
            if (!doc._id) {
                doc._id = randomUUID();
            }
            const result = await ipcRenderer.invoke('canbox.db.put', doc);
            return { success: true, id: result.id, rev: result.rev, doc };
        } catch (error) {
            console.error('[cb-hostsbox preload] createEntry 错误:', error);
            return { success: false, msg: error.message };
        }
    },

    // 更新配置
    updateEntry: async (entry) => {
        try {
            const result = await ipcRenderer.invoke('canbox.db.put', entry);
            return { success: true, rev: result.rev };
        } catch (error) {
            console.error('[cb-hostsbox preload] updateEntry 错误:', error);
            return { success: false, msg: error.message };
        }
    },

    // 删除配置
    deleteEntry: async (id, rev) => {
        try {
            await ipcRenderer.invoke('canbox.db.remove', { _id: id, _rev: rev });
            return { success: true };
        } catch (error) {
            return { success: false, msg: error.message };
        }
    }
});
