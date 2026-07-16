"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("vaneDesktop", {
    getEnv: () => electron_1.ipcRenderer.invoke("vane:get-env"),
    openExternal: (url) => electron_1.ipcRenderer.invoke("vane:open-external", url),
    isDesktop: true,
});
