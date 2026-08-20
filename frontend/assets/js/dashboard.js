(function () {
  'use strict';

  window.CRM_AUTH.requireAuth();

  const elName = document.getElementById('userName');
  const elRole = document.getElementById('userRole');

  const kpiApplicants = document.getElementById('kpiApplicants');
  const kpiJobs = document.getElementById('kpiJobs');
  const kpiPool = document.getElementById('kpiPool');
  const kpiPipeline = document.getElementById('kpiPipeline');
  const kpiInterviews = document.getElementById('kpiInterviews');
  const kpiSelected = document.getElementById('kpiSelected');
  const kpiRejected = document.getElementById('kpiRejected');
  const kpiHires = document.getElementById('kpiHires');
  const kpiTotalRevenue = document.getElementById('kpiTotalRevenue');
  const kpiPendingInvoices = document.getElementById('kpiPendingInvoices');
  const kpiPaidInvoices = document.getElementById('kpiPaidInvoices');
  const kpiReferralPending = document.getElementById('kpiReferralPending');
  const kpiTotalEmployees = document.getElementById('kpiTotalEmployees');
  const kpiPresentToday = document.getElementById('kpiPresentToday');
  const kpiPendingLeaves = document.getElementById('kpiPendingLeaves');
  const kpiPendingSalaries = document.getElementById('kpiPendingSalaries');

  function formatMoneyINR(value) {
    const num = Number(value || 0);
    return num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function loadProfile() {
    const res = await window.CRM_API.request('/api/auth/profile');
    const u = res.data.user;
    window.CRM_USER_ID = u.id;
    elName.textContent = u.full_name;
    elRole.textContent = u.role;
  }

  async function loadEmployeeDashboard() {
    // 1. Show employee view, hide admin view
    const adminView = document.getElementById('adminView');
    const employeeView = document.getElementById('employeeView');
    if (adminView) adminView.style.display = 'none';
    if (employeeView) employeeView.style.display = 'block';

    // 2. Fetch Command Center Consolidated Data
    try {
      const ccRes = await window.CRM_API.request('/api/command-center/dashboard-data');
      const cc = ccRes.data;

      // Update Header Metrics
      if (cc.header) {
        const greetingEl = document.getElementById('empGreeting');
        if (greetingEl) {
          greetingEl.textContent = `${cc.header.greeting}, ${cc.header.employee.name}! 👋`;
        }
      }

      // Update Work Queue Items
      const queueContainer = document.getElementById('workQueueContainer');
      if (queueContainer && cc.workQueue) {
        if (!cc.workQueue.length) {
          queueContainer.innerHTML = '<div class="small-muted p-3 text-center">🎉 All work items completed! No pending items in queue.</div>';
        } else {
          queueContainer.innerHTML = cc.workQueue.map(item => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border-bottom:1px solid var(--border-color);gap:12px">
              <div style="display:flex;align-items:center;gap:10px">
                <span style="width:10px;height:10px;border-radius:50%;background:${item.priority_color};display:inline-block"></span>
                <div>
                  <div style="font-weight:700;font-size:13.5px">${escapeHtml(item.title)}</div>
                  <div class="small-muted" style="font-size:11px">${escapeHtml(item.hospital)} • ${escapeHtml(item.job)} • ${escapeHtml(item.due_time)}</div>
                </div>
              </div>
              <div style="display:flex;gap:6px">
                ${item.applicant_id ? `<a href="./applicants.html?id=${item.applicant_id}" class="btn btn-outline btn-sm" style="font-size:11px;padding:3px 8px">Open</a>` : ''}
                <button class="btn btn-primary btn-sm" style="font-size:11px;padding:3px 8px" onclick="alert('Quick Action executed')">Done</button>
              </div>
            </div>
          `).join('');
        }
      }

      // Update Recommendations
      const recContainer = document.getElementById('recommendationsContainer');
      if (recContainer && cc.recommendations) {
        if (!cc.recommendations.length) {
          recContainer.innerHTML = '<div class="small-muted">No pending recommendations.</div>';
        } else {
          recContainer.innerHTML = cc.recommendations.map(r => `
            <div class="card" style="padding:12px;border-left:4px solid ${r.priority_color};margin-bottom:8px">
              <div style="font-weight:700;font-size:13px">${escapeHtml(r.title)}</div>
              <div class="small-muted" style="font-size:11px;margin-top:2px">${escapeHtml(r.reason)}</div>
              <a href="${r.nav_link}" class="btn btn-outline btn-sm" style="margin-top:6px;font-size:10px;padding:2px 6px">${escapeHtml(r.recommended_action)}</a>
            </div>
          `).join('');
        }
      }
    } catch (err) {
      console.error('Failed to load Command Center data:', err);
    }

    // 3. Fetch and Render Leaderboard Preview
    try {
      const leaderRes = await window.CRM_API.request('/api/analytics/leaderboard');
      const board = leaderRes.data.leaderboard || [];
      const leaderTbody = document.getElementById('leaderboardBody');
      if (leaderTbody) {
        if (!board.length) {
          leaderTbody.innerHTML = '<tr><td colspan="4" class="small-muted text-center">No leaderboard data.</td></tr>';
        } else {
          leaderTbody.innerHTML = board.slice(0, 5).map((u, i) => `
            <tr style="${Number(u.id) === Number(window.CRM_USER_ID) ? 'font-weight:800;background:rgba(37,99,235,0.06)' : ''}">
              <td>${i + 1}</td>
              <td>${escapeHtml(u.full_name)}</td>
              <td>${u.selections}</td>
              <td>₹ ${formatMoneyINR(u.revenue)}</td>
            </tr>
          `).join('');
        }
      }
    } catch (e) {
      console.error('Failed to load leaderboard:', e);
    }

    // 4. Fetch and Render Upcoming Schedule & Follow-ups
    try {
      const calRes = await window.CRM_API.request('/api/calendar/events');
      const events = calRes.data.events || [];
      const scheduleContainer = document.getElementById('employeeScheduleContainer');
      if (scheduleContainer) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().slice(0, 10);

        const filtered = events.filter(ev => ev.event_date === todayStr || ev.event_date === tomorrowStr);
        if (!filtered.length) {
          scheduleContainer.innerHTML = '<div class="small-muted">No interviews or followups scheduled for today/tomorrow.</div>';
        } else {
          scheduleContainer.innerHTML = filtered.slice(0, 5).map(ev => {
            const isToday = ev.event_date === todayStr;
            const badgeClass = ev.type === 'interview' ? 'badge-primary' : ev.type === 'followup' ? 'badge-warning' : 'badge-outline';
            return `
              <div class="card" style="padding:12px;display:flex;justify-content:space-between;align-items:center;margin-bottom:0px;border-left:4px solid var(--primary);box-shadow:var(--shadow-xs)">
                <div>
                  <div style="font-weight:700;font-size:13.5px">${escapeHtml(ev.title)}</div>
                  <div class="small-muted" style="font-size:12px;margin-top:2px">${escapeHtml(ev.description || '')}</div>
                </div>
                <div style="text-align:right">
                  <span class="badge ${badgeClass}" style="font-size:10px">${ev.type}</span>
                  <div class="small-muted" style="font-size:11px;margin-top:4px">${isToday ? 'Today' : 'Tomorrow'} ${ev.event_time ? ev.event_time.slice(0, 5) : ''}</div>
                </div>
              </div>
            `;
          }).join('');
        }
      }
    } catch (e) {
      console.error('Failed to load schedule:', e);
    }

    // 5. Fetch and Render Recruiter Tasks
    try {
      const taskRes = await window.CRM_API.request('/api/tasks');
      const tasks = taskRes.data.tasks || [];
      const tasksContainer = document.getElementById('employeeTasksContainer');
      if (tasksContainer) {
        const activeTasks = tasks.filter(t => t.status !== 'completed');
        if (!activeTasks.length) {
          tasksContainer.innerHTML = '<div class="small-muted">No pending tasks.</div>';
        } else {
          tasksContainer.innerHTML = activeTasks.slice(0, 5).map(t => `
            <div class="card" style="padding:12px;margin-bottom:0px;border-left:4px solid var(--success);box-shadow:var(--shadow-xs)">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="font-weight:700;font-size:13.5px">${escapeHtml(t.title)}</div>
                <span class="badge" style="font-size:10px">${t.status}</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
                <span class="small-muted" style="font-size:11.5px">Due: ${t.due_date}</span>
                <span class="small-muted" style="font-size:11.5px">${t.completion_percentage}% Done</span>
              </div>
            </div>
          `).join('');
        }
      }
    } catch (e) {
      console.error('Failed to load tasks:', e);
    }
  }

  function renderRecentApplicants(items) {
    const tbody = document.getElementById('recentActivityBody');
    if (!tbody) return;

    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="small-muted">No recent activity.</td></tr>';
      return;
    }

    const esc = (v) => String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    tbody.innerHTML = rows.map((a) => {
      const when = String(a.created_at || '').slice(0, 10) || '-';
      const st = String(a.candidate_status || 'active');

      const badge = st === 'active'
        ? '<span class="status green">Active</span>'
        : st === 'hold'
          ? '<span class="status amber">Hold</span>'
          : st === 'pool'
            ? '<span class="status blue">Pool</span>'
            : '<span class="status">Rejected</span>';

      return `
        <tr>
          <td>Applicant</td>
          <td>New applicant added: <b>${esc(a.full_name)}</b></td>
          <td>${badge}</td>
          <td>${esc(when)}</td>
        </tr>
      `;
    }).join('');
  }

  async function loadStats() {
    const res = await window.CRM_API.request('/api/analytics/dashboard');
    const s = res.data;

    if (kpiApplicants) kpiApplicants.textContent = String(s.totalApplicants ?? 0);
    if (kpiJobs) kpiJobs.textContent = String(s.activeJobs ?? 0);
    if (kpiPool) kpiPool.textContent = String(s.poolCandidates ?? 0);
    if (kpiPipeline) kpiPipeline.textContent = String(s.candidatesInPipeline ?? 0);
    if (kpiInterviews) kpiInterviews.textContent = String(s.interviewsScheduled ?? 0);
    if (kpiSelected) kpiSelected.textContent = String(s.selectedCandidates ?? 0);
    if (kpiRejected) kpiRejected.textContent = String(s.rejectedCandidates ?? 0);
    // kpiHires = total candidates placed (selected stage), separate from pipeline selected count
    if (kpiHires) kpiHires.textContent = String(s.selectedCandidates ?? 0);
    if (kpiTotalEmployees) kpiTotalEmployees.textContent = String(s.totalEmployees ?? 0);
    if (kpiPresentToday) kpiPresentToday.textContent = String(s.presentToday ?? 0);
    if (kpiPendingLeaves) kpiPendingLeaves.textContent = String(s.pendingLeaves ?? 0);
    if (kpiPresentToday) kpiPresentToday.textContent = String(s.presentToday ?? 0);
    if (kpiTotalRevenue) kpiTotalRevenue.textContent = '\u20b9 ' + formatMoneyINR(s.revenueGenerated ?? 0);
    if (kpiPendingInvoices) kpiPendingInvoices.textContent = String(s.pendingInvoices ?? 0);
    // Paid invoices: derive from revenue page, not dashboard endpoint - show link prompt
    if (kpiPaidInvoices) kpiPaidInvoices.textContent = String(s.paidInvoices ?? 0);
    if (kpiReferralPending) kpiReferralPending.textContent = String(s.pendingReferrals ?? 0);

    renderRecentApplicants(s.recentApplicants);
    renderUpcomingTasks(s.upcomingTasks);
    renderMonthlyProgress(s.monthlyProgress);
  }

  function renderUpcomingTasks(tasks) {
    const container = document.getElementById('upcomingTasksContainer');
    if (!container) return;

    if (!tasks || !tasks.length) {
      container.innerHTML = '<div class="small-muted">No upcoming tasks scheduled.</div>';
      return;
    }

    container.innerHTML = tasks.map(t => `
      <div class="task-card">
        <span class="task-dot ${t.priority || 'medium'}"></span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:14px">${escapeHtml(t.title)}</div>
          <div class="small-muted" style="text-transform:capitalize;font-size:12px;margin-top:2px">
            ${t.reminder_type} · ${new Date(t.reminder_date).toLocaleDateString()} ${t.reminder_time ? t.reminder_time.slice(0,5) : ''}
          </div>
        </div>
        <span class="badge" style="font-size:10px;text-transform:capitalize">${t.priority}</span>
      </div>
    `).join('');
  }

  function renderMonthlyProgress(prog) {
    const container = document.getElementById('monthlyProgressContainer');
    if (!container) return;

    if (!prog) {
      container.innerHTML = '<div class="small-muted">No targets set for this month.</div>';
      return;
    }

    const revPct = prog.targetRevenue > 0 ? Math.min(100, Math.round((prog.achievedRevenue / prog.targetRevenue) * 100)) : 0;
    const hirePct = prog.targetHires > 0 ? Math.min(100, Math.round((prog.achievedHires / prog.targetHires) * 100)) : 0;
    
    container.innerHTML = `
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-weight:600;font-size:13px;color:var(--text-secondary)">Revenue Target</span>
          <span style="font-weight:800;font-size:13px;color:var(--primary)">${revPct}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${revPct}%"></div>
        </div>
        <div class="small-muted" style="margin-top:6px;font-size:12px">₹ ${formatMoneyINR(prog.achievedRevenue)} / ₹ ${formatMoneyINR(prog.targetRevenue)}</div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-weight:600;font-size:13px;color:var(--text-secondary)">Hiring Target</span>
          <span style="font-weight:800;font-size:13px;color:var(--success)">${hirePct}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${hirePct}%;background:var(--success)"></div>
        </div>
        <div class="small-muted" style="margin-top:6px;font-size:12px">${prog.achievedHires} / ${prog.targetHires} hires</div>
      </div>
    `;
  }

  async function safeInit() {
    try {
      await loadProfile();
      const res = await window.CRM_API.request('/api/auth/profile');
      const u = res.data.user;
      if (u.role === 'employee') {
        await loadEmployeeDashboard();
      } else {
        await loadStats();
      }
    } catch (err) {
      console.warn('[Dashboard] safeInit warning:', err.message);
      if (err.status === 401) {
        window.CRM_API.clearToken();
        window.location.href = './login.html';
      }
    }
  }

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
      await window.CRM_API.request('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // ignore
    } finally {
      window.CRM_API.clearToken();
      window.location.href = './login.html';
    }
  });

  safeInit();
})();
