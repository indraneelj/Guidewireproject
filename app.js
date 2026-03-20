// GigShield — AI Insurance Platform
// Main Application JavaScript

let currentPage = 'dashboard';
let onboardedWorker = null;
let onboardedPolicy = null;

// ── Navigation ────────────────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const el = document.getElementById(`page-${page}`);
  if (el) el.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick')?.includes(`'${page}'`)) {
      n.classList.add('active');
    }
  });

  const titles = {
    dashboard: 'Dashboard — Overview',
    disruptions: 'Live Disruption Monitor',
    onboard: 'Onboard New Worker',
    workers: 'Worker Registry',
    policies: 'Policy Management',
    claims: 'Claims Management',
    payouts: 'Payout Ledger',
    analytics: 'Analytics & Insights',
    fraud: 'Fraud Detection Engine',
  };
  document.getElementById('page-title').textContent = titles[page] || page;
  currentPage = page;

  // Load page data
  const loaders = {
    dashboard: loadDashboard,
    disruptions: loadDisruptions,
    workers: loadWorkers,
    policies: loadPolicies,
    claims: loadClaims,
    payouts: loadPayouts,
    analytics: loadAnalytics,
    fraud: loadFraud,
  };
  if (loaders[page]) loaders[page]();
}

// ── Toast Notifications ────────────────────────────────────
function toast(type, title, msg) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <div class="toast-icon">${icons[type] || 'ℹ️'}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
    </div>
  `;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

// ── API Helper ────────────────────────────────────────────
async function api(method, path, body) {
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    return await res.json();
  } catch (e) {
    toast('error', 'Network Error', e.message);
    return null;
  }
}

// ── Formatters ────────────────────────────────────────────
function fmt(n) { return '₹' + Number(n).toLocaleString('en-IN'); }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function shortId(id) { return id?.slice(-8).toUpperCase() || '—'; }

function riskColor(score) {
  if (score < 40) return '#22c55e';
  if (score < 65) return '#eab308';
  return '#ef4444';
}

function riskLabel(score) {
  if (score < 40) return '<span class="badge badge-green">LOW</span>';
  if (score < 65) return '<span class="badge badge-yellow">MEDIUM</span>';
  return '<span class="badge badge-red">HIGH</span>';
}

function platformTag(p) {
  const cl = { Zomato: 'zomato', Swiggy: 'swiggy', Zepto: 'zepto', Blinkit: 'blinkit', Amazon: 'amazon', Dunzo: 'dunzo' };
  const cls = cl[p] || 'default';
  return `<span class="platform-tag platform-${cls}">${p}</span>`;
}

function statusBadge(s) {
  const map = {
    ACTIVE: 'badge-green', APPROVED: 'badge-green',
    PENDING: 'badge-yellow', UNDER_REVIEW: 'badge-yellow',
    REJECTED: 'badge-red', SUCCESS: 'badge-green',
    INACTIVE: 'badge-gray',
  };
  return `<span class="badge ${map[s] || 'badge-gray'}">${s}</span>`;
}

function fraudBadge(score) {
  const color = score > 60 ? '#ef4444' : score > 30 ? '#eab308' : '#22c55e';
  const fillColor = score > 60 ? '#ef4444' : score > 30 ? '#eab308' : '#22c55e';
  return `<div class="fraud-indicator">
    <div class="fraud-bar-mini"><div class="fraud-fill-mini" style="width:${score}%;background:${fillColor}"></div></div>
    <span style="color:${color};font-weight:700;font-size:12px;">${score}</span>
  </div>`;
}

// ── Dashboard ─────────────────────────────────────────────
async function loadDashboard() {
  const data = await api('GET', '/api/dashboard');
  if (!data) return;

  document.getElementById('stat-workers').textContent = data.totalWorkers;
  document.getElementById('stat-policies').textContent = data.activePolicies;
  document.getElementById('stat-payouts').textContent = fmt(data.totalPayouts);
  document.getElementById('stat-disruptions').textContent = data.activeDisruptions;
  document.getElementById('stat-fraud').textContent = data.fraudBlocked;
  document.getElementById('stat-approval').textContent = data.claimApprovalRate ? data.claimApprovalRate + '%' : '—';
  document.getElementById('stat-pending').textContent = data.pendingClaims;
  document.getElementById('stat-premium').textContent = fmt(data.totalPremiumCollected);

  document.getElementById('disruption-badge').textContent = data.activeDisruptions;
  document.getElementById('claims-badge').textContent = data.pendingClaims;

  // Activity feed
  const feed = document.getElementById('activity-feed');
  const [claims, payouts, workers] = await Promise.all([
    api('GET', '/api/claims'),
    api('GET', '/api/payouts'),
    api('GET', '/api/workers'),
  ]);

  const allActivity = [];
  (claims || []).slice(-5).forEach(c => allActivity.push({ time: c.createdAt, type: 'claim', data: c }));
  (payouts || []).slice(-5).forEach(p => allActivity.push({ time: p.processedAt, type: 'payout', data: p }));
  (workers || []).slice(-3).forEach(w => allActivity.push({ time: w.joinedAt, type: 'worker', data: w }));
  allActivity.sort((a, b) => new Date(b.time) - new Date(a.time));

  if (!allActivity.length) {
    feed.innerHTML = `<div class="empty-state"><div class="empty-icon">📡</div><h3>No activity yet</h3><p>Load demo data to see activity</p></div>`;
    return;
  }

  feed.innerHTML = allActivity.slice(0, 8).map(a => {
    if (a.type === 'claim') {
      const icon = a.data.status === 'APPROVED' ? '✅' : a.data.status === 'REJECTED' ? '❌' : '⏳';
      return `<div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--border);">
        <div style="font-size:20px;">${icon}</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;">${a.data.workerName} — Claim ${statusBadge(a.data.status)}</div>
          <div style="font-size:12px;color:var(--text3);">${a.data.disruptionType} · ${fmt(a.data.amount)}</div>
        </div>
        <div style="font-size:11px;color:var(--text3);">${fmtTime(a.time)}</div>
      </div>`;
    }
    if (a.type === 'payout') {
      const w = (workers || []).find(x => x.id === a.data.workerId);
      return `<div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--border);">
        <div style="font-size:20px;">💸</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;">${w?.name || 'Worker'} — Payout Processed</div>
          <div style="font-size:12px;color:var(--green2);font-weight:600;">${fmt(a.data.amount)} via UPI</div>
        </div>
        <div style="font-size:11px;color:var(--text3);">${fmtTime(a.time)}</div>
      </div>`;
    }
    return `<div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--border);">
      <div style="font-size:20px;">👷</div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:600;">${a.data.name} onboarded</div>
        <div style="font-size:12px;color:var(--text3);">${a.data.platform} · ${a.data.city}</div>
      </div>
      <div style="font-size:11px;color:var(--text3);">${fmtTime(a.time)}</div>
    </div>`;
  }).join('');

  // Disruptions on dashboard
  await loadDashDisruptions();
}

async function loadDashDisruptions() {
  const data = await api('GET', '/api/disruptions');
  const el = document.getElementById('dash-disruptions');
  const active = (data || []).filter(d => d.status === 'ACTIVE');
  if (!active.length) {
    el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">🌤️ No active disruptions</div>`;
    return;
  }
  el.innerHTML = active.slice(0, 3).map(d => {
    const icons = { weather: '🌧️', pollution: '🌫️', social: '🚫' };
    const sevBadge = { CRITICAL: 'badge-red', HIGH: 'badge-orange', MEDIUM: 'badge-yellow' };
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
      <div style="font-size:20px;">${icons[d.type] || '⚡'}</div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:600;">${d.subtype}</div>
        <div style="font-size:11px;color:var(--text3);">${d.affectedZones?.join(', ')}</div>
      </div>
      <span class="badge ${sevBadge[d.severity] || 'badge-gray'}">${d.severity}</span>
    </div>`;
  }).join('');
}

// ── Disruptions ───────────────────────────────────────────
async function loadDisruptions() {
  const data = await api('GET', '/api/disruptions');
  const el = document.getElementById('disruption-list');
  if (!data?.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🌤️</div><h3>No disruptions</h3></div>`;
    return;
  }
  const icons = { weather: '🌧️', pollution: '🌫️', social: '🚫' };
  el.innerHTML = data.map(d => {
    const sev = d.severity?.toLowerCase();
    const sevBadge = { critical: 'badge-red', high: 'badge-orange', medium: 'badge-yellow' };
    return `<div class="disruption-card ${sev}">
      <div class="d-icon ${d.type}">${icons[d.type] || '⚡'}</div>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="font-weight:700;font-size:14px;">${d.subtype}</span>
          <span class="badge ${sevBadge[sev] || 'badge-gray'}">${d.severity}</span>
          ${statusBadge(d.status)}
        </div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:4px;">📍 ${d.affectedZones?.join(', ')}</div>
        <div style="font-size:11px;color:var(--text3);">Source: ${d.source} · Confidence: ${d.confidence}</div>
      </div>
      <div style="font-size:11px;color:var(--text3);text-align:right;">
        <div style="margin-bottom:2px;">${fmtTime(d.triggeredAt)}</div>
        <div style="font-size:10px;">ID: ${shortId(d.id)}</div>
      </div>
    </div>`;
  }).join('');
}

