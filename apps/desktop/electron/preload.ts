import { contextBridge, ipcRenderer } from "electron";

/**
 * Minimal, audited bridge — never expose Node or arbitrary IPC.
 */
contextBridge.exposeInMainWorld("vaneDesktop", {
  getEnv: () => ipcRenderer.invoke("vane:get-env") as Promise<{
    appUrl: string;
    isDev: boolean;
    platform: string;
    version: string;
  }>,
  openExternal: (url: string) => ipcRenderer.invoke("vane:open-external", url),
  isDesktop: true as const,
});
