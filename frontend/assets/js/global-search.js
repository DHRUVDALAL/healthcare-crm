(function () {
  'use strict';

  let searchModal = null;
  let searchInput = null;
  let searchResults = null;

  const NAV_ITEMS = [
    { title: 'Applicants & Candidates', url: '/pages/applicants.html', category: 'Recruitment', icon: '👤' },
    { title: 'My Candidates Workspace', url: '/pages/my-candidates.html', category: 'Recruitment', icon: '📋' },
    { title: 'Hospitals & Clients', url: '/pages/hospitals.html', category: 'Recruitment', icon: '🏥' },
    { title: 'Job Openings', url: '/pages/jobs.html', category: 'Recruitment', icon: '💼' },
    { title: 'Candidate Matching Engine', url: '/pages/matching.html', category: 'Recruitment', icon: '⚡' },
    { title: 'Pool Database Sourcing', url: '/pages/pool.html', category: 'Recruitment', icon: '🔍' },
    { title: 'Recruitment Pipeline', url: '/pages/pipeline.html', category: 'Recruitment', icon: '📊' },
    { title: 'Scheduled Interviews', url: '/pages/interviews.html', category: 'Recruitment', icon: '📅' },
    { title: 'Invoices & Financial ERP', url: '/pages/invoices.html', category: 'Finance', icon: '📄' },
    { title: 'Salary & Payroll ERP', url: '/pages/salary.html', category: 'Finance', icon: '💰' },
    { title: 'Reports & Export Center', url: '/pages/reports.html', category: 'Analytics', icon: '📈' },
    { title: 'Employees Directory', url: '/pages/employees.html', category: 'HRMS', icon: '👥' },
    { title: 'Attendance Management', url: '/pages/attendance.html', category: 'HRMS', icon: '⏱️' },
    { title: 'Leaves Management', url: '/pages/leaves.html', category: 'HRMS', icon: '🌴' },
    { title: 'Task Desk', url: '/pages/tasks.html', category: 'Operations', icon: '✅' },
    { title: 'Performance Analytics', url: '/pages/performance.html', category: 'Analytics', icon: '⭐' },
    { title: 'System Settings', url: '/pages/settings.html', category: 'Admin', icon: '⚙️' }
  ];

  function createSearchModal() {
    if (searchModal) return;

    const modalHtml = `
      <div id="globalSearchModal" class="modal-backdrop" style="display:none;z-index:99999;align-items:flex-start;padding-top:80px;background:rgba(15,23,42,0.65);backdrop-filter:blur(4px)">
        <div class="card" style="width:100%;max-width:640px;margin:0 auto;padding:0;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);border:1px solid var(--border-default)">
          <div style="padding:16px 20px;border-bottom:1px solid var(--border-default);display:flex;align-items:center;gap:12px">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-tertiary)"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
            <input id="globalSearchInput" type="text" placeholder="Type a command or search candidates, jobs, hospitals, invoices... (Press ESC to close)" style="width:100%;border:none;outline:none;font-size:16px;background:transparent;color:var(--text-primary)" />
            <span class="badge" style="font-size:11px">ESC</span>
          </div>
          <div id="globalSearchResults" style="max-height:420px;overflow-y:auto;padding:12px 16px">
            <div class="small-muted" style="padding:12px 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-tertiary)">Quick Navigation</div>
            <div id="globalSearchList" style="display:grid;gap:4px"></div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    searchModal = document.getElementById('globalSearchModal');
    searchInput = document.getElementById('globalSearchInput');
    searchResults = document.getElementById('globalSearchList');

    searchInput.addEventListener('input', handleSearchInput);

    searchModal.addEventListener('click', (e) => {
      if (e.target === searchModal) closeSearchModal();
    });
  }

  function handleSearchInput() {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) {
      renderNavList(NAV_ITEMS);
      return;
    }

    const filtered = NAV_ITEMS.filter(item =>
      item.title.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
    );

    renderNavList(filtered);
  }

  function renderNavList(items) {
    if (!items.length) {
      searchResults.innerHTML = `<div class="small-muted p-3 text-center">No matching navigation links or CRM entities found for "${escapeHtml(searchInput.value)}".</div>`;
      return;
    }

    searchResults.innerHTML = items.map((item, idx) => `
      <a href="${item.url}" class="global-search-item" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:6px;text-decoration:none;color:var(--text-primary);transition:background 120ms" onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background='transparent'">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:16px">${item.icon}</span>
          <span style="font-weight:600;font-size:14px">${escapeHtml(item.title)}</span>
        </div>
        <span class="badge" style="font-size:11px">${item.category}</span>
      </a>
    `).join('');
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function openSearchModal() {
    createSearchModal();
    searchModal.style.display = 'flex';
    searchInput.value = '';
    renderNavList(NAV_ITEMS);
    setTimeout(() => searchInput.focus(), 50);
  }

  function closeSearchModal() {
    if (searchModal) {
      searchModal.style.display = 'none';
    }
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (searchModal && searchModal.style.display === 'flex') {
        closeSearchModal();
      } else {
        openSearchModal();
      }
    } else if (e.key === 'Escape') {
      closeSearchModal();
    }
  });

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.topbar-search, [data-global-search]');
    if (trigger) {
      e.preventDefault();
      openSearchModal();
    }
  });

  window.CRM_SEARCH = {
    openSearchModal,
    closeSearchModal
  };
})();
