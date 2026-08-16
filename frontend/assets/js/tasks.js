(function () {
  'use strict';

  window.CRM_AUTH.requireAuth();

  const els = {
    userName: document.getElementById('userNameSpan'),
    userRole: document.getElementById('userRoleSpan'),
    topRole: document.getElementById('topRole'),
    avatarSpan: document.getElementById('avatarSpan'),

    filterStatus: document.getElementById('filterStatus'),
    filterPriority: document.getElementById('filterPriority'),
    filterType: document.getElementById('filterType'),
    filterEmployee: document.getElementById('filterEmployee'),
    refreshBtn: document.getElementById('refreshBtn'),
    statusBadge: document.getElementById('statusBadge'),
    tableBody: document.getElementById('tableBody'),

    openAddBtn: document.getElementById('openAddBtn'),
    modalOverlay: document.getElementById('modalOverlay'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    taskForm: document.getElementById('taskForm'),
    modalTitle: document.getElementById('modalTitle'),

    taskId: document.getElementById('taskId'),
    taskTitleInput: document.getElementById('taskTitleInput'),
    taskDescInput: document.getElementById('taskDescInput'),
    taskTypeInput: document.getElementById('taskTypeInput'),
    taskPriorityInput: document.getElementById('taskPriorityInput'),
    taskAssigneeInput: document.getElementById('taskAssigneeInput'),
    taskDueDateInput: document.getElementById('taskDueDateInput'),
    taskDueTimeInput: document.getElementById('taskDueTimeInput'),
    taskStatusInput: document.getElementById('taskStatusInput'),
    editStatusGroup: document.getElementById('editStatusGroup'),
    saveBtn: document.getElementById('saveBtn'),

    // Complete Task Modal Elements (Recruiter)
    completeModalOverlay: document.getElementById('completeModalOverlay'),
    closeCompleteModalBtn: document.getElementById('closeCompleteModalBtn'),
    cancelCompleteBtn: document.getElementById('cancelCompleteBtn'),
    completeTaskForm: document.getElementById('completeTaskForm'),
    completeTaskId: document.getElementById('completeTaskId'),
    completionNotesInput: document.getElementById('completionNotesInput'),

    // Review Task Modal Elements (Admin)
    reviewModalOverlay: document.getElementById('reviewModalOverlay'),
    closeReviewModalBtn: document.getElementById('closeReviewModalBtn'),
    cancelReviewBtn: document.getElementById('cancelReviewBtn'),
    reviewTaskForm: document.getElementById('reviewTaskForm'),
    reviewTaskId: document.getElementById('reviewTaskId'),
    reviewRatingInput: document.getElementById('reviewRatingInput'),
    reviewNotesInput: document.getElementById('reviewNotesInput')
  };

  let tasks = [];
  let userProfile = null;
  let recruitersList = [];

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] || m));
  }

  function setStatus(text, variant) {
    els.statusBadge.textContent = text;
    els.statusBadge.className = 'badge';
    if (variant === 'warn') els.statusBadge.classList.add('warn');
    if (variant === 'ok') els.statusBadge.classList.add('success');
  }

  async function init() {
    try {
      await loadProfile();
      if (userProfile.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
        await loadRecruiters();
      }
      await loadTasks();
      bindEvents();
    } catch (err) {
      console.error('Initialization error:', err);
    }
  }

  async function loadProfile() {
    const res = await window.CRM_API.request('/api/auth/profile');
    userProfile = res.data.user;
    els.userName.textContent = userProfile.full_name;
    els.topRole.textContent = userProfile.role;
    els.userRole.textContent = userProfile.role === 'admin' ? 'Administrator' : 'Recruiter';

    const initials = userProfile.full_name
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    els.avatarSpan.textContent = initials;
  }

  async function loadRecruiters() {
    try {
      const res = await window.CRM_API.request('/api/employees?role=employee&status=active');
      recruitersList = res.data.employees || [];
      
      // Populate Assignee Select in Add/Edit Task Form
      els.taskAssigneeInput.innerHTML = '<option value="">Select Employee...</option>' + 
        recruitersList.map(r => `<option value="${r.id}">${escapeHtml(r.full_name)} (${escapeHtml(r.designation || 'Recruiter')})</option>`).join('');

      // Populate Admin filter Assignee Select
      els.filterEmployee.innerHTML = '<option value="">All Employees</option>' +
        recruitersList.map(r => `<option value="${r.id}">${escapeHtml(r.full_name)}</option>`).join('');
    } catch (err) {
      console.error('Failed to load recruiters:', err);
    }
  }

  async function loadTasks() {
    try {
      setStatus('Loading...', 'warn');
      const status = els.filterStatus.value;
      const priority = els.filterPriority.value;
      const type = els.filterType.value;
      
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (priority) params.append('priority', priority);
      if (type) params.append('type', type);

      if (userProfile.role === 'admin' && els.filterEmployee.value) {
        params.append('employee_id', els.filterEmployee.value);
      }

      const res = await window.CRM_API.request(`/api/tasks?${params.toString()}`);
      tasks = res.data.tasks || [];
      renderTable();
      setStatus(`Loaded ${tasks.length} tasks`, 'ok');
    } catch (err) {
      setStatus('Failed to load', 'warn');
      alert(err.message || 'Failed to load tasks');
    }
  }

  function getPriorityBadgeClass(p) {
    if (p === 'high') return 'status red';
    if (p === 'medium') return 'status amber';
    return 'status blue';
  }

  function getStatusBadgeClass(s) {
    if (s === 'completed') return 'status green';
    if (s === 'in_progress') return 'status blue';
    if (s === 'overdue') return 'status red';
    return 'status amber';
  }

  function renderTable() {
    const isAdmin = userProfile.role === 'admin';

    // Toggle header columns
    const adminHeaders = document.querySelectorAll('.admin-only');
    adminHeaders.forEach(th => {
      if (th.tagName === 'TH') {
        th.style.display = isAdmin ? '' : 'none';
      }
    });

    if (!tasks.length) {
      els.tableBody.innerHTML = `<tr><td colspan="${isAdmin ? 8 : 7}" class="small-muted">No tasks found.</td></tr>`;
      return;
    }

    els.tableBody.innerHTML = tasks.map((task) => {
      const priorityBadge = `<span class="${getPriorityBadgeClass(task.priority)}">${task.priority.toUpperCase()}</span>`;
      const statusBadge = `<span class="${getStatusBadgeClass(task.status)}">${task.status.replace('_', ' ').toUpperCase()}</span>`;
      
      let reviewContent = '<span class="small-muted">No review yet</span>';
      if (task.review_rating) {
        reviewContent = `
          <div>
            <strong>${'★'.repeat(task.review_rating)}${'☆'.repeat(5 - task.review_rating)}</strong>
          </div>
          <div class="small-muted">${escapeHtml(task.review_notes || 'No comments')}</div>
        `;
      }

      // Actions logic
      let actions = '';
      if (isAdmin) {
        actions += `<button class="btn btn-outline btn-sm" data-action="edit" data-id="${task.id}" style="margin-right: 4px;">Edit</button>`;
        actions += `<button class="btn btn-outline btn-sm btn-danger" data-action="delete" data-id="${task.id}" style="color:var(--danger); margin-right: 4px;">Delete</button>`;
        if (task.status === 'completed' && !task.review_rating) {
          actions += `<button class="btn btn-primary btn-sm" data-action="review" data-id="${task.id}">Review</button>`;
        }
      } else {
        // Recruiter actions
        if (task.status === 'not_started') {
          actions += `<button class="btn btn-outline btn-sm" data-action="status-in-progress" data-id="${task.id}">Start Task</button>`;
        } else if (task.status === 'in_progress') {
          actions += `<button class="btn btn-primary btn-sm" data-action="status-complete" data-id="${task.id}">Complete Task</button>`;
        } else if (task.status === 'completed') {
          actions += `<span class="small-muted">Awaiting Admin Review</span>`;
        }
      }

      return `
        <tr>
          <td>
            <div style="font-weight:900;">${escapeHtml(task.title)}</div>
            <div class="small-muted">${escapeHtml(task.description || 'No description')}</div>
            ${task.completion_notes ? `<div class="small-muted" style="margin-top:4px; padding-left:6px; border-left:2px solid var(--success-border);"><strong>Completion Notes:</strong> ${escapeHtml(task.completion_notes)}</div>` : ''}
          </td>
          <td>${priorityBadge}</td>
          <td><span class="badge">${task.task_type.toUpperCase()}</span></td>
          ${isAdmin ? `<td><div style="font-weight:600;">${escapeHtml(task.assignee_name)}</div></td>` : ''}
          <td>
            <div>${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'N/A'}</div>
            <div class="small-muted">${task.due_time ? task.due_time.slice(0, 5) : ''}</div>
          </td>
          <td>${statusBadge}</td>
          <td>${reviewContent}</td>
          <td><div class="row-actions">${actions}</div></td>
        </tr>
      `;
    }).join('');
  }

  // --- Main Task Modal Logic (Admin Create/Edit) ---
  function openModal(task = null) {
    if (task) {
      els.modalTitle.textContent = 'Edit Task Details';
      els.saveBtn.textContent = 'Save Changes';
      els.taskId.value = task.id;
      els.taskTitleInput.value = task.title;
      els.taskDescInput.value = task.description || '';
      els.taskTypeInput.value = task.task_type;
      els.taskPriorityInput.value = task.priority;
      els.taskAssigneeInput.value = task.assigned_to;
      els.taskDueDateInput.value = task.due_date ? task.due_date.slice(0, 10) : '';
      els.taskDueTimeInput.value = task.due_time || '';
      els.taskStatusInput.value = task.status;
      els.editStatusGroup.style.display = '';
    } else {
      els.modalTitle.textContent = 'Assign New Task';
      els.saveBtn.textContent = 'Assign Task';
      els.taskForm.reset();
      els.taskId.value = '';
      els.editStatusGroup.style.display = 'none';
      
      // Default due date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      els.taskDueDateInput.value = tomorrow.toISOString().slice(0, 10);
    }
    els.modalOverlay.classList.add('show');
    els.modalOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    els.modalOverlay.classList.remove('show');
    els.modalOverlay.setAttribute('aria-hidden', 'true');
  }

  // --- Complete Task Modal Logic (Recruiter Log Notes) ---
  function openCompleteModal(id) {
    els.completeTaskId.value = id;
    els.completionNotesInput.value = '';
    els.completeModalOverlay.classList.add('show');
    els.completeModalOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeCompleteModal() {
    els.completeModalOverlay.classList.remove('show');
    els.completeModalOverlay.setAttribute('aria-hidden', 'true');
  }

  // --- Review Task Modal Logic (Admin Submit Ratings) ---
  function openReviewModal(id) {
    els.reviewTaskId.value = id;
    els.reviewRatingInput.value = '';
    els.reviewNotesInput.value = '';
    els.reviewModalOverlay.classList.add('show');
    els.reviewModalOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeReviewModal() {
    els.reviewModalOverlay.classList.remove('show');
    els.reviewModalOverlay.setAttribute('aria-hidden', 'true');
  }

  // --- Event Bindings & API Submissions ---
  function bindEvents() {
    els.refreshBtn.addEventListener('click', loadTasks);
    els.filterStatus.addEventListener('change', loadTasks);
    els.filterPriority.addEventListener('change', loadTasks);
    els.filterType.addEventListener('change', loadTasks);
    if (els.filterEmployee) {
      els.filterEmployee.addEventListener('change', loadTasks);
    }

    if (els.openAddBtn) {
      els.openAddBtn.addEventListener('click', () => openModal());
    }
    
    // Admin Add/Edit Forms Close/Cancel
    els.closeModalBtn.addEventListener('click', closeModal);
    els.cancelBtn.addEventListener('click', closeModal);

    // Complete Form Cancel/Close
    els.closeCompleteModalBtn.addEventListener('click', closeCompleteModal);
    els.cancelCompleteBtn.addEventListener('click', closeCompleteModal);

    // Review Form Cancel/Close
    els.closeReviewModalBtn.addEventListener('click', closeReviewModal);
    els.cancelReviewBtn.addEventListener('click', closeReviewModal);

    // Dynamic buttons inside table rows
    els.tableBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      const id = Number(btn.getAttribute('data-id'));

      if (action === 'edit') {
        const t = tasks.find(x => x.id === id);
        if (t) openModal(t);
      } else if (action === 'delete') {
        if (confirm('Are you sure you want to delete this task?')) {
          try {
            await window.CRM_API.request(`/api/tasks/${id}`, { method: 'DELETE' });
            await loadTasks();
          } catch (err) {
            alert(err.message || 'Failed to delete task');
          }
        }
      } else if (action === 'status-in-progress') {
        try {
          await window.CRM_API.request(`/api/tasks/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'in_progress' })
          });
          await loadTasks();
        } catch (err) {
          alert(err.message || 'Failed to update task progress');
        }
      } else if (action === 'status-complete') {
        openCompleteModal(id);
      } else if (action === 'review') {
        openReviewModal(id);
      }
    });

    // Form submits
    els.taskForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = els.taskId.value;
      const payload = {
        title: els.taskTitleInput.value,
        description: els.taskDescInput.value,
        task_type: els.taskTypeInput.value,
        priority: els.taskPriorityInput.value,
        assigned_to: Number(els.taskAssigneeInput.value),
        due_date: els.taskDueDateInput.value,
        due_time: els.taskDueTimeInput.value || null
      };

      if (id) {
        payload.status = els.taskStatusInput.value;
      }

      try {
        const path = id ? `/api/tasks/${id}` : '/api/tasks';
        const method = id ? 'PUT' : 'POST';
        await window.CRM_API.request(path, {
          method,
          body: JSON.stringify(payload)
        });
        closeModal();
        await loadTasks();
      } catch (err) {
        alert(err.message || 'Failed to save task');
      }
    });

    els.completeTaskForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = Number(els.completeTaskId.value);
      const notes = els.completionNotesInput.value;

      try {
        await window.CRM_API.request(`/api/tasks/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'completed',
            completion_notes: notes
          })
        });
        closeCompleteModal();
        await loadTasks();
      } catch (err) {
        alert(err.message || 'Failed to complete task');
      }
    });

    els.reviewTaskForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = Number(els.reviewTaskId.value);
      const rating = Number(els.reviewRatingInput.value);
      const notes = els.reviewNotesInput.value;

      try {
        await window.CRM_API.request(`/api/tasks/${id}/review`, {
          method: 'PATCH',
          body: JSON.stringify({
            review_rating: rating,
            review_notes: notes
          })
        });
        closeReviewModal();
        await loadTasks();
      } catch (err) {
        alert(err.message || 'Failed to submit review');
      }
    });
  }

  // Self-execute on load
  init();
})();
