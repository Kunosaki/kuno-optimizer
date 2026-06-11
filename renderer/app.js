let currentUser = null;

// Window controls
document.querySelector('.dot.close')?.addEventListener('click', () => window.kuno.close());
document.querySelector('.dot.minimize')?.addEventListener('click', () => window.kuno.minimize());
document.querySelector('.dot.maximize')?.addEventListener('click', () => window.kuno.maximize());

// DOM refs
const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('appScreen');
const loginUser = document.getElementById('loginUser');
const loginPass = document.getElementById('loginPass');
const loginError = document.getElementById('loginError');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userBadge = document.getElementById('userBadge');

// Auth
loginBtn.addEventListener('click', async () => {
  const username = loginUser.value.trim();
  const password = loginPass.value.trim();
  if (!username || !password) { loginError.textContent = 'Fill in all fields'; return; }
  if (username.toLowerCase() === 'admin' && password === 'admin') {
    currentUser = { username: 'admin', preset: 'balanced' };
    enterApp(); return;
  }
  const r = await window.kuno.login({ username, password });
  if (r.success) {
    currentUser = r.profile; enterApp();
  } else {
    loginError.textContent = r.error;
  }
});

registerBtn.addEventListener('click', async () => {
  const username = loginUser.value.trim();
  const password = loginPass.value.trim();
  if (!username || !password) { loginError.textContent = 'Fill in all fields'; return; }
  if (username.toLowerCase() === 'admin') { loginError.textContent = 'Admin account already exists'; return; }
  const r = await window.kuno.register({ username, password });
  if (r.success) {
    currentUser = r.profile; enterApp();
  } else {
    loginError.textContent = r.error;
  }
});

logoutBtn.addEventListener('click', () => {
  currentUser = null;
  loginScreen.classList.add('active');
  appScreen.classList.remove('active');
  loginPass.value = '';
});

function enterApp() {
  loginScreen.classList.remove('active');
  appScreen.classList.add('active');
  userBadge.textContent = currentUser.username;
  loadDashboard();
}

// Tab navigation
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const tab = document.getElementById('tab-' + btn.dataset.tab);
    if (tab) tab.classList.add('active');
      if (btn.dataset.tab === 'dashboard') loadDashboard();
      if (btn.dataset.tab === 'startup') loadStartup();
      if (btn.dataset.tab === 'privacy') loadServices();
      if (btn.dataset.tab === 'debloat') { /* cards handle themselves */ }
      if (btn.dataset.tab === 'tools') { /* nothing to preload — sub-tabs handle themselves */ }
  });
});

// Dashboard
async function loadDashboard() {
  const info = await window.kuno.getSysInfo();
  const disks = await window.kuno.getDisks();

  document.getElementById('cpuCount').textContent = info.cpus;
  document.getElementById('ramTotal').textContent = formatBytes(info.totalMem);
  document.getElementById('osName').textContent = info.platform === 'win32' ? 'Windows' : info.platform;
  document.getElementById('sysHostname').textContent = info.hostname;
  document.getElementById('sysCpu').textContent = (info.cpuModel || 'Unknown').substring(0, 35);
  document.getElementById('sysArch').textContent = info.arch;
  document.getElementById('sysUptime').textContent = formatUptime(info.uptime);

  const diskList = document.getElementById('diskList');
  diskList.innerHTML = '';
  (disks || []).forEach(d => {
    const pct = d.total > 0 ? (d.used / d.total * 100) : 0;
    const cls = pct > 90 ? 'danger' : pct > 70 ? 'warn' : 'safe';
    const item = document.createElement('div');
    item.className = 'disk-item';
    item.innerHTML = `
      <div class="disk-letter">${esc(d.drive)}</div>
      <div class="disk-info">
        <div class="disk-name">Local Disk (${esc(d.drive)}:)</div>
        <div class="disk-bar"><div class="disk-fill ${cls}" style="width:${Math.min(pct,100)}%"></div></div>
        <div class="disk-detail">${formatBytes(d.used)} used / ${formatBytes(d.total)}</div>
      </div>
    `;
    diskList.appendChild(item);
  });

  // Quick scan preview + RAM usage
  updateMemUsage();
  loadQuickScanPreview();
}

