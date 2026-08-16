(function () {
  'use strict';

  window.CRM_AUTH.requireAuth();

  const els = {
    userName: document.getElementById('userName'),
    userRole: document.getElementById('userRole'),
    topRole: document.getElementById('topRole'),

    filterStatus: document.getElementById('filterStatus'),
    filterType: document.getElementById('filterType'),
    filterSearch: document.getElementById('filterSearch'),
    refreshBtn: document.getElementById('refreshBtn'),
    statusBadge: document.getElementById('statusBadge'),
    tableBody: document.getElementById('tableBody'),

    openAddBtn: document.getElementById('openAddBtn'),
    modalOverlay: document.getElementById('modalOverlay'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    reminderForm: document.getElementById('reminderForm'),
    modalTitle: document.getElementById('modalTitle'),
    
    remId: document.getElementById('remId'),
    remTitle: document.getElementById('remTitle'),
    remDesc: document.getElementById('remDesc'),
    remType: document.getElementById('remType'),
    remPriority: document.getElementById('remPriority'),
    remDate: document.getElementById('remDate'),
    remTime: document.getElementById('remTime'),
    remAssign: document.getElementById('remAssign'),
    assignGroup: document.getElementById('assignGroup'),
    deleteBtn: document.getElementById('deleteBtn'),

    logoutBtn: document.getElementById('logoutBtn')
  };

  let reminders = [];
  let employees = [];
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
    // no topRole in this page, so ignore

    if (userProfile.role !== 'admin') {
      els.assignGroup.style.display = 'none';
    }
  }

  async function loadEmployees() {
    if (userProfile.role !== 'admin') return;
    try {
      const res = await window.CRM_API.request('/api/employees');
      employees = res.data.employees || [];
      els.remAssign.innerHTML = '<option value="">Assign to self</option>' + employees.map(e => 
        `<option value="${e.id}">${escapeHtml(e.full_name)}</option>`
      ).join('');
    } catch (e) {
      console.warn('Failed to load employees for assignment');
    }
  }

  async function loadReminders() {
    try {
      setStatus('Loading...', 'warn');
      const status = els.filterStatus.value;
      const type = els.filterType.value;
      const search = els.filterSearch.value;
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (type) params.append('type', type);
      if (search) params.append('search', search);

      const res = await window.CRM_API.request(`/api/calendar?${params.toString()}`);
      reminders = res.data.reminders || [];
      renderTable();
      setStatus(`Loaded ${reminders.length} reminders`, 'ok');
    } catch (err) {
      setStatus('Failed to load', 'warn');
      alert(err.message || 'Failed to load reminders');
    }
  }

  function renderTable() {
    if (!reminders.length) {
      els.tableBody.innerHTML = '<tr><td colspan="6" class="small-muted">No reminders found.</td></tr>';
      return;
    }

    els.tableBody.innerHTML = reminders.map((rem) => {
      let stClass = '';
      if (rem.status === 'completed') stClass = 'status green';
      else if (rem.status === 'cancelled') stClass = 'status amber';
      else stClass = 'status blue';

      let prioColor = rem.priority === 'high' ? 'var(--danger)' : (rem.priority === 'medium' ? 'var(--primary)' : 'var(--text-muted)');

      let actionsHTML = `<button class="btn btn-outline btn-sm" data-action="edit" data-id="${rem.id}">Edit</button>`;
      if (rem.status === 'pending') {
        actionsHTML += ` <button class="btn btn-outline btn-sm" data-action="complete" data-id="${rem.id}" style="color:var(--success)">Complete</button>`;
      }

      return `
        <tr>
          <td>
            <div style="font-weight:900;">${escapeHtml(rem.title)}</div>
            <div class="small-muted" style="text-transform: capitalize;">${rem.reminder_type}</div>
          </td>
          <td>
            <div style="color:${prioColor}; font-weight:600; text-transform: capitalize;">${rem.priority}</div>
          </td>
          <td>
            <div>${new Date(rem.reminder_date).toLocaleDateString()}</div>
            <div class="small-muted">${rem.reminder_time ? rem.reminder_time.slice(0, 5) : 'Anytime'}</div>
          </td>
          <td>${escapeHtml(rem.assigned_name)}</td>
          <td><span class="${stClass}">${rem.status.toUpperCase()}</span></td>
          <td><div class="row-actions">${actionsHTML}</div></td>
        </tr>
      `;
    }).join('');
  }

  function openModal(rem = null) {
    if (rem) {
      els.modalTitle.textContent = 'Edit Reminder';
      els.remId.value = rem.id;
      els.remTitle.value = rem.title;
      els.remDesc.value = rem.description || '';
      els.remType.value = rem.reminder_type;
      els.remPriority.value = rem.priority;
      els.remDate.value = rem.reminder_date ? rem.reminder_date.slice(0, 10) : '';
      els.remTime.value = rem.reminder_time ? rem.reminder_time.slice(0, 5) : '';
      if (userProfile.role === 'admin') els.remAssign.value = rem.assigned_to;
      els.deleteBtn.style.display = 'block';
    } else {
      els.modalTitle.textContent = 'Add Reminder';
      els.reminderForm.reset();
      els.remId.value = '';
      els.remDate.value = new Date().toISOString().slice(0, 10);
      if (userProfile.role === 'admin') els.remAssign.value = '';
      els.deleteBtn.style.display = 'none';
    }
    els.modalOverlay.classList.add('show');
    els.modalOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    els.modalOverlay.classList.remove('show');
    els.modalOverlay.setAttribute('aria-hidden', 'true');
  }

  function bindEvents() {
    els.refreshBtn.addEventListener('click', loadReminders);
    els.filterStatus.addEventListener('change', loadReminders);
    els.filterType.addEventListener('change', loadReminders);
    
    let timer;
    els.filterSearch.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(loadReminders, 300);
    });

    els.openAddBtn.addEventListener('click', () => openModal());
    els.closeModalBtn.addEventListener('click', closeModal);
    els.cancelBtn.addEventListener('click', closeModal);

    els.deleteBtn.addEventListener('click', async () => {
      const id = els.remId.value;
      if (!id) return;
      if (!confirm('Are you sure you want to delete this event?')) return;
      try {
        setStatus('Deleting...', 'warn');
        await window.CRM_API.request(`/api/calendar/${id}`, {
          method: 'DELETE'
        });
        closeModal();
        await loadReminders();
      } catch (err) {
        setStatus('Delete failed', 'warn');
        alert(err.message || 'Failed to delete reminder');
      }
    });

    els.tableBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;
      
      if (action === 'edit') {
        const rem = reminders.find(x => x.id == id);
        if (rem) openModal(rem);
      } else if (action === 'complete') {
        if (!confirm('Mark as completed?')) return;
        try {
          setStatus('Updating...', 'warn');
          await window.CRM_API.request(`/api/calendar/status/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'completed' })
          });
          await loadReminders();
        } catch (err) {
          setStatus('Update failed', 'warn');
          alert(err.message || 'Failed to update reminder');
        }
      }
    });

    els.reminderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = els.remId.value;
      const payload = {
        title: els.remTitle.value,
        description: els.remDesc.value,
        reminder_type: els.remType.value,
        priority: els.remPriority.value,
        reminder_date: els.remDate.value,
        reminder_time: els.remTime.value || null,
        assigned_to: (userProfile.role === 'admin' && els.remAssign.value) ? els.remAssign.value : userProfile.id
      };

      try {
        setStatus('Saving...', 'warn');
        if (id) {
          await window.CRM_API.request(`/api/calendar/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
          });
        } else {
          await window.CRM_API.request(`/api/calendar`, {
            method: 'POST',
            body: JSON.stringify(payload)
          });
        }
        closeModal();
        await loadReminders();
      } catch (err) {
        setStatus('Save failed', 'warn');
        alert(err.message || 'Failed to save reminder');
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
      await loadEmployees();
      await loadReminders();
    } catch (err) {
      window.CRM_API.clearToken();
      window.location.href = './login.html';
    }
  }

  init();
})();