// ── Workers ───────────────────────────────────────────────
async function loadWorkers() {
  const workers = await api('GET', '/api/workers');
  const policies = await api('GET', '/api/policies');
  const el = document.getElementById('workers-table');
  document.getElementById('worker-count-badge').textContent = `(${workers?.length || 0} total)`;

  if (!workers?.length) {
    el.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">👥</div><h3>No workers yet</h3><p>Onboard workers or load demo data</p></div></td></tr>`;
    return;
  }

  el.innerHTML = workers.map(w => {
    const pol = (policies || []).find(p => p.workerId === w.id && p.status === 'ACTIVE');
    const initials = w.name.split(' ').map(n => n[0]).join('').slice(0, 2);
    const colors = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#eab308', '#ef4444'];
    const col = colors[Math.abs(w.name.charCodeAt(0) - 65) % colors.length];
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="worker-avatar" style="background:${col}22;color:${col};">${initials}</div>
          <div>
            <div style="font-weight:600;font-size:13px;">${w.name}</div>
            <div style="font-size:11px;color:var(--text3);">${w.phone}</div>
          </div>
        </div>
      </td>
      <td>${platformTag(w.platform)}</td>
      <td style="font-size:13px;">${w.city}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:40px;height:4px;background:var(--bg3);border-radius:10px;overflow:hidden;">
            <div style="height:100%;width:${w.riskScore}%;background:${riskColor(w.riskScore)};border-radius:10px;"></div>
          </div>
          <span style="font-size:12px;font-weight:700;color:${riskColor(w.riskScore)};">${w.riskScore}</span>
        </div>
      </td>
      <td style="font-weight:600;">${fmt(w.avgWeeklyEarnings)}</td>
      <td>${pol ? statusBadge('ACTIVE') : statusBadge('INACTIVE')}</td>
      <td style="font-size:12px;color:var(--text3);">${fmtDate(w.joinedAt)}</td>
    </tr>`;
  }).join('');
}

// ── Policies ──────────────────────────────────────────────
async function loadPolicies() {
  const data = await api('GET', '/api/policies');
  const el = document.getElementById('policies-table');
  const active = (data || []).filter(p => p.status === 'ACTIVE');
  document.getElementById('active-pol-count').textContent = `${active.length} Active`;

  if (!data?.length) {
    el.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📋</div><h3>No policies yet</h3></div></td></tr>`;
    return;
  }

  el.innerHTML = data.map(p => `<tr>
    <td style="font-weight:600;">${p.workerName}</td>
    <td>${platformTag(p.platform)}</td>
    <td><span style="font-family:'DM Mono',monospace;color:var(--accent2);font-weight:700;">${fmt(p.weeklyPremium)}</span><span style="font-size:11px;color:var(--text3);">/week</span></td>
    <td style="font-weight:700;color:var(--green2);">${fmt(p.coverageAmount)}</td>
    <td>
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:40px;height:4px;background:var(--bg3);border-radius:10px;overflow:hidden;">
          <div style="height:100%;width:${p.riskScore}%;background:${riskColor(p.riskScore)};border-radius:10px;"></div>
        </div>
        <span style="font-size:12px;font-weight:700;color:${riskColor(p.riskScore)};">${p.riskScore}</span>
      </div>
    </td>
    <td style="font-size:12px;color:var(--text3);">${fmtDate(p.coverageEnd)}</td>
    <td>${statusBadge(p.status)}</td>
  </tr>`).join('');
}

// ── Claims ────────────────────────────────────────────────
async function loadClaims() {
  const data = await api('GET', '/api/claims');
  const el = document.getElementById('claims-table');

  if (!data?.length) {
    el.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📝</div><h3>No claims yet</h3></div></td></tr>`;
    document.getElementById('claims-badge').textContent = 0;
    return;
  }

  const pending = data.filter(c => c.status === 'PENDING' || c.status === 'UNDER_REVIEW').length;
  document.getElementById('claims-badge').textContent = pending;

  el.innerHTML = data.map(c => `<tr>
    <td><span class="font-mono" style="font-size:11px;color:var(--text3);">#${shortId(c.id)}</span></td>
    <td style="font-weight:600;">${c.workerName}</td>
    <td>
      <div style="font-size:13px;">${c.disruptionType || '—'}</div>
      <div style="font-size:11px;color:var(--text3);">${c.autoProcessed ? '⚡ Auto-parametric' : '📝 Manual'}</div>
    </td>
    <td style="font-weight:700;color:var(--accent2);">${fmt(c.amount)}</td>
    <td>${fraudBadge(c.fraudScore)}</td>
    <td>${statusBadge(c.status)}</td>
    <td>
      ${c.status === 'UNDER_REVIEW' ? `
        <div style="display:flex;gap:6px;">
          <button class="btn btn-green btn-sm" onclick="processClaim('${c.id}','approve')">✓</button>
          <button class="btn btn-red btn-sm" onclick="processClaim('${c.id}','reject')">✗</button>
        </div>
      ` : c.payoutTxnId ? `<span class="font-mono" style="font-size:10px;color:var(--green2);">${c.payoutTxnId}</span>` : '—'}
    </td>
  </tr>`).join('');
}

async function processClaim(id, action) {
  const data = await api('POST', `/api/claims/${id}/process`, { action });
  if (data?.success) {
    toast('success', `Claim ${action === 'approve' ? 'Approved' : 'Rejected'}`, `Claim #${shortId(id)} processed`);
    loadClaims();
    loadDashboard();
  }
}

// ── Payouts ───────────────────────────────────────────────
async function loadPayouts() {
  const [payouts, workers] = await Promise.all([api('GET', '/api/payouts'), api('GET', '/api/workers')]);
  const el = document.getElementById('payouts-table');
  const total = (payouts || []).reduce((s, p) => s + p.amount, 0);
  document.getElementById('payout-total').textContent = fmt(total);

  if (!payouts?.length) {
    el.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">💸</div><h3>No payouts yet</h3></div></td></tr>`;
    return;
  }

  el.innerHTML = payouts.map(p => {
    const w = (workers || []).find(x => x.id === p.workerId);
    return `<tr>
      <td><span class="font-mono" style="font-size:11px;color:var(--green2);">${p.txnId}</span></td>
      <td style="font-weight:600;">${w?.name || 'Unknown'}</td>
      <td><span class="font-mono" style="font-size:12px;color:var(--text3);">${p.upiId}</span></td>
      <td style="font-weight:700;color:var(--green2);">${fmt(p.amount)}</td>
      <td><span class="badge badge-blue">UPI</span></td>
      <td>${statusBadge(p.status)}</td>
      <td style="font-size:12px;color:var(--text3);">${fmtTime(p.processedAt)}</td>
    </tr>`;
  }).join('');
}

// ── Analytics ─────────────────────────────────────────────
async function loadAnalytics() {
  const data = await api('GET', '/api/analytics');
  if (!data) return;

  // Platform chart
  renderBarChart('platform-chart', 'chart-platform', data.byPlatform,
    d => Object.entries(d).map(([k, v]) => ({ label: k, val: v.workers }))
  );

  // City chart
  renderBarChart('city-chart', 'chart-city', data.byCity,
    d => Object.entries(d).map(([k, v]) => ({ label: k, val: v }))
  );

  // Disruption claims chart
  renderBarChart('disruption-chart', 'chart-disruption', data.claimsByType,
    d => Object.entries(d).map(([k, v]) => ({ label: k, val: v }))
  );

  // Risk distribution (mock)
  const riskDistrib = { 'LOW (<40)': 0, 'MED (40-65)': 0, 'HIGH (>65)': 0 };
  const workers = await api('GET', '/api/workers');
  (workers || []).forEach(w => {
    if (w.riskScore < 40) riskDistrib['LOW (<40)']++;
    else if (w.riskScore < 65) riskDistrib['MED (40-65)']++;
    else riskDistrib['HIGH (>65)']++;
  });
  renderBarChart('risk-chart', 'chart-risk', riskDistrib,
    d => Object.entries(d).map(([k, v]) => ({ label: k, val: v }))
  );
}

function renderBarChart(containerId, chartId, data, extractor) {
  const el = document.getElementById(containerId);
  let items;
  try { items = extractor(data); } catch(e) { items = []; }

  if (!items.length) {
    el.innerHTML = `<div class="empty-state" style="padding:24px;"><div class="empty-icon">📊</div><p>No data yet</p></div>`;
    return;
  }

  const max = Math.max(...items.map(i => i.val));
  el.innerHTML = `
    <div class="chart-bar-wrap">
      ${items.map(i => `
        <div class="chart-bar" style="height:${max ? (i.val / max * 90) : 4}px;" data-val="${i.val}"></div>
      `).join('')}
    </div>
    <div class="chart-labels">
      ${items.map(i => `<div class="chart-label">${i.label}</div>`).join('')}
    </div>
  `;
}

// ── Fraud ─────────────────────────────────────────────────
async function loadFraud() {
  const claims = await api('GET', '/api/claims');
  const flagged = (claims || []).filter(c => c.fraudScore > 0);
  const blocked = flagged.filter(c => c.fraudScore > 60).length;
  const review = flagged.filter(c => c.fraudScore > 30 && c.fraudScore <= 60).length;

  document.getElementById('fraud-blocked').textContent = blocked;
  document.getElementById('fraud-review').textContent = review;

  const el = document.getElementById('fraud-table');
  if (!flagged.length) {
    el.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">✅</div><h3>No fraud detected</h3></div></td></tr>`;
    return;
  }

  el.innerHTML = flagged.map(c => `<tr>
    <td><span class="font-mono" style="font-size:11px;color:var(--text3);">#${shortId(c.id)}</span></td>
    <td style="font-weight:600;">${c.workerName}</td>
    <td>${fraudBadge(c.fraudScore)}</td>
    <td style="font-size:11px;color:var(--text3);">${(c.fraudFlags || []).join(', ') || '—'}</td>
    <td>${statusBadge(c.status)}</td>
  </tr>`).join('');
}

// ── Onboarding ────────────────────────────────────────────
async function submitOnboard() {
  const name = document.getElementById('ob-name').value.trim();
  const phone = document.getElementById('ob-phone').value.trim();
  const city = document.getElementById('ob-city').value;
  const platform = document.getElementById('ob-platform').value;
  const experience = document.getElementById('ob-exp').value;
  const avgWeeklyEarnings = document.getElementById('ob-earnings').value;
  const deliveryZone = document.getElementById('ob-zone').value;
  const upiId = document.getElementById('ob-upi').value;

  if (!name || !phone || !city || !platform) {
    toast('error', 'Missing Fields', 'Please fill all required fields');
    return;
  }
  if (phone.length !== 10 || isNaN(phone)) {
    toast('error', 'Invalid Phone', 'Enter a valid 10-digit mobile number');
    return;
  }

  const data = await api('POST', '/api/workers/onboard', { name, phone, city, platform, experience, avgWeeklyEarnings, deliveryZone, upiId });
  if (!data) return;

  if (data.error) {
    toast('error', 'Registration Failed', data.error);
    return;
  }

  onboardedWorker = data.worker;

  // Show step 2
  document.getElementById('onboard-step1').style.display = 'none';
  document.getElementById('onboard-step2').style.display = 'block';
  document.getElementById('step1').className = 'step-dot done';
  document.getElementById('line1').className = 'step-line done';
  document.getElementById('step2').className = 'step-dot active';

  const w = data.worker;
  const riskC = riskColor(w.riskScore);
  document.getElementById('risk-result').innerHTML = `
    <div style="text-align:center;padding:20px 0 10px;">
      <div style="font-size:40px;font-weight:800;color:${riskC};font-family:'Syne',sans-serif;">${w.riskScore}</div>
      <div style="font-size:14px;color:var(--text2);margin-bottom:4px;">AI Risk Score</div>
      ${riskLabel(w.riskScore)}
    </div>
    <div class="result-box">
      <div class="result-row"><span class="label">Worker Name</span><span class="value">${w.name}</span></div>
      <div class="result-row"><span class="label">Platform</span><span class="value">${w.platform}</span></div>
      <div class="result-row"><span class="label">City</span><span class="value">${w.city}</span></div>
      <div class="result-row"><span class="label">Risk Category</span><span class="value">${w.riskCategory}</span></div>
      <div class="result-row"><span class="label">Avg. Weekly Earnings</span><span class="value">${fmt(w.avgWeeklyEarnings || 0)}</span></div>
    </div>
  `;

  toast('success', 'Risk Profile Computed', `${w.name} scored ${w.riskScore} — ${w.riskCategory} risk`);
}

async function createPolicy() {
  if (!onboardedWorker) return;
  const data = await api('POST', '/api/policies/create', { workerId: onboardedWorker.id });
  if (!data) return;
  if (data.error) { toast('error', 'Policy Error', data.error); return; }

  onboardedPolicy = data.policy;
  const p = data.policy;

  document.getElementById('onboard-step2').style.display = 'none';
  document.getElementById('onboard-step3').style.display = 'block';
  document.getElementById('step2').className = 'step-dot done';
  document.getElementById('line2').className = 'step-line done';
  document.getElementById('step3').className = 'step-dot done';

  document.getElementById('policy-result').innerHTML = `
    <div style="text-align:center;padding:20px 0 10px;">
      <div style="font-size:40px;margin-bottom:8px;">🎉</div>
      <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:var(--green2);margin-bottom:4px;">Policy Activated!</div>
      <div style="font-size:13px;color:var(--text2);">Worker is now covered for income disruptions</div>
    </div>
    <div class="result-box">
      <div class="result-row"><span class="label">Policy ID</span><span class="value font-mono" style="font-size:12px;">#${shortId(p.id)}</span></div>
      <div class="result-row"><span class="label">Weekly Premium</span><span class="value big">${fmt(p.weeklyPremium)}</span></div>
      <div class="result-row"><span class="label">Max Coverage</span><span class="value" style="color:var(--green2);">${fmt(p.coverageAmount)}</span></div>
      <div class="result-row"><span class="label">Valid Until</span><span class="value">${fmtDate(p.coverageEnd)}</span></div>
      <div class="result-row"><span class="label">Coverage Types</span><span class="value">Weather, AQI, Social</span></div>
      <div class="result-row"><span class="label">Auto-Renew</span><span class="value">✅ Enabled</span></div>
    </div>
  `;

  toast('success', 'Policy Created!', `${fmt(p.weeklyPremium)}/week · Coverage: ${fmt(p.coverageAmount)}`);
}

function backToStep1() {
  document.getElementById('onboard-step2').style.display = 'none';
  document.getElementById('onboard-step1').style.display = 'block';
  document.getElementById('step1').className = 'step-dot active';
  document.getElementById('step2').className = 'step-dot';
  document.getElementById('line1').className = 'step-line';
}

function resetOnboard() {
  onboardedWorker = null; onboardedPolicy = null;
  ['ob-name','ob-phone','ob-exp','ob-earnings','ob-zone','ob-upi'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('ob-city').value = '';
  document.getElementById('ob-platform').value = '';
  document.getElementById('onboard-step3').style.display = 'none';
  document.getElementById('onboard-step1').style.display = 'block';
  ['step1','step2','step3'].forEach((id, i) => {
    document.getElementById(id).className = 'step-dot' + (i === 0 ? ' active' : '');
  });
  ['line1','line2'].forEach(id => document.getElementById(id).className = 'step-line');
}

// ── Disruption Modal ───────────────────────────────────────
function openDisruptionModal() {
  document.getElementById('modal-disruption').classList.add('open');
}

async function triggerDisruption() {
  const type = document.getElementById('d-type').value;
  const subtype = document.getElementById('d-subtype').value.trim();
  const severity = document.getElementById('d-severity').value;
  const zonesRaw = document.getElementById('d-zones').value;
  const affectedZones = zonesRaw.split(',').map(z => z.trim()).filter(Boolean);

  if (!subtype) { toast('error', 'Missing Name', 'Please enter an event name'); return; }
  if (!affectedZones.length) { toast('error', 'Missing Zones', 'Please enter affected cities'); return; }

  const data = await api('POST', '/api/disruptions/trigger', { type, subtype, severity, affectedZones });
  if (!data) return;

  closeModal('modal-disruption');
  document.getElementById('d-subtype').value = '';
  document.getElementById('d-zones').value = '';

  toast('success', '⚡ Disruption Triggered!', `${data.affectedWorkers} workers affected · ${data.autoClaims} auto-payouts initiated`);
  loadDisruptions();
  loadDashboard();
}

// ── Claim Modal ────────────────────────────────────────────
async function openClaimModal() {
  const [workers, disruptions] = await Promise.all([api('GET', '/api/workers'), api('GET', '/api/disruptions')]);

  const wSel = document.getElementById('claim-worker');
  wSel.innerHTML = '<option value="">Select Worker</option>' + (workers || []).map(w => `<option value="${w.id}">${w.name} — ${w.city}</option>`).join('');

  const dSel = document.getElementById('claim-disruption');
  const active = (disruptions || []).filter(d => d.status === 'ACTIVE');
  dSel.innerHTML = '<option value="">Select Active Disruption</option>' + active.map(d => `<option value="${d.id}">${d.subtype} — ${d.affectedZones?.join(', ')}</option>`).join('');

  document.getElementById('modal-claim').classList.add('open');
}

async function loadWorkerPolicy() {
  const wid = document.getElementById('claim-worker').value;
  if (!wid) return;
  const data = await api('GET', `/api/workers/${wid}`);
  const pSel = document.getElementById('claim-policy');
  const activePol = (data?.policies || []).filter(p => p.status === 'ACTIVE');
  pSel.innerHTML = activePol.length
    ? activePol.map(p => `<option value="${p.id}">${fmt(p.coverageAmount)} coverage · ${fmt(p.weeklyPremium)}/week</option>`).join('')
    : '<option value="">No active policy</option>';
  if (activePol[0]) document.getElementById('claim-amount').placeholder = `Max: ₹${activePol[0].coverageAmount}`;
}

async function submitClaim() {
  const workerId = document.getElementById('claim-worker').value;
  const policyId = document.getElementById('claim-policy').value;
  const disruptionId = document.getElementById('claim-disruption').value;
  const estimatedLoss = document.getElementById('claim-amount').value;
  const description = document.getElementById('claim-desc').value;

  if (!workerId || !policyId) { toast('error', 'Missing Fields', 'Please select a worker and policy'); return; }

  const data = await api('POST', '/api/claims/file', { workerId, policyId, disruptionId, estimatedLoss, description });
  if (!data) return;

  closeModal('modal-claim');
  const c = data.claim;
  const msgs = {
    APPROVED: `Auto-approved! Payout of ${fmt(c.amount)} initiated via UPI · TXN: ${c.payoutTxnId}`,
    REJECTED: `Rejected — Fraud score ${c.fraudScore}: ${c.rejectionReason}`,
    UNDER_REVIEW: `Under review — Moderate fraud score ${c.fraudScore}`,
  };
  toast(c.status === 'APPROVED' ? 'success' : c.status === 'REJECTED' ? 'error' : 'warning',
    `Claim ${c.status}`, msgs[c.status]);
  loadClaims(); loadDashboard();
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
});

// ── Seed Demo ─────────────────────────────────────────────
async function seedDemo() {
  const data = await api('POST', '/api/seed');
  if (!data) return;
  toast('success', '⚡ Demo Data Loaded!', `${data.created.length} workers registered with policies`);
  loadDashboard();
}

// ── Init ──────────────────────────────────────────────────
(async function init() {
  await loadDashboard();

  // Auto-refresh every 30 seconds
  setInterval(() => {
    if (currentPage === 'dashboard') loadDashboard();
    if (currentPage === 'disruptions') loadDisruptions();
  }, 30000);
})();

// Fix the renderBarChart call syntax
window.renderBarChart = function(containerId, chartId, data, extractor) {
  const el = document.getElementById(containerId);
  let items;
  try { items = extractor(data); } catch(e) { items = []; }

  if (!items.length) {
    el.innerHTML = `<div class="empty-state" style="padding:24px;"><div class="empty-icon">📊</div><p>No data yet</p></div>`;
    return;
  }

  const max = Math.max(...items.map(i => i.val));
  el.innerHTML = `
    <div class="chart-bar-wrap">
      ${items.map(i => `
        <div class="chart-bar" style="height:${max ? Math.max(4, (i.val / max * 90)) : 4}px;" data-val="${i.val}"></div>
      `).join('')}
    </div>
    <div class="chart-labels">
      ${items.map(i => `<div class="chart-label">${i.label}</div>`).join('')}
    </div>
  `;
};
