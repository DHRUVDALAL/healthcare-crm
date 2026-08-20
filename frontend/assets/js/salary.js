(function () {
  'use strict';

  window.CRM_AUTH.requireAuth();

  const els = {
    userName: document.getElementById('userName'),
    userRole: document.getElementById('userRole'),
    topRole: document.getElementById('topRole'),

    filterStatus: document.getElementById('filterStatus'),
    filterMonth: document.getElementById('filterMonth'),
    filterSearch: document.getElementById('filterSearch'),
    refreshBtn: document.getElementById('refreshBtn'),
    statusBadge: document.getElementById('statusBadge'),
    tableBody: document.getElementById('tableBody'),

    openAddBtn: document.getElementById('openAddBtn'),
    modalOverlay: document.getElementById('modalOverlay'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    salaryForm: document.getElementById('salaryForm'),
    
    empSelect: document.getElementById('empSelect'),
    salMonth: document.getElementById('salMonth'),
    salBase: document.getElementById('salBase'),
    salBonus: document.getElementById('salBonus'),
    salDeductions: document.getElementById('salDeductions'),
    salNotes: document.getElementById('salNotes'),

    logoutBtn: document.getElementById('logoutBtn')
  };

  let salaries = [];
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

  function formatMoneyINR(value) {
    const num = Number(value || 0);
    return num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
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

  async function loadEmployeesForSelect() {
    try {
      const res = await window.CRM_API.request('/api/employees');
      employees = res.data.employees || [];
      els.empSelect.innerHTML = '<option value="">Select Employee</option>' + employees.map(e => 
        `<option value="${e.id}" data-salary="${e.monthly_salary || 0}">${escapeHtml(e.full_name)} (${e.role})</option>`
      ).join('');
      
      els.empSelect.addEventListener('change', (e) => {
        const option = e.target.options[e.target.selectedIndex];
        if (option && option.dataset.salary) {
          els.salBase.value = option.dataset.salary;
        }
      });
    } catch (e) {
      console.warn('Could not load employees for select');
    }
  }

  async function loadSalaries() {
    try {
      setStatus('Loading...', 'warn');
      const status = els.filterStatus.value;
      const month = els.filterMonth.value;
      const search = els.filterSearch.value;
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (month) params.append('month', month);
      if (search) params.append('search', search);

      const res = await window.CRM_API.request(`/api/salary?${params.toString()}`);
      salaries = res.data.salaries || [];
      renderTable();
      setStatus(`Loaded ${salaries.length} records`, 'ok');
    } catch (err) {
      setStatus('Failed to load', 'warn');
      alert(err.message || 'Failed to load salary records');
    }
  }

  function renderTable() {
    if (!salaries.length) {
      els.tableBody.innerHTML = '<tr><td colspan="6" class="small-muted">No salary records found.</td></tr>';
      return;
    }

    els.tableBody.innerHTML = salaries.map((sal) => {
      let stClass = sal.payment_status === 'paid' ? 'status green' : 'status amber';

      let actionsHTML = `<button class="btn btn-primary btn-sm" data-action="download" data-id="${sal.id}">Payslip</button>`;
      if (sal.payment_status === 'pending') {
        actionsHTML += ` <button class="btn btn-outline btn-sm" data-action="mark-paid" data-id="${sal.id}">Mark Paid</button>`;
      }

      return `
        <tr>
          <td>
            <div style="font-weight:900;">${escapeHtml(sal.employee_name)}</div>
            <div class="small-muted">Month: ${sal.salary_month}</div>
          </td>
          <td>₹ ${formatMoneyINR(sal.base_salary)}</td>
          <td>
            <div style="color:var(--primary)">+ ₹ ${formatMoneyINR(sal.bonus)}</div>
            <div style="color:var(--danger)">- ₹ ${formatMoneyINR(sal.deductions)}</div>
          </td>
          <td><div style="font-weight:900; font-size:16px;">₹ ${formatMoneyINR(sal.final_salary)}</div></td>
          <td><span class="${stClass}">${sal.payment_status.toUpperCase()}</span></td>
          <td><div class="row-actions">${actionsHTML}</div></td>
        </tr>
      `;
    }).join('');
  }

  function openAddModal() {
    els.salaryForm.reset();
    els.salMonth.value = new Date().toISOString().slice(0, 7); // YYYY-MM
    els.modalOverlay.classList.add('show');
    els.modalOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeAddModal() {
    els.modalOverlay.classList.remove('show');
    els.modalOverlay.setAttribute('aria-hidden', 'true');
  }

  async function downloadPayslip(id) {
    try {
      setStatus('Generating PDF...', 'warn');
      const res = await window.CRM_API.request(`/api/salary/payslip/${id}`);
      
      const newWin = window.open('', '_blank');
      if (!newWin) {
        alert('Please allow popups for this site');
        return;
      }
      
      newWin.document.open();
      newWin.document.write(res.data.html);
      newWin.document.close();
      
      setTimeout(() => {
        newWin.print();
      }, 500);

      setStatus('Payslip generated', 'ok');
    } catch (err) {
      setStatus('Failed to generate', 'warn');
      alert(err.message || 'Failed to generate payslip');
    }
  }

  function bindEvents() {
    els.refreshBtn.addEventListener('click', loadSalaries);
    els.filterStatus.addEventListener('change', loadSalaries);
    els.filterMonth.addEventListener('change', loadSalaries);
    
    let timer;
    els.filterSearch.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(loadSalaries, 300);
    });

    els.openAddBtn.addEventListener('click', openAddModal);
    els.closeModalBtn.addEventListener('click', closeAddModal);
    els.cancelBtn.addEventListener('click', closeAddModal);
    
    els.tableBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;
      
      if (action === 'download') {
        downloadPayslip(id);
      } else if (action === 'mark-paid') {
        if (!confirm('Mark this salary as paid?')) return;
        try {
          setStatus('Marking paid...', 'warn');
          await window.CRM_API.request(`/api/salary/status/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'paid' })
          });
          setStatus('Marked as paid', 'ok');
          await loadSalaries();
        } catch (err) {
          setStatus('Failed', 'warn');
          alert(err.message || 'Failed to update status');
        }
      }
    });

    els.salaryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        employee_id: els.empSelect.value,
        salary_month: els.salMonth.value,
        base_salary: els.salBase.value,
        bonus: els.salBonus.value,
        deductions: els.salDeductions.value,
        notes: els.salNotes.value
      };

      try {
        setStatus('Saving...', 'warn');
        await window.CRM_API.request(`/api/salary`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        closeAddModal();
        await loadSalaries();
      } catch (err) {
        setStatus('Save failed', 'warn');
        alert(err.message || 'Failed to save salary record');
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
      await loadSalaries();
    } catch (err) {
      console.warn('[Salary] init warning:', err.message);
      if (err.status === 401) {
        window.CRM_API.clearToken();
        window.location.href = './login.html';
      }
    }
  }

  init();
})();
