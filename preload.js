const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kuno', {
  login: (creds) => ipcRenderer.invoke('auth:login', creds),
  register: (creds) => ipcRenderer.invoke('auth:register', creds),
  getSysInfo: () => ipcRenderer.invoke('sys:info'),
  getDisks: () => ipcRenderer.invoke('sys:disks'),
  runCleanup: (mode) => ipcRenderer.invoke('sys:cleanup', { mode }),
  getStartup: () => ipcRenderer.invoke('sys:startup'),
  disableStartup: (cmd) => ipcRenderer.invoke('sys:disable-startup', cmd),
});
