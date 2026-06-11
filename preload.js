const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kuno', {
  login: (creds) => ipcRenderer.invoke('auth:login', creds),
  register: (creds) => ipcRenderer.invoke('auth:register', creds),
  getSysInfo: () => ipcRenderer.invoke('sys:info'),
  getDisks: () => ipcRenderer.invoke('sys:disks'),
  runCleanup: (mode) => ipcRenderer.invoke('sys:cleanup', { mode }),
  getStartup: () => ipcRenderer.invoke('sys:startup'),
  disableStartup: (cmd) => ipcRenderer.invoke('sys:disable-startup', cmd),
  createRestorePoint: () => ipcRenderer.invoke('sys:restore-point'),
  applyPreset: (name) => ipcRenderer.invoke('sys:apply-preset', name),
  minimize: () => ipcRenderer.invoke('win:minimize'),
  maximize: () => ipcRenderer.invoke('win:maximize'),
  close: () => ipcRenderer.invoke('win:close'),
});
