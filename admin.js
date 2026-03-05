/**
 * admin.js — Admin Panel Logic (v2)
 * - 6 named admin accounts with individual passwords
 * - Year-wise pie chart (Chart.js)
 * - Bought Students view
 * - Scanner, manual lookup, token marking
 */

// ─── 6 Admin Accounts ─────────────────────────────────────────────────────────
const ADMINS = [
    { id: 'A1', name: 'Committee Member 1', role: 'Food Committee Member', password: 'Mechanical@2026', color: '#f97316', initials: 'FC1' },
    { id: 'A2', name: 'Committee Member 2', role: 'Food Committee Member', password: 'Mechanical@2026', color: '#22c55e', initials: 'FC2' },
    { id: 'A3', name: 'Committee Member 3', role: 'Food Committee Member', password: 'Mechanical@2026', color: '#3b82f6', initials: 'FC3' },
    { id: 'A4', name: 'Committee Member 4', role: 'Food Committee Member', password: 'Mechanical@2026', color: '#a855f7', initials: 'FC4' },
    { id: 'A5', name: 'Committee Member 5', role: 'Food Committee Member', password: 'Mechanical@2026', color: '#ec4899', initials: 'FC5' },
    { id: 'A6', name: 'Committee Member 6', role: 'Food Committee Member', password: 'Mechanical@2026', color: '#14b8a6', initials: 'FC6' },
];

// ─── State ────────────────────────────────────────────────────────────────────
let STUDENTS = [];
let currentAdmin = null;
let html5QrScanner = null;
let scannerRunning = false;
let currentScannedStudent = null;
let currentFilter = 'all';
let currentBoughtFilter = 'all';
let pieChartInstance = null;

// ─── Bootstrap ────────────────────────────────────────────────────────────────
const YEAR_MAP_ADMIN = { 4: 'Final Year (2021-2025)', 3: '3rd Year (2023-2027)', 2: '2nd Year (2024-2028)' };
function _cleanPhone(p) { if (!p) return ''; const s = String(p).replace(/\D/g, ''); return s.length >= 10 ? s.slice(-10) : s; }
function _cleanReg(r) { if (r == null) return ''; const s = String(r).trim(); return /^\d+(\.\d+)?$/.test(s) ? String(parseInt(s)) : s; }

async function loadStudents() {
    try {
        const res = await fetch('FINAL DATA SET1.json');
        const raw = await res.json();
        STUDENTS = [];
        for (const row of raw) {
            if (!row || typeof row !== 'object') continue;
            const reg = _cleanReg(row['REGISTER NUMBER']);
            const name = String(row['NAME AS PER THE COLLEGE RECORDS'] || '').trim();
            const phone = _cleanPhone(row['PHONE NO']);
            const yr = row['YEAR'];
            if (!reg || !name || !YEAR_MAP_ADMIN[yr]) continue;
            STUDENTS.push({ registerNumber: reg, name, phone, year: YEAR_MAP_ADMIN[yr], department: 'Mechanical Engineering', tokenId: reg });
        }
    } catch (e) {
        console.error('Failed to load dataset', e);
        STUDENTS = [];
    }
}

