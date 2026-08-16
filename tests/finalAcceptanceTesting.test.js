'use strict';

const assert = require('assert');
const app = require('../backend/app');

const PORT = 5071;
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
  log(`Final Acceptance Testing test server started on ${BASE_URL}`);

  try {
    // ─── 1. Admin Authentication ───────────────────────────────────────
    const loginRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@crm.com', password: 'admin123' })
    });
    assert.strictEqual(loginRes.status, 200, 'Login should succeed');
    const token = loginRes.body.data.token;
    log('✓ Admin authenticated');

    // ─── 2. Client Demo Mode Readiness Status ────────────────────────
    log('\n[DEMO STATUS] Testing Client Demo Mode Readiness Status...');
    const statusRes = await apiRequest('/api/client-demo/status', {}, token);
    assert.strictEqual(statusRes.status, 200, 'Demo status should return 200');
    assert.strictEqual(statusRes.body.data.status.client_demo_mode, 'ACTIVE', 'Client demo mode active');
    assert.strictEqual(statusRes.body.data.status.overall_readiness_score, '100 / 100', 'Readiness score 100 / 100');
    log('✓ Client Demo Mode Readiness status verified (Score: 100 / 100)');

    // ─── 3. End-to-End Agency Recruitment Workflow Simulation ─────────
    log('\n[WORKFLOW SIMULATION] Testing End-to-End Agency Recruitment Simulation...');
    const simRes = await apiRequest('/api/client-demo/simulate-workflow', {
      method: 'POST'
    }, token);
    if (simRes.status !== 200) {
      console.error('WORKFLOW SIMULATION FAILED BODY:', simRes.body);
    }
    assert.strictEqual(simRes.status, 200, 'Workflow simulation should return 200');
    assert.strictEqual(simRes.body.data.result.simulation_success, true, 'Simulation succeeded');
    assert.strictEqual(simRes.body.data.result.workflow_steps_executed, 7, '7 workflow steps executed');
    log('✓ Complete End-to-End agency recruitment lifecycle simulation executed');

    // ─── 4. Client Demo Readiness Checklist ──────────────────────────
    log('\n[DEMO CHECKLIST] Testing Client Demo Readiness Checklist...');
    const chkRes = await apiRequest('/api/client-demo/checklist', {}, token);
    assert.strictEqual(chkRes.status, 200, 'Checklist should return 200');
    assert.ok(Array.isArray(chkRes.body.data.checklist), 'Checklist items present');
    assert.ok(chkRes.body.data.checklist.length >= 10, 'At least 10 verification steps present');
    log('✓ Client Demo Readiness Checklist verified');

    log('\n✅ All Final Acceptance Testing & Client Demo Readiness tests completed successfully!');
  } finally {
    if (server) server.close();
  }
}

module.exports = { run };
