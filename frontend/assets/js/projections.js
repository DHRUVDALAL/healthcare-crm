(function () {
  'use strict';

  window.CRM_AUTH.requireAuth();

  const els = {
    userName: document.getElementById('userName'),
    userRole: document.getElementById('userRole'),
    
    progressWidget: document.getElementById('progressWidget'),
    tableBody: document.getElementById('tableBody'),

    openAddBtn: document.getElementById('openAddBtn'),
    modalOverlay: document.getElementById('modalOverlay'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    targetForm: document.getElementById('targetForm'),
    
    projMonth: document.getElementById('projMonth'),
    projHires: document.getElementById('projHires'),
    projRevenue: document.getElementById('projRevenue'),
    projPlacements: document.getElementById('projPlacements'),
    projNotes: document.getElementById('projNotes'),

    logoutBtn: document.getElementById('logoutBtn')
  };

  let userProfile = null;

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] || m));
  }

  function formatMoneyINR(value) {
    const num = Number(value || 0);
    return num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  async function loadProfile() {
    const res = await window.CRM_API.request('/api/auth/profile');
    userProfile = res.data.user;
    els.userName.textContent = userProfile.full_name;
    els.userRole.textContent = userProfile.role;

    if (userProfile.role !== 'admin') {
      alert('Access Denied. Admins only.');
      window.location.href = './dashboard.html';
    }
  }

  async function loadHistory() {
    try {
      const res = await window.CRM_API.request(`/api/projections`);
      const list = res.data.projections || [];
      
      if (!list.length) {
        els.tableBody.innerHTML = '<tr><td colspan="4" class="small-muted">No historical projections found.</td></tr>';
        return;
      }

      els.tableBody.innerHTML = list.map((p) => {
        return `
          <tr>
            <td><div style="font-weight:900;">${p.month}</div></td>
            <td>₹ ${formatMoneyINR(p.revenue_target)}</td>
            <td>${p.hiring_target} candidates</td>
            <td>${p.placement_target} hospitals</td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      els.tableBody.innerHTML = '<tr><td colspan="4" class="status red">Failed to load history</td></tr>';
    }
  }

  async function loadProgress() {
    try {
      els.progressWidget.innerHTML = '<div class="small-muted">Loading current month progress...</div>';
      const month = new Date().toISOString().slice(0, 7);
      const res = await window.CRM_API.request(`/api/projections/progress?month=${month}`);
      const data = res.data;

      if (!data.target) {
        els.progressWidget.innerHTML = `
          <div class="small-muted" style="text-align:center;">
            No targets set for <b>${month}</b>. Click 'Set Target' to begin tracking.
          </div>
        `;
        return;
      }

      const revPct = data.target.revenue_target > 0 ? Math.min(100, Math.round((data.actual.revenue / data.target.revenue_target) * 100)) : 0;
      const hirePct = data.target.hiring_target > 0 ? Math.min(100, Math.round((data.actual.hires / data.target.hiring_target) * 100)) : 0;

      els.progressWidget.innerHTML = `
        <div style="margin-bottom: 15px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
            <span style="font-weight:600;">Revenue Target</span>
            <span style="font-weight:900;">₹ ${formatMoneyINR(data.actual.revenue)} / ₹ ${formatMoneyINR(data.target.revenue_target)}</span>
          </div>
          <div style="background:var(--border); height:8px; border-radius:4px; overflow:hidden;">
            <div style="background:var(--primary); height:100%; width:${revPct}%;"></div>
          </div>
          <div style="text-align:right; font-size:12px; margin-top:3px;" class="small-muted">${revPct}% Achieved</div>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
            <span style="font-weight:600;">Hiring Target</span>
            <span style="font-weight:900;">${data.actual.hires} / ${data.target.hiring_target}</span>
          </div>
          <div style="background:var(--border); height:8px; border-radius:4px; overflow:hidden;">
            <div style="background:var(--success); height:100%; width:${hirePct}%;"></div>
          </div>
          <div style="text-align:right; font-size:12px; margin-top:3px;" class="small-muted">${hirePct}% Achieved</div>
        </div>
      `;
    } catch (err) {
      els.progressWidget.innerHTML = '<div class="status red">Failed to load progress</div>';
    }
  }

  function openModal() {
    els.targetForm.reset();
    els.projMonth.value = new Date().toISOString().slice(0, 7);
    els.modalOverlay.classList.add('show');
    els.modalOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    els.modalOverlay.classList.remove('show');
    els.modalOverlay.setAttribute('aria-hidden', 'true');
  }

  function bindEvents() {
    els.openAddBtn.addEventListener('click', openModal);
    els.closeModalBtn.addEventListener('click', closeModal);
    els.cancelBtn.addEventListener('click', closeModal);

    els.targetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        month: els.projMonth.value,
        hiring_target: Number(els.projHires.value),
        revenue_target: Number(els.projRevenue.value),
        placement_target: Number(els.projPlacements.value),
        team_notes: els.projNotes.value
      };

      try {
        const btn = e.submitter;
        btn.disabled = true;
        btn.textContent = 'Saving...';
        await window.CRM_API.request(`/api/projections`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        closeModal();
        await Promise.all([loadHistory(), loadProgress()]);
      } catch (err) {
        alert(err.message || 'Failed to save projection');
      } finally {
        const btn = document.querySelector('#targetForm button[type="submit"]');
        btn.disabled = false;
        btn.textContent = 'Save Targets';
      }
    });

    els.logoutBtn.addEventListener('click', async () => {
      try {
        await window.CRM_API.request('/api/auth/logout', { method: 'POST' });
        await window.CRM_API.request('/api/attendance/logout', { method: 'PATCH' });
      } catch (e) {} finally {
        window.CRM_API.clearToken();
        window.location.href = './login.html';
      }
    });
  }

  async function init() {
    try {
      await loadProfile();
      bindEvents();
      await Promise.all([loadHistory(), loadProgress()]);
    } catch (err) {
      window.CRM_API.clearToken();
      window.location.href = './login.html';
    }
  }

  init();
})();
