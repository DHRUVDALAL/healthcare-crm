(function () {
  'use strict';

  window.CRM_AUTH.requireAuth();

  const els = {
    userName: document.getElementById('userName'),
    userRole: document.getElementById('userRole'),
    topRole: document.getElementById('topRole'),

    search: document.getElementById('search'),
    hospitalFilter: document.getElementById('hospitalFilter'),
    statusFilter: document.getElementById('statusFilter'),
    priorityFilter: document.getElementById('priorityFilter'),
    locationFilter: document.getElementById('locationFilter'),
    addBtn: document.getElementById('addBtn'),
    readOnlyBadge: document.getElementById('readOnlyBadge'),

    tableBody: document.getElementById('tableBody'),

    modalOverlay: document.getElementById('modalOverlay'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    jobForm: document.getElementById('jobForm'),
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
  let hospitals = [];

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
    els.jobForm.reset();
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
    if (status === 'open') return '<span class="status green">Open</span>';
    if (status === 'hold') return '<span class="status amber">Hold</span>';
    return '<span class="status">Closed</span>';
  }

  function priorityBadge(p) {
    if (p === 'high') return '<span class="status amber">High</span>';
    if (p === 'low') return '<span class="status">Low</span>';
    return '<span class="status blue">Medium</span>';
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

  async function loadHospitalsForDropdowns() {
    const res = await window.CRM_API.request('/api/hospitals');
    hospitals = res.data.hospitals || [];

    // Filter dropdown
    hospitals.forEach((h) => {
      const opt = document.createElement('option');
      opt.value = String(h.id);
      opt.textContent = h.name;
      els.hospitalFilter.appendChild(opt);
    });

    // Form dropdown
    const formSelect = document.getElementById('hospital_id');
    hospitals.forEach((h) => {
      const opt = document.createElement('option');
      opt.value = String(h.id);
      opt.textContent = `${h.name} (${h.city})`;
      formSelect.appendChild(opt);
    });
  }

  function getQueryParams() {
    const qp = new URLSearchParams();

    const search = els.search.value.trim();
    const hospital = els.hospitalFilter.value;
    const status = els.statusFilter.value;
    const priority = els.priorityFilter.value;
    const location = els.locationFilter.value.trim();

    if (search) qp.set('search', search);
    if (hospital) qp.set('hospital', hospital);
    if (status) qp.set('status', status);
    if (priority) qp.set('priority', priority);
    if (location) qp.set('location', location);

    return qp.toString();
  }

  async function loadJobs() {
    const qs = getQueryParams();
    const url = qs ? `/api/jobs?${qs}` : '/api/jobs';

    const res = await window.CRM_API.request(url);
    const rows = res.data.jobs || [];

    if (!rows.length) {
      els.tableBody.innerHTML = `<tr><td colspan="7" class="small-muted">No job openings found.</td></tr>`;
      return;
    }

    els.tableBody.innerHTML = rows.map((j) => {
      const actions = isAdmin
        ? `
          <button class="btn btn-outline btn-sm" data-action="view" data-id="${j.id}">View</button>
          <button class="btn btn-outline btn-sm" data-action="edit" data-id="${j.id}">Edit</button>
          <button class="btn btn-outline btn-sm" data-action="toggle" data-id="${j.id}" data-status="${j.status}">${j.status === 'open' ? 'Close' : 'Open'}</button>
          <button class="btn btn-danger btn-sm" data-action="delete" data-id="${j.id}">Delete</button>
        `
        : `<button class="btn btn-outline btn-sm" data-action="view" data-id="${j.id}">View</button>`;

      return `
        <tr>
          <td>
            <div style="font-weight:900;">${escapeHtml(j.job_title)}</div>
            <div class="small-muted">${escapeHtml(j.department)}</div>
          </td>
          <td>${escapeHtml(j.hospital_name)}</td>
          <td>${escapeHtml(j.location)}</td>
          <td>${escapeHtml(j.openings_count)}</td>
          <td>${priorityBadge(j.priority_level)}</td>
          <td>${statusBadge(j.status)}</td>
          <td><div class="row-actions">${actions}</div></td>
        </tr>
      `;
    }).join('');
  }

  function formToPayload() {
    const fd = new FormData(els.jobForm);
    return {
      hospital_id: String(fd.get('hospital_id') || '').trim(),
      job_title: String(fd.get('job_title') || '').trim(),
      department: String(fd.get('department') || '').trim(),
      qualification: String(fd.get('qualification') || '').trim(),
      experience_required: String(fd.get('experience_required') || '').trim(),
      salary: String(fd.get('salary') || '').trim(),
      openings_count: String(fd.get('openings_count') || '').trim(),
      location: String(fd.get('location') || '').trim(),
      shift_timing: String(fd.get('shift_timing') || '').trim(),
      job_description: String(fd.get('job_description') || '').trim(),
      required_skills: String(fd.get('required_skills') || '').trim(),
      joining_timeline: String(fd.get('joining_timeline') || '').trim(),
      priority_level: String(fd.get('priority_level') || '').trim(),
      status: String(fd.get('status') || '').trim()
    };
  }

  function clientValidate(p) {
    if (!p.hospital_id) return 'Hospital is required';
    if (!p.job_title) return 'Job title is required';
    if (!p.department) return 'Department is required';
    if (!p.qualification) return 'Qualification is required';
    if (!p.experience_required) return 'Experience required is required';
    if (!p.salary || Number(p.salary) < 0) return 'Salary is required';
    if (!p.openings_count || Number(p.openings_count) <= 0) return 'Openings count must be > 0';
    if (!p.location) return 'Location is required';
    if (!p.shift_timing) return 'Shift timing is required';
    if (!p.joining_timeline) return 'Joining timeline is required';
    if (!p.required_skills) return 'Required skills is required';
    if (!p.job_description) return 'Job description is required';
    if (!['high', 'medium', 'low'].includes(p.priority_level)) return 'Invalid priority';
    if (!['open', 'closed', 'hold'].includes(p.status)) return 'Invalid status';
    return '';
  }

  async function openEdit(id) {
    const res = await window.CRM_API.request(`/api/jobs/${id}`);
    const j = res.data.job;
    editingId = j.id;

    els.modalTitle.textContent = 'Edit Job Opening';

    els.jobForm.hospital_id.value = String(j.hospital_id);
    els.jobForm.job_title.value = j.job_title || '';
    els.jobForm.department.value = j.department || '';
    els.jobForm.qualification.value = j.qualification || '';
    els.jobForm.experience_required.value = j.experience_required || '';
    els.jobForm.salary.value = j.salary || '';
    els.jobForm.openings_count.value = j.openings_count || '';
    els.jobForm.location.value = j.location || '';
    els.jobForm.shift_timing.value = j.shift_timing || '';
    els.jobForm.joining_timeline.value = j.joining_timeline || '';
    els.jobForm.priority_level.value = j.priority_level || 'medium';
    els.jobForm.status.value = j.status || 'open';
    els.jobForm.required_skills.value = j.required_skills || '';
    els.jobForm.job_description.value = j.job_description || '';

    openModal();
  }

  async function openView(id) {
    const res = await window.CRM_API.request(`/api/jobs/${id}`);
    const j = res.data.job;

    openDetails(`
      <div class="details-grid">
        <div class="details-item"><div class="k">Role</div><div class="v">${escapeHtml(j.job_title)}</div></div>
        <div class="details-item"><div class="k">Status</div><div class="v">${statusBadge(j.status)}</div></div>
        <div class="details-item"><div class="k">Hospital</div><div class="v">${escapeHtml(j.hospital_name)}</div></div>
        <div class="details-item"><div class="k">Priority</div><div class="v">${priorityBadge(j.priority_level)}</div></div>
        <div class="details-item"><div class="k">Department</div><div class="v">${escapeHtml(j.department)}</div></div>
        <div class="details-item"><div class="k">Location</div><div class="v">${escapeHtml(j.location)}</div></div>
        <div class="details-item"><div class="k">Qualification</div><div class="v">${escapeHtml(j.qualification)}</div></div>
        <div class="details-item"><div class="k">Experience</div><div class="v">${escapeHtml(j.experience_required)}</div></div>
        <div class="details-item"><div class="k">Salary</div><div class="v">₹ ${escapeHtml(j.salary)}</div></div>
        <div class="details-item"><div class="k">Openings</div><div class="v">${escapeHtml(j.openings_count)}</div></div>
        <div class="details-item"><div class="k">Shift</div><div class="v">${escapeHtml(j.shift_timing)}</div></div>
        <div class="details-item"><div class="k">Joining</div><div class="v">${escapeHtml(j.joining_timeline)}</div></div>
        <div class="details-item"><div class="k">Created By</div><div class="v">${escapeHtml(j.created_by_name || '-')}</div></div>
        <div class="details-item" style="grid-column:1/-1;"><div class="k">Skills</div><div class="v">${escapeHtml(j.required_skills)}</div></div>
        <div class="details-item" style="grid-column:1/-1;"><div class="k">Job Description</div><div class="v">${escapeHtml(j.job_description)}</div></div>
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
    const url = editingId ? `/api/jobs/${editingId}` : '/api/jobs';

    try {
      await window.CRM_API.request(url, {
        method,
        body: JSON.stringify(payload)
      });
      closeModal();
      await loadJobs();
    } catch (error) {
      showAlert(error.message || 'Save failed');
    }
  }

  async function toggleStatus(id, current) {
    const next = current === 'open' ? 'closed' : 'open';

    try {
      await window.CRM_API.request(`/api/jobs/status/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next })
      });
      await loadJobs();
    } catch (err) {
      alert(err.message || 'Failed to update status');
    }
  }

  async function deleteJob(id) {
    if (!confirm('Delete this job opening? This cannot be undone.')) return;

    try {
      await window.CRM_API.request(`/api/jobs/${id}`, { method: 'DELETE' });
      await loadJobs();
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
      els.modalTitle.textContent = 'Add Job Opening';
      els.jobForm.reset();
      els.jobForm.priority_level.value = 'medium';
      els.jobForm.status.value = 'open';
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

    els.jobForm.addEventListener('submit', submitForm);

    els.search.addEventListener('input', debounce(loadJobs, 250));
    els.locationFilter.addEventListener('input', debounce(loadJobs, 250));
    els.hospitalFilter.addEventListener('change', loadJobs);
    els.statusFilter.addEventListener('change', loadJobs);
    els.priorityFilter.addEventListener('change', loadJobs);

    els.tableBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'view') return openView(id);
      if (action === 'edit') return openEdit(id);
      if (action === 'toggle') return toggleStatus(id, btn.dataset.status);
      if (action === 'delete') return deleteJob(id);
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
      await loadJobs();
    } catch (err) {
      console.warn('[Jobs] init warning:', err.message);
      if (err.status === 401) {
        window.CRM_API.clearToken();
        window.location.href = './login.html';
      }
    }
  }

  init();
})();
