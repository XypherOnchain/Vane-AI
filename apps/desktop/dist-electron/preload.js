import { contextBridge, ipcRenderer } from "electron";
/**
 * Minimal, audited bridge — never expose Node or arbitrary IPC.
 */
contextBridge.exposeInMainWorld("vaneDesktop", {
    getEnv: () => ipcRenderer.invoke("vane:get-env"),
    openExternal: (url) => ipcRenderer.invoke("vane:open-external", url),
    isDesktop: true,
});