// Build admin selector + avatars
function buildAuthUI() {
    const sel = document.getElementById('admin-select');
    const avatarRow = document.getElementById('admin-avatars');
    ADMINS.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = `${a.name} (${a.role})`;
        opt.className = 'bg-gray-900';
        sel.appendChild(opt);

        // Avatar circles
        const av = document.createElement('div');
        av.className = 'admin-avatar text-white text-xs cursor-pointer transition-transform hover:scale-110';
        av.style.background = a.color;
        av.style.border = `2px solid ${a.color}66`;
        av.title = `${a.name} — ${a.role}`;
        av.textContent = a.initials;
        av.onclick = () => { sel.value = a.id; document.getElementById('admin-pass').focus(); };
        avatarRow.appendChild(av);
    });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function adminLogin() {
    const selectedId = document.getElementById('admin-select').value;
    const pass = document.getElementById('admin-pass').value;
    const errEl = document.getElementById('auth-error');

    if (!selectedId) { errEl.textContent = '⚠️ Please select an admin.'; errEl.classList.remove('hidden'); return; }

    const admin = ADMINS.find(a => a.id === selectedId && a.password === pass);
    if (!admin) {
        errEl.textContent = '❌ Invalid password. Please try again.';
        errEl.classList.remove('hidden');
        document.getElementById('admin-pass').value = '';
        return;
    }

    errEl.classList.add('hidden');
    currentAdmin = admin;

    // Show badge + logout
    const badge = document.getElementById('logged-in-badge');
    badge.textContent = `${admin.initials} · ${admin.name.split(' ')[1]}`;
    badge.style.background = `${admin.color}22`;
    badge.style.borderColor = `${admin.color}44`;
    badge.style.color = admin.color;
    badge.classList.remove('hidden');
    document.getElementById('logout-btn').classList.remove('hidden');

    document.getElementById('auth-gate').classList.add('hidden');
    document.getElementById('admin-content').classList.remove('hidden');

    loadStudents().then(() => {
        refreshStats();
        renderTokensList();
        renderBoughtList();
    });
}

function adminLogout() {
    currentAdmin = null;
    stopScanner();
    document.getElementById('admin-content').classList.add('hidden');
    document.getElementById('auth-gate').classList.remove('hidden');
    document.getElementById('admin-pass').value = '';
    document.getElementById('admin-select').value = '';
    document.getElementById('logged-in-badge').classList.add('hidden');
    document.getElementById('logout-btn').classList.add('hidden');
    document.getElementById('auth-error').classList.add('hidden');
    // destroy pie chart
    if (pieChartInstance) { pieChartInstance.destroy(); pieChartInstance = null; }
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function switchTab(tab) {
    ['scan', 'stats', 'bought', 'list'].forEach(t => {
        document.getElementById(`panel-${t}`).classList.toggle('hidden', t !== tab);
        const btn = document.getElementById(`tab-${t}`);
        btn.classList.toggle('tab-active', t === tab);
        btn.classList.toggle('tab-inactive', t !== tab);
    });
    if (tab === 'stats') { refreshStats(); renderPieChart(); }
    if (tab === 'bought') { renderBoughtList(); }
    if (tab === 'list') { renderTokensList(); }
}

// ─── Scanner ──────────────────────────────────────────────────────────────────
function startScanner() {
    if (scannerRunning) return;
    document.getElementById('start-btn').classList.add('hidden');
    document.getElementById('stop-btn').classList.remove('hidden');

    // Hide result if showing
    document.getElementById('scan-result').classList.add('hidden');

    // Clear and create new instance
    const readerEl = document.getElementById('reader');
    readerEl.innerHTML = "";

    html5QrScanner = new Html5Qrcode('reader');
    html5QrScanner.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        onScanSuccess,
        () => { } // ignore frame failures
    ).then(() => { scannerRunning = true; })
        .catch(err => {
            console.error(err);
            alert('⚠️ Cannot access camera. Ensure you are using HTTPS and have granted permission.');
            resetScannerUI();
        });
}

function stopScanner() {
    if (!html5QrScanner || !scannerRunning) return;
    html5QrScanner.stop().then(() => {
        html5QrScanner = null;
        resetScannerUI();
    }).catch(console.error);
}

function resetScannerUI() {
    scannerRunning = false;
    document.getElementById('start-btn').classList.remove('hidden');
    document.getElementById('stop-btn').classList.add('hidden');
    const readerEl = document.getElementById('reader');
    readerEl.innerHTML = '<p class="text-gray-500 text-sm text-center px-4">Tap Start Camera to begin scanning</p>';
}

