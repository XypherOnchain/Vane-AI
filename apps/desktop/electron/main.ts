import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  Menu,
  nativeTheme,
} from "electron";
import path from "node:path";
import { startLocalSidecar } from "./sidecar.js";

/**
 * Vane Desktop — Electron shell (the “download like Cursor” surface).
 *
 * Dev: loads the Next.js Debug UI at APP_URL (default http://localhost:3000).
 * Deep links: vane://debug/tx/<hash>
 * Local sidecar: 127.0.0.1:4010 for offline-ish workspace helpers.
 */

const APP_URL = process.env.VANE_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";
const API_URL = process.env.VANE_API_URL ?? process.env.API_URL ?? "http://localhost:4000";
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let pendingDeepLink: string | null = null;
let sidecarClose: (() => void) | null = null;

function resolveDeepLink(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol !== "vane:") return `${APP_URL}/debug`;
    const route = `${u.hostname}${u.pathname}`.replace(/^\/+/, "");
    return `${APP_URL}/${route}${u.search}`;
  } catch {
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
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin" ? [{ role: "appMenu" as const }] : []),
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
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const link = argv.find((a) => a.startsWith("vane://"));
    if (link) {
      const url = resolveDeepLink(link);
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        void mainWindow.loadURL(url);
      } else {
        pendingDeepLink = url;
      }
    }
  });
}

app.on("open-url", (event, url) => {
  event.preventDefault();
  const resolved = resolveDeepLink(url);
  if (mainWindow) void mainWindow.loadURL(resolved);
  else pendingDeepLink = resolved;
});

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("vane", process.execPath, [path.resolve(process.argv[1]!)]);
  }
} else {
  app.setAsDefaultProtocolClient("vane");
}

app.whenReady().then(() => {
  const sidecar = startLocalSidecar({ apiUrl: API_URL });
  sidecarClose = sidecar.close;

  buildMenu();
  const fromArgv = process.argv.find((a) => a.startsWith("vane://"));
  const start = pendingDeepLink ?? (fromArgv ? resolveDeepLink(fromArgv) : "/debug");
  createWindow(start.startsWith("http") ? start : start);

  ipcMain.handle("vane:get-env", () => ({
    appUrl: APP_URL,
    apiUrl: API_URL,
    sidecarUrl: `http://127.0.0.1:${sidecar.port}`,
    isDev,
    platform: process.platform,
    version: app.getVersion(),
    liveEnabled: false,
    modes: ["simulation", "testnet", "live"] as const,
  }));

  ipcMain.handle("vane:open-external", (_e, url: string) => {
    if (typeof url === "string" && (url.startsWith("https://") || url.startsWith("http://"))) {
      void shell.openExternal(url);
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow("/debug");
  });

  console.log(
    `[vane-desktop] ready · appUrl=${APP_URL} · sidecar=${sidecar.port} · packaged=${app.isPackaged}`,
  );
  console.log(`[vane-desktop] dist: pnpm desktop:dist → apps/desktop/release (unsigned .dmg for internal testing)`);
});

app.on("window-all-closed", () => {
  sidecarClose?.();
  if (process.platform !== "darwin") app.quit();
});
