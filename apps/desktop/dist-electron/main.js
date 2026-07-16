import { app, BrowserWindow, shell, ipcMain, Menu, nativeTheme, } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
/**
 * Vane Desktop — Electron shell (the “download like Cursor” surface).
 *
 * Dev: loads the Next.js Debug UI at APP_URL (default http://localhost:3000).
 * Prod: same, or a bundled static export later. Deep links: vane://debug/tx/<hash>
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_URL = process.env.VANE_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";
const isDev = !app.isPackaged;
let mainWindow = null;
let pendingDeepLink = null;
function resolveDeepLink(url) {
    // vane://debug/tx/0xabc → http://localhost:3000/debug/tx/0xabc
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
    nativeTheme.themeSource = "dark";
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 920,
        minWidth: 980,
        minHeight: 640,
        title: "Vane",
        backgroundColor: "#07090c",
        titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
        trafficLightPosition: { x: 16, y: 16 },
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });
    const target = initialPath.startsWith("http") ? initialPath : `${APP_URL}${initialPath}`;
    void mainWindow.loadURL(target);
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        void shell.openExternal(url);
        return { action: "deny" };
    });
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}
function buildMenu() {
    const template = [
        ...(process.platform === "darwin"
            ? [{ role: "appMenu" }]
            : []),
        {
            label: "File",
            submenu: [
                {
                    label: "Open Debug Workspace",
                    accelerator: "CmdOrCtrl+1",
                    click: () => mainWindow?.loadURL(`${APP_URL}/debug`),
                },
                {
                    label: "Open Tx Inspector",
                    accelerator: "CmdOrCtrl+2",
                    click: () => mainWindow?.loadURL(`${APP_URL}/debug/tx`),
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
                    label: "Radar (chain intel)",
                    click: () => mainWindow?.loadURL(`${APP_URL}/radar`),
                },
                {
                    label: "Project Memory",
                    click: () => mainWindow?.loadURL(`${APP_URL}/debug/memory`),
                },
                { type: "separator" },
                {
                    label: "Docs — Product Framework",
                    click: () => shell.openExternal("https://github.com/XypherOnchain/Vane-AI/blob/main/docs/PRODUCT.md"),
                },
            ],
        },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
// Single instance + deep links (Windows/Linux)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
}
else {
    app.on("second-instance", (_event, argv) => {
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
// macOS deep links
app.on("open-url", (event, url) => {
    event.preventDefault();
    const resolved = resolveDeepLink(url);
    if (mainWindow)
        void mainWindow.loadURL(resolved);
    else
        pendingDeepLink = resolved;
});
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient("vane", process.execPath, [path.resolve(process.argv[1])]);
    }
}
else {
    app.setAsDefaultProtocolClient("vane");
}
app.whenReady().then(() => {
    buildMenu();
    const fromArgv = process.argv.find((a) => a.startsWith("vane://"));
    const start = pendingDeepLink ?? (fromArgv ? resolveDeepLink(fromArgv) : "/debug");
    createWindow(start.startsWith("http") ? start : start);
    ipcMain.handle("vane:get-env", () => ({
        appUrl: APP_URL,
        isDev,
        platform: process.platform,
        version: app.getVersion(),
    }));
    ipcMain.handle("vane:open-external", (_e, url) => {
        if (typeof url === "string" && (url.startsWith("https://") || url.startsWith("http://"))) {
            void shell.openExternal(url);
        }
    });
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0)
            createWindow("/debug");
    });
});
app.on("window-all-closed", () => {
    if (process.platform !== "darwin")
        app.quit();
});
console.log(`[vane-desktop] ready · appUrl=${APP_URL} · packaged=${app.isPackaged}`);
