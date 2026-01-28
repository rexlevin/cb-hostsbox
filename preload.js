const { contextBridge } = require('electron');
const { shell } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { nanoid } = require('nanoid-cjs');

/**
 * 获取 hosts 文件路径
 */
function getHostsPath() {
    const platform = os.platform();
    if (platform === 'win32') {
        return 'C:\\Windows\\System32\\drivers\\etc\\hosts';
    } else {
        return '/etc/hosts';
    }
}

/**
 * 获取应用数据目录（用户文档目录）
 */
function getDocumentsPath() {
    const platform = os.platform();
    const homeDir = os.homedir();

    if (platform === 'win32') {
        // Windows: 使用系统语言判断文档目录
        const lang = os.userInfo().shell ? os.userInfo().shell : 'en-US';
        if (lang.includes('zh')) {
            return path.join(homeDir, 'Documents');
        } else {
            return path.join(homeDir, 'Documents');
        }
    } else if (platform === 'darwin') {
        // macOS: ~/Documents
        return path.join(homeDir, 'Documents');
    } else {
        // Linux: ~/Documents (如果存在) 或 ~/文档
        const docsEn = path.join(homeDir, 'Documents');
        const docsCn = path.join(homeDir, '文档');

        // 优先使用存在的目录
        if (fs.existsSync(docsEn)) {
            return docsEn;
        } else if (fs.existsSync(docsCn)) {
            return docsCn;
        } else {
            // 都不存在则创建 Documents
            try {
                if (!fs.existsSync(docsEn)) {
                    fs.mkdirSync(docsEn, { recursive: true });
                }
                return docsEn;
            } catch (e) {
                console.warn('创建文档目录失败:', e);
                return homeDir;
            }
        }
    }
}

/**
 * 读取 hosts 文件
 */
function readHosts() {
    const hostsPath = getHostsPath();
    try {
        const content = fs.readFileSync(hostsPath, 'utf8');
        return { success: true, data: content };
    } catch (error) {
        return { success: false, msg: `读取 hosts 文件失败: ${error.message}` };
    }
}

/**
 * 写入 hosts 文件（使用 sudo-prompt 提权）
 */
function applyHosts(content, callback) {
    const tempFile = path.join(os.tmpdir(), 'hosts-' + nanoid() + '.tmp');
    fs.writeFileSync(tempFile, content, 'utf8');

    const platform = os.platform();
    let command;
    const options = {
        name: 'HostsBox',
        icns: 'public/logo.png', // macOS 图标
    };

    if (platform === 'win32') {
        // Windows: 使用 type 命令
        command = `type "${tempFile}" > "%SystemRoot%\\System32\\drivers\\etc\\hosts"`;
    } else {
        // macOS/linux: 使用 sudo + cat
        command = `cat "${tempFile}" > /etc/hosts`;
    }

    // 根据平台选择 sudo 或 pkexec
    const sudo = require('sudo-prompt');

    sudo.exec(command, options, (error, stdout, stderr) => {
        // 清理临时文件
        try {
            fs.unlinkSync(tempFile);
        } catch (e) {
            console.warn('清理临时文件失败:', e);
        }

        if (error) {
            if (error.message.includes('not') && error.message.includes('grant')) {
                callback({ success: false, code: 'cancel', msg: '用户取消提权' });
            } else {
                callback({ success: false, code: 'failed', msg: '写入 hosts 失败: ' + error.message });
            }
        } else {
            console.log('Hosts 文件更新成功');
            callback({ success: true, code: 'success' });
        }
    });
}

/**
 * 备份 hosts 文件
 */
function backupHosts() {
    const hostsPath = getHostsPath();
    const backupPath = path.join(getDocumentsPath(), 'hosts.backup');

    // 检查备份文件是否已存在
    if (fs.existsSync(backupPath)) {
        console.log('备份文件已存在，跳过备份:', backupPath);
        return { success: true, skipped: true };
    }

    try {
        const content = fs.readFileSync(hostsPath, 'utf8');
        fs.writeFileSync(backupPath, content, 'utf8');
        console.log('Hosts 文件已备份到:', backupPath);
        return { success: true, skipped: false };
    } catch (error) {
        return { success: false, msg: `备份 hosts 文件失败: ${error.message}` };
    }
}

/**
 * 打开 hosts 所在目录
 */
function openHostsDir() {
    const hostsPath = getHostsPath();
    shell.showItemInFolder(hostsPath);
    return { success: true };
}

/**
 * 创建第一个备份（包括文件备份和数据库保存）
 */
async function createFirstBackup() {
    // 备份到文件
    backupHosts();

    // 保存到数据库
    const hostsResult = readHosts();
    if (hostsResult.success) {
        try {
            const doc = {
                type: 'hosts_entry',
                name: 'default',
                content: hostsResult.data,
                active: false,
                createTime: Date.now()
            };

            await window.canbox.db.put(doc);
            console.log('默认 hosts 已保存到数据库');
        } catch (error) {
            // 如果已存在则跳过
            if (error.name === 'conflict' || error.status === 409) {
                console.log('默认 hosts 已存在于数据库中，跳过保存');
            } else {
                console.warn('保存默认 hosts 到数据库失败:', error);
            }
        }
    }
}

// 初始化时创建备份
createFirstBackup();

contextBridge.exposeInMainWorld('hostsbox', {
    // 获取系统 hosts 内容
    getHosts: () => readHosts(),

    // 应用 hosts 内容到系统（使用回调）
    applyHosts: (content) => {
        return new Promise((resolve) => {
            applyHosts(content, (result) => {
                resolve(result);
            });
        });
    },

    // 打开 hosts 所在目录
    openHostsDir: () => openHostsDir(),

    // 备份 hosts 文件
    backupHosts: () => backupHosts()
});

// 数据库操作 API
contextBridge.exposeInMainWorld('hostsboxDB', {
    // 获取所有配置
    getAllEntries: async () => {
        try {
            const result = await window.canbox.db.get({
                selector: {
                    type: 'hosts_entry'
                }
            });
            if (result && result.docs) {
                return { success: true, data: result.docs.map(doc => ({ ...doc, active: doc.active || false })) };
            }
            return { success: true, data: [] };
        } catch (error) {
            return { success: false, msg: error.message };
        }
    },

    // 创建配置
    createEntry: async (entry) => {
        try {
            const doc = {
                type: 'hosts_entry',
                ...entry,
                createTime: Date.now()
            };
            const result = await window.canbox.db.put(doc);
            return { success: true, id: result.id, rev: result.rev };
        } catch (error) {
            return { success: false, msg: error.message };
        }
    },

    // 更新配置
    updateEntry: async (entry) => {
        try {
            const result = await window.canbox.db.put(entry);
            return { success: true, rev: result.rev };
        } catch (error) {
            return { success: false, msg: error.message };
        }
    },

    // 删除配置
    deleteEntry: async (id, rev) => {
        try {
            await window.canbox.db.remove({ _id: id, _rev: rev });
            return { success: true };
        } catch (error) {
            return { success: false, msg: error.message };
        }
    }
});