function onScanSuccess(text) {
    if (navigator.vibrate) navigator.vibrate(100);

    // Stop scanner to focus on results
    if (html5QrScanner && scannerRunning) {
        html5QrScanner.stop().then(() => {
            scannerRunning = false;
            resetScannerUI();

            // Try to handle the scanned text
            let processedText = text.trim();

            // Sometimes scanners add extra quotes or weird characters
            if (processedText.startsWith('"') && processedText.endsWith('"')) {
                processedText = processedText.slice(1, -1);
            }

            try {
                const d = JSON.parse(processedText);
                const reg = d['REGISTER NUMBER'] || d.reg || d.REGISTER_NUMBER || d['TOKEN ID'] || '';
                lookupStudent(String(reg).trim(), reg);
            } catch (e) {
                // If not valid JSON, maybe the identifier is raw or we can extract it
                lookupStudent(processedText, null);
            }
        }).catch(err => {
            console.error('Stop error', err);
            // Fallback even if stop fails
            lookupStudent(text.trim(), null);
        });
    }
}

// ─── Manual Lookup ────────────────────────────────────────────────────────────
function manualLookup() {
    const val = document.getElementById('manual-token').value.trim().toUpperCase();
    if (!val) return;
    lookupStudent(val, null);
}

// ─── Student Lookup ───────────────────────────────────────────────────────────
function lookupStudent(identifier, tokenIdHint) {
    let searchId = String(identifier || '').trim();
    let searchHint = String(tokenIdHint || '').trim();

    // If identifier is a JSON string (failsafe), try to parse it
    if (searchId.startsWith('{') && searchId.endsWith('}')) {
        try {
            const d = JSON.parse(searchId);
            const reg = d['REGISTER NUMBER'] || d.reg || d.REGISTER_NUMBER || d['TOKEN ID'];
            if (reg) searchId = String(reg).trim();
        } catch (e) { }
    }

    const student = STUDENTS.find(s => {
        const sReg = String(s.registerNumber).trim();
        const sToken = String(s.tokenId).trim();
        return sReg === searchId || sToken === searchId || (searchHint && sToken === searchHint);
    });

    const resultEl = document.getElementById('scan-result');
    resultEl.classList.remove('hidden');
    resultEl.classList.add('result-appear');

    if (!student) {
        styleResult('red');
        document.getElementById('result-icon').textContent = '❌';
        document.getElementById('result-name').textContent = 'Invalid ID';
        document.getElementById('result-dept').textContent = 'No matching student found';
        document.getElementById('result-year-tag').textContent = '';
        setBadge('🚫 Invalid', 'red');
        setText('result-reg', searchId.length > 25 ? searchId.substring(0, 22) + '...' : searchId);
        setText('result-token-id', '—');
        setText('result-phone', '—');
        setStatusText('Not Found', 'red');
        document.getElementById('mark-used-btn').classList.add('hidden');
        document.getElementById('already-used-info').classList.add('hidden');
        currentScannedStudent = null;
        return;
    }

    currentScannedStudent = student;
    const status = getTokenStatus(student.tokenId);

    setText('result-name', student.name);
    setText('result-dept', student.department || 'Mechanical Engineering');
    setText('result-year-tag', student.year || '');
    document.getElementById('result-year-tag').className = 'text-xs mt-0.5 text-orange-300 font-medium';
    setText('result-reg', String(student.registerNumber));
    setText('result-token-id', student.tokenId);
    setText('result-phone', student.phone ? '+91 ' + student.phone : '—');

    if (status && status.used) {
        styleResult('red');
        document.getElementById('result-icon').textContent = '🚫';
        setBadge('🚫 Already Read', 'red');
        setStatusText('Already Redeemed', 'red');
        // CRITICAL: Ensure button is hidden
        document.getElementById('mark-used-btn').classList.add('hidden');
        document.getElementById('already-used-info').classList.remove('hidden');
        const t = status.usedAt ? new Date(status.usedAt).toLocaleString('en-IN') : '';
        setText('used-time', t ? `Redeemed at: ${t}` : 'Time unknown');
    } else {
        styleResult('green');
        document.getElementById('result-icon').textContent = '✅';
        setBadge('✅ Valid', 'green');
        setStatusText('Ready to Mark', 'green');
        // CRITICAL: Ensure button is visible
        document.getElementById('mark-used-btn').classList.remove('hidden');
        document.getElementById('mark-used-btn').innerText = '✓ Mark as Used';
        document.getElementById('already-used-info').classList.add('hidden');
    }
}

