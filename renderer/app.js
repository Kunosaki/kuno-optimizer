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
}

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
      const r = await window.kuno.disableStartup({ name: item.name });
      if (r.success) {
        el.style.opacity = '0.3';
        el.querySelector('.startup-btn').textContent = 'Disabled';
        el.querySelector('.startup-btn').disabled = true;
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
    answer: 'Quick performance tips:<br>1. Run <strong>Deep Clean</strong> weekly to clear junk<br>2. Use <strong>Gaming preset</strong> before launching games<br>3. Disable unnecessary startup programs<br>4. Create a <strong>Restore Point</strong> before major changes<br>5. Keep your drivers updated<br>6. Avoid running too many background apps'
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

function handleChat() {
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
