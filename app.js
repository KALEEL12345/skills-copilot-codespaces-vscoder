/**
 * Student Attendance Tracker
 * Tracks daily attendance and highlights students who bunk class.
 */

const STORAGE_KEY = 'attendanceTracker';

// ── State ─────────────────────────────────────────────────────────────────────
let state = {
  students: [],       // [{ id, name, rollNo }]
  sessions: [],       // [{ id, date, subject, records: { studentId: 'present'|'absent'|'bunk' } }]
  currentSession: null  // id of the session being edited
};

// ── Persistence ───────────────────────────────────────────────────────────────
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      state = JSON.parse(raw);
    } catch (e) {
      console.error('Failed to parse saved state', e);
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function statusBadge(status) {
  if (!status) return `<span class="badge badge-none">—</span>`;
  const map = { present: 'Present', absent: 'Absent', bunk: 'Bunked' };
  return `<span class="badge badge-${status}">${map[status] || status}</span>`;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ── Student Management ────────────────────────────────────────────────────────
function addStudent() {
  const nameInput   = document.getElementById('studentName');
  const rollInput   = document.getElementById('studentRoll');
  const name   = nameInput.value.trim();
  const rollNo = rollInput.value.trim();

  if (!name) { showToast('Please enter a student name.'); return; }

  const duplicate = state.students.find(
    s => s.name.toLowerCase() === name.toLowerCase() && s.rollNo === rollNo
  );
  if (duplicate) { showToast('Student already exists.'); return; }

  state.students.push({ id: generateId(), name, rollNo });
  saveState();
  nameInput.value = '';
  rollInput.value = '';
  showToast(`✅ "${name}" added.`);
  renderAll();
}

function removeStudent(id) {
  const student = state.students.find(s => s.id === id);
  if (!student) return;
  if (!confirm(`Remove "${student.name}" and all their attendance records?`)) return;
  state.students = state.students.filter(s => s.id !== id);
  // clean up records in sessions
  state.sessions.forEach(sess => { delete sess.records[id]; });
  saveState();
  showToast(`🗑️ "${student.name}" removed.`);
  renderAll();
}

// ── Session Management ────────────────────────────────────────────────────────
function startSession() {
  const dateEl    = document.getElementById('sessionDate');
  const subjectEl = document.getElementById('sessionSubject');
  const date      = dateEl.value;
  const subject   = subjectEl.value.trim();

  if (!date)    { showToast('Please select a date.'); return; }
  if (!subject) { showToast('Please enter a subject / class name.'); return; }
  if (state.students.length === 0) {
    showToast('Add at least one student first.');
    return;
  }

  // Check if a session with the same date+subject already exists
  const existing = state.sessions.find(
    s => s.date === date && s.subject.toLowerCase() === subject.toLowerCase()
  );

  if (existing) {
    state.currentSession = existing.id;
    showToast(`📋 Resuming session: ${subject} on ${formatDate(date)}`);
  } else {
    const session = { id: generateId(), date, subject, records: {} };
    state.sessions.push(session);
    state.currentSession = session.id;
    showToast(`📋 New session started: ${subject} on ${formatDate(date)}`);
  }

  saveState();
  renderAll();
}

function saveSession() {
  if (!state.currentSession) { showToast('No active session to save.'); return; }
  const session = state.sessions.find(s => s.id === state.currentSession);
  if (!session) return;

  // Read current status selects
  state.students.forEach(student => {
    const sel = document.getElementById(`status-${student.id}`);
    if (sel) session.records[student.id] = sel.value;
  });

  saveState();
  state.currentSession = null;
  showToast('✅ Attendance saved successfully!');
  renderAll();
}

function cancelSession() {
  if (!state.currentSession) return;
  const session = state.sessions.find(s => s.id === state.currentSession);
  // If session has no records yet (was just created), remove it
  if (session && Object.keys(session.records).length === 0) {
    state.sessions = state.sessions.filter(s => s.id !== state.currentSession);
  }
  state.currentSession = null;
  saveState();
  renderAll();
}

function deleteSession(id) {
  const session = state.sessions.find(s => s.id === id);
  if (!session) return;
  if (!confirm(`Delete session "${session.subject}" on ${formatDate(session.date)}?`)) return;
  state.sessions = state.sessions.filter(s => s.id !== id);
  if (state.currentSession === id) state.currentSession = null;
  saveState();
  showToast('🗑️ Session deleted.');
  renderAll();
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function getSessionStats(session) {
  let present = 0, absent = 0, bunk = 0, none = 0;
  state.students.forEach(student => {
    const status = session.records[student.id];
    if (status === 'present') present++;
    else if (status === 'absent') absent++;
    else if (status === 'bunk') bunk++;
    else none++;
  });
  return { present, absent, bunk, none, total: state.students.length };
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderAll() {
  renderStats();
  renderAttendanceTable();
  renderBunkReport();
  renderHistory();
}

function renderStats() {
  const session = state.currentSession
    ? state.sessions.find(s => s.id === state.currentSession)
    : null;

  const stats = session
    ? getSessionStats(session)
    : { total: state.students.length, present: 0, absent: 0, bunk: 0 };

  document.getElementById('stat-total').textContent   = stats.total;
  document.getElementById('stat-present').textContent = stats.present;
  document.getElementById('stat-absent').textContent  = stats.absent;
  document.getElementById('stat-bunk').textContent    = stats.bunk;
}

function renderAttendanceTable() {
  const section = document.getElementById('attendance-section');
  const session = state.currentSession
    ? state.sessions.find(s => s.id === state.currentSession)
    : null;

  if (!session) {
    section.innerHTML = `<p class="empty-state">Start a session above to mark attendance.</p>`;
    return;
  }

  if (state.students.length === 0) {
    section.innerHTML = `<p class="empty-state">No students added yet. Add students below.</p>`;
    return;
  }

  const rows = state.students.map(student => {
    const current = session.records[student.id] || 'present';
    return `
      <tr>
        <td>${student.rollNo || '—'}</td>
        <td><strong>${escapeHtml(student.name)}</strong></td>
        <td>
          <select class="status-select" id="status-${student.id}" onchange="onStatusChange('${student.id}')">
            <option value="present" ${current === 'present' ? 'selected' : ''}>✅ Present</option>
            <option value="absent"  ${current === 'absent'  ? 'selected' : ''}>❌ Absent</option>
            <option value="bunk"    ${current === 'bunk'    ? 'selected' : ''}>⚠️ Bunked</option>
          </select>
        </td>
        <td class="status-badge-cell">${statusBadge(current)}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="removeStudent('${student.id}')">Remove</button>
        </td>
      </tr>`;
  }).join('');

  section.innerHTML = `
    <div class="table-actions">
      <button class="btn btn-success" onclick="markAll('present')">✅ Mark All Present</button>
      <button class="btn btn-danger"  onclick="markAll('absent')">❌ Mark All Absent</button>
      <button class="btn btn-secondary" onclick="markAll('bunk')">⚠️ Mark All Bunked</button>
    </div>
    <div class="attendance-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Roll No.</th>
            <th>Student Name</th>
            <th>Mark Status</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="saveSession()">💾 Save Attendance</button>
      <button class="btn btn-secondary" onclick="cancelSession()">Cancel</button>
    </div>`;
}

function onStatusChange(studentId) {
  const sel = document.getElementById(`status-${studentId}`);
  if (!sel) return;
  const session = state.sessions.find(s => s.id === state.currentSession);
  if (!session) return;
  session.records[studentId] = sel.value;
  // Update badge in the same row
  const badge = sel.closest('tr').querySelector('.status-badge-cell');
  if (badge) badge.innerHTML = statusBadge(sel.value);
  renderStats();
  renderBunkReport();
}

function markAll(status) {
  const session = state.sessions.find(s => s.id === state.currentSession);
  if (!session) return;
  state.students.forEach(student => {
    session.records[student.id] = status;
    const sel = document.getElementById(`status-${student.id}`);
    if (sel) sel.value = status;
    const badge = sel ? sel.closest('tr').querySelector('.status-badge-cell') : null;
    if (badge) badge.innerHTML = statusBadge(status);
  });
  renderStats();
  renderBunkReport();
}

function renderBunkReport() {
  const el = document.getElementById('bunk-report');
  const session = state.currentSession
    ? state.sessions.find(s => s.id === state.currentSession)
    : null;

  if (!session) {
    el.innerHTML = `<p class="empty-state">Start a session to see bunk report.</p>`;
    return;
  }

  const bunkers = state.students.filter(
    s => session.records[s.id] === 'bunk'
  );

  if (bunkers.length === 0) {
    el.innerHTML = `<p class="empty-state">🎉 No students are bunking this class!</p>`;
    return;
  }

  const items = bunkers.map(s =>
    `<li><span class="bunk-icon">🚫</span> ${escapeHtml(s.name)}${s.rollNo ? ` <small>(Roll: ${escapeHtml(s.rollNo)})</small>` : ''}</li>`
  ).join('');
  el.innerHTML = `<ul class="bunk-list">${items}</ul>`;
}

function renderHistory() {
  const el = document.getElementById('history-body');
  const sorted = [...state.sessions]
    .filter(s => s.id !== state.currentSession)
    .sort((a, b) => (b.date > a.date ? 1 : -1));

  if (sorted.length === 0) {
    el.innerHTML = `<tr><td colspan="7" class="empty-state">No saved sessions yet.</td></tr>`;
    return;
  }

  el.innerHTML = sorted.map(session => {
    const stats = getSessionStats(session);
    return `
      <tr>
        <td>${formatDate(session.date)}</td>
        <td>${escapeHtml(session.subject)}</td>
        <td>${stats.total}</td>
        <td><span style="color:#2e7d32;font-weight:700;">${stats.present}</span></td>
        <td><span style="color:#c62828;font-weight:700;">${stats.absent}</span></td>
        <td><span style="color:#e65100;font-weight:700;">${stats.bunk}</span></td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="resumeSession('${session.id}')">Edit</button>
          <button class="btn btn-danger btn-sm"  onclick="deleteSession('${session.id}')">Delete</button>
        </td>
      </tr>`;
  }).join('');
}

function resumeSession(id) {
  state.currentSession = id;
  saveState();
  showToast('📋 Session reopened for editing.');
  renderAll();
  document.getElementById('attendance-card').scrollIntoView({ behavior: 'smooth' });
}

// ── XSS helper ────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadState();

  // Set today's date as default
  const dateEl = document.getElementById('sessionDate');
  if (dateEl && !dateEl.value) dateEl.value = today();

  // Enter-key support for student form
  ['studentName', 'studentRoll'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') addStudent();
    });
  });

  renderAll();
});