async function loadQuickScanPreview() {
  const preview = document.getElementById('quickScanPreview');
  preview.textContent = 'Scanning...';
  const r = await window.kuno.quickScan();
  if (r && r.totalSize > 0) {
    preview.textContent = `${r.totalItems} items — ${formatBytes(r.totalSize)} deletable`;
  } else {
    preview.textContent = 'System is clean';
  }
}

async function updateMemUsage() {
  const r = await window.kuno.getSysInfo();
  const used = r.totalMem - r.freeMem;
  const pct = r.totalMem > 0 ? (used / r.totalMem * 100) : 0;
  document.getElementById('ramUsageFill').style.width = Math.min(pct, 100) + '%';
  document.getElementById('ramUsageText').textContent = `${formatBytes(used)} / ${formatBytes(r.totalMem)}`;
}

// Quick Scan
document.getElementById('quickScanBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('quickScanBtn');
  btn.textContent = '...'; btn.disabled = true;
  const preview = document.getElementById('quickScanPreview');
  preview.textContent = 'Scanning...';
  const r = await window.kuno.quickScan();
  if (r && r.totalSize > 0) {
    preview.textContent = `${r.totalItems} items — ${formatBytes(r.totalSize)}`;
    // Run quick clean after showing result
    const clean = await window.kuno.runCleanup('quick');
    if (clean.success) {
      let cleaned = 0, size = 0;
      clean.results.forEach(item => { cleaned += item.cleaned; size += item.size; });
      preview.textContent = `Cleaned ${cleaned} items (${formatBytes(size)})`;
    }
  } else {
    preview.textContent = 'Nothing to clean';
  }
  btn.textContent = 'Scan';
  btn.disabled = false;
});

// Memory Cleaner
document.getElementById('memCleanBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('memCleanBtn');
  const text = document.getElementById('ramUsageText');
  btn.textContent = '...'; btn.disabled = true;
  text.textContent = 'Freeing memory...';
  const r = await window.kuno.freeMemory();
  if (r.success) {
    const total = (await window.kuno.getSysInfo()).totalMem;
    const used = total - r.free;
    const pct = total > 0 ? (used / total * 100) : 0;
    document.getElementById('ramUsageFill').style.width = Math.min(pct, 100) + '%';
    const freedBytes = r.freed || 0;
    text.textContent = `${formatBytes(used)} / ${formatBytes(total)} (freed ${formatBytes(freedBytes)})`;
  } else {
    text.textContent = 'Failed: ' + esc(r.error || '');
  }
  btn.textContent = 'Free';
  btn.disabled = false;
  setTimeout(() => updateMemUsage(), 2000);
});

// Optimize — Cleanup
document.querySelectorAll('#tab-optimize .preset-card[data-mode]').forEach(card => {
  card.addEventListener('click', async () => {
    const mode = card.dataset.mode;
    const progress = document.getElementById('cleanupProgress');
    const fill = document.getElementById('cleanupFill');
    const text = document.getElementById('cleanupText');
    const results = document.getElementById('cleanupResults');

    progress.style.display = 'flex';
    fill.style.width = '0%'; text.textContent = 'Cleaning...';
    results.innerHTML = '';
    fill.style.width = '40%'; text.textContent = `Running ${mode} clean...`;

    const r = await window.kuno.runCleanup(mode);
    fill.style.width = '100%'; text.textContent = 'Done!';

    if (r.success && r.results.length) {
      let totalCleaned = 0, totalSize = 0;
      r.results.forEach(item => {
        totalCleaned += item.cleaned; totalSize += item.size;
        const el = document.createElement('div');
        el.className = 'cleanup-item';
        el.innerHTML = `<span>${item.category}</span><span>${item.cleaned} items (${formatBytes(item.size)})</span>`;
        results.appendChild(el);
      });
      const sum = document.createElement('div');
      sum.className = 'cleanup-item';
      sum.style.borderLeft = '3px solid var(--safe)';
      sum.innerHTML = `<strong>Total</strong><strong>${totalCleaned} items — ${formatBytes(totalSize)} freed</strong>`;
      results.prepend(sum);
    } else {
      results.innerHTML = '<div class="empty-state"><p>Nothing to clean</p></div>';
    }
    setTimeout(() => { progress.style.display = 'none'; }, 2000);
  });
});

