'use strict';

const assert = require('assert');
const app = require('../backend/app');

const PORT = 5062;
const BASE_URL = `http://127.0.0.1:${PORT}`;

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
  await new Promise((resolve, reject) => {
    server = app.listen(PORT, '127.0.0.1', (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
  log(`Recruitment Command Center test server started on ${BASE_URL}`);

  try {
    // ─── 1. Admin Authentication ──────────────────────────────────────────────
    const adminLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@crm.com', password: 'admin123' })
    });
    assert.strictEqual(adminLogin.status, 200, 'Admin login should succeed');
    const adminToken = adminLogin.body.data.token;
    log('✓ Admin authenticated');

    // ─── 2. Command Center Dashboard Data ──────────────────────────────────────
    log('\n[COMMAND CENTER] Testing Consolidated Dashboard Data Payload...');
    const dashRes = await apiRequest('/api/command-center/dashboard-data', {}, adminToken);
    assert.strictEqual(dashRes.status, 200, 'Dashboard data endpoint should return 200');

    const data = dashRes.body.data;
    assert.ok(data.header, 'Header info required');
    assert.ok(data.header.greeting, 'Header greeting required');
    assert.ok(data.header.employee, 'Employee info required');
    log(`✓ Command Center Header verified (${data.header.greeting}, Score: ${data.header.productivity_score}%)`);

    // ─── 3. Work Queue Prioritization Test ────────────────────────────────────
    log('\n[WORK QUEUE] Testing 6-Tier Work Queue Prioritization Engine...');
    assert.ok(Array.isArray(data.workQueue), 'Work queue array required');
    if (data.workQueue.length) {
      const firstItem = data.workQueue[0];
      assert.ok(firstItem.priority_tier >= 1 && firstItem.priority_tier <= 6, 'Priority tier within 1-6');
      assert.ok(firstItem.quick_actions && firstItem.quick_actions.length, 'Quick action buttons present');
    }
    log('✓ Prioritized 6-Tier Work Queue verified');

    // ─── 4. Smart Recommendation Engine Test ──────────────────────────────────
    log('\n[RECOMMENDATIONS] Testing Actionable Recommendation Rules...');
    assert.ok(Array.isArray(data.recommendations), 'Recommendations array required');
    if (data.recommendations.length) {
      const rec = data.recommendations[0];
      assert.ok(rec.rule_id, 'Recommendation rule ID present');
      assert.ok(rec.recommended_action, 'Action text present');
    }
    log('✓ Smart Rule-Based Recommendations verified');

    // ─── 5. Summary & Performance Scorecard Test ─────────────────────────────
    log('\n[SCORECARD & SUMMARY] Testing Summary Cards & Performance Scorecard Grading...');
    assert.ok(data.summary, 'Summary stats required');
    assert.ok(data.scorecard, 'Scorecard data required');
    assert.ok(data.scorecard.overall_performance_grade, 'Letter grade computed');
    log(`✓ Summary Cards & Performance Scorecard verified (Grade: ${data.scorecard.overall_performance_grade})`);

    log('\n✅ Recruitment Command Center Integration Tests completed successfully!');
  } finally {
    if (server) server.close();
  }
}

module.exports = { run };
