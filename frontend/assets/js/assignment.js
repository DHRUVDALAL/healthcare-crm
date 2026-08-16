(function () {
  'use strict';

  window.CRM_AUTH.requireAuth();

  const els = {
    userName: document.getElementById('userName'),
    userRole: document.getElementById('userRole'),
    userNameInitials: document.getElementById('userNameInitials'),
    logoutBtn: document.getElementById('logoutBtn'),

    recruiterSelect: document.getElementById('recruiterSelect'),
    reasonInput: document.getElementById('reasonInput'),
    btnAssignBulk: document.getElementById('btnAssignBulk'),
    btnUnassignBulk: document.getElementById('btnUnassignBulk'),

    unassignedCount: document.getElementById('unassignedCount'),
    selectAllCheckbox: document.getElementById('selectAllCheckbox'),
    unassignedList: document.getElementById('unassignedList'),
    workloadTableBody: document.getElementById('workloadTableBody')
  };

  let userProfile = null;
  let unassignedCandidates = [];
  let workloads = [];

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] || m));
  }

  async function loadProfile() {
    const res = await window.CRM_API.request('/api/auth/profile');
    userProfile = res.data.user;
    els.userName.textContent = userProfile.full_name;
    els.userRole.textContent = userProfile.role;
    if (els.userNameInitials) {
      els.userNameInitials.textContent = userProfile.full_name.charAt(0).toUpperCase();
    }

    if (userProfile.role !== 'admin') {
      alert('Access Denied: Only administrators can access this planner.');
      window.location.href = './dashboard.html';
    }
  }

  async function fetchData() {
    try {
      // 1. Fetch unassigned candidates
      const candRes = await window.CRM_API.request('/api/applicants?assignment_status=Unassigned');
      unassignedCandidates = candRes.data.applicants || [];

      // 2. Fetch workloads
      const wlRes = await window.CRM_API.request('/api/employees/workload');
      workloads = wlRes.data.workloads || [];

      renderUnassignedList();
      renderWorkloads();
      populateRecruiterDropdown();
    } catch (err) {
      alert('Failed to load data: ' + err.message);
    }
  }

  function renderUnassignedList() {
    els.unassignedCount.textContent = `Unassigned Candidates (${unassignedCandidates.length})`;
    els.selectAllCheckbox.checked = false;

    if (!unassignedCandidates.length) {
      els.unassignedList.innerHTML = '<div class="small-muted">No unassigned candidates found.</div>';
      return;
    }

    els.unassignedList.innerHTML = unassignedCandidates.map(cand => {
      const skills = cand.skills ? `Skills: ${escapeHtml(cand.skills)}` : 'No skills listed';
      const exp = (cand.total_experience || 0) + ' yrs exp';
      const added = new Date(cand.created_at).toLocaleDateString();
      const priorityClass = String(cand.priority || 'medium').toLowerCase() === 'high' ? 'status red' : 'status';

      return `
        <div class="candidate-item">
          <input type="checkbox" class="candidate-checkbox" data-id="${cand.id}" style="margin-top: 4px;" />
          <div class="candidate-details">
            <a href="./candidate-profile.html?id=${cand.id}" class="candidate-name" target="_blank">${escapeHtml(cand.full_name)}</a>
            <span class="${priorityClass}" style="font-size:10px; padding: 2px 6px; margin-left: 8px;">${String(cand.priority || 'medium').toUpperCase()}</span>
            <div class="candidate-meta">${escapeHtml(cand.current_designation || 'No Designation')} • ${exp}</div>
            <div class="candidate-meta" style="font-size: 11px;">${skills}</div>
            <div class="candidate-meta" style="font-size: 11px; margin-top: 6px; display: flex; justify-content: space-between;">
              <span>Hospital: ${escapeHtml(cand.preferred_hospital_name || 'None Preferred')}</span>
              <span>Added: ${added}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach individual checkbox click listeners to update select-all status
    els.unassignedList.querySelectorAll('.candidate-checkbox').forEach(cb => {
      cb.onchange = () => {
        const checkedCount = els.unassignedList.querySelectorAll('.candidate-checkbox:checked').length;
        els.selectAllCheckbox.checked = checkedCount === unassignedCandidates.length;
      };
    });
  }

  function renderWorkloads() {
    if (!workloads.length) {
      els.workloadTableBody.innerHTML = '<tr><td colspan="8" class="small-muted">No workloads found.</td></tr>';
      return;
    }

    els.workloadTableBody.innerHTML = workloads.map(wl => {
      const loadColor = wl.workload_pct >= 90 ? 'var(--danger, #ef4444)' : (wl.workload_pct >= 50 ? 'var(--amber, #f59e0b)' : 'var(--primary)');
      const isLeave = wl.availability === 'On Leave';
      const availClass = isLeave ? 'status red' : 'status green';

      return `
        <tr>
          <td>
            <div style="font-weight:900;">${escapeHtml(wl.full_name)}</div>
            <div class="small-muted" style="font-size:11px;">${escapeHtml(wl.designation || 'Recruiter')}</div>
          </td>
          <td><span class="${availClass}">${wl.availability}</span></td>
          <td><div style="font-weight:900; font-size:15px;">${wl.current_candidates}</div></td>
          <td>${wl.monthly_target} <span class="small-muted">(weekly: ${wl.weekly_target})</span></td>
          <td style="min-width: 120px;">
            <div style="font-weight:700;">${wl.workload_pct}%</div>
            <div class="progress-bar-container">
              <div class="progress-bar-fill" style="width: ${Math.min(wl.workload_pct, 100)}%; background: ${loadColor};"></div>
            </div>
          </td>
          <td><div style="font-weight:800; color:var(--success, #22c55e);">${wl.placements}</div></td>
          <td>${wl.interviews}</td>
          <td>${wl.open_tasks}</td>
        </tr>
      `;
    }).join('');
  }

  function populateRecruiterDropdown() {
    const prevVal = els.recruiterSelect.value;
    els.recruiterSelect.innerHTML = '<option value="">Select Recruiter...</option>';

    workloads.forEach(wl => {
      const opt = document.createElement('option');
      opt.value = wl.id;
      opt.textContent = `${wl.full_name} (${wl.current_candidates} active candidates)`;
      els.recruiterSelect.appendChild(opt);
    });

    els.recruiterSelect.value = prevVal;
  }

  // --- Select All ---
  els.selectAllCheckbox.onchange = () => {
    const isChecked = els.selectAllCheckbox.checked;
    els.unassignedList.querySelectorAll('.candidate-checkbox').forEach(cb => {
      cb.checked = isChecked;
    });
  };

  // --- Submit Assignment Action ---
  async function submitAssignment(recruiterId, defaultReason) {
    const checkboxes = els.unassignedList.querySelectorAll('.candidate-checkbox:checked');
    const applicantIds = Array.from(checkboxes).map(cb => Number(cb.dataset.id));

    if (!applicantIds.length) {
      alert('Please select at least one candidate from the left panel.');
      return;
    }

    const reason = els.reasonInput.value.trim() || defaultReason;

    try {
      await window.CRM_API.request('/api/applicants/bulk-assign', {
        method: 'POST',
        body: JSON.stringify({
          applicant_ids: applicantIds,
          recruiter_id: recruiterId,
          reason
        })
      });

      els.reasonInput.value = '';
      await fetchData();
    } catch (err) {
      alert('Assignment failed: ' + err.message);
    }
  }

  els.btnAssignBulk.onclick = () => {
    const recId = els.recruiterSelect.value;
    if (!recId) {
      alert('Please select a recruiter to assign candidates to.');
      return;
    }
    submitAssignment(Number(recId), 'Workload distributed by administrator');
  };

  els.btnUnassignBulk.onclick = () => {
    if (!confirm('Are you sure you want to remove assignment from selected candidates?')) return;
    submitAssignment(null, 'Assignment removed by administrator');
  };

  // --- Init ---
  async function init() {
    await loadProfile();
    await fetchData();
  }

  init();
})();
