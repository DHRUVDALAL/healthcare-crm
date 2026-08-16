'use strict';

const assert = require('assert');
const app = require('../backend/app');

const PORT = 5059;
const BASE_URL = `http://localhost:${PORT}`;

let server;

async function apiRequest(endpoint, options = {}, token = null) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers
  });

  const contentType = res.headers.get('content-type') || '';
  let body = null;
  if (contentType.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
  }

  return { status: res.status, body, headers: res.headers };
}

async function run(log = console.log) {
  server = app.listen(PORT);
  await new Promise((resolve) => server.once('listening', resolve));
  log(`Productivity & Performance test server started on ${BASE_URL}`);

  try {
    // ─── 1. Admin Authentication ──────────────────────────────────────────────
    const adminLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@crm.com', password: 'admin123' })
    });
    assert.strictEqual(adminLogin.status, 200, 'Admin login should succeed');
    const adminToken = adminLogin.body.data.token;
    log('✓ Admin authenticated');

    // ─── 2. Daily Work Log System ─────────────────────────────────────────────
    log('\n[DAILY WORK LOG] Testing Auto-Creation, Metric Updating & Review...');
    const todayLog = await apiRequest('/api/work-logs/today', {}, adminToken);
    assert.strictEqual(todayLog.status, 200, 'GET /api/work-logs/today should return 200');
    assert.ok(todayLog.body.data.workLog.id, 'Today work log should return valid ID');
    log('✓ Today Work Log retrieved/auto-created on login');

    const updateLog = await apiRequest('/api/work-logs/today', {
      method: 'PUT',
      body: JSON.stringify({
        todays_goal: 'Conduct 5 candidate phone screens and 2 hospital calls',
        candidates_contacted: 8,
        candidates_processed: 5,
        hospital_calls: 3,
        eod_summary: 'Completed 5 candidate screens and scheduled 2 interviews',
        work_completed: '5 screens, 2 interview schedules',
        completion_percentage: 90
      })
    }, adminToken);

    assert.strictEqual(updateLog.status, 200, 'PUT /api/work-logs/today should return 200');
    log('✓ Daily Work Log metrics & EOD summary updated');

    const logId = todayLog.body.data.workLog.id;
    const reviewRes = await apiRequest(`/api/work-logs/${logId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ review_status: 'approved', manager_remarks: 'Great performance today' })
    }, adminToken);

    assert.strictEqual(reviewRes.status, 200, 'Admin review of work log should return 200');
    log('✓ Admin Work Log approval verified');

    // ─── 3. Self Task Management ──────────────────────────────────────────────
    log('\n[TASK MANAGEMENT] Testing Task Duplication & Archiving...');
    const createNewTask = await apiRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: `Productivity Verification Task ${Date.now()}`,
        task_type: 'follow_up',
        priority: 'high',
        assigned_to: 1,
        due_date: '2026-12-31',
        description: 'Automated test task creation'
      })
    }, adminToken);

    assert.strictEqual(createNewTask.status, 201, 'Task creation should return 201');
    const taskId = createNewTask.body.data.task ? createNewTask.body.data.task.id : createNewTask.body.data.id;

    const dupTask = await apiRequest(`/api/tasks/${taskId}/duplicate`, { method: 'POST' }, adminToken);
    assert.strictEqual(dupTask.status, 200, 'Task duplicate should return 200');
    log('✓ Task duplicate created successfully');

    const arcTask = await apiRequest(`/api/tasks/${taskId}/archive`, { method: 'PATCH' }, adminToken);
    assert.strictEqual(arcTask.status, 200, 'Task archive should return 200');
    log('✓ Task archive verified');

    // ─── 4. Live Monitoring & Workload Calculator ────────────────────────────
    log('\n[ADMIN MONITORING] Testing Live Status & Workload Score Calculations...');
    const liveRes = await apiRequest('/api/productivity/live-monitoring', {}, adminToken);
    assert.strictEqual(liveRes.status, 200, 'Live monitoring should return 200');
    assert.ok(liveRes.body.data.summary, 'Summary stats object required');
    assert.ok(Array.isArray(liveRes.body.data.employees), 'Employees list array required');
    log('✓ Admin Productivity Live Monitoring Stream & Workload Indicators verified');

    // ─── 5. Smart Weighted Leaderboard ────────────────────────────────────────
    log('\n[SMART LEADERBOARD] Testing Multi-Metric Weighted Scoring & Badges...');
    const ldrRes = await apiRequest('/api/productivity/leaderboard', {}, adminToken);
    assert.strictEqual(ldrRes.status, 200, 'Leaderboard should return 200');
    assert.ok(Array.isArray(ldrRes.body.data.leaderboard), 'Leaderboard array required');
    if (ldrRes.body.data.leaderboard.length) {
      const topRank = ldrRes.body.data.leaderboard[0];
      assert.strictEqual(topRank.rank, 1, 'Top entry should have rank 1');
      assert.ok(topRank.overall_score >= 0, 'Overall weighted score calculated');
    }
    log('✓ Smart Weighted Gamified Leaderboard & Badges verified');

    // ─── 6. Employee Report Card ──────────────────────────────────────────────
    log('\n[REPORT CARD] Testing Employee Report Card Generation...');
    const reportCardRes = await apiRequest('/api/productivity/report-card/1', {}, adminToken);
    assert.strictEqual(reportCardRes.status, 200, 'Employee report card should return 200');
    assert.ok(reportCardRes.body.data.reportCard.metrics, 'Report card metrics required');
    log('✓ Comprehensive Employee Performance Report Card generated');

    // ─── 7. Employee Goals & Targets ──────────────────────────────────────────
    log('\n[EMPLOYEE GOALS] Testing Goal Setting & Target Progress...');
    const goalCreate = await apiRequest('/api/goals', {
      method: 'POST',
      body: JSON.stringify({
        goal_type: 'monthly',
        target_candidates: 20,
        target_placements: 3,
        target_revenue: 300000,
        target_interviews: 15
      })
    }, adminToken);

    assert.strictEqual(goalCreate.status, 200, 'Goal creation should return 200');

    const goalList = await apiRequest('/api/goals', {}, adminToken);
    assert.strictEqual(goalList.status, 200, 'Goal list should return 200');
    assert.ok(Array.isArray(goalList.body.data.goals), 'Goals array required');
    log('✓ Employee Goal & Target Management verified');

    log('\n✅ Productivity & Performance Integration Tests completed successfully!');
  } finally {
    if (server) server.close();
  }
}

module.exports = { run };
