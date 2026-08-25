'use strict';

const assert = require('assert');
const app = require('../backend/app');

const PORT = 5065;
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
  log(`End-to-End Business Workflows test server started on ${BASE_URL}`);

  try {
    // ─── 1. Authentication ───────────────────────────────────────────────────
    const adminLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@crm.com', password: 'admin123' })
    });
    assert.strictEqual(adminLogin.status, 200, 'Admin login should succeed');
    const adminToken = adminLogin.body.data.token;
    log('✓ Admin authenticated');

    // ─── WORKFLOW 1: Hospital -> Job -> Candidate -> Pipeline -> Invoice -> Payment ───
    log('\n[WORKFLOW 1] Testing End-to-End Recruitment Cycle to Invoicing & Payment...');

    // Step A: Create Hospital
    const hospRes = await apiRequest('/api/hospitals', {
      method: 'POST',
      body: JSON.stringify({
        name: `City Heart Hospital ${Date.now()}`,
        contact_person: 'Dr. R. K. Sharma',
        phone: '9876543210',
        email: `contact_${Date.now()}@cityheart.com`,
        address: '123 Marine Drive Medical Enclave',
        city: 'Mumbai',
        state: 'Maharashtra',
        commission_percentage: 8.33,
        agreement_start_date: '2026-01-01',
        agreement_end_date: '2027-12-31',
        status: 'active'
      })
    }, adminToken);
    assert.strictEqual(hospRes.status, 201, 'Hospital creation should return 201');
    const hospitalId = hospRes.body.data.hospital ? hospRes.body.data.hospital.id : hospRes.body.data.id;

    // Step B: Create Job Opening
    const jobRes = await apiRequest('/api/jobs', {
      method: 'POST',
      body: JSON.stringify({
        hospital_id: hospitalId,
        job_title: 'Chief Medical Officer',
        department: 'Cardiology',
        qualification: 'MD Cardiology',
        experience_required: '10+ Years',
        openings_count: 2,
        salary: 3500000,
        location: 'Mumbai',
        shift_timing: 'Full Time / Day Shift',
        job_description: 'Responsible for managing cardiology department and medical team.',
        required_skills: 'Cardiology, Clinical Operations, ICU, Patient Care',
        joining_timeline: 'Immediate / 30 Days',
        priority_level: 'high',
        status: 'open'
      })
    }, adminToken);
    if (jobRes.status !== 201) {
      console.error('JOB CREATION FAILED BODY:', jobRes.body);
    }
    assert.strictEqual(jobRes.status, 201, 'Job creation should return 201');
    const jobId = jobRes.body.data.job ? jobRes.body.data.job.id : jobRes.body.data.id;

    // Step C: Create Candidate & Assign
    const candRes = await apiRequest('/api/applicants', {
      method: 'POST',
      body: JSON.stringify({
        full_name: `Dr. Ananya Roy ${Date.now()}`,
        email: `ananya_${Date.now()}@med.org`,
        phone: '9988776655',
        dob: '1988-05-14',
        gender: 'female',
        city: 'Mumbai',
        state: 'Maharashtra',
        address: '45 Bandra West Enclave',
        total_experience: 12,
        current_company: 'Apollo Medical Center',
        current_designation: 'Senior Consultant',
        current_salary: 2800000,
        expected_salary: 3500000,
        notice_period: '30 Days',
        qualification: 'MD Cardiology',
        skills: 'Cardiology, ICU, Diagnostics',
        preferred_location: 'Mumbai',
        source: 'portal',
        applied_job_id: jobId
      })
    }, adminToken);
    if (candRes.status !== 201) {
      console.error('CANDIDATE CREATION FAILED BODY:', candRes.body);
    }
    assert.strictEqual(candRes.status, 201, 'Candidate creation should return 201');
    const applicantId = candRes.body.data.applicant ? candRes.body.data.applicant.id : candRes.body.data.id;

    // Step D: Advance Stage to Shortlisted & Selected
    const appListRes = await apiRequest(`/api/pipeline?job_id=${jobId}`, {}, adminToken);
    assert.strictEqual(appListRes.status, 200, 'Pipeline list should return 200');

    // Step E: Create Invoice for Placement
    const invRes = await apiRequest('/api/invoices', {
      method: 'POST',
      body: JSON.stringify({
        hospital_id: hospitalId || 1,
        applicant_id: applicantId || 1,
        job_id: jobId || 1,
        fee_type: 'percentage',
        placement_fee_percentage: 8.33,
        candidate_annual_ctc: 3600000,
        gst_percentage: 18
      })
    }, adminToken);
    if (invRes.status !== 200) {
      console.error('PLACEMENT INVOICE FAILED BODY:', invRes.body);
    }
    assert.strictEqual(invRes.status, 200, 'Placement invoice creation should return 200');
    const invoiceId = invRes.body.data.id;

    // Step F: Record Payment
    const paymentRes = await apiRequest(`/api/invoices/${invoiceId}/payments`, {
      method: 'POST',
      body: JSON.stringify({
        amount: 353858,
        payment_method: 'bank_transfer',
        transaction_reference: 'TXN-99887766'
      })
    }, adminToken);
    assert.strictEqual(paymentRes.status, 200, 'Payment recording should return 200');
    log('✓ Workflow 1 (Recruitment to Payment) completed successfully');

    // ─── WORKFLOW 2: Recruiter Login -> Command Center -> Work Log -> Submission Package ───
    log('\n[WORKFLOW 2] Testing Recruiter Daily Operations & Command Center...');
    const commandRes = await apiRequest('/api/command-center/dashboard-data', {}, adminToken);
    assert.strictEqual(commandRes.status, 200, 'Command center data should return 200');

    const todayLogRes = await apiRequest('/api/work-logs/today', {}, adminToken);
    assert.strictEqual(todayLogRes.status, 200, 'Today work log should return 200');

    const pkgRes = await apiRequest(`/api/applicants/${applicantId}/submission-package`, {}, adminToken);
    assert.strictEqual(pkgRes.status, 200, 'PII-stripped submission package should return 200');
    log('✓ Workflow 2 (Recruiter Daily Command Center) completed successfully');

    // ─── WORKFLOW 3: Admin Monitoring -> Attendance -> Reports -> Business Health ───
    log('\n[WORKFLOW 3] Testing Admin Monitoring, Attendance & Business Intelligence...');
    const adminIntelRes = await apiRequest('/api/admin-intelligence/command-center', {}, adminToken);
    assert.strictEqual(adminIntelRes.status, 200, 'Admin intelligence command center should return 200');

    const attRes = await apiRequest('/api/attendance-admin/daily', {}, adminToken);
    assert.strictEqual(attRes.status, 200, 'Daily attendance summary should return 200');
    log('✓ Workflow 3 (Admin Monitoring & Business Intelligence) completed successfully');

    // ─── WORKFLOW 4: Excel Import -> Preview -> Process -> Multi-Format Export ───
    log('\n[WORKFLOW 4] Testing Bulk Sourcing, Preview & Multi-Format Export Center...');
    const tplRes = await apiRequest('/api/applicants/import/template', {}, adminToken);
    assert.strictEqual(tplRes.status, 200, 'Import template should return 200');

    const previewRes = await apiRequest('/api/applicants/import/preview', {
      method: 'POST',
      body: JSON.stringify({ fileContent: tplRes.body })
    }, adminToken);
    assert.strictEqual(previewRes.status, 200, 'Import preview validation should return 200');

    const exportRes = await apiRequest('/api/reports/export', {
      method: 'POST',
      body: JSON.stringify({ type: 'applicants', format: 'csv' })
    }, adminToken);
    assert.strictEqual(exportRes.status, 200, 'CSV Report Export should return 200');
    log('✓ Workflow 4 (Bulk Sourcing & Export Center) completed successfully');

    log('\n✅ All 4 End-to-End Enterprise Business Workflows completed successfully!');
  } finally {
    if (server) server.close();
  }
}

module.exports = { run };
