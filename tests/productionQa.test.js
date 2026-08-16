'use strict';

const assert = require('assert');
const app = require('../backend/app');

const PORT = 5057;
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
  // ─── 1. Setup Test Server ───────────────────────────────────────────────────
  server = app.listen(PORT);
  await new Promise((resolve) => server.once('listening', resolve));
  log(`Production QA test server started on ${BASE_URL}`);

  try {
    // ─── 2. Health Check Endpoint ─────────────────────────────────────────────
    log('\n[HEALTH] Testing GET /api/health...');
    const healthRes = await apiRequest('/api/health');
    assert.strictEqual(healthRes.status, 200, 'Health check should return status 200');
    assert.strictEqual(healthRes.body.success, true, 'Health check should return success=true');
    assert.strictEqual(healthRes.body.data.status, 'UP', 'Health check status should be UP');
    assert.strictEqual(healthRes.body.data.database.status, 'healthy', 'Database status should be healthy');
    log('✓ System health check endpoint verified');

    // ─── 3. Admin Authentication ──────────────────────────────────────────────
    const adminLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@crm.com', password: 'admin123' })
    });
    assert.strictEqual(adminLogin.status, 200, 'Admin login should succeed');
    const adminToken = adminLogin.body.data.token;
    log('✓ Admin login authenticated');

    // ─── 4. Role-Aware Notifications ───────────────────────────────────────────
    log('\n[NOTIFICATIONS] Testing Notification Center APIs...');
    const notifList = await apiRequest('/api/notifications', {}, adminToken);
    assert.strictEqual(notifList.status, 200, 'Notifications list should return 200');
    assert.ok(Array.isArray(notifList.body.data.notifications), 'Notifications should return an array');
    log('✓ Notification list & unread count retrieved');

    const markAllRead = await apiRequest('/api/notifications/read-all', { method: 'PATCH' }, adminToken);
    assert.strictEqual(markAllRead.status, 200, 'Mark all as read should return 200');
    log('✓ Mark all notifications as read verified');

    // ─── 5. Entity Activity Timelines ──────────────────────────────────────────
    log('\n[TIMELINE] Testing Candidate Activity Timeline...');
    const appList = await apiRequest('/api/applicants', {}, adminToken);
    if (appList.body.data.applicants && appList.body.data.applicants.length) {
      const candidateId = appList.body.data.applicants[0].id;
      const timelineRes = await apiRequest(`/api/applicants/${candidateId}/timeline`, {}, adminToken);
      assert.strictEqual(timelineRes.status, 200, 'Candidate timeline should return 200');
      assert.ok(Array.isArray(timelineRes.body.data.timeline), 'Timeline should return array');
      log('✓ Candidate Activity Timeline endpoint verified');
    }

    // ─── 6. Standardized Error Handling ────────────────────────────────────────
    log('\n[ERROR HANDLING] Testing 404 & Standardized Error Responses...');
    const notFoundRes = await apiRequest('/api/non-existent-route', {}, adminToken);
    assert.strictEqual(notFoundRes.status, 404, 'Non-existent API route should return 404');
    assert.strictEqual(notFoundRes.body.success, false, 'Error response should return success=false');
    log('✓ Centralized 404 error handler verified');

    log('\n✅ Production QA verification completed successfully!');
  } finally {
    if (server) {
      server.close();
    }
  }
}

module.exports = { run };
