/**
 * cb-hostsbox — 主进程入口
 *
 * 标准 Electron APP，通过 canbox-core 注入启动：
 *   electron -r canbox-core/injection.js cb-hostsbox/
 *
 * canbox-core 负责环境初始化（统一 userData、日志）与公共服务 IPC
 *（store/db/misc），本文件负责创建窗口、加载前端页面以及 hosts 文件
 * 的读写/提权操作。
 */

const { app, BrowserWindow, Menu, ipcMain, shell, Notification } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

let mainWindow = null;
let helpWindow = null;

// ---------------------------------------------------------------------------
// hosts 文件路径
// ---------------------------------------------------------------------------
function getHostsPath() {
    const platform = os.platform();
    if (platform === 'win32') {
        return 'C:\\Windows\\System32\\drivers\\etc\\hosts';
    }
    return '/etc/hosts';
}

// ---------------------------------------------------------------------------
// IPC: 读取系统 hosts 文件
// ---------------------------------------------------------------------------
ipcMain.handle('hostsbox.readHosts', () => {
    const hostsPath = getHostsPath();
    try {
        const content = fs.readFileSync(hostsPath, 'utf8');
        return { success: true, data: content };
    } catch (error) {
        return { success: false, msg: '读取 hosts 文件失败: ' + error.message };
    }
});

// ---------------------------------------------------------------------------
// IPC: 应用 hosts 到系统（提权写入）
// ---------------------------------------------------------------------------
ipcMain.handle('hostsbox.applyHosts', async (_e, content) => {
    const tempFile = path.join(os.tmpdir(), 'hostsbox-' + Date.now() + '.tmp');
    fs.writeFileSync(tempFile, content, 'utf8');

    const platform = os.platform();
    const hostsPath = getHostsPath();

    try {
        if (platform === 'linux') {
            // Linux: pkexec 提权
            await runCommand('pkexec', ['sh', '-c', `cat "${tempFile}" > ${hostsPath}`]);
        } else if (platform === 'darwin') {
            // macOS: osascript 提权
            const script = `do shell script "cat \\"${tempFile}\\" > ${hostsPath}" with administrator privileges`;
            await runCommand('osascript', ['-e', script]);
        } else if (platform === 'win32') {
            // Windows: PowerShell 提权
            const psScript = `Start-Process -FilePath cmd.exe -ArgumentList '/c type "${tempFile}" > "${hostsPath}"' -Verb RunAs -Wait`;
            await runCommand('powershell', ['-Command', psScript]);
        } else {
            return { success: false, code: 'failed', msg: '不支持的平台: ' + platform };
        }

        // 清理临时文件
        try { fs.unlinkSync(tempFile); } catch (e) { /* ignore */ }

        // 验证写入是否成功
        let actualContent;
        try {
            actualContent = fs.readFileSync(hostsPath, 'utf8');
        } catch (e) {
            console.error('[cb-hostsbox] 验证读取 hosts 失败:', e);
        }

        if (actualContent) {
            // 归一化换行符后再比较：Windows cmd 重定向（type >）会把 LF 转为 CRLF，
            // 而数据库中存储的 content 可能是 LF-only，导致字节级比较失败。
            // 统一归一化为 LF 后比较，避免换行符差异导致误判。
            const normalizedExpected = content.replace(/\r\n/g, '\n').trim();
            const normalizedActual = actualContent.replace(/\r\n/g, '\n').trim();
            if (normalizedExpected === normalizedActual) {
                return { success: true, code: 'success' };
            }
        }

        return { success: false, code: 'failed', msg: '写入 hosts 失败：内容验证不通过' };
    } catch (error) {
        // 清理临时文件
        try { fs.unlinkSync(tempFile); } catch (e) { /* ignore */ }

        const errMsg = error.message || String(error);
        if (errMsg.includes('Request dismissed') || errMsg.includes('cancel')) {
            return { success: false, code: 'cancel', msg: '用户取消提权' };
        }
        if (errMsg.includes('只读文件系统')) {
            return { success: false, code: 'failed', msg: '写入 hosts 失败：flatpak 沙盒环境无法直接写入系统文件' };
        }
        return { success: false, code: 'failed', msg: '写入 hosts 失败: ' + errMsg };
    }
});

