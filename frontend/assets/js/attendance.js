(function () {
  'use strict';

  window.CRM_AUTH.requireAuth();

  const els = {
    userName: document.getElementById('userName'),
    userRole: document.getElementById('userRole'),
    topRole: document.getElementById('topRole'),

    filterDate: document.getElementById('filterDate'),
    filterSearch: document.getElementById('filterSearch'),
    refreshBtn: document.getElementById('refreshBtn'),
    statusBadge: document.getElementById('statusBadge'),
    tableBody: document.getElementById('tableBody'),

    logoutBtn: document.getElementById('logoutBtn')
  };

  let attendance = [];
  let userProfile = null;

  // Set today's date as default filter
  els.filterDate.value = new Date().toISOString().slice(0, 10);

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] || m));
  }

  function setStatus(text, variant) {
    els.statusBadge.textContent = text;
    els.statusBadge.className = 'badge';
    if (variant === 'warn') els.statusBadge.classList.add('warn');
    if (variant === 'ok') els.statusBadge.classList.add('success');
  }

  async function loadProfile() {
    const res = await window.CRM_API.request('/api/auth/profile');
    userProfile = res.data.user;
    els.userName.textContent = userProfile.full_name;
    els.userRole.textContent = userProfile.role;
    if (els.topRole) els.topRole.textContent = userProfile.role;

    if (userProfile.role !== 'admin') {
      alert('Access Denied. Admins only.');
      window.location.href = './dashboard.html';
    }
  }

  async function loadAttendance() {
    try {
      setStatus('Loading...', 'warn');
      const date = els.filterDate.value;
      const search = els.filterSearch.value;
      const params = new URLSearchParams();
      if (date) params.append('date', date);
      if (search) params.append('search', search);

      const res = await window.CRM_API.request(`/api/attendance?${params.toString()}`);
      attendance = res.data.attendance || [];
      renderTable();
      setStatus(`Loaded logs`, 'ok');
    } catch (err) {
      setStatus('Failed to load', 'warn');
      alert(err.message || 'Failed to load attendance');
    }
  }

  function renderTable() {
    if (!attendance.length) {
      els.tableBody.innerHTML = '<tr><td colspan="6" class="small-muted">No attendance logs found.</td></tr>';
      return;
    }

    els.tableBody.innerHTML = attendance.map((log) => {
      const loginTime = new Date(log.login_time).toLocaleTimeString();
      const logoutTime = log.logout_time ? new Date(log.logout_time).toLocaleTimeString() : '<span class="status amber">Active</span>';
      
      return `
        <tr>
          <td>
            <div style="font-weight:900;">${escapeHtml(log.full_name)}</div>
            <div class="small-muted">${escapeHtml(log.email)}</div>
          </td>
          <td>${log.role.toUpperCase()}</td>
          <td>${new Date(log.login_time).toLocaleDateString()}</td>
          <td>${loginTime}</td>
          <td>${logoutTime}</td>
          <td>${log.total_hours ? Number(log.total_hours).toFixed(2) + ' hrs' : '-'}</td>
        </tr>
      `;
    }).join('');
  }

  function bindEvents() {
    els.refreshBtn.addEventListener('click', loadAttendance);
    els.filterDate.addEventListener('change', loadAttendance);
    
    let timer;
    els.filterSearch.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(loadAttendance, 300);
    });

    els.logoutBtn.addEventListener('click', async () => {
      try {
        await window.CRM_API.request('/api/auth/logout', { method: 'POST' });
        await window.CRM_API.request('/api/attendance/logout', { method: 'PATCH' });
      } catch (e) {
      } finally {
        window.CRM_API.clearToken();
        window.location.href = './login.html';
      }
    });
  }

  async function init() {
    try {
      await loadProfile();
      bindEvents();
      await loadAttendance();
    } catch (err) {
      window.CRM_API.clearToken();
      window.location.href = './login.html';
    }
  }

  init();
})();
