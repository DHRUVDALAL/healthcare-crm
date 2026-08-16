(function () {
  'use strict';

  window.CRM_AUTH.requireAuth();

  const els = {
    userName: document.getElementById('userName'),
    userRole: document.getElementById('userRole'),
    topRole: document.getElementById('topRole'),

    filterStage: document.getElementById('filterStage'),
    filterSearch: document.getElementById('filterSearch'),
    refreshBtn: document.getElementById('refreshBtn'),
    statusBadge: document.getElementById('statusBadge'),
    tableBody: document.getElementById('tableBody'),

    statusModalOverlay: document.getElementById('statusModalOverlay'),
    closeStatusBtn: document.getElementById('closeStatusBtn'),
    cancelStatusBtn: document.getElementById('cancelStatusBtn'),
    statusForm: document.getElementById('statusForm'),
    statusAppId: document.getElementById('statusAppId'),
    statusNewStage: document.getElementById('statusNewStage'),
    statusNotes: document.getElementById('statusNotes'),

    historyModalOverlay: document.getElementById('historyModalOverlay'),
    closeHistoryBtn: document.getElementById('closeHistoryBtn'),
    historyOkBtn: document.getElementById('historyOkBtn'),
    historyTableBody: document.getElementById('historyTableBody'),

    logoutBtn: document.getElementById('logoutBtn')
  };

  let applications = [];

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

  function formatStage(stage) {
    return stage.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  function getNextActionLabel(stage) {
    const map = {
      applied: 'Review Candidate',
      screening: 'Screen Candidate / Shortlist',
      shortlisted: 'Send to Hospital',
      sent_to_hospital: 'Schedule Interview',
      interview_scheduled: 'Await Interview Completion',
      interview_completed: 'Review Interview Feedback',
      offer_released: 'Await Candidate Acceptance',
      selected: 'Confirm Joining Date / Process Billing',
      joined: 'Archiving Placement',
      rejected: 'No Action',
      moved_to_pool: 'Available for Reassignment',
      archived: 'Archived'
    };
    return map[stage] || '-';
  }

  async function loadPipeline() {
    try {
      setStatus('Loading...', 'warn');
      const stage = els.filterStage.value;
      const search = els.filterSearch.value;
      const params = new URLSearchParams();
      if (stage) params.append('stage', stage);
      if (search) params.append('search', search);

      const res = await window.CRM_API.request(`/api/pipeline?${params.toString()}`);
      applications = res.data.applications || [];
      renderTable();
      setStatus(`Loaded ${applications.length} items`, 'ok');
    } catch (err) {
      setStatus('Failed to load', 'warn');
      alert(err.message || 'Failed to load pipeline');
    }
  }

  function renderTable() {
    if (!applications.length) {
      els.tableBody.innerHTML = '<tr><td colspan="6" class="small-muted">No applications found in the pipeline.</td></tr>';
      return;
    }

    els.tableBody.innerHTML = applications.map((app) => {
      let stageClass = '';
      if (app.current_stage === 'selected') stageClass = 'status green';
      else if (app.current_stage === 'rejected') stageClass = 'status red';
      else if (app.current_stage === 'moved_to_pool') stageClass = 'status amber';
      else stageClass = 'status blue';

      const actions = [
        `<button class="btn btn-outline btn-sm" data-action="update-status" data-id="${app.id}" data-stage="${app.current_stage}">Update Stage</button>`,
        `<button class="btn btn-outline btn-sm" data-action="view-history" data-id="${app.id}">History</button>`
      ].join(' ');

      const updated = new Date(app.updated_at).toLocaleDateString();

      const nextAction = app.next_action || getNextActionLabel(app.current_stage);

      return `
        <tr>
          <td>
            <div style="font-weight:900;"><a href="./candidate-profile.html?id=${app.applicant_id}" style="color: var(--primary); text-decoration: underline;">${escapeHtml(app.applicant_name)}</a></div>
            <div class="small-muted">ID: ${app.applicant_id}</div>
          </td>
          <td>
            <div style="font-weight:600;">${escapeHtml(app.job_title)}</div>
            <div class="small-muted">${escapeHtml(app.hospital_name)}</div>
          </td>
          <td><span class="${stageClass}">${formatStage(app.current_stage)}</span></td>
          <td>${updated}</td>
          <td>${escapeHtml(nextAction)}</td>
          <td><div class="row-actions">${actions}</div></td>
        </tr>
      `;
    }).join('');
  }

  function openStatusModal(id, currentStage) {
    els.statusAppId.value = id;
    els.statusNewStage.value = currentStage;
    els.statusNotes.value = '';
    els.statusModalOverlay.classList.add('show');
    els.statusModalOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeStatusModal() {
    els.statusModalOverlay.classList.remove('show');
    els.statusModalOverlay.setAttribute('aria-hidden', 'true');
    els.statusForm.reset();
  }

  function openHistoryModal(html) {
    els.historyTableBody.innerHTML = html;
    els.historyModalOverlay.classList.add('show');
    els.historyModalOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeHistoryModal() {
    els.historyModalOverlay.classList.remove('show');
    els.historyModalOverlay.setAttribute('aria-hidden', 'true');
    els.historyTableBody.innerHTML = '';
  }

  async function loadHistory(id) {
    try {
      const res = await window.CRM_API.request(`/api/pipeline/history/${id}`);
      const hist = res.data.history || [];
      if (!hist.length) {
        openHistoryModal('<tr><td colspan="5" class="small-muted">No history found.</td></tr>');
        return;
      }
      const html = hist.map(h => {
        const date = new Date(h.changed_at).toLocaleString();
        return `
          <tr>
            <td>${formatStage(h.old_stage || 'N/A')}</td>
            <td>${formatStage(h.new_stage)}</td>
            <td>${escapeHtml(h.changed_by_name)}</td>
            <td>${date}</td>
            <td>${escapeHtml(h.notes || '-')}</td>
          </tr>
        `;
      }).join('');
      openHistoryModal(html);
    } catch (err) {
      alert(err.message || 'Failed to load history');
    }
  }

  function bindEvents() {
    els.refreshBtn.addEventListener('click', loadPipeline);
    els.filterStage.addEventListener('change', loadPipeline);
    
    let timer;
    els.filterSearch.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(loadPipeline, 300);
    });

    els.tableBody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;
      
      if (action === 'update-status') {
        openStatusModal(id, btn.dataset.stage);
      } else if (action === 'view-history') {
        loadHistory(id);
      }
    });

    els.closeStatusBtn.addEventListener('click', closeStatusModal);
    els.cancelStatusBtn.addEventListener('click', closeStatusModal);
    els.statusModalOverlay.addEventListener('click', (e) => {
      if (e.target === els.statusModalOverlay) closeStatusModal();
    });

    els.statusForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = els.statusAppId.value;
      const payload = {
        new_stage: els.statusNewStage.value,
        notes: els.statusNotes.value
      };

      try {
        setStatus('Updating...', 'warn');
        await window.CRM_API.request(`/api/pipeline/status/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        closeStatusModal();
        await loadPipeline();
      } catch (err) {
        setStatus('Update failed', 'warn');
        alert(err.message || 'Failed to update stage');
      }
    });

    els.closeHistoryBtn.addEventListener('click', closeHistoryModal);
    els.historyOkBtn.addEventListener('click', closeHistoryModal);
    els.historyModalOverlay.addEventListener('click', (e) => {
      if (e.target === els.historyModalOverlay) closeHistoryModal();
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
      await loadPipeline();
    } catch (err) {
      window.CRM_API.clearToken();
      window.location.href = './login.html';
    }
  }

  init();
})();