// ---------------------------------------------------------------------------
// IPC: 备份 hosts 文件
// ---------------------------------------------------------------------------
ipcMain.handle('hostsbox.backupHosts', () => {
    const hostsPath = getHostsPath();
    const backupPath = path.join(app.getPath('documents'), 'hosts.backup');

    if (fs.existsSync(backupPath)) {
        return { success: true, skipped: true };
    }

    try {
        const content = fs.readFileSync(hostsPath, 'utf8');
        fs.writeFileSync(backupPath, content, 'utf8');
        return { success: true, skipped: false };
    } catch (error) {
        return { success: false, msg: '备份 hosts 文件失败: ' + error.message };
    }
});

// ---------------------------------------------------------------------------
// IPC: 打开 hosts 所在目录
// ---------------------------------------------------------------------------
ipcMain.handle('hostsbox.openHostsDir', () => {
    shell.showItemInFolder(getHostsPath());
    return { success: true };
});

// ---------------------------------------------------------------------------
// IPC: 打开帮助窗口
// ---------------------------------------------------------------------------
ipcMain.handle('hostsbox.openHelpWindow', () => {
    if (helpWindow && !helpWindow.isDestroyed()) {
        helpWindow.focus();
        return { success: true };
    }

    helpWindow = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 600,
        minHeight: 400,
        resizable: true,
        icon: path.join(__dirname, 'public', 'logo.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
        helpWindow.loadURL('http://localhost:5175/#/help');
        helpWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        helpWindow.loadFile(path.join(__dirname, 'build', 'index.html'), { hash: '/help' });
    }

    // ESC 关闭帮助窗口
    helpWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'Escape') {
            helpWindow.close();
        }
    });

    helpWindow.on('closed', () => {
        helpWindow = null;
    });

    return { success: true };
});

// ---------------------------------------------------------------------------
// IPC: 缩放级别持久化（通过 canbox-core store）
// ---------------------------------------------------------------------------
ipcMain.handle('hostsbox.getZoomLevel', () => {
    try {
        const CORE_PATH = global.__CANBOX_CORE_PATH__;
        const store = require(path.join(CORE_PATH, 'lib', 'store'));
        const zoomStore = store.getStore(global.__CANBOX_ENV__.appId, 'settings', path.join(global.__CANBOX_ENV__.usersPath, 'data'));
        const level = zoomStore.get('zoomLevel');
        return level !== undefined ? parseFloat(level) : 1;
    } catch (error) {
        console.error('[cb-hostsbox] 获取缩放级别失败:', error);
        return 1;
    }
});

ipcMain.handle('hostsbox.saveZoomLevel', (_e, level) => {
    try {
        const CORE_PATH = global.__CANBOX_CORE_PATH__;
        const store = require(path.join(CORE_PATH, 'lib', 'store'));
        const zoomStore = store.getStore(global.__CANBOX_ENV__.appId, 'settings', path.join(global.__CANBOX_ENV__.usersPath, 'data'));
        zoomStore.set('zoomLevel', level);
    } catch (error) {
        console.error('[cb-hostsbox] 保存缩放级别失败:', error);
    }
});

// ---------------------------------------------------------------------------
// IPC: 系统通知
// ---------------------------------------------------------------------------
ipcMain.handle('hostsbox.notification', (_e, options) => {
    if (Notification.isSupported()) {
        const n = new Notification({
            title: options.title || 'CB HostsBox',
            body: options.body || '',
            icon: path.join(__dirname, 'public', 'logo.png')
        });
        n.show();
        return { success: true };
    }
    return { success: false, msg: '系统不支持通知' };
});

