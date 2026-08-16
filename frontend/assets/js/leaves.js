(function () {
  'use strict';

  window.CRM_AUTH.requireAuth();

  const els = {
    userName: document.getElementById('userName'),
    userRole: document.getElementById('userRole'),
    topRole: document.getElementById('topRole'),

    filterStatus: document.getElementById('filterStatus'),
    filterSearch: document.getElementById('filterSearch'),
    refreshBtn: document.getElementById('refreshBtn'),
    statusBadge: document.getElementById('statusBadge'),
    tableBody: document.getElementById('tableBody'),

    openAddBtn: document.getElementById('openAddBtn'),
    modalOverlay: document.getElementById('modalOverlay'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    leaveForm: document.getElementById('leaveForm'),
    leaveType: document.getElementById('leaveType'),
    startDate: document.getElementById('startDate'),
    endDate: document.getElementById('endDate'),
    leaveReason: document.getElementById('leaveReason'),

    statusModalOverlay: document.getElementById('statusModalOverlay'),
    closeStatusBtn: document.getElementById('closeStatusBtn'),
    cancelStatusBtn: document.getElementById('cancelStatusBtn'),
    statusForm: document.getElementById('statusForm'),
    statusLeaveId: document.getElementById('statusLeaveId'),
    statusSelect: document.getElementById('statusSelect'),
    adminRemarks: document.getElementById('adminRemarks'),

    logoutBtn: document.getElementById('logoutBtn')
  };

  let leaves = [];
  let userProfile = null;

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
      // Hide search for non-admins as they can only see their own requests
      els.filterSearch.style.display = 'none';
    }
  }

  async function loadLeaves() {
    try {
      setStatus('Loading...', 'warn');
      const status = els.filterStatus.value;
      const search = els.filterSearch.value;
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (search) params.append('search', search);

      const res = await window.CRM_API.request(`/api/leaves?${params.toString()}`);
      leaves = res.data.leaves || [];
      renderTable();
      setStatus(`Loaded ${leaves.length} requests`, 'ok');
    } catch (err) {
      setStatus('Failed to load', 'warn');
      alert(err.message || 'Failed to load leaves');
    }
  }

  function renderTable() {
    if (!leaves.length) {
      els.tableBody.innerHTML = '<tr><td colspan="6" class="small-muted">No leave requests found.</td></tr>';
      return;
    }

    const isAdmin = userProfile?.role === 'admin';

    els.tableBody.innerHTML = leaves.map((lv) => {
      let stClass = '';
      if (lv.leave_status === 'approved') stClass = 'status green';
      else if (lv.leave_status === 'rejected') stClass = 'status red';
      else stClass = 'status amber';

      const sDate = new Date(lv.start_date);
      const eDate = new Date(lv.end_date);
      const days = Math.round((eDate - sDate) / (1000 * 60 * 60 * 24)) + 1;

      let actionsHTML = '';
      if (isAdmin && lv.leave_status === 'pending') {
        actionsHTML = `<button class="btn btn-outline btn-sm" data-action="update-status" data-id="${lv.id}" data-status="${lv.leave_status}">Review Request</button>`;
      } else if (!isAdmin) {
        actionsHTML = `<span class="small-muted">No actions</span>`;
      } else {
        actionsHTML = `<button class="btn btn-outline btn-sm" data-action="update-status" data-id="${lv.id}" data-status="${lv.leave_status}">Change Status</button>`;
      }

      return `
        <tr>
          <td>
            <div style="font-weight:900;">${escapeHtml(lv.employee_name)}</div>
            <div class="small-muted">${escapeHtml(lv.employee_email)}</div>
          </td>
          <td>
            <div style="font-weight:600; text-transform: capitalize;">${lv.leave_type} Leave</div>
          </td>
          <td>
            <div>${sDate.toLocaleDateString()} to ${eDate.toLocaleDateString()}</div>
            <div class="small-muted">${days} day(s)</div>
          </td>
          <td>
            <div style="max-width:250px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(lv.reason)}">${escapeHtml(lv.reason)}</div>
            ${lv.admin_remarks ? `<div class="small-muted" style="color:var(--primary)" title="${escapeHtml(lv.admin_remarks)}">Note: ${escapeHtml(lv.admin_remarks)}</div>` : ''}
          </td>
          <td><span class="${stClass}">${lv.leave_status.toUpperCase()}</span></td>
          <td><div class="row-actions">${actionsHTML}</div></td>
        </tr>
      `;
    }).join('');
  }

  function openStatusModal(id, currentStatus) {
    const lv = leaves.find(x => x.id == id);
    els.statusLeaveId.value = id;
    els.statusSelect.value = currentStatus;
    els.adminRemarks.value = lv?.admin_remarks || '';
    els.statusModalOverlay.classList.add('show');
    els.statusModalOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeStatusModal() {
    els.statusModalOverlay.classList.remove('show');
    els.statusModalOverlay.setAttribute('aria-hidden', 'true');
  }

  function openAddModal() {
    els.leaveForm.reset();
    els.modalOverlay.classList.add('show');
    els.modalOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeAddModal() {
    els.modalOverlay.classList.remove('show');
    els.modalOverlay.setAttribute('aria-hidden', 'true');
  }

  function bindEvents() {
    els.refreshBtn.addEventListener('click', loadLeaves);
    els.filterStatus.addEventListener('change', loadLeaves);
    
    let timer;
    els.filterSearch.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(loadLeaves, 300);
    });

    els.openAddBtn.addEventListener('click', openAddModal);
    els.closeModalBtn.addEventListener('click', closeAddModal);
    els.cancelBtn.addEventListener('click', closeAddModal);
    
    els.closeStatusBtn.addEventListener('click', closeStatusModal);
    els.cancelStatusBtn.addEventListener('click', closeStatusModal);

    els.tableBody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;
      
      if (action === 'update-status') {
        openStatusModal(id, btn.dataset.status);
      }
    });

    els.leaveForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        leave_type: els.leaveType.value,
        start_date: els.startDate.value,
        end_date: els.endDate.value,
        reason: els.leaveReason.value
      };

      try {
        setStatus('Submitting...', 'warn');
        await window.CRM_API.request(`/api/leaves`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        closeAddModal();
        await loadLeaves();
      } catch (err) {
        setStatus('Submit failed', 'warn');
        alert(err.message || 'Failed to submit request');
      }
    });

    els.statusForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = els.statusLeaveId.value;
      const payload = {
        status: els.statusSelect.value,
        admin_remarks: els.adminRemarks.value
      };

      try {
        setStatus('Updating...', 'warn');
        await window.CRM_API.request(`/api/leaves/status/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        closeStatusModal();
        await loadLeaves();
      } catch (err) {
        setStatus('Update failed', 'warn');
        alert(err.message || 'Failed to update leave status');
      }
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
      await loadLeaves();
    } catch (err) {
      window.CRM_API.clearToken();
      window.location.href = './login.html';
    }
  }

  init();
})();
