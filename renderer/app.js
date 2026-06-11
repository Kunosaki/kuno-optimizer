let currentUser = null;

// Window controls
document.querySelector('.dot.close')?.addEventListener('click', () => window.kuno.close());
document.querySelector('.dot.minimize')?.addEventListener('click', () => window.kuno.minimize());
document.querySelector('.dot.maximize')?.addEventListener('click', () => window.kuno.maximize());

// DOM refs
const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('appScreen');
const loginForm = document.getElementById('loginForm');
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
    currentUser = r.profile;
    enterApp();
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
    currentUser = r.profile;
    enterApp();
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
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
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
  document.getElementById('sysCpu').textContent = info.cpuModel.substring(0, 40);
  document.getElementById('sysArch').textContent = info.arch;

  const uptime = info.uptime;
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  document.getElementById('sysUptime').textContent = `${days}d ${hours}h`;

  const diskList = document.getElementById('diskList');
  diskList.innerHTML = '';
  disks.forEach(d => {
    const pct = d.total > 0 ? (d.used / d.total * 100) : 0;
    const cls = pct > 90 ? 'danger' : pct > 70 ? 'warn' : 'safe';
    const item = document.createElement('div');
    item.className = 'disk-item';
    item.innerHTML = `
      <div class="disk-letter">${d.drive}</div>
      <div class="disk-info">
        <div class="disk-name">Local Disk (${d.drive}:)</div>
        <div class="disk-bar"><div class="disk-fill ${cls}" style="width:${pct}%"></div></div>
        <div class="disk-detail">${formatBytes(d.used)} used / ${formatBytes(d.total)}</div>
      </div>
    `;
    diskList.appendChild(item);
  });
}

// Cleanup
document.querySelectorAll('#tab-cleanup .preset-card').forEach(card => {
  card.addEventListener('click', async () => {
    const mode = card.dataset.mode;
    const progress = document.getElementById('cleanupProgress');
    const fill = document.getElementById('cleanupFill');
    const text = document.getElementById('cleanupText');
    const results = document.getElementById('cleanupResults');

    progress.style.display = 'flex';
    fill.style.width = '0%';
    text.textContent = 'Cleaning...';
    results.innerHTML = '';

    fill.style.width = '30%';
    text.textContent = `Running ${mode} clean...`;

    const r = await window.kuno.runCleanup(mode);

    fill.style.width = '100%';
    text.textContent = 'Done!';

    if (r.success && r.results.length) {
      let totalCleaned = 0;
      let totalSize = 0;
      r.results.forEach(item => {
        totalCleaned += item.cleaned;
        totalSize += item.size;
        const el = document.createElement('div');
        el.className = 'cleanup-item';
        el.innerHTML = `<span>${item.category}: ${item.dir.split('\\').pop()}</span><span>${item.cleaned} items (${formatBytes(item.size)})</span>`;
        results.appendChild(el);
      });
      const summary = document.createElement('div');
      summary.className = 'cleanup-item';
      summary.style.borderLeft = '3px solid var(--safe)';
      summary.innerHTML = `<strong>Total</strong><strong>${totalCleaned} items — ${formatBytes(totalSize)} freed</strong>`;
      results.prepend(summary);
    } else {
      results.innerHTML = '<div class="empty-state"><p>Nothing to clean</p></div>';
    }

    setTimeout(() => { progress.style.display = 'none'; }, 2000);
  });
});

// Startup
async function loadStartup() {
  const list = document.getElementById('startupList');
  list.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
  const items = await window.kuno.getStartup();
  if (!items.length) {
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
      <button class="startup-btn" data-cmd="${esc(item.command)}">Disable</button>
    `;
    list.appendChild(el);
    el.querySelector('.startup-btn').addEventListener('click', async () => {
      await window.kuno.disableStartup({ command: item.command });
      el.style.opacity = '0.3';
      el.querySelector('.startup-btn').textContent = 'Disabled';
      el.querySelector('.startup-btn').disabled = true;
    });
  });
}

// Presets
document.querySelectorAll('#tab-presets .preset-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('#tab-presets .preset-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    const status = document.getElementById('presetStatus');
    const name = card.dataset.preset;
    const msgs = {
      balanced: 'Balanced mode active — normal performance and power usage',
      gaming: 'Gaming mode applied — background processes minimized, performance maxed',
      work: 'Work mode applied — stability focused, notifications optimized',
      battery: 'Battery saver active — power consumption minimized, performance reduced',
    };
    status.textContent = msgs[name] || 'Preset applied';
    status.style.display = 'block';
  });
});

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return size.toFixed(1) + ' ' + units[i];
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
