/**
 * app.js — Student Portal Logic
 * Loads FINAL DATA SET1.json directly.
 * Token ID = Register Number (unique per student).
 * QR content: NAME | REGISTER NUMBER | YEAR | TOKEN ID
 */

let STUDENTS = [];
let currentStudent = null;
let qrCodeInstance = null;

const YEAR_MAP = {
    4: 'Final Year (2021-2025)',
    3: '3rd Year (2023-2027)',
    2: '2nd Year (2024-2028)',
};

function cleanPhone(p) {
    if (!p) return '';
    const s = String(p).replace(/\D/g, '');
    return s.length >= 10 ? s.slice(-10) : s;
}

function cleanReg(r) {
    if (r == null) return '';
    const s = String(r).trim();
    // Handle numeric values that may be floats
    if (/^\d+(\.\d+)?$/.test(s)) return String(parseInt(s));
    return s;
}

// ─── Load dataset ─────────────────────────────────────────────────────────────
async function loadStudents() {
    try {
        const res = await fetch('FINAL DATA SET1.json');
        const raw = await res.json();
        STUDENTS = [];
        for (const row of raw) {
            if (!row || typeof row !== 'object') continue;
            const reg = cleanReg(row['REGISTER NUMBER']);
            const name = String(row['NAME AS PER THE COLLEGE RECORDS'] || '').trim();
            const phone = cleanPhone(row['PHONE NO']);
            const yr = row['YEAR'];
            if (!reg || !name || !YEAR_MAP[yr]) continue;
            STUDENTS.push({
                registerNumber: reg,
                name,
                phone,
                year: YEAR_MAP[yr],
                department: 'Mechanical Engineering',
                tokenId: reg,   // Register Number IS the Token ID
            });
        }
        console.log(`Loaded ${STUDENTS.length} students.`);
    } catch (e) {
        console.error('Failed to load dataset:', e);
    }
}
loadStudents();

// ─── QR payload: NAME | REGISTER NUMBER | YEAR | TOKEN ID ────────────────────
function buildQRPayload(student) {
    return JSON.stringify({
        NAME: student.name,
        'REGISTER NUMBER': student.registerNumber,
        YEAR: student.year,
        'TOKEN ID': student.tokenId,
        DEPT: 'Mechanical Engineering',
    });
}

// ─── Verify student ───────────────────────────────────────────────────────────
async function verifyStudent() {
    const regInput = document.getElementById('reg-input').value.trim().toUpperCase();
    const phoneInput = document.getElementById('phone-input').value.trim();

    if (!regInput || !phoneInput) { showError('Please fill in both fields.'); shakeForm(); return; }
    if (!/^\d{10}$/.test(phoneInput)) { showError('Phone number must be exactly 10 digits.'); shakeForm(); return; }

    setBtnLoading(true); hideError();
    await new Promise(r => setTimeout(r, 500));

    // Normalize input reg for comparison
    const normReg = cleanReg(regInput);
    const match = STUDENTS.find(s => s.registerNumber === normReg && s.phone === phoneInput);
    setBtnLoading(false);

    if (!match) { showError('No match found. Check your register number and phone number.'); shakeForm(); return; }
    currentStudent = match;
    showResult(match);
}

// ─── Show result ──────────────────────────────────────────────────────────────
function showResult(student) {
    document.getElementById('student-name').textContent = student.name;
    document.getElementById('student-dept').textContent = `${student.department} · ${student.year}`;
    document.getElementById('info-reg').textContent = student.registerNumber;
    document.getElementById('info-token').textContent = student.tokenId;

    const status = getTokenStatus(student.tokenId);
    const badge = document.getElementById('token-status-badge');
    const usedW = document.getElementById('used-warning');
    if (status.used) {
        badge.textContent = '🚫 Used';
        badge.className = 'ml-auto text-xs font-semibold px-2 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/30';
        usedW.classList.remove('hidden');
    } else {
        badge.textContent = '✅ Valid';
        badge.className = 'ml-auto text-xs font-semibold px-2 py-1 rounded-full bg-green-500/20 text-green-300 border border-green-500/30';
        usedW.classList.add('hidden');
    }

    generateQR(student);
    setupWhatsAppShare(student);

    document.getElementById('form-section').classList.add('hidden');
    const rs = document.getElementById('result-section');
    rs.classList.remove('hidden');
    rs.classList.add('fade-in');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Generate QR ──────────────────────────────────────────────────────────────
function generateQR(student) {
    const container = document.getElementById('qr-container');
    container.innerHTML = '';
    if (qrCodeInstance) { try { qrCodeInstance.clear(); } catch (e) { } qrCodeInstance = null; }
    qrCodeInstance = new QRCode(container, {
        text: buildQRPayload(student),
        width: 220, height: 220,
        colorDark: '#1a1a2e', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H,
    });
}

// ─── Download QR ──────────────────────────────────────────────────────────────
async function downloadQR() {
    if (!currentStudent) return;
    await new Promise(r => setTimeout(r, 200));
    const container = document.getElementById('qr-container');
    const canvas = container.querySelector('canvas');
    const img = container.querySelector('img');
    let dataUrl = null;
    if (canvas) {
        dataUrl = canvas.toDataURL('image/png');
    } else if (img) {
        const tmp = document.createElement('canvas');
        tmp.width = tmp.height = 220;
        tmp.getContext('2d').drawImage(img, 0, 0, 220, 220);
        dataUrl = tmp.toDataURL('image/png');
    }
    if (!dataUrl) { alert('QR not ready yet, please wait.'); return; }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `FoodToken_${currentStudent.registerNumber}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ─── WhatsApp Share ───────────────────────────────────────────────────────────
function setupWhatsAppShare(student) {
    const msg = encodeURIComponent(
        `🍽️ *College Food Token*\n\n` +
        `👤 *Name:* ${student.name}\n` +
        `🎓 *Register No:* ${student.registerNumber}\n` +
        `🏛️ *Year:* ${student.year}\n` +
        `🎟️ *Token ID:* ${student.tokenId}\n` +
        `🔧 *Dept:* Mechanical Engineering\n\n` +
        `📱 Show this QR at the food counter.`
    );
    document.getElementById('whatsapp-btn').onclick = () =>
        window.open(`https://wa.me/91${student.phone}?text=${msg}`, '_blank');
}

// ─── Reset ────────────────────────────────────────────────────────────────────
function resetForm() {
    currentStudent = null;
    document.getElementById('reg-input').value = '';
    document.getElementById('phone-input').value = '';
    document.getElementById('result-section').classList.add('hidden');
    document.getElementById('form-section').classList.remove('hidden');
    document.getElementById('qr-container').innerHTML = '';
    if (qrCodeInstance) { try { qrCodeInstance.clear(); } catch (e) { } qrCodeInstance = null; }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function showError(msg) {
    document.getElementById('error-text').textContent = msg;
    document.getElementById('error-msg').classList.remove('hidden');
}
function hideError() { document.getElementById('error-msg').classList.add('hidden'); }
function shakeForm() {
    const f = document.getElementById('form-section');
    f.classList.add('shake');
    setTimeout(() => f.classList.remove('shake'), 500);
}
function setBtnLoading(on) {
    document.getElementById('btn-text').classList.toggle('hidden', on);
    document.getElementById('btn-loader').classList.toggle('hidden', !on);
    document.getElementById('verify-btn').disabled = on;
}
