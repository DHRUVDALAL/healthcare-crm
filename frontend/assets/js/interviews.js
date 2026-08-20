(function () {
  'use strict';

  window.CRM_AUTH.requireAuth();

  const els = {
    userName: document.getElementById('userName'),
    userRole: document.getElementById('userRole'),
    topRole: document.getElementById('topRole'),

    filterStatus: document.getElementById('filterStatus'),
    filterResult: document.getElementById('filterResult'),
    filterSearch: document.getElementById('filterSearch'),
    refreshBtn: document.getElementById('refreshBtn'),
    scheduleBtn: document.getElementById('scheduleBtn'),
    statusBadge: document.getElementById('statusBadge'),
    tableBody: document.getElementById('tableBody'),

    interviewModalOverlay: document.getElementById('interviewModalOverlay'),
    closeInterviewBtn: document.getElementById('closeInterviewBtn'),
    cancelInterviewBtn: document.getElementById('cancelInterviewBtn'),
    interviewForm: document.getElementById('interviewForm'),
    interviewModalTitle: document.getElementById('interviewModalTitle'),
    
    intId: document.getElementById('interviewId'),
    intAppId: document.getElementById('intApplicantId'),
    intJobId: document.getElementById('intJobId'),
    intHospId: document.getElementById('intHospitalId'),
    intDate: document.getElementById('intDate'),
    intTime: document.getElementById('intTime'),
    intMode: document.getElementById('intMode'),
    intRound: document.getElementById('intRound'),
    intInterviewer: document.getElementById('intInterviewer'),
    intLocation: document.getElementById('intLocation'),

    resultModalOverlay: document.getElementById('resultModalOverlay'),
    closeResultBtn: document.getElementById('closeResultBtn'),
    cancelResultBtn: document.getElementById('cancelResultBtn'),
    resultForm: document.getElementById('resultForm'),
    resultId: document.getElementById('resultInterviewId'),
    resultSelect: document.getElementById('resultSelect'),
    resultFeedback: document.getElementById('resultFeedback'),

    logoutBtn: document.getElementById('logoutBtn')
  };

  let interviews = [];

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
    const u = res.data.user;
    els.userName.textContent = u.full_name;
    els.userRole.textContent = u.role;
    els.topRole.textContent = u.role;
  }

  function formatStatus(status) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  async function loadInterviews() {
    try {
      setStatus('Loading...', 'warn');
      const status = els.filterStatus.value;
      const result = els.filterResult.value;
      const search = els.filterSearch.value;
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (result) params.append('result', result);
      if (search) params.append('search', search);

      const res = await window.CRM_API.request(`/api/interviews?${params.toString()}`);
      interviews = res.data.interviews || [];
      renderTable();
      setStatus(`Loaded ${interviews.length} items`, 'ok');
    } catch (err) {
      setStatus('Failed to load', 'warn');
      alert(err.message || 'Failed to load interviews');
    }
  }

  function renderTable() {
    if (!interviews.length) {
      els.tableBody.innerHTML = '<tr><td colspan="6" class="small-muted">No interviews found.</td></tr>';
      return;
    }

    els.tableBody.innerHTML = interviews.map((inv) => {
      let resultClass = '';
      if (inv.result === 'selected') resultClass = 'status green';
      else if (inv.result === 'rejected') resultClass = 'status red';
      else if (inv.result === 'hold') resultClass = 'status amber';
      else resultClass = 'status blue';

      const actions = [
        inv.status !== 'cancelled' ? `<button class="btn btn-outline btn-sm" data-action="edit" data-id="${inv.id}">Edit</button>` : '',
        inv.status !== 'cancelled' ? `<button class="btn btn-outline btn-sm" data-action="result" data-id="${inv.id}">Feedback</button>` : '',
        inv.status !== 'cancelled' ? `<button class="btn btn-outline btn-sm" data-action="cancel" data-id="${inv.id}" style="color:var(--danger); border-color:var(--danger)">Cancel</button>` : ''
      ].filter(Boolean).join(' ');

      const dateTime = `${inv.interview_date} ${inv.interview_time}`;

      return `
        <tr>
          <td>
            <div style="font-weight:900;">${escapeHtml(inv.applicant_name)}</div>
            <div class="small-muted">ID: ${inv.applicant_id}</div>
          </td>
          <td>
            <div style="font-weight:600;">${escapeHtml(inv.job_title)}</div>
            <div class="small-muted">${escapeHtml(inv.hospital_name)}</div>
          </td>
          <td>
            <div style="font-weight:600;">${escapeHtml(dateTime)}</div>
            <div class="small-muted">Round ${inv.interview_round}</div>
          </td>
          <td>
            <div>${formatStatus(inv.interview_mode)}</div>
            <div class="small-muted">${escapeHtml(inv.meeting_details || '-')}</div>
          </td>
          <td>
            <div>Status: <b>${formatStatus(inv.status)}</b></div>
            <div>Result: <span class="${resultClass}">${formatStatus(inv.result)}</span></div>
          </td>
          <td><div class="row-actions">${actions}</div></td>
        </tr>
      `;
    }).join('');
  }

  function openInterviewModal(inv = null) {
    els.interviewForm.reset();
    if (inv) {
      els.interviewModalTitle.textContent = 'Edit Interview';
      els.intId.value = inv.id;
      els.intAppId.value = inv.applicant_id;
      els.intJobId.value = inv.job_id;
      els.intHospId.value = inv.hospital_id;
      els.intDate.value = inv.interview_date;
      els.intTime.value = inv.interview_time;
      els.intMode.value = inv.interview_mode;
      els.intRound.value = inv.interview_round;
      els.intInterviewer.value = inv.interviewer_name || '';
      els.intLocation.value = inv.meeting_details || '';
      // Disable ID fields if editing
      els.intAppId.disabled = true;
      els.intJobId.disabled = true;
      els.intHospId.disabled = true;
    } else {
      els.interviewModalTitle.textContent = 'Schedule Interview';
      els.intId.value = '';
      els.intAppId.disabled = false;
      els.intJobId.disabled = false;
      els.intHospId.disabled = false;
    }
    els.interviewModalOverlay.classList.add('show');
    els.interviewModalOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeInterviewModal() {
    els.interviewModalOverlay.classList.remove('show');
    els.interviewModalOverlay.setAttribute('aria-hidden', 'true');
  }

  function openResultModal(inv) {
    els.resultId.value = inv.id;
    els.resultSelect.value = inv.result || 'pending';
    els.resultFeedback.value = inv.feedback || '';
    els.resultModalOverlay.classList.add('show');
    els.resultModalOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeResultModal() {
    els.resultModalOverlay.classList.remove('show');
    els.resultModalOverlay.setAttribute('aria-hidden', 'true');
  }

  function bindEvents() {
    els.refreshBtn.addEventListener('click', loadInterviews);
    els.scheduleBtn.addEventListener('click', () => openInterviewModal());
    els.filterStatus.addEventListener('change', loadInterviews);
    els.filterResult.addEventListener('change', loadInterviews);
    
    let timer;
    els.filterSearch.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(loadInterviews, 300);
    });

    els.tableBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = Number(btn.dataset.id);
      const inv = interviews.find(i => i.id === id);
      if (!inv) return;
      
      if (action === 'edit') {
        openInterviewModal(inv);
      } else if (action === 'result') {
        openResultModal(inv);
      } else if (action === 'cancel') {
        if (!confirm('Are you sure you want to cancel this interview?')) return;
        try {
          setStatus('Cancelling...', 'warn');
          await window.CRM_API.request(`/api/interviews/${id}`, { method: 'DELETE' });
          await loadInterviews();
        } catch (err) {
          setStatus('Failed to cancel', 'warn');
          alert(err.message || 'Failed to cancel');
        }
      }
    });

    els.closeInterviewBtn.addEventListener('click', closeInterviewModal);
    els.cancelInterviewBtn.addEventListener('click', closeInterviewModal);
    els.interviewModalOverlay.addEventListener('click', (e) => {
      if (e.target === els.interviewModalOverlay) closeInterviewModal();
    });

    els.interviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = els.intId.value;
      const payload = {
        applicant_id: Number(els.intAppId.value),
        job_id: Number(els.intJobId.value),
        hospital_id: Number(els.intHospId.value),
        interview_date: els.intDate.value,
        interview_time: els.intTime.value,
        interview_mode: els.intMode.value,
        interview_round: Number(els.intRound.value),
        interviewer_name: els.intInterviewer.value,
        meeting_details: els.intLocation.value
      };

      try {
        setStatus('Saving...', 'warn');
        if (id) {
          await window.CRM_API.request(`/api/interviews/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
          });
        } else {
          await window.CRM_API.request('/api/interviews', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
        }
        closeInterviewModal();
        await loadInterviews();
      } catch (err) {
        setStatus('Save failed', 'warn');
        alert(err.message || 'Failed to save interview');
      }
    });

    els.closeResultBtn.addEventListener('click', closeResultModal);
    els.cancelResultBtn.addEventListener('click', closeResultModal);
    els.resultModalOverlay.addEventListener('click', (e) => {
      if (e.target === els.resultModalOverlay) closeResultModal();
    });

    els.resultForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = els.resultId.value;
      const resultVal = els.resultSelect.value;
      const feedbackVal = els.resultFeedback.value;

      try {
        setStatus('Saving feedback...', 'warn');
        
        if (feedbackVal) {
          await window.CRM_API.request(`/api/interviews/feedback/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ feedback: feedbackVal })
          });
        }
        
        await window.CRM_API.request(`/api/interviews/result/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ result: resultVal })
        });
        
        closeResultModal();
        await loadInterviews();
      } catch (err) {
        setStatus('Update failed', 'warn');
        alert(err.message || 'Failed to update result');
      }
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
      await loadInterviews();
    } catch (err) {
      console.warn('[Interviews] init warning:', err.message);
      if (err.status === 401) {
        window.CRM_API.clearToken();
        window.location.href = './login.html';
      }
    }
  }

  init();
})();
