(function () {
  'use strict';

  window.CRM_AUTH.requireAuth();

  const els = {
    userName: document.getElementById('userName'),
    userRole: document.getElementById('userRole'),
    filterSearch: document.getElementById('filterSearch'),
    refreshBtn: document.getElementById('refreshBtn'),
    statusBadge: document.getElementById('statusBadge'),
    tableBody: document.getElementById('tableBody'),
    openAddBtn: document.getElementById('openAddBtn'),
    modalOverlay: document.getElementById('modalOverlay'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    roleForm: document.getElementById('roleForm'),
    modalTitle: document.getElementById('modalTitle'),
    roleId: document.getElementById('roleId'),
    roleName: document.getElementById('roleName'),
    roleDisplayName: document.getElementById('roleDisplayName'),
    roleDescription: document.getElementById('roleDescription'),
    permModalOverlay: document.getElementById('permModalOverlay'),
    permModalTitle: document.getElementById('permModalTitle'),
    closePermBtn: document.getElementById('closePermBtn'),
    cancelPermBtn: document.getElementById('cancelPermBtn'),
    savePermBtn: document.getElementById('savePermBtn'),
    permRoleId: document.getElementById('permRoleId'),
    permMatrix: document.getElementById('permMatrix'),
    cloneModalOverlay: document.getElementById('cloneModalOverlay'),
    cloneForm: document.getElementById('cloneForm'),
    closeCloneBtn: document.getElementById('closeCloneBtn'),
    cancelCloneBtn: document.getElementById('cancelCloneBtn'),
    cloneSourceId: document.getElementById('cloneSourceId'),
    cloneName: document.getElementById('cloneName'),
    cloneDisplayName: document.getElementById('cloneDisplayName'),
    logoutBtn: document.getElementById('logoutBtn')
  };

  let roles = [];
  let allPermissions = [];
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

  async function loadProfile() {
    const res = await window.CRM_API.request('/api/auth/profile');
    userProfile = res.data.user;
    els.userName.textContent = userProfile.full_name;
    els.userRole.textContent = userProfile.role;
    if (userProfile.role !== 'admin') {
      alert('Access Denied. Admins only.');
      window.location.href = './dashboard.html';
    }
  }

  async function loadRoles() {
    try {
      setStatus('Loading...', 'warn');
      const res = await window.CRM_API.request('/api/custom-roles');
      roles = res.data.roles || [];
      renderTable();
      setStatus(`Loaded ${roles.length} roles`, 'ok');
    } catch (err) {
      setStatus('Failed to load', 'warn');
      alert(err.message || 'Failed to load roles');
    }
  }

  async function loadPermissions() {
    try {
      const res = await window.CRM_API.request('/api/custom-roles/permissions');
      allPermissions = res.data.permissions || [];
    } catch (err) {
      console.warn('Failed to load permissions');
    }
  }

  function renderTable() {
    const search = els.filterSearch.value.toLowerCase();
    const filtered = roles.filter(r => !search || r.display_name.toLowerCase().includes(search) || r.role_name.toLowerCase().includes(search));

    if (!filtered.length) {
      els.tableBody.innerHTML = '<tr><td colspan="5" class="small-muted">No roles found.</td></tr>';
      return;
    }

    els.tableBody.innerHTML = filtered.map(r => `
      <tr>
        <td>
          <div style="font-weight:900;">${escapeHtml(r.display_name)}</div>
          <div class="small-muted">${escapeHtml(r.role_name)}</div>
        </td>
        <td><span class="badge">${r.permission_count || 0} permissions</span></td>
        <td>${r.user_count || 0} users</td>
        <td>${r.is_system ? '<span class="status green">SYSTEM</span>' : '<span class="status blue">CUSTOM</span>'}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-outline btn-sm" data-action="permissions" data-id="${r.id}">Permissions</button>
            ${!r.is_system ? `<button class="btn btn-outline btn-sm" data-action="edit" data-id="${r.id}">Edit</button>` : ''}
            <button class="btn btn-outline btn-sm" data-action="clone" data-id="${r.id}">Clone</button>
            ${!r.is_system ? `<button class="btn btn-outline btn-sm" style="color:var(--danger)" data-action="delete" data-id="${r.id}">Delete</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  }

  function openModal(role) {
    if (role) {
      els.modalTitle.textContent = 'Edit Role';
      els.roleId.value = role.id;
      els.roleName.value = role.role_name;
      els.roleName.disabled = true;
      els.roleDisplayName.value = role.display_name;
      els.roleDescription.value = role.description || '';
    } else {
      els.modalTitle.textContent = 'Create Role';
      els.roleForm.reset();
      els.roleId.value = '';
      els.roleName.disabled = false;
    }
    els.modalOverlay.classList.add('show');
    els.modalOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    els.modalOverlay.classList.remove('show');
    els.modalOverlay.setAttribute('aria-hidden', 'true');
  }

  async function openPermModal(roleId) {
    const role = roles.find(r => r.id == roleId);
    if (!role) return;
    els.permModalTitle.textContent = `Permissions: ${role.display_name}`;
    els.permRoleId.value = roleId;

    let currentPerms = [];
    try {
      const res = await window.CRM_API.request(`/api/custom-roles/${roleId}`);
      currentPerms = (res.data.permissions || []).map(p => p.id);
    } catch (e) { /* ignore */ }

    const grouped = {};
    allPermissions.forEach(p => {
      const group = p.permission_key.split('_')[0] || 'other';
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push({ ...p, checked: currentPerms.includes(p.id) });
    });

    els.permMatrix.innerHTML = Object.entries(grouped).map(([group, perms]) => `
      <div style="margin-bottom: 20px;">
        <div style="font-weight:800; font-size:14px; text-transform:capitalize; margin-bottom:8px; color:var(--primary);">${escapeHtml(group)}</div>
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 6px;">
          ${perms.map(p => `
            <label class="checkbox" style="display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:6px; border:1px solid var(--border-default); cursor:pointer;">
              <input type="checkbox" value="${p.id}" ${p.checked ? 'checked' : ''} data-perm-id="${p.id}" />
              <div>
                <div style="font-size:13px; font-weight:600;">${escapeHtml(p.permission_key)}</div>
                <div style="font-size:11px; color:var(--text-muted);">${escapeHtml(p.description || '')}</div>
              </div>
            </label>
          `).join('')}
        </div>
      </div>
    `).join('');

    els.permModalOverlay.classList.add('show');
    els.permModalOverlay.setAttribute('aria-hidden', 'false');
  }

  function closePermModal() {
    els.permModalOverlay.classList.remove('show');
    els.permModalOverlay.setAttribute('aria-hidden', 'true');
  }

  function openCloneModal(roleId) {
    els.cloneSourceId.value = roleId;
    els.cloneForm.reset();
    els.cloneModalOverlay.classList.add('show');
    els.cloneModalOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeCloneModal() {
    els.cloneModalOverlay.classList.remove('show');
    els.cloneModalOverlay.setAttribute('aria-hidden', 'true');
  }

  function bindEvents() {
    els.refreshBtn.addEventListener('click', loadRoles);
    let timer;
    els.filterSearch.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(renderTable, 300); });

    els.openAddBtn.addEventListener('click', () => openModal(null));
    els.closeModalBtn.addEventListener('click', closeModal);
    els.cancelBtn.addEventListener('click', closeModal);
    els.closePermBtn.addEventListener('click', closePermModal);
    els.cancelPermBtn.addEventListener('click', closePermModal);
    els.closeCloneBtn.addEventListener('click', closeCloneModal);
    els.cancelCloneBtn.addEventListener('click', closeCloneModal);

    els.tableBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'edit') {
        const role = roles.find(r => r.id == id);
        if (role) openModal(role);
      } else if (action === 'permissions') {
        openPermModal(id);
      } else if (action === 'clone') {
        openCloneModal(id);
      } else if (action === 'delete') {
        if (!confirm('Are you sure you want to delete this role?')) return;
        try {
          setStatus('Deleting...', 'warn');
          await window.CRM_API.request(`/api/custom-roles/${id}`, { method: 'DELETE' });
          setStatus('Deleted', 'ok');
          await loadRoles();
        } catch (err) {
          setStatus('Failed', 'warn');
          alert(err.message);
        }
      }
    });

    els.roleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = els.roleId.value;
      const payload = {
        role_name: els.roleName.value,
        display_name: els.roleDisplayName.value,
        description: els.roleDescription.value
      };
      try {
        setStatus('Saving...', 'warn');
        if (id) {
          await window.CRM_API.request(`/api/custom-roles/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
          await window.CRM_API.request('/api/custom-roles', { method: 'POST', body: JSON.stringify(payload) });
        }
        closeModal();
        await loadRoles();
      } catch (err) {
        setStatus('Save failed', 'warn');
        alert(err.message || 'Failed to save');
      }
    });

    els.savePermBtn.addEventListener('click', async () => {
      const roleId = els.permRoleId.value;
      const checkboxes = els.permMatrix.querySelectorAll('input[type="checkbox"]');
      const permIds = [];
      checkboxes.forEach(cb => { if (cb.checked) permIds.push(Number(cb.value)); });

      try {
        setStatus('Saving permissions...', 'warn');
        await window.CRM_API.request(`/api/custom-roles/${roleId}/permissions`, {
          method: 'POST',
          body: JSON.stringify({ permission_ids: permIds })
        });
        closePermModal();
        await loadRoles();
      } catch (err) {
        setStatus('Failed', 'warn');
        alert(err.message || 'Failed to save permissions');
      }
    });

    els.cloneForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const sourceId = els.cloneSourceId.value;
      try {
        setStatus('Cloning...', 'warn');
        await window.CRM_API.request(`/api/custom-roles/${sourceId}/clone`, {
          method: 'POST',
          body: JSON.stringify({ role_name: els.cloneName.value, display_name: els.cloneDisplayName.value })
        });
        closeCloneModal();
        await loadRoles();
      } catch (err) {
        setStatus('Failed', 'warn');
        alert(err.message || 'Failed to clone role');
      }
    });

    els.logoutBtn.addEventListener('click', async () => {
      try {
        await window.CRM_API.request('/api/auth/logout', { method: 'POST' });
        await window.CRM_API.request('/api/attendance/logout', { method: 'PATCH' });
      } catch (e) {} finally {
        window.CRM_API.clearToken();
        window.location.href = './login.html';
      }
    });
  }

  async function init() {
    try {
      await loadProfile();
      bindEvents();
      await loadRoles();
    } catch (err) {
      console.warn('[Roles] init warning:', err.message);
      if (err.status === 401) {
        window.CRM_API.clearToken();
        window.location.href = './login.html';
      }
    }
  }

  init();
})();