// ─── Scan Next ────────────────────────────────────────────────────────────────
function scanNext() {
    document.getElementById('scan-result').classList.add('hidden');
    startScanner();
}

function styleResult(color) {
    const inner = document.getElementById('scan-result-inner');
    inner.className = `rounded-2xl p-5 ${color === 'green' ? 'glass-green' : 'glass-red'}`;
    document.getElementById('result-icon').className = `w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${color === 'green' ? 'bg-green-500/20' : 'bg-red-500/20'}`;
}
function setBadge(text, color) {
    const el = document.getElementById('result-badge');
    el.textContent = text;
    el.className = `ml-auto px-2 py-1 rounded-full text-xs font-bold shrink-0 ${color === 'green' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`;
}
function setStatusText(text, color) {
    const el = document.getElementById('result-status-text');
    el.textContent = text;
    el.className = `font-semibold text-sm ${color === 'green' ? 'text-green-400' : 'text-red-400'}`;
}
function setText(id, val) { document.getElementById(id).textContent = val; }

// ─── Mark Token Used ──────────────────────────────────────────────────────────
function markCurrentTokenUsed() {
    if (!currentScannedStudent) return;
    if (!confirm(`Mark token for ${currentScannedStudent.name} as USED?`)) return;
    markTokenUsed(currentScannedStudent.tokenId, currentScannedStudent.registerNumber);

    // Refresh the lookup to show the "Already Redeemed" status
    lookupStudent(String(currentScannedStudent.registerNumber), currentScannedStudent.tokenId);
    refreshStats();
    // update pie if on stats tab
    if (!document.getElementById('panel-stats').classList.contains('hidden')) renderPieChart();
}

// ─── Statistics ───────────────────────────────────────────────────────────────
function refreshStats() {
    if (!STUDENTS.length) return;
    const { total, used, remaining } = getStats(STUDENTS);
    const pct = total ? Math.round((used / total) * 100) : 0;
    setText('stat-total', total);
    setText('stat-used', used);
    setText('stat-remaining', remaining);
    setText('stat-percent', pct + '%');
    document.getElementById('progress-bar').style.width = pct + '%';
}

