"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
/**
 * Vane Desktop — Electron shell (the “download like Cursor” surface).
 *
 * Dev: loads the Next.js Debug UI at APP_URL (default http://localhost:3000).
 * Deep links: vane://debug/tx/<hash>
 */
const APP_URL = process.env.VANE_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";
const isDev = !electron_1.app.isPackaged;
let mainWindow = null;
let pendingDeepLink = null;
function resolveDeepLink(url) {
    try {
        const u = new URL(url);
        if (u.protocol !== "vane:")
            return `${APP_URL}/debug`;
        const route = `${u.hostname}${u.pathname}`.replace(/^\/+/, "");
        return `${APP_URL}/${route}${u.search}`;
    }
    catch {
        return `${APP_URL}/debug`;
    }
}
function createWindow(initialPath = "/debug") {
    electron_1.nativeTheme.themeSource = "dark";
    mainWindow = new electron_1.BrowserWindow({
        width: 1440,
        height: 920,
        minWidth: 980,
        minHeight: 640,
        title: "Vane",
        backgroundColor: "#07090c",
        titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
        trafficLightPosition: { x: 16, y: 16 },
        webPreferences: {
            preload: node_path_1.default.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });
    const target = initialPath.startsWith("http") ? initialPath : `${APP_URL}${initialPath}`;
    void mainWindow.loadURL(target);
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        void electron_1.shell.openExternal(url);
        return { action: "deny" };
    });
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}
function buildMenu() {
    const template = [
        ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
        {
            label: "File",
            submenu: [
                {
                    label: "Open Debug Workspace",
                    accelerator: "CmdOrCtrl+1",
                    click: () => void mainWindow?.loadURL(`${APP_URL}/debug`),
                },
                {
                    label: "Open Tx Inspector",
                    accelerator: "CmdOrCtrl+2",
                    click: () => void mainWindow?.loadURL(`${APP_URL}/debug/tx`),
                },
                { type: "separator" },
                process.platform === "darwin" ? { role: "close" } : { role: "quit" },
            ],
        },
        { role: "editMenu" },
        { role: "viewMenu" },
        {
            label: "Vane",
            submenu: [
                {
                    label: "AI Chat",
                    accelerator: "CmdOrCtrl+3",
                    click: () => void mainWindow?.loadURL(`${APP_URL}/debug/chat`),
                },
                {
                    label: "Project Memory",
                    accelerator: "CmdOrCtrl+4",
                    click: () => void mainWindow?.loadURL(`${APP_URL}/debug/memory`),
                },
                {
                    label: "Repair",
                    click: () => void mainWindow?.loadURL(`${APP_URL}/debug/repair`),
                },
            ],
        },
    ];
    electron_1.Menu.setApplicationMenu(electron_1.Menu.buildFromTemplate(template));
}
const gotLock = electron_1.app.requestSingleInstanceLock();
if (!gotLock) {
    electron_1.app.quit();
}
else {
    electron_1.app.on("second-instance", (_event, argv) => {
        const link = argv.find((a) => a.startsWith("vane://"));
        if (link) {
            const url = resolveDeepLink(link);
            if (mainWindow) {
                if (mainWindow.isMinimized())
                    mainWindow.restore();
                mainWindow.focus();
                void mainWindow.loadURL(url);
            }
            else {
                pendingDeepLink = url;
            }
        }
    });
}
electron_1.app.on("open-url", (event, url) => {
    event.preventDefault();
    const resolved = resolveDeepLink(url);
    if (mainWindow)
        void mainWindow.loadURL(resolved);
    else
        pendingDeepLink = resolved;
});
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        electron_1.app.setAsDefaultProtocolClient("vane", process.execPath, [node_path_1.default.resolve(process.argv[1])]);
    }
}
else {
    electron_1.app.setAsDefaultProtocolClient("vane");
}
electron_1.app.whenReady().then(() => {
    buildMenu();
    const fromArgv = process.argv.find((a) => a.startsWith("vane://"));
    const start = pendingDeepLink ?? (fromArgv ? resolveDeepLink(fromArgv) : "/debug");
    createWindow(start.startsWith("http") ? start : start);
    electron_1.ipcMain.handle("vane:get-env", () => ({
        appUrl: APP_URL,
        isDev,
        platform: process.platform,
        version: electron_1.app.getVersion(),
    }));
    electron_1.ipcMain.handle("vane:open-external", (_e, url) => {
        if (typeof url === "string" && (url.startsWith("https://") || url.startsWith("http://"))) {
            void electron_1.shell.openExternal(url);
        }
    });
    electron_1.app.on("activate", () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow("/debug");
    });
    console.log(`[vane-desktop] ready · appUrl=${APP_URL} · packaged=${electron_1.app.isPackaged}`);
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin")
        electron_1.app.quit();
});
