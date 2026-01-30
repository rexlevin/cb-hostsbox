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
 * 写入 hosts 文件（使用 canbox.sudo.exec 提权）
 */
async function applyHosts(content) {
    const tempFile = path.join(os.tmpdir(), 'hosts-' + nanoid() + '.tmp');
    fs.writeFileSync(tempFile, content, 'utf8');

    const platform = os.platform();
    let command;

    if (platform === 'win32') {
        // Windows: 使用 type 命令
        command = `type "${tempFile}" > "%SystemRoot%\\System32\\drivers\\etc\\hosts"`;
    } else {
        // macOS/linux: 使用 cat 命令
        command = `cat "${tempFile}" > /etc/hosts`;
    }

    console.log('执行提权命令:', command);
    console.log('平台:', platform);
    console.log('准备调用 canbox.sudo.exec，参数:', { command, name: '应用 hosts 配置' });

    try {
        const result = await canbox.sudo.exec({
            command: command,
            name: 'Hosts Config'
        });

        console.log('提权执行成功，stdout:', result.stdout);
        console.log('stderr:', result.stderr);

        // 清理临时文件
        try {
            fs.unlinkSync(tempFile);
        } catch (e) {
            console.warn('清理临时文件失败:', e);
        }

        // 验证 hosts 文件是否真的被更新了
        const hostsPath = getHostsPath();
        let actualContent;
        try {
            actualContent = fs.readFileSync(hostsPath, 'utf8');
        } catch (e) {
            console.error('读取 hosts 失败:', e);
        }

        if (actualContent) {
            const normalizedExpected = content.trim();
            const normalizedActual = actualContent.trim();

            // 检查前100个字符是否匹配
            const sampleLength = Math.min(100, normalizedExpected.length, normalizedActual.length);
            const expectedSample = normalizedExpected.substring(0, sampleLength);
            const actualSample = normalizedActual.substring(0, sampleLength);

            if (expectedSample === actualSample) {
                console.log('Hosts 文件已成功更新（通过验证，样本匹配）');
                return { success: true, code: 'success' };
            }

            // 如果长度也一致，认为更新成功
            if (normalizedExpected.length === normalizedActual.length) {
                console.log('Hosts 文件已成功更新（通过验证，长度匹配）');
                return { success: true, code: 'success' };
            }

            console.log('内容不匹配，期望长度:', normalizedExpected.length, '实际长度:', normalizedActual.length);
            console.log('期望内容前100字符:', expectedSample);
            console.log('实际内容前100字符:', actualSample);
        }

        return { success: false, code: 'failed', msg: '写入 hosts 失败：内容验证不通过' };

    } catch (error) {
        console.error('[preload.js] 提权执行失败: %o', error);
        console.dir(error);
        // 多次排查，发现这里的 error 是一个 string，气死了～

        // 清理临时文件
        try {
            fs.unlinkSync(tempFile);
        } catch (e) {
            console.warn('清理临时文件失败:', e);
        }

        // 检查用户是否取消
        if (error && error.includes('User did not grant permission')) {
            console.log('用户取消提权');
            return { success: false, code: 'cancel', msg: '用户取消提权 cancel' };
        }

        // 如果错误信息包含"只读文件系统"，直接返回失败
        if (error && error.includes('只读文件系统')) {
            return { success: false, code: 'failed', msg: '写入 hosts 失败：flatpak 沙盒环境无法直接写入系统文件' };
        }

        return { success: false, code: 'failed', msg: '写入 hosts 失败: ' + error.message };
    }
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
            // 先查询是否已存在 default 条目
            const existing = await canbox.db.find({
                selector: {
                    type: 'hosts_entry',
                    name: 'default'
                },
                limit: 1
            });

            if (existing.docs && existing.docs.length > 0) {
                console.log('默认 hosts 已存在于数据库中，跳过保存');
                return;
            }

            // 不存在则创建
            const doc = {
                type: 'hosts_entry',
                name: 'default',
                content: hostsResult.data,
                active: false,
                createTime: Date.now()
            };

            await canbox.db.put(doc);
            console.log('默认 hosts 已保存到数据库');
        } catch (error) {
            console.warn('保存默认 hosts 到数据库失败:', error);
        }
    }
}

// 初始化时创建备份
createFirstBackup();

// 数据库操作 API
contextBridge.exposeInMainWorld('hostsboxDB', {
    // 获取所有配置
    getAllEntries: async () => {
        try {
            console.log('getAllEntries 开始查询');

            // 使用 allDocs 获取所有文档，避免索引延迟问题
            const result = await canbox.db.allDocs({
                include_docs: true
            });

            console.log('getAllEntries allDocs 结果:', result);

            if (result && result.rows) {
                // 过滤出 type 为 hosts_entry 的文档
                const docs = result.rows
                    .map(row => row.doc)
                    .filter(doc => doc && doc.type === 'hosts_entry');

                console.log('getAllEntries 过滤后文档数量:', docs.length);
                return { success: true, data: docs.map(doc => ({ ...doc, active: doc.active || false })) };
            }
            console.log('getAllEntries 没有找到文档');
            return { success: true, data: [] };
        } catch (error) {
            console.error('获取所有 entry 失败:', error);
            return { success: false, msg: error.message };
        }
    },

    // 创建配置
    createEntry: async (entry) => {
        try {
            console.log('preload.js createEntry 输入:', entry);
            const doc = {
                type: 'hosts_entry',
                ...entry,
                createTime: Date.now()
            };
            console.log('准备写入数据库的文档:', doc);
            const result = await canbox.db.put(doc);
            console.log('db.put 结果:', result);
            return { success: true, id: result.id, rev: result.rev, doc };
        } catch (error) {
            console.error('createEntry 错误:', error);
            return { success: false, msg: error.message };
        }
    },

    // 更新配置
    updateEntry: async (entry) => {
        try {
            console.log('updateEntry 输入:', entry);
            const result = await canbox.db.put(entry);
            console.log('updateEntry 结果:', result);
            return { success: true, rev: result.rev };
        } catch (error) {
            console.error('updateEntry 错误:', error);
            return { success: false, msg: error.message };
        }
    },

    // 删除配置
    deleteEntry: async (id, rev) => {
        try {
            await canbox.db.remove({ _id: id, _rev: rev });
            return { success: true };
        } catch (error) {
            return { success: false, msg: error.message };
        }
    }
});

// hostsbox API
contextBridge.exposeInMainWorld('hostsbox', {
    // 获取系统 hosts 内容
    getHosts: () => readHosts(),

    // 应用 hosts 内容到系统
    applyHosts: (content) => {
        return applyHosts(content);
    },

    // 打开 hosts 所在目录
    openHostsDir: () => openHostsDir(),

    // 备份 hosts 文件
    backupHosts: () => backupHosts(),

    // 获取缩放级别
    getZoomLevel: () => {
        try {
            const level = localStorage.getItem('hostsbox-zoom-level');
            return level ? parseFloat(level) : 1;
        } catch (error) {
            console.error('获取缩放级别失败:', error);
            return 1;
        }
    },

    // 保存缩放级别
    saveZoomLevel: (level) => {
        try {
            localStorage.setItem('hostsbox-zoom-level', level.toString());
        } catch (error) {
            console.error('保存缩放级别失败:', error);
        }
    },

    // 打开帮助窗口
    openHelpWindow: () => {
        try {
            window.canbox.win.createWindow(
                {},
                {
                    url: 'help.html',
                    title: '帮助 - CB HostsBox',
                    escClose: true
                }
            );
        } catch (error) {
            console.error('打开帮助窗口失败:', error);
        }
    }
});
