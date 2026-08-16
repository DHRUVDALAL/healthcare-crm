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
    statusBadge: document.getElementById('statusBadge'),
    tableBody: document.getElementById('tableBody'),

    detailModalOverlay: document.getElementById('detailModalOverlay'),
    closeDetailBtn: document.getElementById('closeDetailBtn'),
    detailOkBtn: document.getElementById('detailOkBtn'),
    detailTitle: document.getElementById('detailTitle'),
    detailSubtitle: document.getElementById('detailSubtitle'),
    detailBody: document.getElementById('detailBody'),

    statusModalOverlay: document.getElementById('statusModalOverlay'),
    closeStatusBtn: document.getElementById('closeStatusBtn'),
    cancelStatusBtn: document.getElementById('cancelStatusBtn'),
    statusForm: document.getElementById('statusForm'),
    statusRefId: document.getElementById('statusRefId'),
    statusSelect: document.getElementById('statusSelect'),

    logoutBtn: document.getElementById('logoutBtn')
  };

  let referrers = [];
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

  function formatStage(stage) {
    if (!stage) return '-';
    return stage.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  async function loadProfile() {
    const res = await window.CRM_API.request('/api/auth/profile');
    userProfile = res.data.user;
    els.userName.textContent = userProfile.full_name;
    els.userRole.textContent = userProfile.role;
    els.topRole.textContent = userProfile.role;
  }

  async function loadReferrals() {
    try {
      setStatus('Loading...', 'warn');
      const milestoneStatus = els.filterStatus.value;
      const search = els.filterSearch.value;
      const params = new URLSearchParams();
      if (milestoneStatus) params.append('milestoneStatus', milestoneStatus);
      if (search) params.append('search', search);

      const res = await window.CRM_API.request(`/api/referrals/grouped?${params.toString()}`);
      referrers = res.data.referrers || [];
      renderTable();
      setStatus(`Loaded ${referrers.length} referrers`, 'ok');
    } catch (err) {
      setStatus('Failed to load', 'warn');
      alert(err.message || 'Failed to load referrals');
    }
  }

  function getMilestoneStatusBadge(status) {
    switch (status) {
      case 'rewarded':
        return '<span class="status green">Rewarded</span>';
      case 'milestone_reached':
        return '<span class="status blue">Milestone Reached</span>';
      default:
        return '<span class="status amber">No Milestone</span>';
    }
  }

  function renderTable() {
    if (!referrers.length) {
      els.tableBody.innerHTML = '<tr><td colspan="7" class="small-muted">No referrals found.</td></tr>';
      return;
    }

    els.tableBody.innerHTML = referrers.map((ref) => {
      const progressPct = Math.round((ref.progress || 0) * 100);
      const progressBar = ref.next_milestone
        ? `<div style="background: var(--border); border-radius: 4px; height: 6px; width: 80px; margin-top: 4px;">
            <div style="background: var(--primary); border-radius: 4px; height: 6px; width: ${Math.min(progressPct, 100)}%;"></div>
           </div>
           <div class="small-muted" style="font-size: 11px;">${ref.successful_count} / ${ref.next_milestone}</div>`
        : '<div class="small-muted" style="font-size: 11px;">All reached</div>';

      return `
        <tr>
          <td>
            <div style="font-weight:900;">${escapeHtml(ref.referrer_name)}</div>
            <div class="small-muted">${escapeHtml(ref.referrer_contact || 'No contact')}</div>
          </td>
          <td>
            <div style="font-weight:900; font-size: 16px;">${ref.successful_count}</div>
            <div class="small-muted">${ref.total_referred} total referred</div>
          </td>
          <td>
            <div style="font-weight:700;">${ref.current_milestone ? ref.current_milestone_label : '-'}</div>
          </td>
          <td>
            <div style="font-weight:600;">${ref.next_milestone_label}</div>
            ${progressBar}
          </td>
          <td>
            <div style="font-weight:900;">${ref.current_reward ? '₹ ' + formatMoneyINR(ref.current_reward) : '-'}</div>
          </td>
          <td>${getMilestoneStatusBadge(ref.milestone_status)}</td>
          <td>
            <div class="row-actions">
              <button class="btn btn-outline btn-sm" data-action="view-detail" data-name="${escapeHtml(ref.referrer_name)}" data-contact="${escapeHtml(ref.referrer_contact || '')}">View Details</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
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

  async function viewReferrerDetail(referrerName, referrerContact) {
    try {
      els.detailBody.innerHTML = '<div class="small-muted">Loading referrer details...</div>';
      openDetailModal();

      const params = new URLSearchParams();
      params.append('referrer_name', referrerName);
      if (referrerContact) params.append('referrer_contact', referrerContact);

      const res = await window.CRM_API.request(`/api/referrals/referrer-detail?${params.toString()}`);
      const data = res.data;
      const ms = data.milestone;

      els.detailTitle.textContent = data.referrer_name;
      els.detailSubtitle.textContent = data.referrer_contact || 'No contact info';

      // Summary section
      const progressPct = Math.round((ms.progress || 0) * 100);
      let summaryHtml = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px;">
          <div class="card" style="padding: 12px; text-align: center;">
            <div class="small-muted">Total Referred</div>
            <div style="font-weight:900; font-size: 22px; margin-top: 4px;">${data.total_referred}</div>
          </div>
          <div class="card" style="padding: 12px; text-align: center;">
            <div class="small-muted">Successful (Selected)</div>
            <div style="font-weight:900; font-size: 22px; margin-top: 4px; color: var(--success, #22c55e);">${data.successful_count}</div>
          </div>
          <div class="card" style="padding: 12px; text-align: center;">
            <div class="small-muted">Current Milestone</div>
            <div style="font-weight:900; font-size: 16px; margin-top: 4px;">${ms.currentMilestoneLabel}</div>
          </div>
          <div class="card" style="padding: 12px; text-align: center;">
            <div class="small-muted">Current Reward</div>
            <div style="font-weight:900; font-size: 16px; margin-top: 4px;">${ms.currentReward ? '₹ ' + formatMoneyINR(ms.currentReward) : '-'}</div>
          </div>
        </div>
      `;

      // Progress towards next milestone
      if (ms.nextMilestone) {
        summaryHtml += `
          <div style="margin-bottom: 16px;">
            <div class="small-muted" style="margin-bottom: 4px;">Progress to Next Milestone: ${ms.nextMilestoneLabel} (₹ ${formatMoneyINR(ms.nextReward)})</div>
            <div style="background: var(--border); border-radius: 6px; height: 10px; width: 100%;">
              <div style="background: var(--primary); border-radius: 6px; height: 10px; width: ${Math.min(progressPct, 100)}%;"></div>
            </div>
            <div class="small-muted" style="margin-top: 2px;">${ms.successCount} / ${ms.nextMilestone} (${progressPct}%)</div>
          </div>
        `;
      } else {
        summaryHtml += `<div class="small-muted" style="margin-bottom: 16px;">🎉 All milestones reached!</div>`;
      }

      // Candidates table
      let candidatesHtml = '';
      if (data.candidates && data.candidates.length > 0) {
        const isAdmin = userProfile?.role === 'admin';
        candidatesHtml = `
          <div style="font-weight:700; margin-bottom: 8px;">Referred Candidates</div>
          <div style="overflow: auto;">
          <table class="table" style="font-size: 13px;">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Job</th>
                <th>Hospital</th>
                <th>Pipeline Stage</th>
                <th>Reward Status</th>
                <th>Successful</th>
                ${isAdmin ? '<th style="width: 180px;">Actions</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${data.candidates.map((c) => {
                const isSuccess = c.reward_status === 'eligible' || c.reward_status === 'rewarded';
                let stageClass = '';
                if (c.current_stage === 'selected') stageClass = 'status green';
                else if (c.current_stage === 'rejected') stageClass = 'status red';
                else stageClass = 'status blue';

                let rewardClass = '';
                if (c.reward_status === 'rewarded') rewardClass = 'status green';
                else if (c.reward_status === 'eligible') rewardClass = 'status blue';
                else rewardClass = 'status amber';

                let actionsHTML = '';
                if (isAdmin) {
                  actionsHTML = `
                    <button class="btn btn-outline btn-sm" data-action="update-candidate-status" data-id="${c.referral_id}" data-status="${c.reward_status}">Update</button>
                    ${c.reward_status === 'eligible' ? ` <button class="btn btn-primary btn-sm" data-action="mark-candidate-paid" data-id="${c.referral_id}">Mark Paid</button>` : ''}
                  `;
                }

                return `
                  <tr>
                    <td>
                      <div style="font-weight:700;">${escapeHtml(c.applicant_name)}</div>
                      <div class="small-muted">${escapeHtml(c.applicant_email || '')}</div>
                    </td>
                    <td>${escapeHtml(c.job_title || '-')}</td>
                    <td>${escapeHtml(c.hospital_name || '-')}</td>
                    <td>${c.current_stage ? `<span class="${stageClass}">${formatStage(c.current_stage)}</span>` : '-'}</td>
                    <td><span class="${rewardClass}">${(c.reward_status || 'pending').toUpperCase()}</span></td>
                    <td>${isSuccess ? '<span class="status green">✓ Yes</span>' : '<span class="small-muted">No</span>'}</td>
                    ${isAdmin ? `<td><div class="row-actions">${actionsHTML}</div></td>` : ''}
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          </div>
        `;
      } else {
        candidatesHtml = '<div class="small-muted">No referred candidates found.</div>';
      }

      els.detailBody.innerHTML = summaryHtml + candidatesHtml;
    } catch (err) {
      els.detailBody.innerHTML = '<div class="small-muted">Failed to load referrer details.</div>';
    }
  }

  function openStatusModal(id, currentStatus) {
    els.statusRefId.value = id;
    els.statusSelect.value = currentStatus;
    els.statusModalOverlay.classList.add('show');
    els.statusModalOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeStatusModal() {
    els.statusModalOverlay.classList.remove('show');
    els.statusModalOverlay.setAttribute('aria-hidden', 'true');
  }

  function bindEvents() {
    els.refreshBtn.addEventListener('click', loadReferrals);
    els.filterStatus.addEventListener('change', loadReferrals);
    
    let timer;
    els.filterSearch.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(loadReferrals, 300);
    });

    els.tableBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      
      if (action === 'view-detail') {
        const name = btn.dataset.name;
        const contact = btn.dataset.contact || '';
        await viewReferrerDetail(name, contact);
      }
    });

    // Detail modal close
    els.closeDetailBtn.addEventListener('click', closeDetailModal);
    els.detailOkBtn.addEventListener('click', closeDetailModal);
    els.detailModalOverlay.addEventListener('click', (e) => {
      if (e.target === els.detailModalOverlay) closeDetailModal();
    });

    // detail candidate list actions
    els.detailBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'update-candidate-status') {
        openStatusModal(id, btn.dataset.status);
      } else if (action === 'mark-candidate-paid') {
        if (!confirm('Mark this referral reward as paid?')) return;
        try {
          setStatus('Marking paid...', 'warn');
          await window.CRM_API.request(`/api/referrals/reward-paid/${id}`, { method: 'PATCH' });
          setStatus('Marked as paid', 'ok');
          
          const name = els.detailTitle.textContent;
          const contact = els.detailSubtitle.textContent === 'No contact info' ? '' : els.detailSubtitle.textContent;
          await viewReferrerDetail(name, contact);
          await loadReferrals();
        } catch (err) {
          setStatus('Failed', 'warn');
          alert(err.message || 'Failed to mark as paid');
        }
      }
    });

    // Update Status Modal events
    els.closeStatusBtn.addEventListener('click', closeStatusModal);
    els.cancelStatusBtn.addEventListener('click', closeStatusModal);
    els.statusModalOverlay.addEventListener('click', (e) => {
      if (e.target === els.statusModalOverlay) closeStatusModal();
    });

    els.statusForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = els.statusRefId.value;
      const status = els.statusSelect.value;

      try {
        setStatus('Updating...', 'warn');
        await window.CRM_API.request(`/api/referrals/status/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status })
        });
        closeStatusModal();
        
        const name = els.detailTitle.textContent;
        const contact = els.detailSubtitle.textContent === 'No contact info' ? '' : els.detailSubtitle.textContent;
        await viewReferrerDetail(name, contact);
        await loadReferrals();
      } catch (err) {
        setStatus('Update failed', 'warn');
        alert(err.message || 'Failed to update referral status');
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
      await loadReferrals();
    } catch (err) {
      window.CRM_API.clearToken();
      window.location.href = './login.html';
    }
  }

  init();
})();
