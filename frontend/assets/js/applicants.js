(function () {
  'use strict';

  window.CRM_AUTH.requireAuth();

  const els = {
    userName: document.getElementById('userName'),
    userRole: document.getElementById('userRole'),

    search: document.getElementById('search'),
    skills: document.getElementById('skills'),
    jobFilter: document.getElementById('jobFilter'),
    minExperience: document.getElementById('minExperience'),
    statusFilter: document.getElementById('statusFilter'),
    sourceFilter: document.getElementById('sourceFilter'),
    addBtn: document.getElementById('addBtn'),

    tableBody: document.getElementById('tableBody'),

    modalOverlay: document.getElementById('modalOverlay'),
    modalTitle: document.getElementById('modalTitle'),
    modalSubtitle: document.getElementById('modalSubtitle'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    applicantForm: document.getElementById('applicantForm'),
    formAlert: document.getElementById('formAlert'),

    resume: document.getElementById('resume'),
    resumeHint: document.getElementById('resumeHint'),
    existingResume: document.getElementById('existingResume'),

    detailsOverlay: document.getElementById('detailsOverlay'),
    closeDetailsBtn: document.getElementById('closeDetailsBtn'),
    detailsOkBtn: document.getElementById('detailsOkBtn'),
    detailsBody: document.getElementById('detailsBody'),

    logoutBtn: document.getElementById('logoutBtn')
  };

  let isAdmin = false;
  let editingId = null;
  let jobs = [];

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
    els.applicantForm.reset();
    els.existingResume.style.display = 'none';
    els.existingResume.innerHTML = '';
    els.resumeHint.textContent = 'Resume is optional.';
    editingId = null;
  }

  function openDetails(html) {
    els.detailsBody.innerHTML = html;

    // Allow action buttons inside the details modal.
    els.detailsBody.querySelectorAll('button[data-action][data-id]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const action = btn.dataset.action;
        const id = btn.dataset.id;

        try {
          if (action === 'view-original') return viewOriginalResume(id);
          if (action === 'download-original') return downloadOriginalResume(id);
          if (action === 'move-pool') {
            await window.CRM_API.request(`/api/pool/move/${id}`, { method: 'PATCH' });
            await loadApplicants();
            closeDetails();
            return;
          }
        } catch (err) {
          alert(err.message || 'Action failed');
        }
      });
    });

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

  function fmtDate(d) {
    if (!d) return '-';
    return String(d).slice(0, 10);
  }

  function statusBadge(s) {
    if (s === 'active') return '<span class="status green">Active</span>';
    if (s === 'hold') return '<span class="status amber">Hold</span>';
    if (s === 'pool') return '<span class="status blue">Pool</span>';
    return '<span class="status">Rejected</span>';
  }

  function sourceLabel(s) {
    const map = {
      call: 'Call',
      whatsapp: 'WhatsApp',
      portal: 'Portal',
      social_media: 'Social Media',
      referral: 'Referral'
    };
    return map[s] || String(s || '-');
  }

  async function loadProfile() {
    const res = await window.CRM_API.request('/api/auth/profile');
    const u = res.data.user;

    els.userName.textContent = u.full_name;
    els.userRole.textContent = u.role;

    isAdmin = u.role === 'admin';
  }

  async function loadJobs() {
    const res = await window.CRM_API.request('/api/jobs');
    jobs = res.data.jobs || [];

    const jobFilter = els.jobFilter;
    const jobSelect = document.getElementById('applied_job_id');

    // Reset options (keep first)
    jobFilter.querySelectorAll('option:not(:first-child)').forEach((o) => o.remove());
    jobSelect.querySelectorAll('option:not(:first-child)').forEach((o) => o.remove());

    jobs.forEach((j) => {
      const label = `${j.job_title} - ${j.hospital_name} - ${j.location}`;

      const opt1 = document.createElement('option');
      opt1.value = String(j.id);
      opt1.textContent = label;
      jobFilter.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = String(j.id);
      opt2.textContent = label;
      jobSelect.appendChild(opt2);
    });
  }

  function getQueryParams() {
    const qp = new URLSearchParams();
    const search = els.search.value.trim();
    const skills = els.skills.value.trim();
    const jobId = els.jobFilter.value;
    const minExperience = els.minExperience.value;
    const status = els.statusFilter.value;
    const source = els.sourceFilter.value;

    if (search) qp.set('search', search);
    if (skills) qp.set('skills', skills);
    if (jobId) qp.set('jobId', jobId);
    if (minExperience) qp.set('minExperience', minExperience);
    if (status) qp.set('status', status);
    if (source) qp.set('source', source);

    return qp.toString();
  }

  async function loadApplicants() {
    const qs = getQueryParams();
    const url = qs ? `/api/applicants?${qs}` : '/api/applicants';

    const res = await window.CRM_API.request(url);
    const rows = res.data.applicants || [];

    if (!rows.length) {
      els.tableBody.innerHTML = `<tr><td colspan="7" class="small-muted">No applicants found.</td></tr>`;
      return;
    }

    els.tableBody.innerHTML = rows.map((a) => {
      const applied = a.job_title ? `${a.job_title} - ${a.hospital_name || '-'}` : '-';

      const resumeBtns = (() => {
        const parts = [];

        if (a.original_resume_path) {
          parts.push(`<button class="btn btn-outline btn-sm" data-action="view-original" data-id="${a.id}">View Original</button>`);
          parts.push(`<button class="btn btn-outline btn-sm" data-action="download-original" data-id="${a.id}">Download Original</button>`);
        }

        if (!parts.length) return '<span class="small-muted">-</span>';
        return parts.join(' ');
      })();

      const statusSelect = `
        <select class="select" data-action="status-select" data-id="${a.id}" style="min-width: 140px;">
          <option value="active" ${a.candidate_status === 'active' ? 'selected' : ''}>Active</option>
          <option value="hold" ${a.candidate_status === 'hold' ? 'selected' : ''}>Hold</option>
          <option value="rejected" ${a.candidate_status === 'rejected' ? 'selected' : ''}>Rejected</option>
          <option value="pool" ${a.candidate_status === 'pool' ? 'selected' : ''}>Pool</option>
        </select>
      `;

      const actions = `
        <button class="btn btn-outline btn-sm" data-action="view" data-id="${a.id}">View</button>
        <button class="btn btn-outline btn-sm" data-action="export-pdf" data-id="${a.id}" style="color:var(--primary); font-weight:700;">📄 Export PDF</button>
        <button class="btn btn-outline btn-sm" data-action="edit" data-id="${a.id}">Edit</button>
        ${isAdmin ? `<button class="btn btn-danger btn-sm" data-action="delete" data-id="${a.id}">Delete</button>` : ''}
      `;

      return `
        <tr>
          <td>
            <div style="font-weight:900;"><a href="./candidate-profile.html?id=${a.id}" style="color: var(--primary); text-decoration: underline;">${escapeHtml(a.full_name)}</a></div>
            <div class="small-muted">${escapeHtml(a.phone)} - ${escapeHtml(a.email)}</div>
          </td>
          <td>
            <div style="font-weight:800;">${escapeHtml(applied)}</div>
            <div class="small-muted">Preferred: ${escapeHtml(a.preferred_location || '-')}</div>
          </td>
          <td>${escapeHtml(a.total_experience)} yrs</td>
          <td>
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
              ${statusBadge(a.candidate_status)}
              ${statusSelect}
            </div>
          </td>
          <td>${escapeHtml(sourceLabel(a.source))}</td>
          <td><div class="row-actions">${resumeBtns}</div></td>
          <td><div class="row-actions">${actions}</div></td>
        </tr>
      `;
    }).join('');
  }

  function clientValidate(fd) {
    const fullName = String(fd.get('full_name') || '').trim();
    const phone = String(fd.get('phone') || '').trim();
    const email = String(fd.get('email') || '').trim();
    const dob = String(fd.get('dob') || '').trim();
    const gender = String(fd.get('gender') || '').trim();
    const city = String(fd.get('city') || '').trim();
    const state = String(fd.get('state') || '').trim();
    const address = String(fd.get('address') || '').trim();
    const totalExp = Number(fd.get('total_experience'));
    const currentCompany = String(fd.get('current_company') || '').trim();
    const currentDesignation = String(fd.get('current_designation') || '').trim();
    const currentSalary = Number(fd.get('current_salary'));
    const expectedSalary = Number(fd.get('expected_salary'));
    const notice = String(fd.get('notice_period') || '').trim();
    const qualification = String(fd.get('qualification') || '').trim();
    const skills = String(fd.get('skills') || '').trim();
    const prefLoc = String(fd.get('preferred_location') || '').trim();
    const jobId = String(fd.get('applied_job_id') || '').trim();

    if (!fullName) return 'Full name is required';
    if (!phone) return 'Phone number is required';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Valid email is required';
    if (!dob) return 'Date of birth is required';
    if (!['male', 'female', 'other'].includes(gender)) return 'Gender is required';
    if (!city) return 'Current city is required';
    if (!state) return 'Current state is required';
    if (!address) return 'Full address is required';
    if (!Number.isFinite(totalExp) || totalExp < 0) return 'Total experience is required';
    if (!currentCompany) return 'Current company is required';
    if (!currentDesignation) return 'Current designation is required';
    if (!Number.isFinite(currentSalary) || currentSalary < 0) return 'Current salary is required';
    if (!Number.isFinite(expectedSalary) || expectedSalary < 0) return 'Expected salary is required';
    if (!notice) return 'Notice period is required';
    if (!qualification) return 'Highest qualification is required';
    if (!skills) return 'Skills are required';
    if (!prefLoc) return 'Preferred location is required';
    if (!jobId) return 'Applied job is required';

    const resume = els.resume.files && els.resume.files[0];
    if (resume && (resume.type !== 'application/pdf' || !resume.name.toLowerCase().endsWith('.pdf'))) return 'Resume must be a PDF file';

    return '';
  }

  async function openEdit(id) {
    const res = await window.CRM_API.request(`/api/applicants/${id}`);
    const a = res.data.applicant;
    editingId = a.id;

    els.modalTitle.textContent = 'Edit Applicant';
    els.modalSubtitle.textContent = 'Update candidate details. Upload a new resume to replace.';
    els.resumeHint.textContent = 'Upload a new PDF to replace the existing resume (optional).';

    const f = els.applicantForm;
    f.full_name.value = a.full_name || '';
    f.phone.value = a.phone || '';
    f.email.value = a.email || '';
    f.dob.value = (a.dob || '').slice(0, 10);
    f.gender.value = a.gender || '';
    f.city.value = a.city || '';
    f.state.value = a.state || '';
    f.address.value = a.address || '';
    f.total_experience.value = a.total_experience ?? '';
    f.current_company.value = a.current_company || '';
    f.current_designation.value = a.current_designation || '';
    f.current_salary.value = a.current_salary ?? '';
    f.expected_salary.value = a.expected_salary ?? '';
    f.notice_period.value = a.notice_period || '';
    f.qualification.value = a.qualification || '';
    f.skills.value = a.skills || '';
    f.certifications.value = a.certifications || '';
    f.preferred_location.value = a.preferred_location || '';
    f.applied_job_id.value = String(a.applied_job_id || '');
    f.source.value = a.source || 'call';
    f.referral_reward_status.value = a.referral_reward_status || 'pending';
    f.referred_by.value = a.referred_by || '';
    f.referral_contact.value = a.referral_contact || '';
    f.notes.value = a.notes || '';
    f.candidate_status.value = a.candidate_status || 'active';

    els.resume.value = '';

    if (a.original_resume_path) {
      els.existingResume.style.display = 'block';
      els.existingResume.innerHTML = `Existing resume: <button class="btn btn-outline btn-sm" type="button" id="viewExistingBtn">View Original</button> <button class="btn btn-outline btn-sm" type="button" id="downloadExistingBtn">Download Original</button>`;

      setTimeout(() => {
        const v = document.getElementById('viewExistingBtn');
        const d = document.getElementById('downloadExistingBtn');
        if (v) v.addEventListener('click', () => viewOriginalResume(a.id));
        if (d) d.addEventListener('click', () => downloadOriginalResume(a.id));
      }, 0);
    }



    openModal();
  }

  async function openView(id) {
    let currentTab = 'tab-profile';

    async function loadAndRender() {
      try {
        els.detailsBody.innerHTML = '<div class="small-muted">Loading candidate files, timeline, and notes...</div>';
        els.detailsOverlay.classList.add('show');
        els.detailsOverlay.setAttribute('aria-hidden', 'false');

        const [appRes, timelineRes, notesRes, tagsRes, historyRes] = await Promise.all([
          window.CRM_API.request(`/api/applicants/${id}`),
          window.CRM_API.request(`/api/applicants/${id}/timeline`).catch(() => ({ data: { timeline: [] } })),
          window.CRM_API.request(`/api/applicants/${id}/notes`).catch(() => ({ data: { notes: [] } })),
          window.CRM_API.request(`/api/applicants/${id}/tags`).catch(() => ({ data: { tags: [] } })),
          window.CRM_API.request(`/api/applicants/${id}/resume-history`).catch(() => ({ data: { history: [] } }))
        ]);

        const a = appRes.data.applicant;
        const timeline = timelineRes.data.timeline || [];
        const notes = notesRes.data.notes || [];
        const tags = tagsRes.data.tags || [];
        const resumeHistory = historyRes.data.history || [];

        const hasOriginal = Boolean(a.original_resume_path);
        const resumeActions = `
          <div style="display:flex; gap:10px; flex-wrap: wrap; margin-top: 15px;">
            ${hasOriginal ? `<button class="btn btn-outline btn-sm" type="button" data-action="view-original" data-id="${a.id}">View Original</button>` : ''}
            ${hasOriginal ? `<button class="btn btn-outline btn-sm" type="button" data-action="download-original" data-id="${a.id}">Download Original</button>` : ''}
            ${(a.candidate_status !== 'pool') ? `<button class="btn btn-outline btn-sm" type="button" data-action="move-pool" data-id="${a.id}">Move to Pool</button>` : ''}
          </div>
        `;

        // Render Tabs Navigation
        const tabsNav = `
          <div class="details-tabs-nav" style="display:flex; gap:8px; margin-bottom:15px; border-bottom:1px solid #e5e7eb; padding-bottom:8px; overflow-x:auto;">
            <button class="btn btn-sm tab-btn ${currentTab === 'tab-profile' ? 'active' : 'btn-outline'}" data-tab="tab-profile">Profile</button>
            <button class="btn btn-sm tab-btn ${currentTab === 'tab-timeline' ? 'active' : 'btn-outline'}" data-tab="tab-timeline">Timeline (${timeline.length})</button>
            <button class="btn btn-sm tab-btn ${currentTab === 'tab-notes' ? 'active' : 'btn-outline'}" data-tab="tab-notes">Notes (${notes.length})</button>
            <button class="btn btn-sm tab-btn ${currentTab === 'tab-tags' ? 'active' : 'btn-outline'}" data-tab="tab-tags">Skills & Tags</button>
            <button class="btn btn-sm tab-btn ${currentTab === 'tab-resumes' ? 'active' : 'btn-outline'}" data-tab="tab-resumes">Resumes (${resumeHistory.length})</button>
          </div>
        `;

        // Tab 1: Profile
        const tabProfile = `
          <div class="tab-content" id="tab-profile" style="display: ${currentTab === 'tab-profile' ? 'block' : 'none'};">
            <div class="details-grid">
              <div class="details-item"><div class="k">Full Name</div><div class="v">${escapeHtml(a.full_name)}</div></div>
              <div class="details-item"><div class="k">Status</div><div class="v">${statusBadge(a.candidate_status)}</div></div>
              <div class="details-item"><div class="k">Phone</div><div class="v">${escapeHtml(a.phone)}</div></div>
              <div class="details-item"><div class="k">Email</div><div class="v">${escapeHtml(a.email)}</div></div>
              <div class="details-item"><div class="k">DOB</div><div class="v">${escapeHtml(fmtDate(a.dob))}</div></div>
              <div class="details-item"><div class="k">Gender</div><div class="v">${escapeHtml(a.gender)}</div></div>

              <div class="details-item" style="grid-column:1/-1;"><div class="k">Address</div><div class="v">${escapeHtml(a.address)}, ${escapeHtml(a.city)}, ${escapeHtml(a.state)}</div></div>

              <div class="details-item"><div class="k">Experience</div><div class="v">${escapeHtml(a.total_experience)} yrs</div></div>
              <div class="details-item"><div class="k">Notice</div><div class="v">${escapeHtml(a.notice_period)}</div></div>

              <div class="details-item"><div class="k">Company</div><div class="v">${escapeHtml(a.current_company)}</div></div>
              <div class="details-item"><div class="k">Designation</div><div class="v">${escapeHtml(a.current_designation)}</div></div>

              <div class="details-item"><div class="k">Current Salary</div><div class="v">₹ ${escapeHtml(a.current_salary)}</div></div>
              <div class="details-item"><div class="k">Expected Salary</div><div class="v">₹ ${escapeHtml(a.expected_salary)}</div></div>

              <div class="details-item"><div class="k">Qualification</div><div class="v">${escapeHtml(a.qualification)}</div></div>
              <div class="details-item"><div class="k">Preferred Location</div><div class="v">${escapeHtml(a.preferred_location)}</div></div>

              <div class="details-item" style="grid-column:1/-1;"><div class="k">Skills</div><div class="v">${escapeHtml(a.skills)}</div></div>
              <div class="details-item" style="grid-column:1/-1;"><div class="k">Certifications</div><div class="v">${escapeHtml(a.certifications || '-')}</div></div>

              <div class="details-item"><div class="k">Applied Job</div><div class="v">${escapeHtml(a.job_title || '-')}</div></div>
              <div class="details-item"><div class="k">Hospital</div><div class="v">${escapeHtml(a.hospital_name || '-')}</div></div>

              <div class="details-item"><div class="k">Source</div><div class="v">${escapeHtml(sourceLabel(a.source))}</div></div>
              <div class="details-item"><div class="k">Referral Reward</div><div class="v">${escapeHtml(a.referral_reward_status || 'pending')}</div></div>

              <div class="details-item"><div class="k">Referred By</div><div class="v">${escapeHtml(a.referred_by || '-')}</div></div>
              <div class="details-item"><div class="k">Referral Contact</div><div class="v">${escapeHtml(a.referral_contact || '-')}</div></div>

              <div class="details-item" style="grid-column:1/-1;"><div class="k">Notes</div><div class="v">${escapeHtml(a.notes || '-')}</div></div>

              <div class="details-item"><div class="k">Created By</div><div class="v">${escapeHtml(a.created_by_name || '-')}</div></div>
              <div class="details-item"><div class="k">Created</div><div class="v">${escapeHtml(String(a.created_at || '').slice(0, 19).replace('T', ' '))}</div></div>
            </div>
            ${resumeActions}
          </div>
        `;

        // Tab 2: Timeline
        let timelineHtml = '<div class="small-muted">No timeline events found.</div>';
        if (timeline && timeline.length) {
          timelineHtml = `
            <div style="display:flex; flex-direction:column; gap:12px; max-height: 450px; overflow-y: auto; padding: 10px 5px;">
              ${timeline.map(t => {
                const date = new Date(t.event_time).toLocaleString();
                let icon = '⚫';
                if (t.type === 'stage') icon = '🔄';
                else if (t.type === 'interview') icon = '📅';
                else if (t.type === 'note') icon = '📝';
                else if (t.type === 'creation') icon = '🆕';

                return `
                  <div style="display:flex; gap:10px; align-items:flex-start;">
                    <div style="font-size:16px; margin-top:2px;">${icon}</div>
                    <div style="flex:1;">
                      <div style="font-weight:700; font-size:14px;">${escapeHtml(t.title)}</div>
                      <div style="font-size:13px; color:var(--text-secondary); margin-top:2px;">${escapeHtml(t.description)}</div>
                      <div class="small-muted" style="margin-top:2px;">By ${escapeHtml(t.user)} on ${date}</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        }
        const tabTimeline = `
          <div class="tab-content" id="tab-timeline" style="display: ${currentTab === 'tab-timeline' ? 'block' : 'none'};">
            ${timelineHtml}
          </div>
        `;

        // Tab 3: Notes
        let notesHtml = '<div class="small-muted" style="margin-bottom: 12px;">No candidate notes found.</div>';
        if (notes && notes.length) {
          notesHtml = `
            <div style="display:flex; flex-direction:column; gap:10px; max-height: 250px; overflow-y: auto; margin-bottom: 15px; padding: 5px;">
              ${notes.map(n => {
                const date = new Date(n.created_at).toLocaleString();
                const canDelete = isAdmin ? `<button class="btn btn-sm" style="color:var(--danger); border:none; background:none; padding:0; cursor:pointer;" data-action="delete-note" data-note-id="${n.id}">Delete</button>` : '';
                return `
                  <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:8px 10px;">
                    <div style="font-size:13px; line-height: 1.4;">${escapeHtml(n.note_text)}</div>
                    <div class="small-muted" style="display:flex; justify-content:space-between; margin-top:6px;">
                      <span>By ${escapeHtml(n.author_name)} on ${date}</span>
                      ${canDelete}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        }
        const appendNoteForm = `
          <div style="border-top:1px solid #e2e8f0; padding-top:12px;">
            <div class="form-group" style="margin-bottom:8px;">
              <label class="label" style="font-weight:700;">Add Note</label>
              <textarea id="newNoteText" class="input" style="height:60px;" placeholder="Write a note about this candidate..."></textarea>
            </div>
            <button class="btn btn-primary btn-sm" type="button" id="submitNoteBtn">Add Note</button>
          </div>
        `;
        const tabNotes = `
          <div class="tab-content" id="tab-notes" style="display: ${currentTab === 'tab-notes' ? 'block' : 'none'};">
            ${notesHtml}
            ${appendNoteForm}
          </div>
        `;

        // Tab 4: Skills & Tags
        const skillsList = a.skills ? a.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
        const skillChips = skillsList.map(s => `<span class="badge" style="margin-right:4px; margin-bottom:4px; background:#e2e8f0; color:#1e293b;">${escapeHtml(s)}</span>`).join('');
        const tagChips = tags.map(t => `
          <span class="status blue" style="display:inline-flex; align-items:center; gap:4px; margin-right:4px; margin-bottom:4px; font-weight:700; padding:3px 8px; border-radius:12px;">
            ${escapeHtml(t)}
            <span style="cursor:pointer; font-weight:bold; font-size:11px;" data-action="remove-tag" data-tag="${escapeHtml(t)}">×</span>
          </span>
        `).join('');
        const tabTags = `
          <div class="tab-content" id="tab-tags" style="display: ${currentTab === 'tab-tags' ? 'block' : 'none'};">
            <div style="margin-bottom:15px;">
              <div style="font-weight:700; margin-bottom:6px;">Candidate Skills (from profile)</div>
              <div style="display:flex; flex-wrap:wrap;">${skillChips || '<span class="small-muted">No skills recorded</span>'}</div>
            </div>
            
            <div style="border-top:1px solid #e2e8f0; padding-top:12px; margin-bottom:15px;">
              <div style="font-weight:700; margin-bottom:6px;">Recruiter Tags / Labels</div>
              <div style="display:flex; flex-wrap:wrap;">${tagChips || '<span class="small-muted">No tags added yet</span>'}</div>
            </div>

            <div style="border-top:1px solid #e2e8f0; padding-top:12px;">
              <div class="form-group" style="margin-bottom:8px; max-width: 300px;">
                <label class="label" style="font-weight:700;">Add Tag</label>
                <div style="display:flex; gap:8px;">
                  <input type="text" id="newTagInput" class="input" placeholder="e.g. ICU, Immediate" style="height:32px; font-size:13px;" />
                  <button class="btn btn-primary btn-sm" type="button" id="submitTagBtn" style="height:32px; padding:0 12px; line-height:32px;">+ Add</button>
                </div>
              </div>
            </div>
          </div>
        `;

        // Tab 5: Resume History
        let historyHtml = '<div class="small-muted">No resume upload history found.</div>';
        if (resumeHistory && resumeHistory.length) {
          historyHtml = `
            <div style="overflow-x:auto;">
              <table class="table" style="font-size: 13px;">
                <thead>
                  <tr>
                    <th>File Type</th>
                    <th>Uploaded By</th>
                    <th>Upload Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${resumeHistory.map(h => {
                    const date = new Date(h.created_at).toLocaleString();
                    return `
                      <tr>
                        <td><span class="badge">${h.file_type.toUpperCase()}</span></td>
                        <td>${escapeHtml(h.uploaded_by_name)}</td>
                        <td>${date}</td>
                        <td>
                          <a href="/api/applicants/view/${a.id}?path=${encodeURIComponent(h.file_path)}" target="_blank" class="btn btn-outline btn-sm">View File</a>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `;
        }
        const tabResumes = `
          <div class="tab-content" id="tab-resumes" style="display: ${currentTab === 'tab-resumes' ? 'block' : 'none'};">
            ${historyHtml}
          </div>
        `;

        // Assemble HTML into detailsBody
        els.detailsBody.innerHTML = `
          ${tabsNav}
          ${tabProfile}
          ${tabTimeline}
          ${tabNotes}
          ${tabTags}
          ${tabResumes}
        `;

        // Tab Switching Event Listeners
        els.detailsBody.querySelectorAll('.tab-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            currentTab = btn.dataset.tab;
            
            els.detailsBody.querySelectorAll('.tab-btn').forEach(b => {
              b.classList.remove('active');
              b.classList.add('btn-outline');
            });
            btn.classList.add('active');
            btn.classList.remove('btn-outline');

            els.detailsBody.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            els.detailsBody.querySelector(`#${currentTab}`).style.display = 'block';
          });
        });

        // Resume actions & Move pool buttons
        els.detailsBody.querySelectorAll('button[data-action][data-id]').forEach((btn) => {
          btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const action = btn.dataset.action;
            const uid = btn.dataset.id;
            try {
              if (action === 'view-original') return viewOriginalResume(uid);
              if (action === 'download-original') return downloadOriginalResume(uid);
              if (action === 'move-pool') {
                await window.CRM_API.request(`/api/pool/move/${uid}`, { method: 'PATCH' });
                await loadApplicants();
                closeDetails();
              }
            } catch (err) {
              alert(err.message || 'Action failed');
            }
          });
        });

        // Add tag listener
        const submitTagBtn = els.detailsBody.querySelector('#submitTagBtn');
        if (submitTagBtn) {
          submitTagBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const val = els.detailsBody.querySelector('#newTagInput').value.trim();
            if (!val) return;
            try {
              await window.CRM_API.request(`/api/applicants/${id}/tags`, {
                method: 'POST',
                body: JSON.stringify({ tag: val })
              });
              await loadAndRender();
            } catch (err) {
              alert(err.message || 'Failed to add tag');
            }
          });
        }

        // Delete tag listener
        els.detailsBody.querySelectorAll('[data-action="remove-tag"]').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const tagVal = btn.dataset.tag;
            try {
              await window.CRM_API.request(`/api/applicants/${id}/tags/${encodeURIComponent(tagVal)}`, {
                method: 'DELETE'
              });
              await loadAndRender();
            } catch (err) {
              alert(err.message || 'Failed to remove tag');
            }
          });
        });

        // Add note listener
        const submitNoteBtn = els.detailsBody.querySelector('#submitNoteBtn');
        if (submitNoteBtn) {
          submitNoteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const val = els.detailsBody.querySelector('#newNoteText').value.trim();
            if (!val) return;
            try {
              await window.CRM_API.request(`/api/applicants/${id}/notes`, {
                method: 'POST',
                body: JSON.stringify({ note_text: val })
              });
              await loadAndRender();
            } catch (err) {
              alert(err.message || 'Failed to add note');
            }
          });
        }

        // Delete note listener
        els.detailsBody.querySelectorAll('[data-action="delete-note"]').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const noteId = btn.dataset.noteId;
            if (!confirm('Are you sure you want to delete this note?')) return;
            try {
              await window.CRM_API.request(`/api/applicants/notes/${noteId}`, {
                method: 'DELETE'
              });
              await loadAndRender();
            } catch (err) {
              alert(err.message || 'Failed to delete note');
            }
          });
        });

      } catch (err) {
        els.detailsBody.innerHTML = `<div class="small-muted">Failed to load candidate profile: ${escapeHtml(err.message)}</div>`;
      }
    }

    await loadAndRender();
  }

  async function submitForm(e) {
    e.preventDefault();
    clearAlert();

    const fd = new FormData(els.applicantForm);
    const err = clientValidate(fd);
    if (err) {
      showAlert(err);
      return;
    }

    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `/api/applicants/${editingId}` : '/api/applicants';

    try {
      await window.CRM_API.request(url, {
        method,
        body: fd
      });
      closeModal();
      await loadApplicants();
    } catch (error) {
      showAlert(error.message || 'Save failed');
    }
  }

  async function setStatus(id, nextStatus) {
    try {
      await window.CRM_API.request(`/api/applicants/status/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ candidate_status: nextStatus })
      });
      await loadApplicants();
    } catch (err) {
      alert(err.message || 'Failed to update status');
    }
  }

  async function deleteApplicant(id) {
    if (!confirm('Delete this applicant? This will also remove the stored resume.')) return;

    try {
      await window.CRM_API.request(`/api/applicants/${id}`, { method: 'DELETE' });
      await loadApplicants();
    } catch (err) {
      alert(err.message || 'Delete failed');
    }
  }

  async function fetchPdfBlob(url) {
    const token = window.CRM_API.getToken();
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to fetch file');
    }
    return res.blob();
  }

  async function viewOriginalResume(id) {
    try {
      const blob = await fetchPdfBlob(`/api/resume/original/${id}`);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      alert(err.message || 'Original resume not available');
    }
  }

  async function downloadOriginalResume(id) {
    try {
      const blob = await fetchPdfBlob(`/api/resume/original/${id}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resume_original_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      alert(err.message || 'Original resume not available');
    }
  }

  async function exportCandidatePdf(id) {
    try {
      const blob = await fetchPdfBlob(`/api/applicants/${id}/export-pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Candidate_Profile_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      alert(err.message || 'Failed to export candidate PDF');
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
      els.modalTitle.textContent = 'Add Applicant';
      els.modalSubtitle.textContent = 'Enter candidate details and upload resume (optional).';
      els.resumeHint.textContent = 'Resume is optional.';
      els.existingResume.style.display = 'none';
      els.existingResume.innerHTML = '';
      els.applicantForm.reset();
      document.getElementById('referral_reward_status').value = 'pending';
      document.getElementById('candidate_status').value = 'active';
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

    els.applicantForm.addEventListener('submit', submitForm);

    els.search.addEventListener('input', debounce(loadApplicants, 250));
    els.skills.addEventListener('input', debounce(loadApplicants, 250));
    els.minExperience.addEventListener('input', debounce(loadApplicants, 250));
    els.jobFilter.addEventListener('change', loadApplicants);
    els.statusFilter.addEventListener('change', loadApplicants);
    els.sourceFilter.addEventListener('change', loadApplicants);

    els.tableBody.addEventListener('change', async (e) => {
      const sel = e.target.closest('select[data-action="status-select"]');
      if (!sel) return;
      const id = sel.dataset.id;
      const next = sel.value;
      await setStatus(id, next);
    });

    els.tableBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'view') { window.location.href = `./candidate-profile.html?id=${id}`; return; }
      if (action === 'export-pdf') return exportCandidatePdf(id);
      if (action === 'edit') return openEdit(id);
      if (action === 'delete') return deleteApplicant(id);
      if (action === 'view-original') return viewOriginalResume(id);
      if (action === 'download-original') return downloadOriginalResume(id);
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
      await loadJobs();
      bindEvents();
      await loadApplicants();
    } catch (err) {
      window.CRM_API.clearToken();
      window.location.href = './login.html';
    }
  }

  init();
})();
