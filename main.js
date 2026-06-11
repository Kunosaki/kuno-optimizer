const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
const os = require('os');

let mainWindow;
let tray = null;
let PROFILES_FILE;

function createTray() {
  const iconPath = path.join(__dirname, 'tray-icon.png');
  if (!fs.existsSync(iconPath)) return;
  tray = new Tray(nativeImage.createFromPath(iconPath));
  tray.setToolTip('Kuno Optimizer');
  const ctx = Menu.buildFromTemplate([
    { label: 'Show Kuno', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(ctx);
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
}

function getProfilesPath() {
  if (!PROFILES_FILE) PROFILES_FILE = path.join(app.getPath('userData'), 'profiles.json');
  return PROFILES_FILE;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960, height: 680, minWidth: 720, minHeight: 500,
    frame: false, show: false,
    backgroundColor: '#1c1c1e',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('minimize', (e) => { e.preventDefault(); mainWindow.hide(); });
  mainWindow.on('close', (e) => { if (!app.isQuitting) { e.preventDefault(); mainWindow.hide(); } });
  createTray();
  app.on('before-quit', () => { app.isQuitting = true; });

// === QUICK SCANNER (preview what can be deleted) ===
ipcMain.handle('sys:quick-scan', async () => {
  const homedir = os.homedir();
  const targets = [
    { label: 'Windows Temp', path: os.tmpdir() },
    { label: 'User Temp', path: path.join(homedir, 'AppData', 'Local', 'Temp') },
    { label: 'Prefetch', path: path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'Prefetch') },
    { label: 'Chrome Cache', path: path.join(homedir, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Cache') },
    { label: 'Edge Cache', path: path.join(homedir, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache') },
  ];
  const ffProfiles = path.join(homedir, 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles');
  if (fs.existsSync(ffProfiles)) {
    try {
      for (const p of fs.readdirSync(ffProfiles)) {
        const cache2 = path.join(ffProfiles, p, 'cache2', 'entries');
        if (fs.existsSync(cache2)) targets.push({ label: 'Firefox Cache', path: cache2 });
      }
    } catch {}
  }
  const results = [];
  let totalSize = 0, totalItems = 0;
  for (const t of targets) {
    if (!fs.existsSync(t.path)) continue;
    let size = 0, items = 0;
    try {
      for (const f of fs.readdirSync(t.path)) {
        try {
          const full = path.join(t.path, f);
          const stat = fs.statSync(full);
          size += stat.size;
          items++;
          if (stat.isDirectory()) {
            try { const sub = fs.readdirSync(full); items += sub.length; for (const s of sub) { try { size += fs.statSync(path.join(full, s)).size; } catch {} } } catch {}
          }
        } catch {}
      }
    } catch {}
    if (items > 0) {
      results.push({ label: t.label, items, size });
      totalSize += size; totalItems += items;
    }
  }
  return { results, totalSize, totalItems };
});

// === MEMORY CLEANER ===
ipcMain.handle('sys:free-memory', async () => {
  try {
    execSync('powershell -Command "Get-Process | Where-Object { $_.WorkingSet64 -gt 5MB } | ForEach-Object { try { $null = $_.PriorityClass; $_.Refresh() } catch {} }; [System.GC]::Collect(); [System.GC]::WaitForPendingFinalizers()"', { timeout: 10000 });
    const free = os.freemem();
    return { success: true, freed: os.totalmem() - free, free };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// === GAME BOOSTER ===
ipcMain.handle('sys:game-booster', async (_, { action }) => {
  try {
    const services = ['SysMain', 'WSearch', 'TabletInputService', 'lfsvc', 'PcaSvc', 'WbioSrvc'];
    const cmd = action === 'on' ? 'stop' : 'start';
    for (const svc of services) {
      try { execSync(`sc ${cmd} "${svc}"`, { timeout: 3000 }); } catch {}
    }
    if (action === 'on') {
      execSync('powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', { timeout: 3000 });
    }
    return { success: true };
  } catch { return { success: false, error: 'Failed to toggle game booster' }; }
});

// === LATENCY TWEAKS ===
ipcMain.handle('sys:latency-tweaks', async () => {
  const results = [];
  // Disable HPET
  try {
    execSync('bcdedit /deletevalue useplatformclock 2>nul', { timeout: 3000 });
    results.push('HPET disabled (reboot required)');
  } catch {}
  // Mouse/keyboard registry tweaks
  try {
    execSync('reg add "HKCU\\Control Panel\\Mouse" /v MouseSensitivity /t REG_DWORD /d 10 /f', { timeout: 2000 });
    execSync('reg add "HKCU\\Control Panel\\Mouse" /v MouseSpeed /t REG_DWORD /d 0 /f', { timeout: 2000 });
    execSync('reg add "HKCU\\Control Panel\\Keyboard" /v KeyboardDelay /t REG_DWORD /d 0 /f', { timeout: 2000 });
    execSync('reg add "HKCU\\Control Panel\\Keyboard" /v KeyboardSpeed /t REG_DWORD /d 31 /f', { timeout: 2000 });
    results.push('Mouse/keyboard latency optimized');
  } catch {}
  return { success: true, results };
});

// === DEBLOAT APPS ===
ipcMain.handle('sys:debloat-discord', async () => {
  try {
    const local = path.join(os.homedir(), 'AppData', 'Local', 'Discord');
    if (fs.existsSync(local)) {
      for (const v of fs.readdirSync(local)) {
        const lp = path.join(local, v, 'modules');
        if (fs.existsSync(lp)) {
          for (const mod of fs.readdirSync(lp)) {
            try { fs.rmSync(path.join(lp, mod, 'discord_voice'), { recursive: true, force: true }); } catch {}
          }
        }
      }
    }
    return { success: true, message: 'Discord debloated (voice modules removed)' };
  } catch { return { success: false, error: 'Discord not found' }; }
});

ipcMain.handle('sys:debloat-spotify', async () => {
  try {
    const spotDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Spotify');
    if (fs.existsSync(spotDir)) {
      for (const f of fs.readdirSync(spotDir)) {
        if (f.includes('locale') || f.includes('lang')) {
          try { fs.rmSync(path.join(spotDir, f), { recursive: true, force: true }); } catch {}
        }
      }
    }
    // Also check Program Files
    const pfDir = path.join(process.env.APPDATA || '', 'Spotify');
    if (fs.existsSync(pfDir)) {
      const locales = path.join(pfDir, 'locales');
      if (fs.existsSync(locales)) {
        for (const f of fs.readdirSync(locales)) {
          try { fs.unlinkSync(path.join(locales, f)); } catch {}
        }
      }
    }
    return { success: true, message: 'Spotify debloated (language packs removed)' };
  } catch { return { success: false, error: 'Spotify not found' }; }
});
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('win:minimize', () => mainWindow?.minimize());
ipcMain.handle('win:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize(); else mainWindow?.maximize();
});
ipcMain.handle('win:close', () => mainWindow?.close());

// Restore Point
ipcMain.handle('sys:restore-point', async () => {
  try {
    execSync('powershell -Command "Checkpoint-Computer -Description \'Kuno Optimizer Restore Point\' -RestorePointType MODIFY_SETTINGS"', { timeout: 30000 });
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Create failed. Try running as Admin.' };
  }
});

// Presets — real optimization
ipcMain.handle('sys:apply-preset', async (_, name) => {
  try {
    const cmds = {
      gaming: [
        'powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', // High performance
        'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 2 /f',
      ],
      work: [
        'powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2f', // Balanced
      ],
      battery: [
        'powercfg /setactive a1841308-3541-4fab-bc81-f71556f20b4a', // Power saver
        'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 0 /f',
      ],
      balanced: [
        'powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2f', // Balanced
        'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 1 /f',
      ],
    };
    const commands = cmds[name] || cmds.balanced;
    for (const cmd of commands) {
      try { execSync(cmd, { timeout: 5000 }); } catch {}
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to apply preset' };
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// Profile management
function loadProfiles() {
  try {
    return JSON.parse(fs.readFileSync(getProfilesPath(), 'utf8'));
  } catch { return {}; }
}

function saveProfiles(profiles) {
  fs.writeFileSync(getProfilesPath(), JSON.stringify(profiles, null, 2));
}

ipcMain.handle('auth:login', (_, { username, password }) => {
  const profiles = loadProfiles();
  if (profiles[username] && profiles[username].password === password) {
    return { success: true, profile: profiles[username] };
  }
  return { success: false, error: 'Invalid username or password' };
});

ipcMain.handle('auth:register', (_, { username, password }) => {
  const profiles = loadProfiles();
  if (profiles[username]) return { success: false, error: 'Username already exists' };
  profiles[username] = { username, password, created: Date.now(), preset: 'balanced' };
  saveProfiles(profiles);
  return { success: true, profile: profiles[username] };
});

// System info
ipcMain.handle('sys:info', () => {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    cpuModel: os.cpus()[0]?.model || 'Unknown',
    totalMem: os.totalmem(),
    freeMem: os.freemem(),
    uptime: os.uptime(),
    osType: os.type(),
    osRelease: os.release(),
    homedir: os.homedir(),
  };
});

ipcMain.handle('sys:disks', () => {
  const disks = [];
  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i);
    const root = letter + ':\\';
    try {
      const info = execSync(`wmic logicaldisk where "DeviceID='${root}'" get Size,FreeSpace /format:csv`, { encoding: 'utf8', timeout: 3000 });
      const lines = info.split('\n').filter(l => l.trim() && !l.includes('FreeSpace'));
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 3 && parts[2].trim()) {
          const total = parseInt(parts[2].trim());
          const free = parseInt(parts[1].trim());
          if (total > 0) {
            disks.push({ drive: root.replace(':\\', ''), total, free, used: total - free });
          }
        }
      }
    } catch {}
  }
  return disks;
});

ipcMain.handle('sys:cleanup', async (_, { mode }) => {
  const results = [];
  const homedir = os.homedir();

  const browserDirs = [
    path.join(homedir, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Cache'),
    path.join(homedir, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'),
  ];

  const ffProfiles = path.join(homedir, 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles');
  if (fs.existsSync(ffProfiles)) {
    try {
      for (const p of fs.readdirSync(ffProfiles)) {
        const cache2 = path.join(ffProfiles, p, 'cache2', 'entries');
        if (fs.existsSync(cache2)) browserDirs.push(cache2);
      }
    } catch {}
  }

  const dirs = {
    temp: [os.tmpdir(), path.join(homedir, 'AppData', 'Local', 'Temp')],
    prefetch: [path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'Prefetch')],
    browser: browserDirs,
  };

  const targets = mode === 'quick' ? ['temp'] :
                  mode === 'deep' ? ['temp', 'prefetch', 'browser'] :
                  ['temp', 'prefetch', 'browser'];

  for (const category of targets) {
    for (const dir of dirs[category]) {
      if (!fs.existsSync(dir)) continue;
      let count = 0, size = 0;
      try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          try {
            const full = path.join(dir, item);
            const stat = fs.statSync(full);
            size += stat.size;
            if (stat.isDirectory()) {
              fs.rmSync(full, { recursive: true, force: true });
            } else {
              fs.unlinkSync(full);
            }
            count++;
          } catch {}
        }
      } catch {}
      if (count > 0) results.push({ category, dir, cleaned: count, size });
    }
  }
  return { success: true, results };
});

ipcMain.handle('sys:startup', async () => {
  const items = [];
  try {
    const out = execSync('wmic startup get caption,command /format:csv', { encoding: 'utf8', timeout: 5000 });
    const lines = out.split('\n').filter(l => l.trim() && !l.includes('Caption'));
    for (const line of lines) {
      const parts = line.split(',');
      if (parts.length >= 3) {
        items.push({ name: parts[1]?.trim() || parts[2]?.trim(), command: parts[2]?.trim() || '' });
      }
    }
  } catch {}
  return items;
});

ipcMain.handle('sys:disable-startup', async (_, { name }) => {
  try {
    execSync(`reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "${name}" /f 2>nul`, { timeout: 3000 });
    return { success: true };
  } catch {
    return { success: false, error: 'Could not disable startup entry' };
  }
});

// === PRIVACY — Services ===
ipcMain.handle('sys:privacy-services', async () => {
  const services = [
    { name: 'DiagTrack', label: 'Connected User Experiences and Telemetry', desc: 'Collects telemetry data sent to Microsoft. Disabling improves privacy.' },
    { name: 'dmwappushservice', label: 'Device Management WAP Push', desc: 'Pushes device management and sync settings. Safe to disable for privacy.' },
    { name: 'WMPNetworkSvc', label: 'WMP Network Sharing', desc: 'Shares Windows Media Player libraries. Safe to disable if not streaming.' },
    { name: 'RemoteRegistry', label: 'Remote Registry', desc: 'Allows remote registry editing. Security risk — safe to disable.' },
    { name: 'SysMain', label: 'SysMain (Superfetch)', desc: 'Preloads frequently used apps into RAM. Disabling frees memory, may slow app launch.' },
    { name: 'WSearch', label: 'Windows Search Indexer', desc: 'Indexes files for fast search. Disabling saves CPU but slows file searches.' },
    { name: 'XblAuthManager', label: 'Xbox Live Auth Manager', desc: 'Handles Xbox Live authentication. Safe to disable if you don\'t use Xbox.' },
    { name: 'XboxNetApiSvc', label: 'Xbox Live Networking', desc: 'Networking for Xbox Live. Safe to disable if you don\'t use Xbox.' },
    { name: 'lfsvc', label: 'Geolocation Service', desc: 'Provides location data to apps. Disabling improves privacy.' },
    { name: 'MapsBroker', label: 'Downloaded Maps Manager', desc: 'Manages downloaded maps. Safe to disable if not using Maps app.' },
    { name: 'PcaSvc', label: 'Program Compatibility Assistant', desc: 'Detects compatibility issues. Can be disabled to reduce background CPU.' },
    { name: 'WbioSrvc', label: 'Windows Biometric Service', desc: 'Handles fingerprint/face login. Disable if you use PIN/password only.' },
    { name: 'wlidsvc', label: 'Microsoft Account Sign-in Assistant', desc: 'Manages Microsoft account sign-in. Safe to disable for local accounts.' },
  ];
  const results = [];
  for (const svc of services) {
    try {
      const out = execSync(`sc query "${svc.name}"`, { encoding: 'utf8', timeout: 3000 });
      const running = out.includes('RUNNING');
      results.push({ ...svc, exists: true, running });
    } catch { results.push({ ...svc, exists: false, running: false }); }
  }
  return results;
});

ipcMain.handle('sys:set-service', async (_, { name, action }) => {
  try {
    execSync(`sc ${action} "${name}"`, { timeout: 5000 });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// === PRIVACY — UWP Apps ===
ipcMain.handle('sys:uwp-apps', async () => {
  try {
    const out = execSync('powershell -Command "Get-AppxPackage | Select-Object Name, PackageFullName | ConvertTo-Json"', { encoding: 'utf8', timeout: 10000 });
    const apps = JSON.parse(out);
    return Array.isArray(apps) ? apps.map(a => ({ name: a.Name, fullName: a.PackageFullName })) : [];
  } catch { return []; }
});

ipcMain.handle('sys:uninstall-uwp', async (_, { fullName }) => {
  const safeName = fullName.replace(/'/g, "''");
  try {
    execSync(`powershell -Command "Get-AppxPackage -AllUsers '${safeName}' | Remove-AppxPackage -AllUsers"`, { timeout: 20000 });
    return { success: true };
  } catch {
    try {
      execSync(`powershell -Command "Get-AppxPackage '${safeName}' | Remove-AppxPackage"`, { timeout: 20000 });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
});

// === NETWORK ===
ipcMain.handle('net:flush-dns', async () => {
  try {
    execSync('ipconfig /flushdns', { timeout: 5000 });
    return { success: true };
  } catch { return { success: false, error: 'Failed to flush DNS' }; }
});

ipcMain.handle('net:set-dns', async (_, { primary, secondary }) => {
  try {
    const out = execSync('powershell -Command "Get-NetAdapter | Where-Object {$_.Status -eq \'Up\'} | Select-Object -First 1 -ExpandProperty Name"', { encoding: 'utf8', timeout: 5000 });
    const iface = out.trim();
    if (!iface) return { success: false, error: 'No active network adapter found' };
    execSync(`netsh interface ip set dns "${iface}" static ${primary}`, { timeout: 5000 });
    if (secondary) execSync(`netsh interface ip add dns "${iface}" ${secondary} index=2`, { timeout: 5000 });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('net:dns-dhcp', async () => {
  try {
    const out = execSync('powershell -Command "Get-NetAdapter | Where-Object {$_.Status -eq \'Up\'} | Select-Object -First 1 -ExpandProperty Name"', { encoding: 'utf8', timeout: 5000 });
    const iface = out.trim();
    if (!iface) return { success: false, error: 'No active network adapter found' };
    execSync(`netsh interface ip set dns "${iface}" dhcp`, { timeout: 5000 });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// === HOSTS ===
ipcMain.handle('sys:get-hosts', async () => {
  const hostsPath = path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts');
  try {
    return { content: fs.readFileSync(hostsPath, 'utf8'), path: hostsPath };
  } catch (e) {
    return { content: '', path: hostsPath, error: e.message };
  }
});

ipcMain.handle('sys:save-hosts', async (_, { content }) => {
  const hostsPath = path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts');
  try {
    fs.writeFileSync(hostsPath, content, 'utf8');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// === REGISTRY CLEANER ===
ipcMain.handle('sys:registry-scan', async () => {
  const issues = [];
  const checkPath = (raw) => {
    const m = raw.match(/"([^"]+)"/);
    if (!m) return null;
    let p = m[1];
    p = p.replace(/%([^%]+)%/g, (_, k) => process.env[k] || '');
    if (!fs.existsSync(p)) return p;
    return null;
  };
  const regPaths = [
    { hive: 'HKCU', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Run' },
    { hive: 'HKLM', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Run' },
    { hive: 'HKCU', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce' },
  ];
  for (const rp of regPaths) {
    try {
      const out = execSync(`reg query "${rp.hive}\\${rp.path}" 2>nul`, { encoding: 'utf8', timeout: 3000 });
      const lines = out.split('\n').filter(l => l.trim() && !l.startsWith('HKEY') && !l.includes('<') && !l.includes('(Default)'));
      for (const line of lines) {
        const parts = line.trim().split(/\s{4,}|\t+/);
        if (parts.length >= 2) {
          const name = parts[0].trim();
          const value = parts.slice(1).join(' ').trim();
          const missing = checkPath(value);
          if (missing) {
            issues.push({ type: 'run', key: `${rp.hive}\\${rp.path}`, name, value: missing, issue: `Startup entry points to missing file` });
          }
        }
      }
    } catch {}
  }
  return issues;
});

ipcMain.handle('sys:registry-fix', async (_, { issue }) => {
  try {
    execSync(`reg delete "${issue.key}" /v "${issue.name}" /f 2>nul`, { timeout: 3000 });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// === HARDWARE DETECTION + AUTO-TUNE ===
ipcMain.handle('sys:detect-hardware', async () => {
  let gpu = 'Unknown';
  try {
    const out = execSync('powershell -Command "Get-CimInstance Win32_VideoController | Select-Object -First 1 -ExpandProperty Name"', { encoding: 'utf8', timeout: 5000 });
    const name = out.trim().split('\n')[0];
    if (name) gpu = name;
  } catch {}

  let gpuBrand = 'other';
  const g = gpu.toLowerCase();
  if (g.includes('nvidia') || g.includes('geforce') || g.includes('quadro') || g.includes('tesla')) gpuBrand = 'nvidia';
  else if (g.includes('amd') || g.includes('radeon') || g.includes('firepro') || g.includes('ryzen')) gpuBrand = 'amd';
  else if (g.includes('intel') || g.includes('iris') || g.includes('uhd') || g.includes('hd graphics')) gpuBrand = 'intel';

  const totalMem = os.totalmem();
  const cpuCores = os.cpus().length;
  const cpuModel = os.cpus()[0]?.model || 'Unknown';

  let recommended = 'balanced';
  if (gpuBrand === 'nvidia' || gpuBrand === 'amd') {
    if (totalMem >= 16 * 1024 ** 3 && cpuCores >= 8) recommended = 'gaming';
    else if (totalMem >= 8 * 1024 ** 3) recommended = 'balanced';
    else recommended = 'gaming';
  } else if (totalMem <= 4 * 1024 ** 3) {
    recommended = 'battery';
  }

  return { gpu, gpuBrand, totalMem, cpuCores, cpuModel, recommended };
});

ipcMain.handle('sys:apply-gpu-tweaks', async (_, { brand }) => {
  try {
    if (brand === 'nvidia') {
      execSync('reg add "HKLM\\SOFTWARE\\NVIDIA Corporation\\Global\\PowerManagementSettings" /v PreferMaximumPerformance /t REG_DWORD /d 1 /f 2>nul', { timeout: 3000 });
    } else if (brand === 'amd') {
      execSync('reg add "HKLM\\SOFTWARE\\AMD\\PowerTune" /v EnablePowerTune /t REG_DWORD /d 0 /f 2>nul', { timeout: 3000 });
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Could not apply GPU tweaks (may need Admin)' };
  }
});