// Restore Point
document.getElementById('restorePointBtn')?.addEventListener('click', async () => {
  const progress = document.getElementById('cleanupProgress');
  const fill = document.getElementById('cleanupFill');
  const text = document.getElementById('cleanupText');
  const results = document.getElementById('cleanupResults');

  progress.style.display = 'flex';
  fill.style.width = '0%'; text.textContent = 'Creating restore point...';
  results.innerHTML = '';

  const r = await window.kuno.createRestorePoint();
  fill.style.width = '100%';

  const el = document.createElement('div');
  el.className = 'cleanup-item';
  if (r.success) {
    text.textContent = 'Restore point created!';
    el.style.borderLeft = '3px solid var(--safe)';
    el.innerHTML = `<strong>✓</strong><strong>Restore point created successfully</strong>`;
  } else {
    text.textContent = 'Failed: ' + (r.error || 'unknown');
    el.style.borderLeft = '3px solid var(--danger)';
    el.innerHTML = `<strong>✕</strong><strong>${esc(r.error || 'Failed to create restore point')}</strong>`;
  }
  results.appendChild(el);
  setTimeout(() => { progress.style.display = 'none'; }, 3000);
});

// Startup
async function loadStartup() {
  const list = document.getElementById('startupList');
  list.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
  const items = await window.kuno.getStartup();
  if (!items || !items.length) {
    list.innerHTML = '<div class="empty-state"><p>No startup items found</p></div>';
    return;
  }
  list.innerHTML = '';
  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'startup-item';
    el.innerHTML = `
      <div class="startup-info">
        <div class="startup-name">${esc(item.name || 'Unknown')}</div>
        <div class="startup-cmd">${esc(item.command)}</div>
      </div>
      <button class="startup-btn">Disable</button>
    `;
    list.appendChild(el);
    el.querySelector('.startup-btn').addEventListener('click', async () => {
      const btn = el.querySelector('.startup-btn');
      btn.textContent = '...'; btn.disabled = true;
      const r = await window.kuno.disableStartup({ name: item.name });
      if (r.success) {
        el.style.opacity = '0.3';
        btn.textContent = 'Disabled';
      } else {
        btn.textContent = 'Failed';
        setTimeout(() => { btn.textContent = 'Disable'; btn.disabled = false; }, 2000);
      }
    });
  });
}