// ─── PIE CHART — Year-wise bought vs not bought ───────────────────────────────
function renderPieChart() {
    if (!STUDENTS.length) return;
    const state = getTokensState();

    // Group by year
    const yearGroups = {};
    STUDENTS.forEach(s => {
        const yr = s.year || 'Unknown';
        if (!yearGroups[yr]) yearGroups[yr] = { bought: 0, notBought: 0, color: '' };
        if (state[s.tokenId]?.used) yearGroups[yr].bought++;
        else yearGroups[yr].notBought++;
    });

    // Colour mapping
    const YEAR_COLORS = {
        'Final Year (2021-2025)': { bought: '#f97316', notBought: '#f97316' + '44' },
        '3rd Year (2023-2027)': { bought: '#22c55e', notBought: '#22c55e' + '44' },
        '2nd Year': { bought: '#3b82f6', notBought: '#3b82f6' + '44' },
    };
    const fallbackColors = ['#a855f7', '#ec4899', '#14b8a6'];
    let fi = 0;

    const labels = [];
    const data = [];
    const bgColors = [];

    Object.entries(yearGroups).forEach(([yr, { bought, notBought }]) => {
        const colors = YEAR_COLORS[yr] || { bought: fallbackColors[fi], notBought: fallbackColors[fi] + '44' };
        fi++;
        const shortYr = yr.replace(' (2021-2025)', '').replace(' (2023-2027)', '');
        labels.push(`${shortYr} – Bought`);
        data.push(bought);
        bgColors.push(colors.bought);

        labels.push(`${shortYr} – Not Bought`);
        data.push(notBought);
        bgColors.push(colors.notBought);
    });

    const ctx = document.getElementById('pie-chart').getContext('2d');
    if (pieChartInstance) pieChartInstance.destroy();

    pieChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: bgColors,
                borderColor: 'rgba(0,0,0,0.3)',
                borderWidth: 2,
                hoverOffset: 8,
            }]
        },
        options: {
            responsive: true,
            cutout: '60%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${ctx.parsed} students`
                    }
                }
            }
        }
    });

    // Custom legend
    const legend = document.getElementById('pie-legend');
    legend.innerHTML = '';
    // Group by year for cleaner display
    Object.entries(yearGroups).forEach(([yr, { bought, notBought }]) => {
        const total = bought + notBought;
        const pct = total ? Math.round((bought / total) * 100) : 0;
        const colors = YEAR_COLORS[yr] || { bought: '#a855f7', notBought: '#a855f7' + '44' };
        const shortYr = yr.replace(' (2021-2025)', '').replace(' (2023-2027)', '');
        legend.insertAdjacentHTML('beforeend', `
      <div class="glass rounded-xl p-3">
        <div class="flex justify-between items-center mb-2">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full inline-block" style="background:${colors.bought}"></span>
            <span class="text-xs font-semibold">${shortYr}</span>
          </div>
          <span class="text-xs font-bold" style="color:${colors.bought}">${pct}% redeemed</span>
        </div>
        <div class="h-2 bg-white/10 rounded-full overflow-hidden">
          <div class="h-full rounded-full" style="width:${pct}%;background:${colors.bought};transition:width .7s"></div>
        </div>
        <div class="flex justify-between mt-1.5">
          <span class="text-xs text-gray-400">✅ Bought: <strong class="text-white">${bought}</strong></span>
          <span class="text-xs text-gray-400">⏳ Pending: <strong class="text-white">${notBought}</strong></span>
        </div>
      </div>
    `);
    });
}

// ─── Bought Students List ─────────────────────────────────────────────────────
let boughtFilter = 'all';

function setBoughtFilter(f) {
    boughtFilter = f;
    document.querySelectorAll('.bought-chip').forEach(el => {
        el.classList.remove('btn-primary', 'text-white');
        el.classList.add('glass', 'text-gray-300');
    });
    const active = document.getElementById(`bf-${f}`);
    active.classList.remove('glass', 'text-gray-300');
    active.classList.add('btn-primary', 'text-white');
    renderBoughtList();
}

function renderBoughtList() {
    const container = document.getElementById('bought-list');
    const countEl = document.getElementById('bought-count');
    container.innerHTML = '';
    const state = getTokensState();

    let filtered = STUDENTS.filter(s => state[s.tokenId]?.used);

    if (boughtFilter === 'final') filtered = filtered.filter(s => s.year?.includes('Final Year'));
    else if (boughtFilter === '3rd') filtered = filtered.filter(s => s.year?.includes('3rd'));
    else if (boughtFilter === '2nd') filtered = filtered.filter(s => s.year?.includes('2nd'));

    countEl.textContent = `${filtered.length} student${filtered.length !== 1 ? 's' : ''} redeemed`;

    if (!filtered.length) {
        container.innerHTML = `
      <div class="glass rounded-2xl p-8 text-center">
        <div class="text-4xl mb-3">🎟️</div>
        <p class="text-gray-400 text-sm">No tokens redeemed yet</p>
        <p class="text-gray-500 text-xs mt-1">Scan a QR and mark it as used</p>
      </div>`;
        return;
    }

    filtered.forEach((s, idx) => {
        const status = state[s.tokenId];
        const usedAt = status?.usedAt ? new Date(status.usedAt).toLocaleString('en-IN', {
            hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short'
        }) : '—';

        const yearBadgeColor = s.year?.includes('Final')
            ? 'bg-orange-500/20 text-orange-300'
            : s.year?.includes('3rd')
                ? 'bg-green-500/20 text-green-300'
                : 'bg-blue-500/20 text-blue-300';

        container.insertAdjacentHTML('beforeend', `
      <div class="glass rounded-2xl p-4 flex items-center gap-3 fade-in">
        <div class="w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center text-base font-bold text-green-300 shrink-0">
          ${idx + 1}
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-sm leading-tight truncate">${s.name}</p>
          <p class="text-xs text-gray-400 truncate">${s.registerNumber}</p>
          <p class="text-xs text-gray-500 mt-0.5">⏱ ${usedAt}</p>
        </div>
        <div class="shrink-0 text-right">
          <span class="text-xs ${yearBadgeColor} px-2 py-0.5 rounded-full font-medium block mb-1">
            ${s.year?.includes('Final') ? 'Final Yr' : s.year?.includes('3rd') ? '3rd Yr' : '2nd Yr'}
          </span>
          <span class="text-xs text-green-400 font-semibold">✅ Bought</span>
        </div>
      </div>
    `);
    });
}

