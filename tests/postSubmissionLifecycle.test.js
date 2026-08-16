'use strict';

const assert = require('assert');
const app = require('../backend/app');

const PORT = 5067;
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
  log(`Post-Submission Recruitment Lifecycle test server started on ${BASE_URL}`);

  try {
    // ─── 1. Admin Authentication ──────────────────────────────────────────────
    const adminLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@crm.com', password: 'admin123' })
    });
    assert.strictEqual(adminLogin.status, 200, 'Admin login should succeed');
    const adminToken = adminLogin.body.data.token;
    log('✓ Admin authenticated');

    // ─── 2. Hospital Review Management ───────────────────────────────────────
    log('\n[HOSPITAL REVIEW] Testing Hospital Review Status & Resubmission Tracking...');
    const reviewRes = await apiRequest('/api/post-submission/hospitals/review', {
      method: 'POST',
      body: JSON.stringify({
        applicationId: 1,
        status: 'shortlisted',
        remarks: 'Candidate profile shortlisted for technical interview'
      })
    }, adminToken);
    if (reviewRes.status !== 200) {
      console.error('HOSPITAL REVIEW FAILED BODY:', reviewRes.body);
    }
    assert.strictEqual(reviewRes.status, 200, 'Hospital review update should return 200');
    log('✓ Hospital review status updated to shortlisted');

    // ─── 3. Multi-Round Interview Engine & Calendar Integration ───────────────
    log('\n[INTERVIEW & CALENDAR] Testing Scheduling & Calendar Event Creation...');
    const intRes = await apiRequest('/api/post-submission/interviews/schedule', {
      method: 'POST',
      body: JSON.stringify({
        applicantId: 1,
        jobId: 1,
        hospitalId: 1,
        interviewDate: '2026-08-15',
        interviewTime: '11:00:00',
        mode: 'online',
        roundNumber: 2,
        interviewerName: 'Dr. Head of Cardiology',
        meetingDetails: 'https://meet.jit.si/healthcrm-interview'
      })
    }, adminToken);
    assert.strictEqual(intRes.status, 201, 'Interview scheduling should return 201');
    assert.ok(intRes.body.data.calendar_event_created, 'Calendar event should be auto-created');
    const interviewId = intRes.body.data.interview_id;
    log('✓ Multi-round interview scheduled with automatic calendar sync');

    // ─── 4. Structured Interview Feedback ─────────────────────────────────────
    log('\n[INTERVIEW FEEDBACK] Testing Structured 5-Dimension Feedback Ratings...');
    const feedRes = await apiRequest('/api/post-submission/interviews/feedback', {
      method: 'POST',
      body: JSON.stringify({
        interviewId,
        technicalRating: 9,
        communicationRating: 8,
        behaviorRating: 9,
        recommendation: 'select',
        comments: 'Excellent clinical skills and communication'
      })
    }, adminToken);
    if (feedRes.status !== 200) {
      console.error('INTERVIEW FEEDBACK FAILED BODY:', feedRes.body);
    }
    assert.strictEqual(feedRes.status, 200, 'Interview feedback should return 200');
    log('✓ Structured interview feedback submitted');

    // ─── 5. Offer Management Workflow ─────────────────────────────────────────
    log('\n[OFFER MANAGEMENT] Testing Offer Creation & CTC Revision...');
    const offerRes = await apiRequest('/api/post-submission/offers', {
      method: 'POST',
      body: JSON.stringify({
        applicantId: 1,
        jobId: 1,
        hospitalId: 1,
        salaryOffered: 150000,
        annualCtc: 1800000,
        joiningDate: '2026-09-01',
        offerStatus: 'sent'
      })
    }, adminToken);
    if (offerRes.status !== 201) {
      console.error('OFFER CREATION FAILED BODY:', offerRes.body);
    }
    assert.strictEqual(offerRes.status, 201, 'Offer creation should return 201');
    log('✓ Offer created and sent to candidate');

    // ─── 6. Pre-Joining Readiness Checklist ──────────────────────────────────
    log('\n[PRE-JOINING] Testing Pre-Joining Checklist & Readiness Score...');
    const preJoinRes = await apiRequest('/api/post-submission/pre-joining', {
      method: 'POST',
      body: JSON.stringify({
        applicantId: 1,
        documentVerified: true,
        medicalCleared: true,
        backgroundCleared: true,
        noticeDaysRemaining: 10
      })
    }, adminToken);
    assert.strictEqual(preJoinRes.status, 200, 'Pre-joining checklist should return 200');
    assert.strictEqual(preJoinRes.body.data.readiness_score, 100, 'Readiness score should be 100');
    log('✓ Pre-joining readiness checklist calculated (Score: 100)');

    // ─── 7. Candidate Joining & Dedicated Placement Engine ────────────────────
    log('\n[JOINING & PLACEMENT] Testing Candidate Joining & Placement Auto-Creation...');
    const joinRes = await apiRequest('/api/post-submission/joining', {
      method: 'POST',
      body: JSON.stringify({
        applicantId: 1,
        jobId: 1,
        hospitalId: 1,
        actualJoiningDate: '2026-09-01',
        offeredCtc: 1800000,
        feeType: 'percentage',
        feeValue: 10
      })
    }, adminToken);
    assert.strictEqual(joinRes.status, 200, 'Candidate joining should return 200');
    assert.ok(joinRes.body.data.placement_id, 'Placement record created');
    assert.ok(joinRes.body.data.invoice_eligible, 'Invoice eligibility flag enabled');
    const placementId = joinRes.body.data.placement_id;
    log('✓ Candidate joining confirmed & placement record created');

    // ─── 8. Recruitment Replacement Policy ───────────────────────────────────
    log('\n[REPLACEMENT POLICY] Testing Guarantee Period Replacement Request...');
    const repRes = await apiRequest('/api/post-submission/placements/replacement', {
      method: 'POST',
      body: JSON.stringify({
        placementId,
        originalApplicantId: 1,
        reason: 'Candidate relocated out of city'
      })
    }, adminToken);
    assert.strictEqual(repRes.status, 200, 'Replacement request should return 200');
    log('✓ Replacement policy request logged successfully');

    // ─── 9. Enterprise Recruitment Analytics & KPIs ──────────────────────────
    log('\n[RECRUITMENT ANALYTICS] Testing Enterprise Recruitment KPIs...');
    const kpiRes = await apiRequest('/api/post-submission/analytics/kpis', {}, adminToken);
    assert.strictEqual(kpiRes.status, 200, 'Recruitment KPIs should return 200');
    assert.ok(kpiRes.body.data.kpis.time_to_hire_days > 0, 'Time to hire KPI calculated');
    log('✓ Enterprise recruitment KPI metrics verified');

    log('\n✅ All Post-Submission Recruitment Lifecycle tests completed successfully!');
  } finally {
    if (server) server.close();
  }
}

module.exports = { run };
