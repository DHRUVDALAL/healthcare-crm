(function () {
  'use strict';

  window.CRM_AUTH.requireAuth();

  const urlParams = new URLSearchParams(window.location.search);
  const applicantId = urlParams.get('id');

  if (!applicantId) {
    alert('Candidate ID is required');
    window.location.href = './applicants.html';
    return;
  }

  const els = {
    userName: document.getElementById('userName'),
    userRole: document.getElementById('userRole'),
    userNameInitials: document.getElementById('userNameInitials'),
    logoutBtn: document.getElementById('logoutBtn'),
    navAssignment: document.getElementById('nav-assignment'),

    candidateName: document.getElementById('candidateName'),
    candidateDesignation: document.getElementById('candidateDesignation'),
    avatarName: document.getElementById('avatarName'),
    statusPillContainer: document.getElementById('statusPillContainer'),

    metaPriority: document.getElementById('metaPriority'),
    metaRecruiter: document.getElementById('metaRecruiter'),
    metaNotice: document.getElementById('metaNotice'),
    metaExperience: document.getElementById('metaExperience'),

    infoEmail: document.getElementById('infoEmail'),
    infoPhone: document.getElementById('infoPhone'),
    infoDob: document.getElementById('infoDob'),
    infoGender: document.getElementById('infoGender'),
    infoLocation: document.getElementById('infoLocation'),
    infoQual: document.getElementById('infoQual'),
    infoCurrentSalary: document.getElementById('infoCurrentSalary'),
    infoExpectedSalary: document.getElementById('infoExpectedSalary'),
    infoCompany: document.getElementById('infoCompany'),
    infoHospital: document.getElementById('infoHospital'),
    infoSkills: document.getElementById('infoSkills'),

    btnViewResume: document.getElementById('btnViewResume'),
    btnDownloadResume: document.getElementById('btnDownloadResume'),
    btnViewMasked: document.getElementById('btnViewMasked'),

    docList: document.getElementById('docList'),
    docUploadForm: document.getElementById('docUploadForm'),

    timelineLog: document.getElementById('timelineLog'),

    referralEmpty: document.getElementById('referralEmpty'),
    referralContainer: document.getElementById('referralContainer'),
    refName: document.getElementById('refName'),
    refContact: document.getElementById('refContact'),
    refRewardAmount: document.getElementById('refRewardAmount'),
    refStatus: document.getElementById('refStatus'),
    adminRewardPnl: document.getElementById('adminRewardPnl'),
    btnApproveReferral: document.getElementById('btnApproveReferral'),
    btnPayReferral: document.getElementById('btnPayReferral'),

    notesContainer: document.getElementById('notesContainer'),
    noteForm: document.getElementById('noteForm'),
    noteContent: document.getElementById('noteContent')
  };

  let userProfile = null;
  let applicant = null;
  let linkedReferral = null;

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] || m));
  }

  function getStatusBadge(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'selected' || s === 'joined') return '<span class="status green">Selected</span>';
    if (s === 'hold' || s === 'active') return '<span class="status blue">Active</span>';
    if (s === 'rejected') return '<span class="status red">Rejected</span>';
    if (s === 'pool') return '<span class="status amber">Pool</span>';
    return `<span class="status">${escapeHtml(status)}</span>`;
  }

  async function loadProfile() {
    const res = await window.CRM_API.request('/api/auth/profile');
    userProfile = res.data.user;
    els.userName.textContent = userProfile.full_name;
    els.userRole.textContent = userProfile.role;
    if (els.userNameInitials) {
      els.userNameInitials.textContent = userProfile.full_name.charAt(0).toUpperCase();
    }

    if (userProfile.role === 'admin') {
      els.navAssignment.style.display = 'block';
      els.adminRewardPnl.style.display = 'block';
    } else {
      els.adminRewardPnl.style.display = 'none';
    }
  }

  async function loadApplicantDetails() {
    try {
      const res = await window.CRM_API.request(`/api/applicants/${applicantId}`);
      applicant = res.data.applicant;

      els.candidateName.textContent = applicant.full_name;
      els.candidateDesignation.textContent = applicant.current_designation || 'No Designation';
      els.avatarName.textContent = applicant.full_name.charAt(0).toUpperCase();
      els.statusPillContainer.innerHTML = getStatusBadge(applicant.candidate_status);

      els.metaPriority.textContent = String(applicant.priority || 'medium').toUpperCase();
      els.metaRecruiter.textContent = applicant.assigned_recruiter_name || 'Unassigned';
      els.metaNotice.textContent = applicant.notice_period || 'Immediate';
      els.metaExperience.textContent = (applicant.total_experience || 0) + ' years';

      els.infoEmail.textContent = applicant.email;
      els.infoPhone.textContent = applicant.phone;
      els.infoDob.textContent = String(applicant.dob || '').slice(0, 10);
      els.infoGender.textContent = String(applicant.gender || '').toUpperCase();
      els.infoLocation.textContent = `${applicant.city || '-'}, ${applicant.state || '-'}`;
      els.infoQual.textContent = applicant.qualification || '-';
      els.infoCurrentSalary.textContent = applicant.current_salary ? `₹ ${applicant.current_salary.toLocaleString('en-IN')}` : '-';
      els.infoExpectedSalary.textContent = applicant.expected_salary ? `₹ ${applicant.expected_salary.toLocaleString('en-IN')}` : '-';
      els.infoCompany.textContent = applicant.current_company || '-';
      els.infoHospital.textContent = applicant.preferred_hospital_name || 'None Preferred';
      els.infoSkills.textContent = applicant.skills || '-';

      // Setup resume buttons
      els.btnViewResume.onclick = () => {
        window.open(window.CRM_API.getUrl(`/api/resume/view/${applicantId}`), '_blank');
      };
      els.btnDownloadResume.onclick = () => {
        window.open(window.CRM_API.getUrl(`/api/resume/download/${applicantId}`), '_blank');
      };

      if (applicant.masked_resume_path) {
        els.btnViewMasked.style.display = 'inline-flex';
        els.btnViewMasked.onclick = () => {
          window.open(window.CRM_API.getUrl(`/api/resume/view/${applicantId}?masked=true`), '_blank');
        };
      } else {
        els.btnViewMasked.style.display = 'none';
      }

      // Check referral details
      if (applicant.referred_by || applicant.source === 'referral') {
        els.referralEmpty.style.display = 'none';
        els.referralContainer.style.display = 'block';
        els.refName.textContent = applicant.referred_by || 'Unknown';
        els.refContact.textContent = applicant.referral_contact || 'None';
        els.refStatus.textContent = String(applicant.referral_reward_status || 'pending').toUpperCase();

        // Load referral reward record to find internal ID
        await loadReferralDetails();
      } else {
        els.referralEmpty.style.display = 'block';
        els.referralContainer.style.display = 'none';
      }
    } catch (err) {
      alert('Failed to load candidate details: ' + (err.message || err));
      window.location.href = './applicants.html';
    }
  }

  async function loadReferralDetails() {
    try {
      const res = await window.CRM_API.request('/api/referrals');
      const rewards = res.data.referrals || [];
      linkedReferral = rewards.find(r => Number(r.applicant_id) === Number(applicantId));

      if (linkedReferral) {
        els.refRewardAmount.textContent = `₹ ${Number(linkedReferral.reward_amount).toLocaleString('en-IN')}`;
        els.refStatus.textContent = String(linkedReferral.reward_status || 'pending').toUpperCase();
      }
    } catch (e) {
      console.error('Failed to load linked referral details', e);
    }
  }

  async function loadDocuments() {
    try {
      const res = await window.CRM_API.request(`/api/applicants/${applicantId}/documents`);
      const docs = res.data.documents || [];

      if (!docs.length) {
        els.docList.innerHTML = '<div class="small-muted">No documents uploaded.</div>';
        return;
      }

      els.docList.innerHTML = docs.map(doc => {
        const fileExt = doc.file_name.split('.').pop().toUpperCase();
        return `
          <div class="document-row">
            <div class="document-info">
              <div class="doc-icon">${fileExt}</div>
              <div>
                <div class="doc-title">${escapeHtml(doc.file_name)}</div>
                <div class="doc-meta">Uploaded by ${escapeHtml(doc.uploaded_by_name)} on ${new Date(doc.created_at).toLocaleDateString()}</div>
              </div>
            </div>
            <div>
              <a href="${window.CRM_API.getUrl(`/api/applicants/documents/${doc.id}/view`)}" target="_blank" class="btn btn-outline btn-sm" style="margin-right:8px;">View</a>
              <a href="${window.CRM_API.getUrl(`/api/applicants/documents/${doc.id}/download`)}" download class="btn btn-outline btn-sm" style="margin-right:8px;">Download</a>
              <button class="btn btn-danger btn-sm" data-action="delete-doc" data-id="${doc.id}">Delete</button>
            </div>
          </div>
        `;
      }).join('');

      // Attach delete events
      els.docList.querySelectorAll('button[data-action="delete-doc"]').forEach(btn => {
        btn.onclick = async () => {
          if (!confirm('Are you sure you want to delete this document?')) return;
          try {
            await window.CRM_API.request(`/api/applicants/documents/${btn.dataset.id}`, { method: 'DELETE' });
            loadDocuments();
          } catch (e) {
            alert('Failed to delete document: ' + e.message);
          }
        };
      });
    } catch (err) {
      console.error('Failed to load documents', err);
    }
  }

  async function loadTimeline() {
    try {
      const res = await window.CRM_API.request(`/api/applicants/${applicantId}/timeline`);
      const timeline = res.data.timeline || [];

      if (!timeline.length) {
        els.timelineLog.innerHTML = '<div class="small-muted">No activities logged yet.</div>';
        return;
      }

      els.timelineLog.innerHTML = timeline.map(item => {
        const label = item.stage ? `Changed Stage to: ${item.stage.toUpperCase()}` : item.title;
        const remarks = item.remarks ? `<div class="timeline-note">"${escapeHtml(item.remarks)}"</div>` : '';
        return `
          <div class="timeline-item">
            <div class="timeline-time">${new Date(item.event_time).toLocaleString()}</div>
            <div class="timeline-text">${escapeHtml(label)}</div>
            ${remarks}
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load timeline', err);
    }
  }

  async function loadNotes() {
    try {
      const res = await window.CRM_API.request(`/api/applicants/${applicantId}/notes`);
      const notes = res.data.notes || [];

      if (!notes.length) {
        els.notesContainer.innerHTML = '<div class="small-muted">No notes recorded yet.</div>';
        return;
      }

      els.notesContainer.innerHTML = notes.map(note => {
        return `
          <div class="card" style="padding:16px; margin-bottom:12px; position:relative;">
            <div style="font-weight:700; font-size:13px; color:var(--primary); margin-bottom:4px;">
              ${escapeHtml(note.created_by_name)} • ${new Date(note.created_at).toLocaleString()}
            </div>
            <div style="font-size:14px; font-weight:600; color:var(--text);">${escapeHtml(note.note_text)}</div>
            <button class="icon-btn" style="position:absolute; right:12px; top:12px;" data-action="delete-note" data-id="${note.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        `;
      }).join('');

      els.notesContainer.querySelectorAll('button[data-action="delete-note"]').forEach(btn => {
        btn.onclick = async () => {
          if (!confirm('Are you sure you want to delete this note?')) return;
          try {
            await window.CRM_API.request(`/api/applicants/notes/${btn.dataset.id}`, { method: 'DELETE' });
            loadNotes();
          } catch (e) {
            alert('Failed to delete note: ' + e.message);
          }
        };
      });
    } catch (err) {
      console.error('Failed to load notes', err);
    }
  }

  // --- Document Upload ---
  els.docUploadForm.onsubmit = async (e) => {
    e.preventDefault();
    const files = els.documents.files;
    if (!files.length) {
      alert('Please select at least one document');
      return;
    }

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('documents', files[i]);
    }

    try {
      await window.CRM_API.request(`/api/applicants/${applicantId}/documents`, {
        method: 'POST',
        body: formData,
        headers: {} // Let browser set boundary automatically
      });
      els.docUploadForm.reset();
      loadDocuments();
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
  };

  // --- Add Note ---
  els.noteForm.onsubmit = async (e) => {
    e.preventDefault();
    const note = els.noteContent.value.trim();
    if (!note) return;

    try {
      await window.CRM_API.request(`/api/applicants/${applicantId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ note })
      });
      els.noteContent.value = '';
      loadNotes();
      loadTimeline(); // Update activity log automatically
    } catch (err) {
      alert('Failed to save note: ' + err.message);
    }
  };

  // --- Approve / Pay Referrals ---
  els.btnApproveReferral.onclick = async () => {
    if (!linkedReferral) return alert('No linked referral reward details found');
    try {
      await window.CRM_API.request(`/api/referrals/status/${linkedReferral.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'eligible' })
      });
      await loadApplicantDetails();
    } catch (err) {
      alert('Failed to approve reward: ' + err.message);
    }
  };

  els.btnPayReferral.onclick = async () => {
    if (!linkedReferral) return alert('No linked referral reward details found');
    try {
      await window.CRM_API.request(`/api/referrals/reward-paid/${linkedReferral.id}`, {
        method: 'PATCH'
      });
      await loadApplicantDetails();
    } catch (err) {
      alert('Failed to pay reward: ' + err.message);
    }
  };

  // --- Setup tabs ---
  document.querySelectorAll('.profile-tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.profile-tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const tabId = btn.dataset.tab;
      document.getElementById(`tab-${tabId}`).classList.add('active');

      if (tabId === 'documents') loadDocuments();
      if (tabId === 'timeline') loadTimeline();
      if (tabId === 'notes') loadNotes();
    };
  });

  // --- Init page ---
  async function init() {
    await loadProfile();
    await loadApplicantDetails();
  }

  init();
})();