// ─── All Tokens List ──────────────────────────────────────────────────────────
function setFilter(f) {
    currentFilter = f;
    document.querySelectorAll('.filter-chip').forEach(el => {
        el.classList.remove('btn-primary', 'text-white');
        el.classList.add('glass', 'text-gray-300');
    });
    document.getElementById(`filter-${f}`).classList.remove('glass', 'text-gray-300');
    document.getElementById(`filter-${f}`).classList.add('btn-primary', 'text-white');
    renderTokensList();
}

function renderTokensList() {
    const container = document.getElementById('tokens-list');
    const search = (document.getElementById('search-input')?.value || '').toLowerCase();
    const state = getTokensState();
    container.innerHTML = '';

    let filtered = STUDENTS.filter(s => {
        const match = s.name.toLowerCase().includes(search) ||
            String(s.registerNumber).toLowerCase().includes(search);
        const used = !!state[s.tokenId]?.used;
        if (currentFilter === 'used') return match && used;
        if (currentFilter === 'unused') return match && !used;
        return match;
    });

    if (!filtered.length) {
        container.innerHTML = '<p class="text-center text-gray-500 text-sm py-8">No records found.</p>';
        return;
    }

    filtered.forEach(s => {
        const isUsed = !!state[s.tokenId]?.used;
        const usedAt = isUsed && state[s.tokenId].usedAt
            ? new Date(state[s.tokenId].usedAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
            : null;
        container.insertAdjacentHTML('beforeend', `
      <div class="glass rounded-2xl p-4 flex items-center gap-3 ${isUsed ? 'opacity-70' : ''}">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl ${isUsed ? 'bg-green-500/20' : 'bg-orange-500/20'} shrink-0">
          ${isUsed ? '✅' : '⏳'}
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-sm leading-tight truncate">${s.name}</p>
          <p class="text-xs text-gray-400 truncate">${s.registerNumber}</p>
          ${isUsed ? `<p class="text-xs text-green-400 mt-0.5">Bought: ${usedAt}</p>` : ''}
        </div>
        <div class="shrink-0">
          ${isUsed
                ? `<span class="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded-full">Bought</span>`
                : `<button onclick="quickMark('${s.registerNumber}')" class="text-xs bg-orange-500/20 text-orange-300 px-2 py-1 rounded-full hover:bg-orange-500/30 transition-colors">Mark Used</button>`
            }
        </div>
      </div>
    `);
    });
}

function quickMark(reg) {
    const s = STUDENTS.find(s => String(s.registerNumber) === String(reg));
    if (!s || !confirm(`Mark token for ${s.name} as USED?`)) return;
    markTokenUsed(s.tokenId, s.registerNumber);
    renderTokensList();
    refreshStats();
}



// ─── Init ─────────────────────────────────────────────────────────────────────
buildAuthUI();

document.getElementById('admin-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') adminLogin();
});
