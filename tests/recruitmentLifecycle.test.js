'use strict';

const assert = require('assert');
const app = require('../backend/app');

const PORT = 5066;
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
  log(`Candidate Recruitment Lifecycle test server started on ${BASE_URL}`);

  try {
    // ─── 1. Authentication ───────────────────────────────────────────────────
    const adminLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@crm.com', password: 'admin123' })
    });
    assert.strictEqual(adminLogin.status, 200, 'Admin login should succeed');
    const adminToken = adminLogin.body.data.token;
    log('✓ Admin authenticated');

    // Create a candidate for lifecycle testing
    const candRes = await apiRequest('/api/applicants', {
      method: 'POST',
      body: JSON.stringify({
        full_name: `Dr. Vikram Seth ${Date.now()}`,
        email: `vikram_${Date.now()}@hospital.org`,
        phone: '9876500112',
        dob: '1985-08-20',
        gender: 'male',
        city: 'Delhi',
        state: 'Delhi',
        address: '88 Connaught Place',
        total_experience: 15,
        current_company: 'Max Healthcare',
        current_designation: 'Director Surgery',
        current_salary: 4000000,
        expected_salary: 5000000,
        notice_period: '30 Days',
        qualification: 'MS Surgery',
        skills: 'General Surgery, Laparoscopy, Operation Theater',
        preferred_location: 'Delhi',
        applied_job_id: 1,
        source: 'portal'
      })
    }, adminToken);
    if (candRes.status !== 201) {
      console.error('LIFECYCLE CANDIDATE CREATION FAILED:', candRes.body);
    }
    assert.strictEqual(candRes.status, 201, 'Candidate creation should return 201');
    const applicantId = candRes.body.data.applicant ? candRes.body.data.applicant.id : candRes.body.data.id;

    // ─── 2. Candidate Workspace Payload ──────────────────────────────────────
    log('\n[CANDIDATE WORKSPACE] Testing Consolidated Workspace Payload...');
    const wsRes = await apiRequest(`/api/candidate-workspace/${applicantId}`, {}, adminToken);
    assert.strictEqual(wsRes.status, 200, 'Candidate Workspace endpoint should return 200');

    const data = wsRes.body.data;
    assert.ok(data.candidate, 'Candidate details object required');
    assert.ok(Array.isArray(data.lifecycle_progression), 'Lifecycle progression array required');
    assert.ok(data.match_breakdown.overall_score > 0, 'Match score breakdown calculated');
    log('✓ Consolidated Candidate Workspace data payload verified');

    // ─── 3. Unified Status Engine Transition ─────────────────────────────────
    log('\n[STATUS ENGINE] Testing Unified Status Progression & History Logging...');
    const statusRes = await apiRequest(`/api/candidate-workspace/${applicantId}/status-transition`, {
      method: 'POST',
      body: JSON.stringify({
        newStatus: 'Profile Under Review',
        remarks: 'Qualifications and experience verified by Recruiter'
      })
    }, adminToken);
    if (statusRes.status !== 200) {
      console.error('STATUS TRANSITION FAILED BODY:', statusRes.body);
    }
    assert.strictEqual(statusRes.status, 200, 'Status transition should return 200');
    log('✓ Unified Candidate Status transition executed successfully');

    // ─── 4. Document Management Center ────────────────────────────────────────
    log('\n[DOCUMENT CENTER] Testing Verification Document Upload & Versioning...');
    const docRes = await apiRequest(`/api/candidate-workspace/${applicantId}/documents`, {
      method: 'POST',
      body: JSON.stringify({
        documentType: 'Medical License',
        filePath: 'uploads/docs/license_1.pdf',
        fileName: 'Medical_Council_Registration.pdf'
      })
    }, adminToken);
    if (docRes.status !== 200) {
      console.error('DOCUMENT UPLOAD FAILED BODY:', docRes.body);
    }
    assert.strictEqual(docRes.status, 200, 'Document upload should return 200');
    log('✓ Candidate Document record added successfully');

    // ─── 5. Communication Center Logging ──────────────────────────────────────
    log('\n[COMMUNICATION CENTER] Testing Candidate Communication Entry...');
    const commRes = await apiRequest(`/api/candidate-workspace/${applicantId}/communications`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'phone_call',
        summary: 'Discussed salary expectations and 30-day notice period timeline.',
        nextFollowupDate: '2026-08-05'
      })
    }, adminToken);
    if (commRes.status !== 200) {
      console.error('COMMUNICATION LOG FAILED BODY:', commRes.body);
    }
    assert.strictEqual(commRes.status, 200, 'Communication log should return 200');
    log('✓ Communication entry recorded successfully');

    log('\n✅ All Candidate Recruitment Lifecycle & Workspace tests completed successfully!');
  } finally {
    if (server) server.close();
  }
}

module.exports = { run };
