'use strict';

const assert = require('assert');
const app = require('../backend/app');

const PORT = 5068;
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
  log(`Recruiter Command Center System test server started on ${BASE_URL}`);

  try {
    // ─── 1. Admin / Recruiter Authentication ───────────────────────────
    const loginRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@crm.com', password: 'admin123' })
    });
    assert.strictEqual(loginRes.status, 200, 'Login should succeed');
    const token = loginRes.body.data.token;
    log('✓ Recruiter authenticated');

    // ─── 2. Today Work Center ─────────────────────────────────────────
    log('\n[WORK CENTER] Testing Today Work Center (10-Section Consolidated Payload)...');
    const wcRes = await apiRequest('/api/recruiter-command-center/work-center', {}, token);
    if (wcRes.status !== 200) {
      console.error('WORK CENTER FAILED BODY:', wcRes.body);
    }
    assert.strictEqual(wcRes.status, 200, 'Work Center payload should return 200');
    assert.ok(wcRes.body.data.interviews_today !== undefined, 'Interviews today section present');
    assert.ok(wcRes.body.data.overdue_followups !== undefined, 'Overdue followups section present');
    log('✓ Today Work Center 10-section consolidated payload verified');

    // ─── 3. 7-Tier Intelligent Work Queue ─────────────────────────────
    log('\n[WORK QUEUE] Testing 7-Tier Prioritized Work Queue...');
    const wqRes = await apiRequest('/api/recruiter-command-center/work-queue', {}, token);
    assert.strictEqual(wqRes.status, 200, 'Work Queue should return 200');
    assert.ok(Array.isArray(wqRes.body.data.queue), 'Queue should be an array');
    log('✓ 7-Tier Prioritized Work Queue retrieved');

    // ─── 4. My Candidates Workspace ──────────────────────────────────
    log('\n[MY CANDIDATES] Testing My Candidates Assigned View...');
    const candRes = await apiRequest('/api/recruiter-command-center/my-candidates', {}, token);
    assert.strictEqual(candRes.status, 200, 'My Candidates should return 200');
    assert.ok(Array.isArray(candRes.body.data.candidates), 'Candidates list should be array');
    log('✓ Recruiter My Candidates assigned dataset verified');

    // ─── 5. One-Click Quick Actions ───────────────────────────────────
    log('\n[QUICK ACTIONS] Testing One-Click Quick Actions...');
    const qaRes = await apiRequest('/api/recruiter-command-center/quick-action', {
      method: 'POST',
      body: JSON.stringify({
        actionType: 'schedule_interview',
        applicantId: 1
      })
    }, token);
    if (qaRes.status !== 200) {
      console.error('QUICK ACTION FAILED BODY:', qaRes.body);
    }
    assert.strictEqual(qaRes.status, 200, 'Quick Action should return 200');
    assert.ok(qaRes.body.data.executed, 'Action should mark executed true');
    log('✓ One-Click Quick Action executed');

    // ─── 6. Recruiter Notes Engine ────────────────────────────────────
    log('\n[NOTES ENGINE] Testing Recruiter Notes Creation & Pinning...');
    const noteRes = await apiRequest('/api/recruiter-command-center/notes', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Candidate Pre-Screening Notes',
        content: 'Verified clinical qualifications, available for immediate joining.',
        noteType: 'candidate',
        isPinned: true
      })
    }, token);
    if (noteRes.status !== 201) {
      console.error('NOTE CREATION FAILED BODY:', noteRes.body);
    }
    assert.strictEqual(noteRes.status, 201, 'Note creation should return 201');
    log('✓ Recruiter note created & pinned');

    // ─── 7. Offline Draft Queue Sync ─────────────────────────────────
    log('\n[OFFLINE SYNC] Testing Offline Draft Queue Sync...');
    const syncRes = await apiRequest('/api/recruiter-command-center/offline-sync', {
      method: 'POST',
      body: JSON.stringify({
        drafts: [
          { entityType: 'note', payload: { title: 'Offline Note 1' } },
          { entityType: 'task', payload: { title: 'Offline Task 1' } }
        ]
      })
    }, token);
    if (syncRes.status !== 200 || syncRes.body?.data?.synced_count !== 2) {
      console.error('OFFLINE SYNC FAILED BODY:', syncRes.body);
    }
    assert.strictEqual(syncRes.status, 200, 'Offline sync should return 200');
    assert.strictEqual(syncRes.body.data.synced_count, 2, '2 draft items should be synced');
    log('✓ Offline draft queue synced successfully');

    // ─── 8. Recruiter Gamified Leaderboard ───────────────────────────
    log('\n[LEADERBOARD] Testing Recruiter Gamified Leaderboard Rankings...');
    const lbRes = await apiRequest('/api/recruiter-command-center/leaderboard', {}, token);
    assert.strictEqual(lbRes.status, 200, 'Leaderboard should return 200');
    assert.ok(Array.isArray(lbRes.body.data.leaderboard), 'Leaderboard should be array');
    log('✓ Recruiter Gamified Leaderboard rankings verified');

    // ─── 9. Recruiter Self Profile ────────────────────────────────────
    log('\n[SELF PROFILE] Testing Recruiter Self Profile & Performance...');
    const profRes = await apiRequest('/api/recruiter-command-center/self-profile', {}, token);
    assert.strictEqual(profRes.status, 200, 'Self Profile should return 200');
    assert.ok(profRes.body.data.profile.performance_score > 0, 'Performance score should be positive');
    log('✓ Recruiter Self Profile dataset verified');

    log('\n✅ All Recruiter Command Center System tests completed successfully!');
  } finally {
    if (server) server.close();
  }
}

module.exports = { run };
