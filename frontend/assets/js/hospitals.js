(function () {
  'use strict';

  window.CRM_AUTH.requireAuth();

  const els = {
    userName: document.getElementById('userName'),
    userRole: document.getElementById('userRole'),
    topRole: document.getElementById('topRole'),

    search: document.getElementById('search'),
    cityFilter: document.getElementById('cityFilter'),
    statusFilter: document.getElementById('statusFilter'),
    addBtn: document.getElementById('addBtn'),
    readOnlyBadge: document.getElementById('readOnlyBadge'),

    tableBody: document.getElementById('tableBody'),

    modalOverlay: document.getElementById('modalOverlay'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    hospitalForm: document.getElementById('hospitalForm'),
    formAlert: document.getElementById('formAlert'),
    modalTitle: document.getElementById('modalTitle'),

    detailsOverlay: document.getElementById('detailsOverlay'),
    closeDetailsBtn: document.getElementById('closeDetailsBtn'),
    detailsOkBtn: document.getElementById('detailsOkBtn'),
    detailsBody: document.getElementById('detailsBody'),

    logoutBtn: document.getElementById('logoutBtn')
  };

  let isAdmin = false;
  let editingId = null;

  function showAlert(message) {
    els.formAlert.textContent = message;
    els.formAlert.classList.add('show');
  }

  function clearAlert() {
    els.formAlert.textContent = '';
    els.formAlert.classList.remove('show');
  }

  function openModal() {
    clearAlert();
    els.modalOverlay.classList.add('show');
    els.modalOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    els.modalOverlay.classList.remove('show');
    els.modalOverlay.setAttribute('aria-hidden', 'true');
    els.hospitalForm.reset();
    editingId = null;
  }

  function openDetails(html) {
    els.detailsBody.innerHTML = html;
    els.detailsOverlay.classList.add('show');
    els.detailsOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeDetails() {
    els.detailsOverlay.classList.remove('show');
    els.detailsOverlay.setAttribute('aria-hidden', 'true');
    els.detailsBody.innerHTML = '';
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"]+/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] || m));
  }

  function statusBadge(status) {
    if (status === 'active') return '<span class="status green">Active</span>';
    return '<span class="status">Inactive</span>';
  }

  function fmtDate(d) {
    if (!d) return '-';
    return String(d).slice(0, 10);
  }

  async function loadProfile() {
    const res = await window.CRM_API.request('/api/auth/profile');
    const u = res.data.user;

    els.userName.textContent = u.full_name;
    els.userRole.textContent = u.role;
    els.topRole.textContent = u.role;

    isAdmin = u.role === 'admin';
    if (!isAdmin) {
      els.addBtn.style.display = 'none';
      els.readOnlyBadge.style.display = 'inline-flex';
    }
  }

  function getQueryParams() {
    const search = els.search.value.trim();
    const city = els.cityFilter.value;
    const status = els.statusFilter.value;

    const qp = new URLSearchParams();
    if (search) qp.set('search', search);
    if (city) qp.set('city', city);
    if (status) qp.set('status', status);

    return qp.toString();
  }

  async function loadHospitals() {
    const qs = getQueryParams();
    const url = qs ? `/api/hospitals?${qs}` : '/api/hospitals';

    const res = await window.CRM_API.request(url);
    const rows = res.data.hospitals || [];

    // populate cities (only on first load)
    const cities = res.data.cities || [];
    if (els.cityFilter.dataset.loaded !== '1') {
      cities.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        els.cityFilter.appendChild(opt);
      });
      els.cityFilter.dataset.loaded = '1';
    }

    if (!rows.length) {
      els.tableBody.innerHTML = `<tr><td colspan="6" class="small-muted">No hospitals found.</td></tr>`;
      return;
    }

    els.tableBody.innerHTML = rows.map((h) => {
      const actions = isAdmin
        ? `
          <button class="btn btn-outline btn-sm" data-action="view" data-id="${h.id}">View</button>
          <button class="btn btn-outline btn-sm" data-action="edit" data-id="${h.id}">Edit</button>
          <button class="btn btn-outline btn-sm" data-action="toggle" data-id="${h.id}" data-status="${h.status}">${h.status === 'active' ? 'Deactivate' : 'Activate'}</button>
          <button class="btn btn-danger btn-sm" data-action="delete" data-id="${h.id}">Delete</button>
        `
        : `<button class="btn btn-outline btn-sm" data-action="view" data-id="${h.id}">View</button>`;

      return `
        <tr>
          <td>
            <div style="font-weight:900;">${escapeHtml(h.name)}</div>
            <div class="small-muted">${escapeHtml(h.contact_person)} - ${escapeHtml(h.phone)}</div>
          </td>
          <td>${escapeHtml(h.city)}, ${escapeHtml(h.state)}</td>
          <td>${escapeHtml(h.commission_percentage)}%</td>
          <td>${statusBadge(h.status)}</td>
          <td>
            <div style="font-weight:800;">${fmtDate(h.agreement_start_date)} to ${fmtDate(h.agreement_end_date)}</div>
            <div class="small-muted">${escapeHtml(h.email)}</div>
          </td>
          <td>
            <div class="row-actions">${actions}</div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function formToPayload() {
    const fd = new FormData(els.hospitalForm);

    return {
      name: String(fd.get('name') || '').trim(),
      contact_person: String(fd.get('contact_person') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      address: String(fd.get('address') || '').trim(),
      city: String(fd.get('city') || '').trim(),
      state: String(fd.get('state') || '').trim(),
      commission_percentage: String(fd.get('commission_percentage') || '').trim(),
      agreement_start_date: String(fd.get('agreement_start_date') || '').trim(),
      agreement_end_date: String(fd.get('agreement_end_date') || '').trim(),
      notes: String(fd.get('notes') || '').trim(),
      status: String(fd.get('status') || '').trim()
    };
  }

  function clientValidate(payload) {
    if (!payload.name) return 'Hospital name is required';
    if (!payload.contact_person) return 'Contact person is required';
    if (!payload.phone) return 'Phone is required';
    if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return 'Valid email is required';
    if (!payload.address) return 'Address is required';
    if (!payload.city) return 'City is required';
    if (!payload.state) return 'State is required';

    const c = Number(payload.commission_percentage);
    if (!Number.isFinite(c) || c < 0 || c > 100) return 'Commission % must be between 0 and 100';

    if (!payload.agreement_start_date) return 'Agreement start date is required';
    if (!payload.agreement_end_date) return 'Agreement end date is required';

    if (payload.status !== 'active' && payload.status !== 'inactive') return 'Invalid status';

    return '';
  }

  async function openEdit(id) {
    const res = await window.CRM_API.request(`/api/hospitals/${id}`);
    const h = res.data.hospital;
    editingId = h.id;

    els.modalTitle.textContent = 'Edit Hospital';

    els.hospitalForm.name.value = h.name || '';
    els.hospitalForm.contact_person.value = h.contact_person || '';
    els.hospitalForm.phone.value = h.phone || '';
    els.hospitalForm.email.value = h.email || '';
    els.hospitalForm.address.value = h.address || '';
    els.hospitalForm.city.value = h.city || '';
    els.hospitalForm.state.value = h.state || '';
    els.hospitalForm.commission_percentage.value = h.commission_percentage || '';
    els.hospitalForm.agreement_start_date.value = (h.agreement_start_date || '').slice(0, 10);
    els.hospitalForm.agreement_end_date.value = (h.agreement_end_date || '').slice(0, 10);
    els.hospitalForm.notes.value = h.notes || '';
    els.hospitalForm.status.value = h.status || 'active';

    openModal();
  }

  async function openView(id) {
    const res = await window.CRM_API.request(`/api/hospitals/${id}`);
    const h = res.data.hospital;

    openDetails(`
      <div class="details-grid">
        <div class="details-item"><div class="k">Hospital</div><div class="v">${escapeHtml(h.name)}</div></div>
        <div class="details-item"><div class="k">Status</div><div class="v">${statusBadge(h.status)}</div></div>
        <div class="details-item"><div class="k">Contact Person</div><div class="v">${escapeHtml(h.contact_person)}</div></div>
        <div class="details-item"><div class="k">Phone</div><div class="v">${escapeHtml(h.phone)}</div></div>
        <div class="details-item"><div class="k">Email</div><div class="v">${escapeHtml(h.email)}</div></div>
        <div class="details-item"><div class="k">Commission</div><div class="v">${escapeHtml(h.commission_percentage)}%</div></div>
        <div class="details-item" style="grid-column:1/-1;"><div class="k">Address</div><div class="v">${escapeHtml(h.address)}, ${escapeHtml(h.city)}, ${escapeHtml(h.state)}</div></div>
        <div class="details-item"><div class="k">Agreement Start</div><div class="v">${fmtDate(h.agreement_start_date)}</div></div>
        <div class="details-item"><div class="k">Agreement End</div><div class="v">${fmtDate(h.agreement_end_date)}</div></div>
        <div class="details-item" style="grid-column:1/-1;"><div class="k">Notes</div><div class="v">${escapeHtml(h.notes || '-')}</div></div>
      </div>
    `);
  }

  async function submitForm(e) {
    e.preventDefault();
    clearAlert();

    const payload = formToPayload();
    const err = clientValidate(payload);
    if (err) {
      showAlert(err);
      return;
    }

    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `/api/hospitals/${editingId}` : '/api/hospitals';

    try {
      await window.CRM_API.request(url, {
        method,
        body: JSON.stringify(payload)
      });
      closeModal();
      await loadHospitals();
    } catch (error) {
      showAlert(error.message || 'Save failed');
    }
  }

  async function toggleStatus(id, current) {
    const next = current === 'active' ? 'inactive' : 'active';

    try {
      await window.CRM_API.request(`/api/hospitals/status/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next })
      });
      await loadHospitals();
    } catch (err) {
      alert(err.message || 'Failed to update status');
    }
  }

  async function deleteHospital(id) {
    if (!confirm('Delete this hospital? This cannot be undone.')) return;

    try {
      await window.CRM_API.request(`/api/hospitals/${id}`, { method: 'DELETE' });
      await loadHospitals();
    } catch (err) {
      alert(err.message || 'Delete failed');
    }
  }

  function debounce(fn, wait) {
    let t;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), wait);
    };
  }

  function bindEvents() {
    els.addBtn.addEventListener('click', () => {
      editingId = null;
      els.modalTitle.textContent = 'Add Hospital';
      els.hospitalForm.reset();
      els.hospitalForm.status.value = 'active';
      openModal();
    });

    els.closeModalBtn.addEventListener('click', closeModal);
    els.cancelBtn.addEventListener('click', closeModal);
    els.modalOverlay.addEventListener('click', (e) => {
      if (e.target === els.modalOverlay) closeModal();
    });

    els.closeDetailsBtn.addEventListener('click', closeDetails);
    els.detailsOkBtn.addEventListener('click', closeDetails);
    els.detailsOverlay.addEventListener('click', (e) => {
      if (e.target === els.detailsOverlay) closeDetails();
    });

    els.hospitalForm.addEventListener('submit', submitForm);

    els.search.addEventListener('input', debounce(loadHospitals, 250));
    els.cityFilter.addEventListener('change', loadHospitals);
    els.statusFilter.addEventListener('change', loadHospitals);

    els.tableBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'view') return openView(id);
      if (action === 'edit') return openEdit(id);
      if (action === 'toggle') return toggleStatus(id, btn.dataset.status);
      if (action === 'delete') return deleteHospital(id);
    });

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

  async function init() {
    try {
      await loadProfile();
      bindEvents();
      await loadHospitals();
    } catch (err) {
      console.warn('[Hospitals] init warning:', err.message);
      if (err.status === 401) {
        window.CRM_API.clearToken();
        window.location.href = './login.html';
      }
    }
  }

  init();
})();
