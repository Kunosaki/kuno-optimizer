const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
const os = require('os');

let mainWindow;
let PROFILES_FILE;

function getProfilesPath() {
  if (!PROFILES_FILE) PROFILES_FILE = path.join(app.getPath('userData'), 'profiles.json');
  return PROFILES_FILE;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960, height: 680, minWidth: 720, minHeight: 500,
    frame: false,
    backgroundColor: '#1c1c1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
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
  const dirs = {
    temp: [os.tmpdir(), path.join(os.homedir(), 'AppData', 'Local', 'Temp')],
    prefetch: [path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'Prefetch')],
    recycle: [],
    browser: [
      path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Cache'),
      path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'),
      path.join(os.homedir(), 'AppData', 'Local', 'Mozilla', 'Firefox', 'Profiles'),
    ],
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

ipcMain.handle('sys:disable-startup', async (_, { command }) => {
  try {
    execSync(`reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "${command}" /f 2>nul`, { timeout: 3000 });
    return { success: true };
  } catch {
    return { success: false, error: 'Could not disable startup entry' };
  }
});
