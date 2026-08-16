'use strict';

const assert = require('assert');
const app = require('../backend/app');

const PORT = 5064;
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
  log(`Business Intelligence test server started on ${BASE_URL}`);

  try {
    // ─── 1. Admin Authentication ──────────────────────────────────────────────
    const adminLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@crm.com', password: 'admin123' })
    });
    assert.strictEqual(adminLogin.status, 200, 'Admin login should succeed');
    const adminToken = adminLogin.body.data.token;
    log('✓ Admin authenticated');

    // ─── 2. Admin Command Center Payload ──────────────────────────────────────
    log('\n[COMMAND CENTER] Testing 30-Second Admin Intelligence Dataset...');
    const ccRes = await apiRequest('/api/admin-intelligence/command-center', {}, adminToken);
    assert.strictEqual(ccRes.status, 200, 'Command center endpoint should return 200');

    const data = ccRes.body.data;
    assert.ok(data.topKpis, 'Top KPIs object required');
    assert.ok(data.topKpis.time_to_hire_days > 0, 'Time to hire KPI calculated');
    assert.ok(Array.isArray(data.workloadDistribution), 'Workload distribution array required');
    log(`✓ Admin Command Center KPIs & Workload Distribution verified`);

    // ─── 3. Workload Balancer & Reassignment Engine ───────────────────────────
    log('\n[WORKLOAD BALANCER] Testing Workload Score Calculation & Candidate Rebalancing...');
    const candList = await apiRequest('/api/applicants', {}, adminToken);
    const firstCand = candList.body?.data?.applicants?.[0];
    const candidateId = firstCand ? firstCand.id : 1;
    const fromUser = firstCand ? Number(firstCand.created_by || 1) : 1;
    const toUser = fromUser === 1 ? 2 : 1;

    const rebalanceRes = await apiRequest('/api/admin-intelligence/rebalance-workload', {
      method: 'POST',
      body: JSON.stringify({
        fromUserId: fromUser,
        toUserId: toUser,
        candidateIds: [candidateId]
      })
    }, adminToken);

    if (rebalanceRes.status !== 200) {
      console.error('REBALANCE WORKLOAD FAILED BODY:', rebalanceRes.body);
    }
    assert.strictEqual(rebalanceRes.status, 200, 'Workload rebalancing should return 200');
    log('✓ Candidate Workload Rebalancing executed successfully');

    // ─── 4. Predictive Forecasts & Risks ──────────────────────────────────────
    log('\n[PREDICTIVE INSIGHTS] Testing Placement/Revenue Forecasts & Risk Models...');
    assert.ok(data.predictiveInsights.forecast, 'Forecast data required');
    assert.ok(data.predictiveInsights.forecast.expected_placements >= 0, 'Expected placements forecast calculated');
    log(`✓ Predictive Placement/Revenue Forecasts verified (Forecast Placements: ${data.predictiveInsights.forecast.expected_placements})`);

    // ─── 5. Company Health Scorecard ──────────────────────────────────────────
    log('\n[COMPANY SCORECARD] Testing Multi-Metric Health Scorecard & Grading...');
    assert.ok(data.companyScorecard.overall_company_score >= 0, 'Overall company score calculated');
    assert.ok(data.companyScorecard.health_grade, 'Company health grade assigned');
    log(`✓ Company Health Scorecard verified (Score: ${data.companyScorecard.overall_company_score}, Grade: ${data.companyScorecard.health_grade})`);

    // ─── 6. Executive Director Summary ────────────────────────────────────────
    log('\n[EXECUTIVE SUMMARY] Testing Executive Director Dashboard Dataset...');
    const execRes = await apiRequest('/api/admin-intelligence/executive-summary', {}, adminToken);
    assert.strictEqual(execRes.status, 200, 'Executive summary should return 200');
    assert.ok(execRes.body.data.executive_summary, 'Executive summary object required');
    log('✓ Executive Director Summary verified');

    log('\n✅ Business Intelligence & Analytics Integration Tests completed successfully!');
  } finally {
    if (server) server.close();
  }
}

module.exports = { run };