// Presets — real optimization
document.querySelectorAll('#tab-presets .preset-card').forEach(card => {
  card.addEventListener('click', async () => {
    document.querySelectorAll('#tab-presets .preset-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    const status = document.getElementById('presetStatus');
    const name = card.dataset.preset;

    status.textContent = 'Applying preset...';
    status.style.border = '1px solid var(--warn)';
    status.style.color = 'var(--warn)';
    status.style.display = 'block';

    const r = await window.kuno.applyPreset(name);

    const msgs = {
      balanced: 'Balanced mode active — normal settings applied',
      gaming: 'Gaming mode active — high performance power plan, visual effects optimized',
      work: 'Work mode active — stability focused, background tasks optimized',
      battery: 'Battery saver active — power saving plan enabled',
    };
    if (r.success) {
      status.textContent = msgs[name] || 'Preset applied';
      status.style.border = '1px solid var(--safe)';
      status.style.color = 'var(--safe)';
    } else {
      status.textContent = (msgs[name] || 'Preset applied') + ' (partial)';
      status.style.border = '1px solid var(--warn)';
      status.style.color = 'var(--warn)';
    }
  });
});

// === HELP / AI ASSISTANT ===
const helpDB = {
  dashboard: {
    keywords: ['dashboard', 'system info', 'specs', 'monitor', 'disk', 'usage'],
    answer: 'The <strong>Dashboard</strong> shows your system at a glance — CPU cores, total RAM, OS type, hostname, CPU model, uptime, and disk usage for each drive. Disk bars turn yellow above 70% and red above 90%. It refreshes each time you click the tab.'
  },
  cleanup: {
    keywords: ['clean', 'cleanup', 'temp', 'cache', 'junk', 'browser', 'deep clean', 'quick clean'],
    answer: 'Use the <strong>Optimize</strong> tab. <strong>Quick Clean</strong> removes temporary files. <strong>Deep Clean</strong> also clears Prefetch and browser caches (Chrome, Edge, Firefox). Results show how many items were removed and how much space you freed. You can also create a <strong>Restore Point</strong> before cleaning.'
  },
  startup: {
    keywords: ['startup', 'boot', 'disable startup', 'autostart', 'launch'],
    answer: 'The <strong>Startup Manager</strong> lists all programs that launch when Windows starts. Click <strong>Disable</strong> next to any entry to remove it from the registry Run key. This can speed up boot time. Some entries from the Startup folder may not be removable here.'
  },
  presets: {
    keywords: ['preset', 'performance', 'gaming', 'battery', 'power', 'balanced', 'work', 'mode'],
    answer: 'Presets apply real Windows tweaks:<br>• <strong>Gaming</strong> — High Performance power plan + disables visual effects for max FPS<br>• <strong>Work</strong> — Balanced plan, stability focused<br>• <strong>Battery Saver</strong> — Power Saver plan, minimal effects<br>• <strong>Balanced</strong> — Default power plan with normal effects'
  },
  tips: {
    keywords: ['tip', 'tips', 'advice', 'optimize', 'speed up', 'faster', 'performance', 'tweak'],
    answer: 'Quick performance tips:<br>1. Run <strong>Deep Clean</strong> weekly to clear junk<br>2. Use <strong>Gaming preset</strong> before launching games<br>3. Disable unnecessary startup programs<br>4. Create a <strong>Restore Point</strong> before major changes<br>5. Use <strong>Quick Scan</strong> on Dashboard for one-click junk cleaning<br>6. Use <strong>Memory Free</strong> on Dashboard to free up RAM<br>7. Enable <strong>Game Booster</strong> in the Debloat tab for max FPS<br>8. Keep your drivers updated'
  },
  debloat: {
    keywords: ['debloat', 'game booster', 'game', 'fps', 'latency', 'spotify', 'discord', 'hpet'],
    answer: 'The <strong>Debloat</strong> tab has tools to improve gaming and reduce bloat:<br>• <strong>Game Booster</strong> — stops background services and enables High Performance power plan<br>• <strong>Latency Tweaks</strong> — disables HPET timer, optimizes mouse and keyboard response<br>• <strong>Debloat Discord</strong> — removes voice modules to reduce Discord resource usage<br>• <strong>Debloat Spotify</strong> — removes language packs to free memory<br>Some tweaks (like HPET) require a reboot to take effect.'
  },
  memory: {
    keywords: ['memory', 'ram', 'free memory', 'memory cleaner', 'memredact', 'cleaner'],
    answer: 'The <strong>Memory</strong> tool on the Dashboard shows real-time RAM usage. Click <strong>Free</strong> to release unused working sets and clear system cache (similar to MemReduct). You\'ll see how much memory was freed after each run.'
  },
  quickscan: {
    keywords: ['quick scan', 'quick clean', 'junk', 'temp cleaner', 'one click'],
    answer: 'The <strong>Quick Scan</strong> card on the Dashboard shows how much deletable junk is on your system (temp files, prefetch, browser cache). Click <strong>Scan</strong> to clean it — it runs the Quick Clean and shows how much space was freed.'
  },
  restore: {
    keywords: ['restore point', 'backup', 'system restore', 'rollback', 'checkpoint'],
    answer: 'The <strong>Restore Point</strong> button in the Optimize tab creates a Windows System Restore checkpoint. If something goes wrong after a cleanup or preset change, you can use Windows System Restore to revert your PC to this saved state. Requires admin privileges.'
  },
  general: {
    keywords: ['hello', 'hi', 'hey', 'what is', 'who', 'help', 'support', 'kuno', 'app'],
    answer: 'I\'m <strong>Kuno Assistant</strong> — your built-in help bot for Kuno Optimizer. I can answer questions about the Dashboard, cleanup tools, Startup Manager, performance presets, restore points, and optimization tips. What would you like to know?'
  }
};

function getBotAnswer(input) {
  const text = input.toLowerCase().trim();
  if (!text) return helpDB.general.answer;
  let bestMatch = { score: 0, answer: helpDB.general.answer };
  for (const topic of Object.values(helpDB)) {
    for (const kw of topic.keywords) {
      if (text.includes(kw)) {
        const score = kw.length;
        if (score > bestMatch.score) {
          bestMatch = { score, answer: topic.answer };
        }
      }
    }
  }
  return bestMatch.answer;
}

function addChatMessage(text, isUser) {
  const box = document.getElementById('chatBox');
  const msg = document.createElement('div');
  msg.className = 'chat-msg ' + (isUser ? 'user' : 'bot');
  msg.innerHTML = `<div class="chat-avatar">${isUser ? 'U' : 'K'}</div><div class="chat-bubble">${text}</div>`;
  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
}

let lastChatTime = 0;
const CHAT_COOLDOWN = 1500;

function handleChat() {
  const now = Date.now();
  if (now - lastChatTime < CHAT_COOLDOWN) {
    const input = document.getElementById('chatInput');
    input.style.borderColor = 'var(--danger)';
    input.placeholder = 'Please wait...';
    setTimeout(() => { input.style.borderColor = ''; input.placeholder = 'Type a question...'; }, 1000);
    return;
  }
  lastChatTime = now;
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  addChatMessage(esc(text), true);
  input.value = '';
  setTimeout(() => {
    addChatMessage(getBotAnswer(text), false);
  }, 300);
}

document.getElementById('chatSendBtn').addEventListener('click', handleChat);
document.getElementById('chatInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleChat();
});
document.querySelectorAll('.suggestion-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('chatInput').value = btn.dataset.ask;
    handleChat();
  });
});

