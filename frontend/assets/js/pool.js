(function () {
  'use strict';

  window.CRM_AUTH.requireAuth();

  const els = {
    userName: document.getElementById('userName'),
    userRole: document.getElementById('userRole'),
    topRole: document.getElementById('topRole'),

    search: document.getElementById('search'),
    skills: document.getElementById('skills'),
    minExperience: document.getElementById('minExperience'),
    location: document.getElementById('location'),
    prevJobId: document.getElementById('prevJobId'),
    refreshBtn: document.getElementById('refreshBtn'),
    poolCount: document.getElementById('poolCount'),

    tableBody: document.getElementById('tableBody'),

    modalOverlay: document.getElementById('modalOverlay'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    saveBtn: document.getElementById('saveBtn'),
    formAlert: document.getElementById('formAlert'),
    jobSelect: document.getElementById('job_id'),

    detailModalOverlay: document.getElementById('detailModalOverlay'),
    closeDetailBtn: document.getElementById('closeDetailBtn'),
    detailOkBtn: document.getElementById('detailOkBtn'),
    detailBody: document.getElementById('detailBody'),
    detailSubtitle: document.getElementById('detailSubtitle'),

    logoutBtn: document.getElementById('logoutBtn')
  };

  let jobs = [];
  let candidates = [];
  let editingId = null;
  let userProfile = null;

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"]+/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] || m));
  }

  function showAlert(msg) {
    els.formAlert.textContent = msg;
    els.formAlert.classList.add('show');
  }

  function clearAlert() {
    els.formAlert.textContent = '';
    els.formAlert.classList.remove('show');
  }

  function openModal(applicantId, candidateName) {
    clearAlert();
    editingId = applicantId;
    document.getElementById('modalTitle').textContent = 'Reassign Candidate';
    document.getElementById('modalSubtitle').textContent = candidateName ? `Reassign ${candidateName} to a job opening.` : 'Assign this candidate to a new job opening.';
    els.jobSelect.value = '';
    els.modalOverlay.classList.add('show');
    els.modalOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    els.modalOverlay.classList.remove('show');
    els.modalOverlay.setAttribute('aria-hidden', 'true');
    editingId = null;
    clearAlert();
  }

  // --- Detail Modal ---
  function openDetailModal() {
    els.detailModalOverlay.classList.add('show');
    els.detailModalOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeDetailModal() {
    els.detailModalOverlay.classList.remove('show');
    els.detailModalOverlay.setAttribute('aria-hidden', 'true');
    els.detailBody.innerHTML = '<div class="small-muted">Loading...</div>';
  }

  async function viewCandidate(id) {
    let currentTab = 'tab-profile';
    const isAdmin = userProfile && userProfile.role === 'admin';

    async function loadAndRender() {
      try {
        els.detailBody.innerHTML = '<div class="small-muted">Loading candidate files, timeline, and notes...</div>';
        openDetailModal();

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

        els.detailSubtitle.textContent = a.full_name;

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
            <table class="table" style="font-size: 13px;">
              <tbody>
                <tr><td style="font-weight:700; width: 180px;">Full Name</td><td>${escapeHtml(a.full_name)}</td></tr>
                <tr><td style="font-weight:700;">Phone</td><td>${escapeHtml(a.phone)}</td></tr>
                <tr><td style="font-weight:700;">Email</td><td>${escapeHtml(a.email)}</td></tr>
                <tr><td style="font-weight:700;">Gender</td><td>${escapeHtml(a.gender)}</td></tr>
                <tr><td style="font-weight:700;">Date of Birth</td><td>${a.dob ? new Date(a.dob).toLocaleDateString() : '-'}</td></tr>
                <tr><td style="font-weight:700;">City / State</td><td>${escapeHtml(a.city)}, ${escapeHtml(a.state)}</td></tr>
                <tr><td style="font-weight:700;">Address</td><td>${escapeHtml(a.address)}</td></tr>
                <tr><td style="font-weight:700;">Total Experience</td><td>${a.total_experience} yrs</td></tr>
                <tr><td style="font-weight:700;">Current Company</td><td>${escapeHtml(a.current_company)}</td></tr>
                <tr><td style="font-weight:700;">Current Designation</td><td>${escapeHtml(a.current_designation)}</td></tr>
                <tr><td style="font-weight:700;">Current Salary</td><td>₹ ${Number(a.current_salary || 0).toLocaleString('en-IN')}</td></tr>
                <tr><td style="font-weight:700;">Expected Salary</td><td>₹ ${Number(a.expected_salary || 0).toLocaleString('en-IN')}</td></tr>
                <tr><td style="font-weight:700;">Notice Period</td><td>${escapeHtml(a.notice_period)}</td></tr>
                <tr><td style="font-weight:700;">Qualification</td><td>${escapeHtml(a.qualification)}</td></tr>
                <tr><td style="font-weight:700;">Skills</td><td>${escapeHtml(a.skills)}</td></tr>
                <tr><td style="font-weight:700;">Certifications</td><td>${escapeHtml(a.certifications || '-')}</td></tr>
                <tr><td style="font-weight:700;">Preferred Location</td><td>${escapeHtml(a.preferred_location)}</td></tr>
                <tr><td style="font-weight:700;">Applied Job</td><td>${escapeHtml(a.job_title || '-')} ${a.hospital_name ? '(' + escapeHtml(a.hospital_name) + ')' : ''}</td></tr>
                <tr><td style="font-weight:700;">Source</td><td>${escapeHtml(a.source)}</td></tr>
                <tr><td style="font-weight:700;">Referred By</td><td>${escapeHtml(a.referred_by || '-')}</td></tr>
                <tr><td style="font-weight:700;">Candidate Status</td><td>${escapeHtml(a.candidate_status)}</td></tr>
                <tr><td style="font-weight:700;">Notes</td><td>${escapeHtml(a.notes || '-')}</td></tr>
              </tbody>
            </table>
          </div>
        `;

        // Tab 2: Timeline
        let timelineHtml = '<div class="small-muted">No timeline events found.</div>';
        if (timeline && timeline.length) {
          timelineHtml = `
            <div style="display:flex; flex-direction:column; gap:12px; max-height: 350px; overflow-y: auto; padding: 10px 5px;">
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
            <div style="display:flex; flex-direction:column; gap:10px; max-height: 200px; overflow-y: auto; margin-bottom: 15px; padding: 5px;">
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

        // Assemble HTML into detailBody
        els.detailBody.innerHTML = `
          ${tabsNav}
          ${tabProfile}
          ${tabTimeline}
          ${tabNotes}
          ${tabTags}
          ${tabResumes}
        `;

        // Tab Switching Event Listeners
        els.detailBody.querySelectorAll('.tab-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            currentTab = btn.dataset.tab;
            
            els.detailBody.querySelectorAll('.tab-btn').forEach(b => {
              b.classList.remove('active');
              b.classList.add('btn-outline');
            });
            btn.classList.add('active');
            btn.classList.remove('btn-outline');

            els.detailBody.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            els.detailBody.querySelector(`#${currentTab}`).style.display = 'block';
          });
        });

        // Add tag listener
        const submitTagBtn = els.detailBody.querySelector('#submitTagBtn');
        if (submitTagBtn) {
          submitTagBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const val = els.detailBody.querySelector('#newTagInput').value.trim();
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
        els.detailBody.querySelectorAll('[data-action="remove-tag"]').forEach(btn => {
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
        const submitNoteBtn = els.detailBody.querySelector('#submitNoteBtn');
        if (submitNoteBtn) {
          submitNoteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const val = els.detailBody.querySelector('#newNoteText').value.trim();
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
        els.detailBody.querySelectorAll('[data-action="delete-note"]').forEach(btn => {
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
        els.detailBody.innerHTML = `<div class="small-muted">Failed to load candidate details: ${escapeHtml(err.message)}</div>`;
      }
    }

    await loadAndRender();
  }

  async function removeFromPool(id) {
    if (!confirm('Remove this candidate from the pool?')) return;
    try {
      await window.CRM_API.request(`/api/pool/reassign/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ job_id: '' })
      });
      await loadPool();
    } catch (err) {
      alert(err.message || 'Failed to remove from pool');
    }
  }

  async function loadProfile() {
    const res = await window.CRM_API.request('/api/auth/profile');
    userProfile = res.data.user;
    els.userName.textContent = userProfile.full_name;
    els.userRole.textContent = userProfile.role;
    els.topRole.textContent = userProfile.role;
  }

  async function loadJobs() {
    const res = await window.CRM_API.request('/api/jobs');
    jobs = res.data.jobs || [];

    els.prevJobId.querySelectorAll('option:not(:first-child)').forEach((o) => o.remove());
    els.jobSelect.querySelectorAll('option:not(:first-child)').forEach((o) => o.remove());

    jobs.forEach((j) => {
      const label = `${j.job_title} - ${j.hospital_name} - ${j.location}`;

      const opt1 = document.createElement('option');
      opt1.value = String(j.id);
      opt1.textContent = label;
      els.prevJobId.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = String(j.id);
      opt2.textContent = label;
      els.jobSelect.appendChild(opt2);
    });
  }

  function getQueryParams() {
    const qp = new URLSearchParams();
    const search = String(els.search.value || '').trim();
    const skills = String(els.skills.value || '').trim();
    const minExperience = String(els.minExperience.value || '').trim();
    const location = String(els.location.value || '').trim();
    const prevJobId = String(els.prevJobId.value || '').trim();

    if (search) qp.set('search', search);
    if (skills) qp.set('skills', skills);
    if (minExperience) qp.set('minExperience', minExperience);
    if (location) qp.set('location', location);
    if (prevJobId) qp.set('prevJobId', prevJobId);

    return qp.toString();
  }

  function renderTable() {
    if (!candidates.length) {
      els.tableBody.innerHTML = '<tr><td colspan="6" class="small-muted">No pool candidates found.</td></tr>';
      els.poolCount.textContent = 'Pool: 0';
      return;
    }

    els.poolCount.textContent = `Pool: ${candidates.length}`;

    els.tableBody.innerHTML = candidates.map((c) => {
      const prevJob = c.job_title ? `${c.job_title} - ${c.hospital_name || '-'}` : '-';
      const skills = String(c.skills || '').split(',').slice(0, 4).join(', ');

      const actions = [
        `<button class="btn btn-outline btn-sm" data-action="view" data-id="${c.id}">View</button>`,
        `<button class="btn btn-primary btn-sm" data-action="reassign" data-id="${c.id}">Reassign</button>`,
        `<button class="btn btn-danger btn-sm" data-action="remove" data-id="${c.id}">Remove</button>`
      ].join(' ');

      return `
        <tr>
          <td>
            <div style="font-weight:900;"><a href="./candidate-profile.html?id=${c.id}" style="color: var(--primary); text-decoration: underline;">${escapeHtml(c.full_name)}</a></div>
            <div class="small-muted">${escapeHtml(c.phone)} - ${escapeHtml(c.email)}</div>
          </td>
          <td>${escapeHtml(c.total_experience)} yrs</td>
          <td>${escapeHtml(c.preferred_location || '-')}</td>
          <td>${escapeHtml(prevJob)}</td>
          <td class="small-muted">${escapeHtml(skills || '-')}</td>
          <td><div class="row-actions">${actions}</div></td>
        </tr>
      `;
    }).join('');
  }

  async function loadPool() {
    const qs = getQueryParams();
    const url = qs ? `/api/pool?${qs}` : '/api/pool';

    const res = await window.CRM_API.request(url);
    candidates = res.data.candidates || [];
    renderTable();
  }

  async function reassignCandidate() {
    clearAlert();
    if (!editingId) return;

    const jobId = els.jobSelect.value ? Number(els.jobSelect.value) : null;
    if (jobId != null && (!Number.isInteger(jobId) || jobId <= 0)) {
      showAlert('Invalid job');
      return;
    }

    await window.CRM_API.request(`/api/pool/reassign/${editingId}`, {
      method: 'PATCH',
      body: JSON.stringify({ job_id: jobId == null ? '' : jobId })
    });

    closeModal();
    await loadPool();
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
    els.refreshBtn.addEventListener('click', loadPool);

    els.search.addEventListener('input', debounce(loadPool, 250));
    els.skills.addEventListener('input', debounce(loadPool, 250));
    els.minExperience.addEventListener('input', debounce(loadPool, 250));
    els.location.addEventListener('input', debounce(loadPool, 250));
    els.prevJobId.addEventListener('change', loadPool);

    els.tableBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = Number(btn.dataset.id);
      const c = candidates.find((x) => Number(x.id) === id);

      try {
        if (action === 'view') { window.location.href = `./candidate-profile.html?id=${id}`; return; }
        if (action === 'reassign') return openModal(id, c ? c.full_name : '');
        if (action === 'remove') return await removeFromPool(id);
      } catch (err) {
        alert(err.message || 'Action failed');
      }
    });

    els.closeModalBtn.addEventListener('click', closeModal);
    els.cancelBtn.addEventListener('click', closeModal);
    els.modalOverlay.addEventListener('click', (e) => {
      if (e.target === els.modalOverlay) closeModal();
    });

    els.saveBtn.addEventListener('click', async () => {
      try {
        await reassignCandidate();
      } catch (err) {
        showAlert(err.message || 'Failed to reassign');
      }
    });

    // Detail modal
    els.closeDetailBtn.addEventListener('click', closeDetailModal);
    els.detailOkBtn.addEventListener('click', closeDetailModal);
    els.detailModalOverlay.addEventListener('click', (e) => {
      if (e.target === els.detailModalOverlay) closeDetailModal();
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
      await loadPoolData();
    } catch (err) {
      console.warn('[Pool] init warning:', err.message);
      if (err.status === 401) {
        window.CRM_API.clearToken();
        window.location.href = './login.html';
      }
    }
  }

  init();
})();
