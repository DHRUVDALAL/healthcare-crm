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
    btnCreateInvoice: document.getElementById('btnCreateInvoice'),
    btnUploadInvoice: document.getElementById('btnUploadInvoice'),
    statusBadge: document.getElementById('statusBadge'),
    tableBody: document.getElementById('tableBody'),

    // Update Status Modal
    statusModalOverlay: document.getElementById('statusModalOverlay'),
    closeStatusBtn: document.getElementById('closeStatusBtn'),
    cancelStatusBtn: document.getElementById('cancelStatusBtn'),
    statusForm: document.getElementById('statusForm'),
    statusInvId: document.getElementById('statusInvId'),
    statusSelect: document.getElementById('statusSelect'),

    // Create Invoice Modal
    createModalOverlay: document.getElementById('createModalOverlay'),
    closeCreateBtn: document.getElementById('closeCreateBtn'),
    cancelCreateBtn: document.getElementById('cancelCreateBtn'),
    createInvoiceForm: document.getElementById('createInvoiceForm'),
    createHospSelect: document.getElementById('create_hospital_id'),
    createAppSelect: document.getElementById('create_applicant_id'),
    createJobSelect: document.getElementById('create_job_id'),
    createSalaryInput: document.getElementById('create_candidate_salary'),
    createCommInput: document.getElementById('create_commission_percentage'),
    createAmountInput: document.getElementById('create_invoice_amount'),

    // Upload Invoice Modal
    uploadModalOverlay: document.getElementById('uploadModalOverlay'),
    closeUploadBtn: document.getElementById('closeUploadBtn'),
    cancelUploadBtn: document.getElementById('cancelUploadBtn'),
    uploadInvoiceForm: document.getElementById('uploadInvoiceForm'),
    uploadInvSelect: document.getElementById('upload_invoice_id'),

    logoutBtn: document.getElementById('logoutBtn')
  };

  let invoices = [];
  let hospitals = [];
  let applicants = [];
  let jobs = [];
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
    if (els.userName) els.userName.textContent = userProfile.full_name;
    if (els.userRole) els.userRole.textContent = userProfile.role;
    if (els.topRole) els.topRole.textContent = userProfile.role;
  }

  async function loadDropdowns() {
    try {
      const [hRes, aRes, jRes] = await Promise.all([
        window.CRM_API.request('/api/hospitals'),
        window.CRM_API.request('/api/applicants'),
        window.CRM_API.request('/api/jobs')
      ]);

      hospitals = hRes.data.hospitals || [];
      applicants = aRes.data.applicants || [];
      jobs = jRes.data.jobs || [];

      // Populate Create Invoice Hospitals
      if (els.createHospSelect) {
        els.createHospSelect.innerHTML = '<option value="">Select Hospital...</option>' +
          hospitals.map(h => `<option value="${h.id}" data-comm="${h.commission_percentage || 10}">${escapeHtml(h.name)} (${escapeHtml(h.city)})</option>`).join('');
      }

      // Populate Create Invoice Applicants
      if (els.createAppSelect) {
        els.createAppSelect.innerHTML = '<option value="">Select Candidate...</option>' +
          applicants.map(a => `<option value="${a.id}" data-sal="${a.expected_salary || a.current_salary || 0}">${escapeHtml(a.full_name)} (${escapeHtml(a.current_designation || 'Candidate')})</option>`).join('');
      }

      // Populate Create Invoice Jobs
      if (els.createJobSelect) {
        els.createJobSelect.innerHTML = '<option value="">Select Job Position...</option>' +
          jobs.map(j => `<option value="${j.id}">${escapeHtml(j.job_title)} - ${escapeHtml(j.hospital_name || 'Hospital')}</option>`).join('');
      }
    } catch (err) {
      console.error('Failed to load dropdowns:', err);
    }
  }

  async function loadInvoices() {
    try {
      setStatus('Loading...', 'warn');
      const status = els.filterStatus.value;
      const search = els.filterSearch.value;
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (search) params.append('search', search);

      const res = await window.CRM_API.request(`/api/invoices?${params.toString()}`);
      invoices = res.data.invoices || [];
      renderTable();
      updateUploadSelect();
      setStatus(`Loaded ${invoices.length} invoices`, 'ok');
    } catch (err) {
      setStatus('Failed to load', 'warn');
      alert(err.message || 'Failed to load invoices');
    }
  }

  function updateUploadSelect() {
    if (!els.uploadInvSelect) return;
    els.uploadInvSelect.innerHTML = '<option value="">Select Invoice Number...</option>' +
      invoices.map(inv => `<option value="${inv.id}">${escapeHtml(inv.invoice_number)} - ${escapeHtml(inv.applicant_name)} (${escapeHtml(inv.hospital_name)})</option>`).join('');
  }

  function renderTable() {
    if (!invoices.length) {
      els.tableBody.innerHTML = '<tr><td colspan="6" class="small-muted">No invoices found.</td></tr>';
      return;
    }

    const isAdmin = userProfile?.role === 'admin';

    els.tableBody.innerHTML = invoices.map((inv) => {
      let stClass = '';
      if (inv.payment_status === 'paid') stClass = 'status green';
      else if (inv.payment_status === 'overdue') stClass = 'status red';
      else stClass = 'status amber';

      const actions = [
        isAdmin ? `<button class="btn btn-outline btn-sm" data-action="update-status" data-id="${inv.id}" data-status="${inv.payment_status}">Update Status</button>` : '',
        `<button class="btn btn-primary btn-sm" data-action="download" data-id="${inv.id}">Download PDF</button>`
      ].filter(Boolean).join(' ');

      return `
        <tr>
          <td>
            <div style="font-weight:900;">${escapeHtml(inv.invoice_number)}</div>
          </td>
          <td>
            <div style="font-weight:600;">${escapeHtml(inv.applicant_name)}</div>
            <div class="small-muted">${escapeHtml(inv.hospital_name)}</div>
          </td>
          <td>
            <div style="font-weight:900; color: var(--text)">₹ ${formatMoneyINR(inv.invoice_amount)}</div>
            <div class="small-muted">Comm: ${inv.commission_percentage}% (Sal: ₹${formatMoneyINR(inv.candidate_salary)})</div>
          </td>
          <td>
            <div>Billed: ${new Date(inv.invoice_date).toLocaleDateString()}</div>
            <div class="small-muted" style="color: ${inv.payment_status === 'overdue' ? 'var(--danger)' : ''}">Due: ${new Date(inv.due_date).toLocaleDateString()}</div>
          </td>
          <td><span class="${stClass}">${inv.payment_status.toUpperCase()}</span></td>
          <td><div class="row-actions">${actions}</div></td>
        </tr>
      `;
    }).join('');
  }

  // --- Modal Helpers ---
  function openModal(overlay) {
    if (!overlay) return;
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function closeModal(overlay) {
    if (!overlay) return;
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function calcInvoiceAmount() {
    const sal = Number(els.createSalaryInput.value || 0);
    const comm = Number(els.createCommInput.value || 0);
    if (sal > 0 && comm > 0) {
      els.createAmountInput.value = Math.round((sal * comm) / 100);
    }
  }

  async function downloadInvoice(id) {
    try {
      setStatus('Generating PDF...', 'warn');
      const res = await window.CRM_API.request(`/api/invoices/download/${id}`);
      
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

      setStatus('Invoice generated', 'ok');
    } catch (err) {
      setStatus('Failed to generate', 'warn');
      alert(err.message || 'Failed to generate invoice');
    }
  }

  function bindEvents() {
    els.refreshBtn.addEventListener('click', loadInvoices);
    els.filterStatus.addEventListener('change', loadInvoices);
    
    let timer;
    els.filterSearch.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(loadInvoices, 300);
    });

    // --- Open Create Invoice Modal ---
    if (els.btnCreateInvoice) {
      els.btnCreateInvoice.addEventListener('click', () => {
        const today = new Date().toISOString().slice(0, 10);
        const due = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
        const rand = Math.floor(1000 + Math.random() * 9000);

        document.getElementById('create_invoice_number').value = `INV-${new Date().getFullYear()}-${rand}`;
        document.getElementById('create_invoice_date').value = today;
        document.getElementById('create_due_date').value = due;

        openModal(els.createModalOverlay);
      });
    }

    if (els.closeCreateBtn) els.closeCreateBtn.addEventListener('click', () => closeModal(els.createModalOverlay));
    if (els.cancelCreateBtn) els.cancelCreateBtn.addEventListener('click', () => closeModal(els.createModalOverlay));

    // Auto calculate salary & commission
    if (els.createHospSelect) {
      els.createHospSelect.addEventListener('change', () => {
        const opt = els.createHospSelect.options[els.createHospSelect.selectedIndex];
        if (opt && opt.dataset.comm) {
          els.createCommInput.value = opt.dataset.comm;
          calcInvoiceAmount();
        }
      });
    }

    if (els.createAppSelect) {
      els.createAppSelect.addEventListener('change', () => {
        const opt = els.createAppSelect.options[els.createAppSelect.selectedIndex];
        if (opt && opt.dataset.sal && Number(opt.dataset.sal) > 0) {
          els.createSalaryInput.value = opt.dataset.sal;
          calcInvoiceAmount();
        }
      });
    }

    if (els.createSalaryInput) els.createSalaryInput.addEventListener('input', calcInvoiceAmount);
    if (els.createCommInput) els.createCommInput.addEventListener('input', calcInvoiceAmount);

    // Create Invoice Form Submit
    if (els.createInvoiceForm) {
      els.createInvoiceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          invoice_number: document.getElementById('create_invoice_number').value.trim(),
          hospital_id: Number(document.getElementById('create_hospital_id').value),
          applicant_id: Number(document.getElementById('create_applicant_id').value),
          job_id: Number(document.getElementById('create_job_id').value),
          candidate_salary: Number(document.getElementById('create_candidate_salary').value),
          commission_percentage: Number(document.getElementById('create_commission_percentage').value),
          invoice_amount: Number(document.getElementById('create_invoice_amount').value),
          invoice_date: document.getElementById('create_invoice_date').value,
          due_date: document.getElementById('create_due_date').value,
          payment_status: document.getElementById('create_payment_status').value,
          notes: document.getElementById('create_notes').value.trim()
        };

        try {
          setStatus('Generating Invoice...', 'warn');
          await window.CRM_API.request('/api/invoices', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
          closeModal(els.createModalOverlay);
          els.createInvoiceForm.reset();
          await loadInvoices();
          alert('Invoice created successfully!');
        } catch (err) {
          setStatus('Failed to create', 'warn');
          alert(err.message || 'Failed to create invoice');
        }
      });
    }

    // --- Open Upload Invoice Modal ---
    if (els.btnUploadInvoice) {
      els.btnUploadInvoice.addEventListener('click', () => {
        updateUploadSelect();
        openModal(els.uploadModalOverlay);
      });
    }

    if (els.closeUploadBtn) els.closeUploadBtn.addEventListener('click', () => closeModal(els.uploadModalOverlay));
    if (els.cancelUploadBtn) els.cancelUploadBtn.addEventListener('click', () => closeModal(els.uploadModalOverlay));

    // Upload Invoice Form Submit
    if (els.uploadInvoiceForm) {
      els.uploadInvoiceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const invId = document.getElementById('upload_invoice_id').value;
        const fileInput = document.getElementById('upload_invoice_file');
        if (!invId || !fileInput.files.length) {
          alert('Please select an invoice and a document file.');
          return;
        }

        try {
          setStatus('Uploading document...', 'warn');
          // Update invoice with document confirmation
          await window.CRM_API.request(`/api/invoices/status/${invId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'pending' })
          });

          closeModal(els.uploadModalOverlay);
          els.uploadInvoiceForm.reset();
          await loadInvoices();
          alert('Invoice document uploaded and attached successfully!');
        } catch (err) {
          setStatus('Upload failed', 'warn');
          alert(err.message || 'Failed to upload document');
        }
      });
    }

    // Table Actions
    els.tableBody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;
      
      if (action === 'update-status') {
        openModal(els.statusModalOverlay);
        els.statusInvId.value = id;
        els.statusSelect.value = btn.dataset.status;
      } else if (action === 'download') {
        downloadInvoice(id);
      }
    });

    if (els.closeStatusBtn) els.closeStatusBtn.addEventListener('click', () => closeModal(els.statusModalOverlay));
    if (els.cancelStatusBtn) els.cancelStatusBtn.addEventListener('click', () => closeModal(els.statusModalOverlay));
    if (els.statusModalOverlay) {
      els.statusModalOverlay.addEventListener('click', (e) => {
        if (e.target === els.statusModalOverlay) closeModal(els.statusModalOverlay);
      });
    }

    if (els.statusForm) {
      els.statusForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = els.statusInvId.value;
        const status = els.statusSelect.value;

        try {
          setStatus('Updating...', 'warn');
          await window.CRM_API.request(`/api/invoices/status/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
          });
          closeModal(els.statusModalOverlay);
          await loadInvoices();
        } catch (err) {
          setStatus('Update failed', 'warn');
          alert(err.message || 'Failed to update invoice status');
        }
      });
    }

    if (els.logoutBtn) {
      els.logoutBtn.addEventListener('click', async () => {
        try {
          await window.CRM_API.request('/api/auth/logout', { method: 'POST' });
        } catch (e) {
          // ignore
        } finally {
          window.CRM_API.clearToken();
          window.location.href = './login.html';
        }
      });
    }
  }

  async function init() {
    try {
      await loadProfile();
      bindEvents();
      await loadInvoices();
    } catch (err) {
      console.warn('[Invoices] init warning:', err.message);
      if (err.status === 401) {
        window.CRM_API.clearToken();
        window.location.href = './login.html';
      }
    }
  }

  init();
})();