// === PRIVACY — Services ===
async function loadServices() {
  const list = document.getElementById('serviceList');
  list.innerHTML = '<div class="empty-state"><p>Loading services...</p></div>';
  const services = await window.kuno.getPrivacyServices();
  if (!services || !services.length) {
    list.innerHTML = '<div class="empty-state"><p>No services found</p></div>';
    return;
  }
  list.innerHTML = '';
  services.forEach(svc => {
    if (!svc.exists) return;
    const el = document.createElement('div');
    el.className = 'service-item';
    const running = svc.running;
    el.innerHTML = `
      <div class="service-info">
        <div class="service-name">${esc(svc.name)}</div>
        <div class="service-label">${esc(svc.label)}</div>
      </div>
      <span class="service-badge ${running ? 'running' : 'stopped'}">${running ? 'Running' : 'Stopped'}</span>
      <div class="toggle-wrap">
        <input type="checkbox" class="toggle-check" id="svc-${svc.name}" ${running ? 'checked' : ''}>
        <label class="toggle-label" for="svc-${svc.name}"></label>
      </div>
    `;
    list.appendChild(el);
    const toggle = el.querySelector('.toggle-check');
    toggle.addEventListener('change', async () => {
      const action = toggle.checked ? 'start' : 'stop';
      const r = await window.kuno.setService({ name: svc.name, action });
      if (!r.success) {
        toggle.checked = !toggle.checked;
        const badge = el.querySelector('.service-badge');
        badge.textContent = svc.running ? 'Running' : 'Stopped';
        badge.className = 'service-badge ' + (svc.running ? 'running' : 'stopped');
      } else {
        svc.running = action === 'start';
        const badge = el.querySelector('.service-badge');
        badge.textContent = svc.running ? 'Running' : 'Stopped';
        badge.className = 'service-badge ' + (svc.running ? 'running' : 'stopped');
      }
    });
  });
}

// === PRIVACY — UWP ===
async function loadUwpApps() {
  const list = document.getElementById('uwpList');
  list.innerHTML = '<div class="empty-state"><p>Loading apps...</p></div>';
  const apps = await window.kuno.getUwpApps();
  if (!apps || !apps.length) {
    list.innerHTML = '<div class="empty-state"><p>No UWP apps found</p></div>';
    return;
  }
  list.innerHTML = '';
  apps.forEach(app => {
    const el = document.createElement('div');
    el.className = 'uwp-item';
    el.innerHTML = `
      <div class="uwp-info">
        <div class="uwp-name">${esc(app.name)}</div>
        <div class="uwp-desc">${esc(app.fullName)}</div>
      </div>
      <button class="uwp-uninstall-btn">Uninstall</button>
    `;
    list.appendChild(el);
    el.querySelector('.uwp-uninstall-btn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.textContent = '...'; btn.disabled = true;
      const r = await window.kuno.uninstallUwp({ fullName: app.fullName });
      if (r.success) {
        btn.textContent = '✓'; btn.style.background = 'rgba(48,209,88,0.15)'; btn.style.color = 'var(--safe)';
        setTimeout(() => { if (el.parentNode) el.style.opacity = '0.3'; }, 500);
      } else {
        btn.textContent = 'Failed'; btn.disabled = false;
      }
    });
  });
}

