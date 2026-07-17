// 定义 window.hostsbox 与 window.hostsboxDB 的类型（新架构，canbox-core IPC 通道）
export {}; // 确保文件被识别为模块

declare const __APP_VERSION__: string;
declare const __APP_DESCRIPTION__: string;

declare global {
    interface Window {
        hostsbox: {
            /** 读取系统 hosts 文件 */
            getHosts: () => Promise<{ success: boolean; data?: string; msg?: string }>;
            /** 应用 hosts 内容到系统（含提权） */
            applyHosts: (content: string) => Promise<{ success: boolean; code?: string; msg?: string }>;
            /** 打开 hosts 所在目录 */
            openHostsDir: () => Promise<{ success: boolean; msg?: string }>;
            /** 备份 hosts 文件 */
            backupHosts: () => Promise<{ success: boolean; skipped?: boolean; msg?: string }>;
            /** 获取缩放级别 */
            getZoomLevel: () => Promise<number>;
            /** 保存缩放级别 */
            saveZoomLevel: (level: number) => void;
            /** 打开帮助窗口 */
            openHelpWindow: () => void;
            /** 设置 webFrame 缩放 */
            setZoom: (factor: number) => void;
        };

        hostsboxDB: {
            /** 获取所有 hosts 配置 */
            getAllEntries: () => Promise<{ success: boolean; data?: any[]; msg?: string }>;
            /** 创建 hosts 配置 */
            createEntry: (entry: any) => Promise<{ success: boolean; id?: string; rev?: string; doc?: any; msg?: string }>;
            /** 更新 hosts 配置 */
            updateEntry: (entry: any) => Promise<{ success: boolean; rev?: string; msg?: string }>;
            /** 删除 hosts 配置 */
            deleteEntry: (id: string, rev: string) => Promise<{ success: boolean; msg?: string }>;
        };
    }
}
