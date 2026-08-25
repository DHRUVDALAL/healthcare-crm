(function () {
  'use strict';

  window.CRM_AUTH.requireAuth();

  const els = {
    userName: document.getElementById('userName'),
    userRole: document.getElementById('userRole'),
    topRole: document.getElementById('topRole'),

    jobSelect: document.getElementById('jobSelect'),
    loadMatchesBtn: document.getElementById('loadMatchesBtn'),
    calculateBtn: document.getElementById('calculateBtn'),
    statusBadge: document.getElementById('statusBadge'),

    filterSkills: document.getElementById('filterSkills'),
    filterMinExp: document.getElementById('filterMinExp'),
    filterLocation: document.getElementById('filterLocation'),
    filterQualification: document.getElementById('filterQualification'),

    tableBody: document.getElementById('tableBody'),

    detailsOverlay: document.getElementById('detailsOverlay'),
    closeDetailsBtn: document.getElementById('closeDetailsBtn'),
    detailsOkBtn: document.getElementById('detailsOkBtn'),
    detailsTitle: document.getElementById('detailsTitle'),
    detailsSubtitle: document.getElementById('detailsSubtitle'),
    detailsBody: document.getElementById('detailsBody'),

    logoutBtn: document.getElementById('logoutBtn')
  };

  let matches = [];

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"]+/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] || m));
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

  async function loadJobs() {
    const res = await window.CRM_API.request('/api/jobs');
    const jobs = res.data.jobs || [];

    els.jobSelect.querySelectorAll('option:not(:first-child)').forEach((o) => o.remove());
    jobs.forEach((j) => {
      const opt = document.createElement('option');
      opt.value = String(j.id);
      opt.textContent = `${j.job_title} - ${j.hospital_name} - ${j.location}`;
      els.jobSelect.appendChild(opt);
    });
  }

  function applyClientFilters(rows) {
    const skills = String(els.filterSkills.value || '').trim().toLowerCase();
    const minExp = Number(els.filterMinExp.value || 0);
    const location = String(els.filterLocation.value || '').trim().toLowerCase();
    const qualification = String(els.filterQualification.value || '').trim().toLowerCase();

    return (rows || []).filter((r) => {
      if (skills) {
        const s = String(r.skills || '').toLowerCase();
        if (!s.includes(skills)) return false;
      }
      if (Number.isFinite(minExp) && minExp > 0) {
        const exp = Number(r.total_experience || 0);
        if (!(exp >= minExp)) return false;
      }
      if (location) {
        const l = String(r.preferred_location || '').toLowerCase();
        if (!l.includes(location)) return false;
      }
      if (qualification) {
        const q = String(r.qualification || '').toLowerCase();
        if (!q.includes(qualification)) return false;
      }
      return true;
    });
  }

  function renderTable() {
    const rows = applyClientFilters(matches);

    if (!rows.length) {
      els.tableBody.innerHTML = '<tr><td colspan="7" class="small-muted">No matches found. Try calculating matches, or adjust filters.</td></tr>';
      return;
    }

    els.tableBody.innerHTML = rows.map((m) => {
      const score = Number(m.match_score || m.matchScore || 0);
      const scoreBadge = score >= 80
        ? '<span class="status green">' + score + '%</span>'
        : score >= 60
          ? '<span class="status blue">' + score + '%</span>'
          : score >= 40
            ? '<span class="status amber">' + score + '%</span>'
            : '<span class="status">' + score + '%</span>';

      const hasMasked = Boolean(m.masked_resume_path);

      const actions = [
        `<button class="btn btn-outline btn-sm" data-action="details" data-id="${m.applicant_id}">Details</button>`,
        hasMasked
          ? `<button class="btn btn-outline btn-sm" data-action="view-masked" data-id="${m.applicant_id}">View Masked</button>`
          : `<span class="small-muted">No masked PDF</span>`,
        hasMasked
          ? `<button class="btn btn-outline btn-sm" data-action="download-masked" data-id="${m.applicant_id}">Download Masked</button>`
          : '',
        `<button class="btn btn-primary btn-sm" data-action="send" data-id="${m.applicant_id}">Send Candidate</button>`
      ].filter(Boolean).join(' ');

      return `
        <tr>
          <td>
            <div style="font-weight:900;"><a href="./candidate-profile.html?id=${m.applicant_id}" style="color: var(--primary); text-decoration: underline;">${escapeHtml(m.full_name || '')}</a></div>
            <div class="small-muted">ID: ${escapeHtml(m.applicant_id)}</div>
          </td>
          <td>${escapeHtml(m.total_experience)} yrs</td>
          <td>${escapeHtml(m.preferred_location || '-')}</td>
          <td>${escapeHtml(m.qualification || '-')}</td>
          <td>${scoreBadge}</td>
          <td class="small-muted">${escapeHtml(m.match_notes || '-')}</td>
          <td><div class="row-actions">${actions}</div></td>
        </tr>
      `;
    }).join('');
  }

  function openDetails(html, { title, subtitle } = {}) {
    els.detailsTitle.textContent = title || 'Candidate';
    els.detailsSubtitle.textContent = subtitle || 'Match details';
    els.detailsBody.innerHTML = html;
    els.detailsOverlay.classList.add('show');
    els.detailsOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeDetails() {
    els.detailsOverlay.classList.remove('show');
    els.detailsOverlay.setAttribute('aria-hidden', 'true');
    els.detailsBody.innerHTML = '';
  }

  async function fetchPdfBlob(url) {
    const token = window.CRM_API.getToken();
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to fetch file');
    }
    return res.blob();
  }

  async function viewMasked(applicantId) {
    const blob = await fetchPdfBlob(`/api/resume/masked/${applicantId}`);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function downloadMasked(applicantId) {
    const blob = await fetchPdfBlob(`/api/resume/download-masked/${applicantId}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resume_masked_${applicantId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function getSelectedJobId() {
    const jobId = Number(els.jobSelect.value);
    if (!Number.isInteger(jobId) || jobId <= 0) return null;
    return jobId;
  }

  async function loadSavedMatches() {
    const jobId = getSelectedJobId();
    if (!jobId) {
      alert('Select a job first');
      return;
    }

    setStatus('Loading…', 'warn');
    const res = await window.CRM_API.request(`/api/matching/job/${jobId}`);
    const m = res.data.matches || [];

    matches = m.map((row) => ({
      applicant_id: row.applicant_id,
      full_name: row.full_name,
      total_experience: row.total_experience,
      preferred_location: row.preferred_location,
      qualification: row.qualification,
      skills: row.skills,
      match_score: row.match_score,
      match_notes: row.match_notes,
      masked_resume_path: row.masked_resume_path
    }));

    setStatus(`Loaded ${matches.length}`, 'ok');
    renderTable();
  }

  async function calculateMatches() {
    const jobId = getSelectedJobId();
    if (!jobId) {
      alert('Select a job first');
      return;
    }

    setStatus('Calculating…', 'warn');
    const res = await window.CRM_API.request(`/api/matching/calculate/${jobId}`, { method: 'POST' });
    matches = res.data.matches || [];
    setStatus(`Calculated ${matches.length}`, 'ok');
    renderTable();
  }

  async function sendCandidate(applicantId) {
    setStatus('Sending…', 'warn');
    const jobId = getSelectedJobId();
    await window.CRM_API.request(`/api/pipeline/send/${applicantId}`, {
      method: 'POST',
      body: JSON.stringify({ job_id: jobId })
    });
    setStatus('Sent', 'ok');
    alert('Candidate sent to hospital successfully and moved to pipeline.');
  }

  function bindEvents() {
    els.closeDetailsBtn.addEventListener('click', closeDetails);
    els.detailsOkBtn.addEventListener('click', closeDetails);
    els.detailsOverlay.addEventListener('click', (e) => {
      if (e.target === els.detailsOverlay) closeDetails();
    });

    els.jobSelect.addEventListener('change', () => {
      matches = [];
      els.tableBody.innerHTML = '<tr><td colspan="7" class="small-muted">Choose an action: load saved matches or calculate new matches.</td></tr>';
      setStatus('Ready');
    });

    els.loadMatchesBtn.addEventListener('click', async () => {
      try {
        await loadSavedMatches();
      } catch (err) {
        setStatus('Failed', 'warn');
        alert(err.message || 'Failed to load matches');
      }
    });

    els.calculateBtn.addEventListener('click', async () => {
      try {
        await calculateMatches();
      } catch (err) {
        setStatus('Failed', 'warn');
        alert(err.message || 'Failed to calculate matches');
      }
    });

    const rerender = () => renderTable();
    ['input', 'change'].forEach((evt) => {
      els.filterSkills.addEventListener(evt, rerender);
      els.filterMinExp.addEventListener(evt, rerender);
      els.filterLocation.addEventListener(evt, rerender);
      els.filterQualification.addEventListener(evt, rerender);
    });

    els.tableBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const applicantId = Number(btn.dataset.id);

      const row = matches.find((x) => Number(x.applicant_id) === applicantId);

      try {
        if (action === 'details' && row) {
          openDetails(`
            <div class="details-grid">
              <div class="details-item"><div class="k">Full Name</div><div class="v">${escapeHtml(row.full_name)}</div></div>
              <div class="details-item"><div class="k">Match Score</div><div class="v">${escapeHtml(row.match_score)}%</div></div>
              <div class="details-item"><div class="k">Experience</div><div class="v">${escapeHtml(row.total_experience)} yrs</div></div>
              <div class="details-item"><div class="k">Preferred Location</div><div class="v">${escapeHtml(row.preferred_location || '-')}</div></div>
              <div class="details-item" style="grid-column:1/-1;"><div class="k">Qualification</div><div class="v">${escapeHtml(row.qualification || '-')}</div></div>
              <div class="details-item" style="grid-column:1/-1;"><div class="k">Skills</div><div class="v">${escapeHtml(row.skills || '-')}</div></div>
              <div class="details-item" style="grid-column:1/-1;"><div class="k">Notes</div><div class="v">${escapeHtml(row.match_notes || '-')}</div></div>
            </div>
          `, { title: row.full_name, subtitle: 'Match breakdown' });
          return;
        }

        if (action === 'view-masked') return await viewMasked(applicantId);
        if (action === 'download-masked') return await downloadMasked(applicantId);
        if (action === 'send') return await sendCandidate(applicantId);
      } catch (err) {
        alert(err.message || 'Action failed');
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
      await loadJobs();
      bindEvents();
    } catch (err) {
      console.warn('[Matching] init warning:', err.message);
      if (err.status === 401) {
        window.CRM_API.clearToken();
        window.location.href = './login.html';
      }
    }
  }

  init();
})();