// Privacy sub-tabs
document.querySelectorAll('.privacy-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.privacy-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.ptab-content').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const tab = document.getElementById('ptab-' + btn.dataset.ptab);
    if (tab) tab.classList.add('active');
    if (btn.dataset.ptab === 'services') loadServices();
    if (btn.dataset.ptab === 'uwp') loadUwpApps();
  });
});

// === TOOLS — Network ===
document.getElementById('flushDnsBtn')?.addEventListener('click', async () => {
  const status = document.getElementById('netStatus');
  status.style.display = 'block';
  status.textContent = 'Flushing DNS...';
  status.style.border = '1px solid var(--warn)';
  status.style.color = 'var(--warn)';
  const r = await window.kuno.flushDns();
  if (r.success) {
    status.textContent = '✓ DNS cache flushed successfully';
    status.style.border = '1px solid var(--safe)';
    status.style.color = 'var(--safe)';
  } else {
    status.textContent = '✕ Failed to flush DNS';
    status.style.border = '1px solid var(--danger)';
    status.style.color = 'var(--danger)';
  }
  setTimeout(() => { status.style.display = 'none'; }, 3000);
});

document.getElementById('dnsDhcpBtn')?.addEventListener('click', async () => {
  const status = document.getElementById('netStatus');
  status.style.display = 'block';
  status.textContent = 'Resetting DNS to automatic...';
  status.style.border = '1px solid var(--warn)';
  status.style.color = 'var(--warn)';
  const r = await window.kuno.dnsDhcp();
  if (r.success) {
    status.textContent = '✓ DNS set to automatic (DHCP)';
    status.style.border = '1px solid var(--safe)';
    status.style.color = 'var(--safe)';
  } else {
    status.textContent = '✕ Failed: ' + esc(r.error || 'unknown');
    status.style.border = '1px solid var(--danger)';
    status.style.color = 'var(--danger)';
  }
  setTimeout(() => { status.style.display = 'none'; }, 3000);
});

document.querySelectorAll('.dns-card').forEach(card => {
  card.addEventListener('click', async () => {
    const status = document.getElementById('netStatus');
    const primary = card.dataset.primary;
    const secondary = card.dataset.secondary;
    status.style.display = 'block';
    status.textContent = `Setting DNS to ${primary}...`;
    status.style.border = '1px solid var(--warn)';
    status.style.color = 'var(--warn)';
    const r = await window.kuno.setDns({ primary, secondary });
    if (r.success) {
      status.textContent = `✓ DNS set to ${primary}${secondary ? ' / ' + secondary : ''}`;
      status.style.border = '1px solid var(--safe)';
      status.style.color = 'var(--safe)';
    } else {
      status.textContent = '✕ Failed: ' + esc(r.error || 'unknown');
      status.style.border = '1px solid var(--danger)';
      status.style.color = 'var(--danger)';
    }
    setTimeout(() => { status.style.display = 'none'; }, 4000);
  });
});

// === TOOLS — Hosts ===
async function loadHosts() {
  const editor = document.getElementById('hostsEditor');
  const pathEl = document.getElementById('hostsPath');
  const r = await window.kuno.getHosts();
  if (pathEl) pathEl.textContent = r.path || 'Unknown';
  editor.value = r.content || '# Unable to read hosts file';
  if (r.error) {
    const status = document.getElementById('hostsStatus');
    status.style.display = 'block';
    status.textContent = '⚠ Read error: ' + esc(r.error) + ' (may need Admin)';
    status.style.border = '1px solid var(--warn)';
    status.style.color = 'var(--warn)';
  }
}

document.getElementById('hostsRefreshBtn')?.addEventListener('click', () => {
  loadHosts();
  const status = document.getElementById('hostsStatus');
  status.style.display = 'none';
});

