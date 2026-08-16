(function () {
  'use strict';

  window.CRM_AUTH.requireAuth();

  const els = {
    userName: document.getElementById('userName'),
    userRole: document.getElementById('userRole'),

    reportForm: document.getElementById('reportForm'),
    reportType: document.getElementById('reportType'),
    filterStatusGroup: document.getElementById('filterStatusGroup'),
    filterStatus: document.getElementById('filterStatus'),
    reportFormat: document.getElementById('reportFormat'),
    exportBtn: document.getElementById('exportBtn'),
    exportStatus: document.getElementById('exportStatus'),

    importForm: document.getElementById('importForm'),
    importType: document.getElementById('importType'),
    importFile: document.getElementById('importFile'),
    btnProcessImport: document.getElementById('btnProcessImport'),
    importStatus: document.getElementById('importStatus'),

    logoutBtn: document.getElementById('logoutBtn')
  };

  async function loadProfile() {
    const res = await window.CRM_API.request('/api/auth/profile');
    const user = res.data.user;
    if (els.userName) els.userName.textContent = user.full_name;
    if (els.userRole) els.userRole.textContent = user.role;

    if (user.role !== 'admin') {
      alert('Access Denied. Admins only.');
      window.location.href = './dashboard.html';
    }
  }

  function parseCSVText(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
    const records = [];

    for (let i = 1; i < lines.length; i++) {
      // Split comma avoiding inside quotes if possible or standard comma
      const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (!cols.length || (cols.length === 1 && !cols[0])) continue;

      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = cols[idx] !== undefined ? cols[idx] : '';
      });
      records.push(obj);
    }
    return records;
  }

  async function downloadTemplate(type) {
    try {
      const token = window.CRM_API.getToken();
      const res = await fetch(`/api/reports/import-template/${type}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to download template');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_import_template.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Failed to download template');
    }
  }

  function bindEvents() {
    if (els.reportType) {
      els.reportType.addEventListener('change', () => {
        if (els.reportType.value === 'revenue') {
          els.filterStatusGroup.style.display = 'block';
        } else {
          els.filterStatusGroup.style.display = 'none';
          els.filterStatus.value = '';
        }
      });
    }

    if (els.reportForm) {
      els.reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = els.reportType.value;
        const format = els.reportFormat.value;
        const status = els.filterStatus.value;

        els.exportBtn.disabled = true;
        els.exportBtn.textContent = 'Generating Export...';
        els.exportStatus.textContent = '';
        els.exportStatus.className = 'small-muted';

        try {
          const payload = { type, format, filters: {} };
          if (type === 'revenue' && status) {
            payload.filters.status = status;
          }

          const token = window.CRM_API.getToken();
          const res = await fetch('/api/reports/export', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Export failed');
          }

          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${type}_report_${new Date().toISOString().slice(0,10)}.${format}`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);

          els.exportStatus.textContent = 'Export completed successfully.';
          els.exportStatus.className = 'small-muted';
          els.exportStatus.style.color = 'var(--success)';
        } catch (err) {
          els.exportStatus.textContent = err.message || 'Failed to export report';
          els.exportStatus.className = 'small-muted';
          els.exportStatus.style.color = 'var(--danger)';
        } finally {
          els.exportBtn.disabled = false;
          els.exportBtn.textContent = 'Download Report';
        }
      });
    }

    // --- Bulk Excel Data Import ---
    if (els.importForm) {
      els.importForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = els.importType.value;
        const file = els.importFile.files[0];

        if (!file) {
          alert('Please select an Excel or CSV file to import.');
          return;
        }

        els.btnProcessImport.disabled = true;
        els.btnProcessImport.textContent = 'Processing Import...';
        els.importStatus.textContent = 'Reading file records...';
        els.importStatus.style.color = 'var(--text-muted)';

        try {
          const text = await file.text();
          const records = parseCSVText(text);

          if (!records.length) {
            throw new Error('File contains no readable rows or invalid CSV structure.');
          }

          els.importStatus.textContent = `Uploading ${records.length} records...`;

          const res = await window.CRM_API.request('/api/reports/bulk-import', {
            method: 'POST',
            body: JSON.stringify({ type, records })
          });

          els.importStatus.textContent = `✅ Success! ${res.data.imported_count || records.length} records imported cleanly.`;
          els.importStatus.style.color = 'var(--success)';
          els.importForm.reset();
        } catch (err) {
          els.importStatus.textContent = `❌ Import Failed: ${err.message}`;
          els.importStatus.style.color = 'var(--danger)';
        } finally {
          els.btnProcessImport.disabled = false;
          els.btnProcessImport.textContent = '📤 Upload & Process Import';
        }
      });
    }

    // --- Template Downloads ---
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action="download-template"]');
      if (btn) {
        const type = btn.dataset.type;
        downloadTemplate(type);
      }
    });

    if (els.logoutBtn) {
      els.logoutBtn.addEventListener('click', async () => {
        try {
          await window.CRM_API.request('/api/auth/logout', { method: 'POST' });
        } catch (e) {} finally {
          window.CRM_API.clearToken();
          window.location.href = './login.html';
        }
      });
    }
  }

  async function init() {
    try {
      await loadProfile();
      bindEvents();
    } catch (err) {
      window.CRM_API.clearToken();
      window.location.href = './login.html';
    }
  }

  init();
})();
