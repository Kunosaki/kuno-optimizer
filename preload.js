const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kuno', {
  login: (creds) => ipcRenderer.invoke('auth:login', creds),
  register: (creds) => ipcRenderer.invoke('auth:register', creds),
  getSysInfo: () => ipcRenderer.invoke('sys:info'),
  getDisks: () => ipcRenderer.invoke('sys:disks'),
  runCleanup: (mode) => ipcRenderer.invoke('sys:cleanup', { mode }),
  getStartup: () => ipcRenderer.invoke('sys:startup'),
  disableStartup: (entry) => ipcRenderer.invoke('sys:disable-startup', entry),
  createRestorePoint: () => ipcRenderer.invoke('sys:restore-point'),
  applyPreset: (name) => ipcRenderer.invoke('sys:apply-preset', name),
  minimize: () => ipcRenderer.invoke('win:minimize'),
  maximize: () => ipcRenderer.invoke('win:maximize'),
  close: () => ipcRenderer.invoke('win:close'),
  // Privacy
  getPrivacyServices: () => ipcRenderer.invoke('sys:privacy-services'),
  setService: (opts) => ipcRenderer.invoke('sys:set-service', opts),
  getUwpApps: () => ipcRenderer.invoke('sys:uwp-apps'),
  uninstallUwp: (opts) => ipcRenderer.invoke('sys:uninstall-uwp', opts),
  // Network
  flushDns: () => ipcRenderer.invoke('net:flush-dns'),
  setDns: (opts) => ipcRenderer.invoke('net:set-dns', opts),
  dnsDhcp: () => ipcRenderer.invoke('net:dns-dhcp'),
  // Hosts
  getHosts: () => ipcRenderer.invoke('sys:get-hosts'),
  saveHosts: (opts) => ipcRenderer.invoke('sys:save-hosts', opts),
  // Registry
  registryScan: () => ipcRenderer.invoke('sys:registry-scan'),
  registryFix: (opts) => ipcRenderer.invoke('sys:registry-fix', opts),
  // Hardware
  detectHardware: () => ipcRenderer.invoke('sys:detect-hardware'),
  applyGpuTweaks: (opts) => ipcRenderer.invoke('sys:apply-gpu-tweaks', opts),
  // Quick scan
  quickScan: () => ipcRenderer.invoke('sys:quick-scan'),
  freeMemory: () => ipcRenderer.invoke('sys:free-memory'),
  // Game booster
  gameBooster: (opts) => ipcRenderer.invoke('sys:game-booster', opts),
  // Latency
  latencyTweaks: () => ipcRenderer.invoke('sys:latency-tweaks'),
  // Debloat apps
  debloatDiscord: () => ipcRenderer.invoke('sys:debloat-discord'),
  debloatSpotify: () => ipcRenderer.invoke('sys:debloat-spotify'),
});