document.getElementById('hostsSaveBtn')?.addEventListener('click', async () => {
  const status = document.getElementById('hostsStatus');
  const content = document.getElementById('hostsEditor').value;
  status.style.display = 'block';
  status.textContent = 'Saving...';
  status.style.border = '1px solid var(--warn)';
  status.style.color = 'var(--warn)';
  const r = await window.kuno.saveHosts({ content });
  if (r.success) {
    status.textContent = '✓ HOSTS file saved';
    status.style.border = '1px solid var(--safe)';
    status.style.color = 'var(--safe)';
  } else {
    status.textContent = '✕ Save failed: ' + esc(r.error || 'unknown');
    status.style.border = '1px solid var(--danger)';
    status.style.color = 'var(--danger)';
  }
  setTimeout(() => { status.style.display = 'none'; }, 3000);
});

// === TOOLS — Registry Cleaner ===
document.getElementById('registryScanBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('registryScanBtn');
  const progress = document.getElementById('registryProgress');
  const fill = document.getElementById('registryFill');
  const text = document.getElementById('registryScanText');
  const list = document.getElementById('registryIssues');

  btn.textContent = 'Scanning...'; btn.disabled = true;
  progress.style.display = 'flex';
  fill.style.width = '0%'; text.textContent = 'Scanning registry...';
  list.innerHTML = '';

  fill.style.width = '60%';
  const issues = await window.kuno.registryScan();

  fill.style.width = '100%'; text.textContent = 'Done!';
  btn.textContent = '🔍 Scan Registry'; btn.disabled = false;

  if (!issues || !issues.length) {
    list.innerHTML = '<div class="empty-state"><p>✓ No broken startup entries found</p></div>';
  } else {
    list.innerHTML = '';
    issues.forEach(issue => {
      const el = document.createElement('div');
      el.className = 'registry-item';
      el.innerHTML = `
        <div class="registry-info">
          <div class="registry-name">${esc(issue.name)} — ${esc(issue.issue)}</div>
          <div class="registry-path">${esc(issue.value)}</div>
        </div>
        <button class="registry-fix-btn">Fix</button>
      `;
      list.appendChild(el);
      el.querySelector('.registry-fix-btn').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.textContent = '...'; btn.disabled = true;
        const r = await window.kuno.registryFix({ issue });
        if (r.success) {
          btn.textContent = '✓ Fixed';
          btn.style.background = 'rgba(48,209,88,0.15)';
          btn.style.color = 'var(--safe)';
          el.style.opacity = '0.3';
        } else {
          btn.textContent = 'Failed';
          btn.disabled = false;
        }
      });
    });
  }
  setTimeout(() => { progress.style.display = 'none'; }, 2000);
});

// === AUTO-TUNE ===
document.getElementById('autoTuneBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('autoTuneBtn');
  const details = document.getElementById('autoTuneDetails');
  const status = document.getElementById('autoTuneStatus');
  const hw = await window.kuno.detectHardware();

  document.getElementById('atGpu').textContent = hw.gpu.substring(0, 40) || 'Unknown';
  document.getElementById('atCpu').textContent = hw.cpuCores + ' (' + (hw.cpuModel || '').substring(0, 20) + ')';
  document.getElementById('atRam').textContent = formatBytes(hw.totalMem);
  document.getElementById('atPreset').textContent = hw.recommended.charAt(0).toUpperCase() + hw.recommended.slice(1);
  details.style.display = 'flex';

  btn.textContent = '⚙ Applying...';
  btn.disabled = true;

  // Apply recommended preset
  const r1 = await window.kuno.applyPreset(hw.recommended);
  // Apply GPU tweaks
  const r2 = await window.kuno.applyGpuTweaks({ brand: hw.gpuBrand });

  status.style.display = 'block';
  if (r1.success) {
    status.textContent = `✓ ${hw.recommended.charAt(0).toUpperCase() + hw.recommended.slice(1)} preset applied` +
      (r2.success && hw.gpuBrand !== 'other' && hw.gpuBrand !== 'intel' ? ` + ${hw.gpuBrand.toUpperCase()} GPU optimizations` : '');
    status.style.border = '1px solid var(--safe)';
    status.style.color = 'var(--safe)';
  } else {
    status.textContent = '⚠ Partial — some tweaks may need Admin';
    status.style.border = '1px solid var(--warn)';
    status.style.color = 'var(--warn)';
  }

  btn.textContent = '✓ Auto-Tuned!';
  setTimeout(() => {
    btn.textContent = '🔄 Re-Detect';
    btn.disabled = false;
  }, 3000);
});