// ---------------------------------------------------------------------------
// 辅助：执行子命令并返回 Promise
// ---------------------------------------------------------------------------
function runCommand(cmd, args) {
    return new Promise((resolve, reject) => {
        execFile(cmd, args, { timeout: 30000 }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

// ---------------------------------------------------------------------------
// 创建主窗口
// ---------------------------------------------------------------------------
function createWindow() {
    // 从 core store 读取上次窗口状态
    const CORE_PATH = global.__CANBOX_CORE_PATH__;
    const store = require(path.join(CORE_PATH, 'lib', 'store'));
    const winStateStore = store.getStore(global.__CANBOX_ENV__.appId, 'winState', path.join(global.__CANBOX_ENV__.usersPath, 'data'));
    const savedBounds = winStateStore.get('bounds');

    mainWindow = new BrowserWindow({
        width: savedBounds ? savedBounds.width : 1000,
        height: savedBounds ? savedBounds.height : 700,
        x: savedBounds ? savedBounds.x : undefined,
        y: savedBounds ? savedBounds.y : undefined,
        minWidth: 1000,
        minHeight: 600,
        resizable: true,
        icon: path.join(__dirname, 'public', 'logo.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    const isDev = process.env.NODE_ENV === 'development';
    console.log('[cb-hostsbox] NODE_ENV =', JSON.stringify(process.env.NODE_ENV), 'isDev =', isDev);
    if (isDev) {
        mainWindow.loadURL('http://localhost:5175');
        mainWindow.webContents.on('did-finish-load', () => {
            mainWindow.webContents.openDevTools({ mode: 'detach' });
        });
    } else {
        mainWindow.loadFile(path.join(__dirname, 'build', 'index.html'));
    }

    // 窗口关闭前保存窗口状态
    mainWindow.on('close', () => {
        const bounds = mainWindow.getBounds();
        winStateStore.set('bounds', bounds);
    });

    // 缩放快捷键（无论菜单是否可见都生效）
    mainWindow.webContents.on('before-input-event', (event, input) => {
        const ctrl = input.control || input.meta;
        if (ctrl && (input.key === '=' || input.key === '+')) {
            event.preventDefault();
            const current = mainWindow.webContents.getZoomFactor();
            mainWindow.webContents.setZoomFactor(Math.min(current + 0.1, 3.0));
        } else if (ctrl && input.key === '-') {
            event.preventDefault();
            const current = mainWindow.webContents.getZoomFactor();
            mainWindow.webContents.setZoomFactor(Math.max(current - 0.1, 0.5));
        } else if (ctrl && input.key === '0') {
            event.preventDefault();
            mainWindow.webContents.setZoomFactor(1.0);
        }
    });
}

// ---------------------------------------------------------------------------
// 初始化：首次备份 hosts + 保存到数据库
// ---------------------------------------------------------------------------
async function createFirstBackup() {
    const hostsPath = getHostsPath();

    // 备份到文件
    try {
        const backupPath = path.join(app.getPath('documents'), 'hosts.backup');
        if (!fs.existsSync(backupPath)) {
            const content = fs.readFileSync(hostsPath, 'utf8');
            fs.writeFileSync(backupPath, content, 'utf8');
        }
    } catch (e) {
        console.warn('[cb-hostsbox] 备份 hosts 文件失败:', e);
    }

    // 保存默认 hosts 到数据库
    try {
        const CORE_PATH = global.__CANBOX_CORE_PATH__;
        const db = require(path.join(CORE_PATH, 'lib', 'db'));
        const appDb = db.getAppDb(global.__CANBOX_ENV__.appId, path.join(global.__CANBOX_ENV__.usersPath, 'data'));

        // 查询是否已存在 default 条目
        const existing = await appDb.find({
            selector: { type: 'hosts_entry', name: 'default' },
            limit: 1
        });

        if (existing.docs && existing.docs.length > 0) {
            return;
        }

        const hostsContent = fs.readFileSync(hostsPath, 'utf8');
        const { randomUUID } = require('crypto');
        await appDb.put({
            _id: randomUUID(),
            type: 'hosts_entry',
            name: 'default',
            content: hostsContent,
            active: false,
            createTime: Date.now()
        });
    } catch (e) {
        console.warn('[cb-hostsbox] 保存默认 hosts 到数据库失败:', e);
    }
}

app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();
    createFirstBackup();
});

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
