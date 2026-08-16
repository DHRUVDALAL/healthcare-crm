(function () {
  'use strict';

  window.CRM_AUTH.requireAuth();

  const els = {
    userName: document.getElementById('userName'),
    userRole: document.getElementById('userRole'),
    topRole: document.getElementById('topRole'),

    filterStatus: document.getElementById('filterStatus'),
    filterRole: document.getElementById('filterRole'),
    filterSearch: document.getElementById('filterSearch'),
    refreshBtn: document.getElementById('refreshBtn'),
    statusBadge: document.getElementById('statusBadge'),
    tableBody: document.getElementById('tableBody'),

    openAddBtn: document.getElementById('openAddBtn'),
    modalOverlay: document.getElementById('modalOverlay'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    employeeForm: document.getElementById('employeeForm'),
    modalTitle: document.getElementById('modalTitle'),
    
    empId: document.getElementById('empId'),
    empName: document.getElementById('empName'),
    empEmail: document.getElementById('empEmail'),
    empPhone: document.getElementById('empPhone'),
    empPassword: document.getElementById('empPassword'),
    empRole: document.getElementById('empRole'),
    empDept: document.getElementById('empDept'),
    empDesignation: document.getElementById('empDesignation'),
    empJoining: document.getElementById('empJoining'),
    empSalary: document.getElementById('empSalary'),
    empEmergency: document.getElementById('empEmergency'),
    empAddress: document.getElementById('empAddress'),
    empNotes: document.getElementById('empNotes'),

    logoutBtn: document.getElementById('logoutBtn')
  };

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
    els.topRole.textContent = userProfile.role;

    if (userProfile.role !== 'admin') {
      alert('Access Denied. Admins only.');
      window.location.href = './dashboard.html';
    }
  }

  async function loadEmployees() {
    try {
      setStatus('Loading...', 'warn');
      const status = els.filterStatus.value;
      const role = els.filterRole.value;
      const search = els.filterSearch.value;
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (role) params.append('role', role);
      if (search) params.append('search', search);

      const res = await window.CRM_API.request(`/api/employees?${params.toString()}`);
      employees = res.data.employees || [];
      renderTable();
      setStatus(`Loaded ${employees.length} employees`, 'ok');
    } catch (err) {
      setStatus('Failed to load', 'warn');
      alert(err.message || 'Failed to load employees');
    }
  }

  function renderTable() {
    if (!employees.length) {
      els.tableBody.innerHTML = '<tr><td colspan="5" class="small-muted">No employees found.</td></tr>';
      return;
    }

    els.tableBody.innerHTML = employees.map((emp) => {
      let stClass = emp.status === 'active' ? 'status green' : 'status red';
      let roleClass = emp.role === 'admin' ? 'badge' : '';

      return `
        <tr>
          <td>
            <div style="font-weight:900;">${escapeHtml(emp.full_name)}</div>
            <div class="small-muted">${escapeHtml(emp.email)}</div>
            <div class="small-muted">${escapeHtml(emp.phone || 'No phone')}</div>
          </td>
          <td>
            <div style="font-weight:600;"><span class="${roleClass}">${emp.role.toUpperCase()}</span></div>
            <div class="small-muted">${escapeHtml(emp.designation || 'No Designation')} - ${escapeHtml(emp.department || 'No Dept')}</div>
          </td>
          <td>
            <div>Joined: ${emp.joining_date ? new Date(emp.joining_date).toLocaleDateString() : 'N/A'}</div>
            <div class="small-muted">₹ ${emp.monthly_salary || 0}</div>
          </td>
          <td><span class="${stClass}">${emp.status.toUpperCase()}</span></td>
          <td>
            <div class="row-actions">
              <button class="btn btn-outline btn-sm" data-action="edit" data-id="${emp.id}">Edit</button>
              ${emp.status === 'active' 
                ? `<button class="btn btn-outline btn-sm" style="color:var(--danger)" data-action="toggle-status" data-id="${emp.id}" data-status="inactive">Deactivate</button>` 
                : `<button class="btn btn-outline btn-sm" style="color:var(--primary)" data-action="toggle-status" data-id="${emp.id}" data-status="active">Activate</button>`
              }
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function openModal(emp = null) {
    if (emp) {
      els.modalTitle.textContent = 'Edit Employee';
      els.empId.value = emp.id;
      els.empName.value = emp.full_name;
      els.empEmail.value = emp.email;
      els.empPhone.value = emp.phone || '';
      els.empPassword.value = '';
      els.empPassword.removeAttribute('required');
      els.empRole.value = emp.role;
      els.empDept.value = emp.department || '';
      els.empDesignation.value = emp.designation || '';
      els.empJoining.value = emp.joining_date ? emp.joining_date.slice(0, 10) : '';
      els.empSalary.value = emp.monthly_salary || '';
      els.empEmergency.value = emp.emergency_contact || '';
      els.empAddress.value = emp.address || '';
      els.empNotes.value = emp.notes || '';
    } else {
      els.modalTitle.textContent = 'Add Employee';
      els.employeeForm.reset();
      els.empId.value = '';
      els.empPassword.setAttribute('required', 'true');
    }
    els.modalOverlay.classList.add('show');
    els.modalOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    els.modalOverlay.classList.remove('show');
    els.modalOverlay.setAttribute('aria-hidden', 'true');
  }

  function bindEvents() {
    els.refreshBtn.addEventListener('click', loadEmployees);
    els.filterStatus.addEventListener('change', loadEmployees);
    els.filterRole.addEventListener('change', loadEmployees);
    
    let timer;
    els.filterSearch.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(loadEmployees, 300);
    });

    els.openAddBtn.addEventListener('click', () => openModal());
    els.closeModalBtn.addEventListener('click', closeModal);
    els.cancelBtn.addEventListener('click', closeModal);
    
    els.tableBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;
      
      if (action === 'edit') {
        const emp = employees.find(x => x.id == id);
        if (emp) openModal(emp);
      } else if (action === 'toggle-status') {
        if (!confirm(`Are you sure you want to ${btn.dataset.status === 'inactive' ? 'deactivate' : 'activate'} this employee?`)) return;
        try {
          setStatus('Updating...', 'warn');
          await window.CRM_API.request(`/api/employees/status/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: btn.dataset.status })
          });
          setStatus('Updated', 'ok');
          await loadEmployees();
        } catch (err) {
          setStatus('Failed', 'warn');
          alert(err.message);
        }
      }
    });

    els.employeeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = els.empId.value;
      const payload = {
        full_name: els.empName.value,
        email: els.empEmail.value,
        phone: els.empPhone.value,
        role: els.empRole.value,
        department: els.empDept.value,
        designation: els.empDesignation.value,
        joining_date: els.empJoining.value || null,
        monthly_salary: els.empSalary.value || null,
        emergency_contact: els.empEmergency.value,
        address: els.empAddress.value,
        notes: els.empNotes.value
      };
      
      if (els.empPassword.value) {
        payload.password = els.empPassword.value;
      }

      try {
        setStatus('Saving...', 'warn');
        if (id) {
          await window.CRM_API.request(`/api/employees/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
          });
        } else {
          await window.CRM_API.request(`/api/employees`, {
            method: 'POST',
            body: JSON.stringify(payload)
          });
        }
        closeModal();
        await loadEmployees();
      } catch (err) {
        setStatus('Save failed', 'warn');
        alert(err.message || 'Failed to save employee');
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
      await loadEmployees();
    } catch (err) {
      window.CRM_API.clearToken();
      window.location.href = './login.html';
    }
  }

  init();
})();
