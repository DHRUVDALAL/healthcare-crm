(function () {
  'use strict';

  window.CRM_AUTH.requireAuth();

  const els = {
    userName: document.getElementById('userNameSpan'),
    userRole: document.getElementById('userRoleSpan'),
    topRole: document.getElementById('topRole'),
    avatarSpan: document.getElementById('avatarSpan'),

    filterMonth: document.getElementById('filterMonth'),
    refreshBtn: document.getElementById('refreshBtn'),
    statusBadge: document.getElementById('statusBadge'),
    leaderboardBody: document.getElementById('leaderboardBody'),

    openTargetsBtn: document.getElementById('openTargetsBtn'),
    targetsModalOverlay: document.getElementById('targetsModalOverlay'),
    closeTargetsModalBtn: document.getElementById('closeTargetsModalBtn'),
    cancelTargetsBtn: document.getElementById('cancelTargetsBtn'),
    targetsForm: document.getElementById('targetsForm'),
    
    targetRecruiterSelect: document.getElementById('targetRecruiterSelect'),
    targetMonthInput: document.getElementById('targetMonthInput'),
    targetSubmissionsInput: document.getElementById('targetSubmissionsInput'),
    targetSelectionsInput: document.getElementById('targetSelectionsInput'),
    targetRevenueInput: document.getElementById('targetRevenueInput'),
    targetNotesInput: document.getElementById('targetNotesInput')
  };

  let leaderboardData = [];
  let userProfile = null;
  let recruitersList = [];

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] || m));
  }

  function setStatus(text, variant) {
    els.statusBadge.textContent = text;
    els.statusBadge.className = 'badge';
    if (variant === 'warn') els.statusBadge.classList.add('warn');
    if (variant === 'ok') els.statusBadge.classList.add('success');
  }

  async function init() {
    try {
      await loadProfile();

      // Enforce admin access matching employees.js pattern
      if (userProfile.role !== 'admin') {
        alert('Access Denied. Performance tracking is restricted to Admin users.');
        window.location.href = './dashboard.html';
        return;
      }

      document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');

      // Set default month in filter to current month (YYYY-MM)
      const currentMonth = new Date().toISOString().slice(0, 7);
      els.filterMonth.value = currentMonth;
      els.targetMonthInput.value = currentMonth;

      await Promise.all([
        loadRecruiters(),
        loadLeaderboard()
      ]);

      bindEvents();
    } catch (err) {
      console.error('Initialization error:', err);
    }
  }

  async function loadProfile() {
    const res = await window.CRM_API.request('/api/auth/profile');
    userProfile = res.data.user;
    els.userName.textContent = userProfile.full_name;
    els.topRole.textContent = userProfile.role;
    els.userRole.textContent = userProfile.role === 'admin' ? 'Administrator' : 'Recruiter';

    const initials = userProfile.full_name
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    els.avatarSpan.textContent = initials;
  }

  async function loadRecruiters() {
    try {
      const res = await window.CRM_API.request('/api/employees?role=employee&status=active');
      recruitersList = res.data.employees || [];
      
      els.targetRecruiterSelect.innerHTML = '<option value="">Choose Employee...</option>' + 
        recruitersList.map(r => `<option value="${r.id}">${escapeHtml(r.full_name)} (${escapeHtml(r.designation || 'Recruiter')})</option>`).join('');
    } catch (err) {
      console.error('Failed to load recruiters:', err);
    }
  }

  async function loadLeaderboard() {
    try {
      setStatus('Loading...', 'warn');
      const selectedMonth = els.filterMonth.value;
      if (!selectedMonth) return;

      const res = await window.CRM_API.request(`/api/analytics/performance?month=${selectedMonth}`);
      leaderboardData = res.data.leaderboard || [];
      
      renderLeaderboard();
      setStatus(`Loaded leaderboard`, 'ok');
    } catch (err) {
      setStatus('Failed to load', 'warn');
      alert(err.message || 'Failed to load performance stats');
    }
  }

  function renderProgressBar(achieved, target, colorClass = 'primary') {
    const act = Number(achieved || 0);
    const trg = Number(target || 0);
    
    if (trg <= 0) {
      return `
        <div>${act} achieved <span class="small-muted">(No target set)</span></div>
      `;
    }

    const pct = Math.min(Math.round((act / trg) * 100), 100);
    
    return `
      <div>
        <strong>${act} / ${trg}</strong> (${pct}%)
        <div class="progress-bar-container">
          <div class="progress-bar-fill ${colorClass}" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }

  function renderRevenueProgressBar(achieved, target) {
    const act = Number(achieved || 0);
    const trg = Number(target || 0);
    
    const formattedAch = '₹' + act.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    const formattedTrg = '₹' + trg.toLocaleString('en-IN', { maximumFractionDigits: 0 });

    if (trg <= 0) {
      return `
        <div>${formattedAch} achieved <span class="small-muted">(No target set)</span></div>
      `;
    }

    const pct = Math.min(Math.round((act / trg) * 100), 100);
    
    return `
      <div>
        <strong>${formattedAch} / ${formattedTrg}</strong> (${pct}%)
        <div class="progress-bar-container">
          <div class="progress-bar-fill success" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }

  function renderLeaderboard() {
    if (!leaderboardData.length) {
      els.leaderboardBody.innerHTML = '<tr><td colspan="7" class="small-muted">No leaderboard data found for this month.</td></tr>';
      return;
    }

    els.leaderboardBody.innerHTML = leaderboardData.map((rec, index) => {
      const rank = index + 1;
      let rankBadge = '';
      if (rank === 1) rankBadge = '<span class="rank-badge rank-1">1</span>';
      else if (rank === 2) rankBadge = '<span class="rank-badge rank-2">2</span>';
      else if (rank === 3) rankBadge = '<span class="rank-badge rank-3">3</span>';
      else rankBadge = `<span class="rank-badge rank-other">${rank}</span>`;

      return `
        <tr>
          <td><center>${rankBadge}</center></td>
          <td>
            <div style="font-weight:900;">${escapeHtml(rec.recruiter_name)}</div>
            <div class="small-muted">${escapeHtml(rec.email)}</div>
          </td>
          <td>${renderProgressBar(rec.submissions_achieved, rec.submissions_target, 'primary')}</td>
          <td>${renderProgressBar(rec.selections_achieved, rec.selections_target, 'warning')}</td>
          <td>${renderRevenueProgressBar(rec.revenue_achieved, rec.revenue_target)}</td>
          <td><span class="badge" style="font-size:13px; font-weight:700;">${rec.candidates_added} added</span></td>
          <td><span class="badge" style="font-size:13px; font-weight:700;">${rec.tasks_completed} completed</span></td>
        </tr>
      `;
    }).join('');
  }

  function openTargetsModal() {
    els.targetsForm.reset();
    
    // Default form month to whatever filter month is selected
    els.targetMonthInput.value = els.filterMonth.value;
    
    els.targetsModalOverlay.classList.add('show');
    els.targetsModalOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeTargetsModal() {
    els.targetsModalOverlay.classList.remove('show');
    els.targetsModalOverlay.setAttribute('aria-hidden', 'true');
  }

  function bindEvents() {
    els.refreshBtn.addEventListener('click', loadLeaderboard);
    els.filterMonth.addEventListener('change', loadLeaderboard);

    els.openTargetsBtn.addEventListener('click', openTargetsModal);
    els.closeTargetsModalBtn.addEventListener('click', closeTargetsModal);
    els.cancelTargetsBtn.addEventListener('click', closeTargetsModal);

    // Form submission
    els.targetsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const payload = {
        recruiter_id: Number(els.targetRecruiterSelect.value),
        month: els.targetMonthInput.value,
        submissions_target: Number(els.targetSubmissionsInput.value || 0),
        selections_target: Number(els.targetSelectionsInput.value || 0),
        revenue_target: Number(els.targetRevenueInput.value || 0),
        notes: els.targetNotesInput.value || null
      };

      try {
        await window.CRM_API.request('/api/projections/recruiter', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        
        closeTargetsModal();
        
        // Sync filter month with updated month to show results immediately
        els.filterMonth.value = payload.month;
        await loadLeaderboard();
      } catch (err) {
        alert(err.message || 'Failed to save targets');
      }
    });
  }

  // Execute on load
  init();
})();