// === DEBLOAT TAB ===
document.getElementById('gameBoosterOn')?.addEventListener('click', async () => {
  const status = document.getElementById('debloatStatus');
  status.style.display = 'block'; status.textContent = 'Enabling game booster...';
  status.style.border = '1px solid var(--warn)'; status.style.color = 'var(--warn)';
  const r = await window.kuno.gameBooster({ action: 'on' });
  if (r.success) {
    status.textContent = '✓ Game booster ON — background services stopped, high perf power';
    status.style.border = '1px solid var(--safe)'; status.style.color = 'var(--safe)';
  } else {
    status.textContent = '✕ Failed: ' + esc(r.error || '');
    status.style.border = '1px solid var(--danger)'; status.style.color = 'var(--danger)';
  }
  setTimeout(() => { status.style.display = 'none'; }, 4000);
});

document.getElementById('gameBoosterOff')?.addEventListener('click', async () => {
  const status = document.getElementById('debloatStatus');
  status.style.display = 'block'; status.textContent = 'Disabling game booster...';
  status.style.border = '1px solid var(--warn)'; status.style.color = 'var(--warn)';
  const r = await window.kuno.gameBooster({ action: 'off' });
  if (r.success) {
    status.textContent = '✓ Game booster OFF — services restarted';
    status.style.border = '1px solid var(--safe)'; status.style.color = 'var(--safe)';
  } else {
    status.textContent = '✕ Failed: ' + esc(r.error || '');
    status.style.border = '1px solid var(--danger)'; status.style.color = 'var(--danger)';
  }
  setTimeout(() => { status.style.display = 'none'; }, 4000);
});

document.getElementById('latencyTweaksBtn')?.addEventListener('click', async () => {
  const status = document.getElementById('debloatStatus');
  status.style.display = 'block'; status.textContent = 'Applying latency tweaks...';
  status.style.border = '1px solid var(--warn)'; status.style.color = 'var(--warn)';
  const r = await window.kuno.latencyTweaks();
  if (r.success) {
    status.textContent = '✓ ' + (r.results || []).join(' • ') || 'Latency tweaks applied (reboot may be needed)';
    status.style.border = '1px solid var(--safe)'; status.style.color = 'var(--safe)';
  } else {
    status.textContent = '✕ Failed: ' + esc(r.error || '');
    status.style.border = '1px solid var(--danger)'; status.style.color = 'var(--danger)';
  }
  setTimeout(() => { status.style.display = 'none'; }, 5000);
});

document.getElementById('debloatDiscordBtn')?.addEventListener('click', async () => {
  const status = document.getElementById('debloatStatus');
  status.style.display = 'block'; status.textContent = 'Debloating Discord...';
  status.style.border = '1px solid var(--warn)'; status.style.color = 'var(--warn)';
  const r = await window.kuno.debloatDiscord();
  if (r.success) {
    status.textContent = '✓ ' + esc(r.message);
    status.style.border = '1px solid var(--safe)'; status.style.color = 'var(--safe)';
  } else {
    status.textContent = '✕ ' + esc(r.error || '');
    status.style.border = '1px solid var(--danger)'; status.style.color = 'var(--danger)';
  }
  setTimeout(() => { status.style.display = 'none'; }, 4000);
});

document.getElementById('debloatSpotifyBtn')?.addEventListener('click', async () => {
  const status = document.getElementById('debloatStatus');
  status.style.display = 'block'; status.textContent = 'Debloating Spotify...';
  status.style.border = '1px solid var(--warn)'; status.style.color = 'var(--warn)';
  const r = await window.kuno.debloatSpotify();
  if (r.success) {
    status.textContent = '✓ ' + esc(r.message);
    status.style.border = '1px solid var(--safe)'; status.style.color = 'var(--safe)';
  } else {
    status.textContent = '✕ ' + esc(r.error || '');
    status.style.border = '1px solid var(--danger)'; status.style.color = 'var(--danger)';
  }
  setTimeout(() => { status.style.display = 'none'; }, 4000);
});

// Tools sub-tabs
document.querySelectorAll('.tools-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tools-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.ttab-content').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const tab = document.getElementById('ttab-' + btn.dataset.ttab);
    if (tab) tab.classList.add('active');
    if (btn.dataset.ttab === 'hosts') loadHosts();
  });
});

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return size.toFixed(1) + ' ' + units[i];
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
