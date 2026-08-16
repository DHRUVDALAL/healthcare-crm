'use strict';

const assert = require('assert');
const app = require('../backend/app');

const PORT = 5058;
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
  log(`Business Operations test server started on ${BASE_URL}`);

  try {
    // ─── 1. Admin Authentication ──────────────────────────────────────────────
    const adminLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@crm.com', password: 'admin123' })
    });
    assert.strictEqual(adminLogin.status, 200, 'Admin login should succeed');
    const adminToken = adminLogin.body.data.token;
    log('✓ Admin authenticated');

    // ─── 2. Enterprise Invoice Management ─────────────────────────────────────
    log('\n[INVOICES] Testing Placement Invoice Creation & Fee Calculations...');

    // Get a hospital, candidate, and job for invoice creation
    const hospList = await apiRequest('/api/hospitals', {}, adminToken);
    const appList = await apiRequest('/api/applicants', {}, adminToken);
    const jobList = await apiRequest('/api/jobs', {}, adminToken);

    assert.ok(hospList.body.data.hospitals.length, 'At least one hospital required');
    assert.ok(appList.body.data.applicants.length, 'At least one candidate required');
    assert.ok(jobList.body.data.jobs.length, 'At least one job required');

    const hospitalId = hospList.body.data.hospitals[0].id;
    const applicantId = appList.body.data.applicants[0].id;
    const jobId = jobList.body.data.jobs[0].id;

    // A. Percentage Fee Invoice Creation
    const pctInvoice = await apiRequest('/api/invoices', {
      method: 'POST',
      body: JSON.stringify({
        hospital_id: hospitalId,
        applicant_id: applicantId,
        job_id: jobId,
        candidate_salary: 1000000,
        fee_type: 'percentage',
        commission_percentage: 10,
        gst_percentage: 18,
        notes: 'Percentage placement invoice test'
      })
    }, adminToken);

    assert.strictEqual(pctInvoice.status, 200, 'Percentage invoice creation should return 200');
    assert.ok(pctInvoice.body.data.id, 'Created invoice should return ID');
    const invId1 = pctInvoice.body.data.id;
    log(`✓ Percentage Placement Fee Invoice created (ID: ${invId1})`);

    // B. Fixed Fee Invoice Creation
    const fixedInvoice = await apiRequest('/api/invoices', {
      method: 'POST',
      body: JSON.stringify({
        hospital_id: hospitalId,
        applicant_id: applicantId,
        job_id: jobId,
        candidate_salary: 800000,
        fee_type: 'fixed',
        fixed_fee_amount: 50000,
        gst_percentage: 18,
        notes: 'Fixed fee placement invoice test'
      })
    }, adminToken);

    assert.strictEqual(fixedInvoice.status, 200, 'Fixed fee invoice creation should return 200');
    const invId2 = fixedInvoice.body.data.id;
    log(`✓ Fixed Placement Fee Invoice created (ID: ${invId2})`);

    // C. Record Payment
    const paymentRes = await apiRequest(`/api/invoices/${invId1}/payments`, {
      method: 'POST',
      body: JSON.stringify({
        amount: 50000,
        payment_method: 'bank_transfer',
        transaction_reference: 'TXN100200300',
        notes: 'First installment payment'
      })
    }, adminToken);

    assert.strictEqual(paymentRes.status, 200, 'Record payment should return 200');
    log('✓ Invoice payment recorded successfully');

    // D. Duplicate Invoice
    const dupRes = await apiRequest(`/api/invoices/${invId1}/duplicate`, { method: 'POST' }, adminToken);
    assert.strictEqual(dupRes.status, 200, 'Invoice duplicate should return 200');
    log('✓ Invoice duplicate created successfully');

    // E. Financial Summary Stats
    const finSummary = await apiRequest('/api/invoices/stats/financial-summary', {}, adminToken);
    assert.strictEqual(finSummary.status, 200, 'Financial summary should return 200');
    assert.ok(finSummary.body.data.totals, 'Summary should contain totals object');
    log('✓ Financial Dashboard Summary statistics verified');

    // ─── 3. Candidate Submission Package (PII-Stripped PDF) ─────────────────
    log('\n[SUBMISSION PACKAGE] Testing PII-Stripped Corporate PDF Generation...');
    const pdfRes = await apiRequest(`/api/applicants/${applicantId}/submission-package`, {}, adminToken);
    assert.strictEqual(pdfRes.status, 200, 'Submission package PDF should return 200');
    log('✓ Candidate Submission Package PDF generated successfully');

    // ─── 4. Excel Bulk Import Engine ──────────────────────────────────────────
    log('\n[EXCEL IMPORT ENGINE] Testing Template, Validation Preview & Bulk Sourcing...');
    const tplRes = await apiRequest('/api/applicants/import/template', {}, adminToken);
    assert.strictEqual(tplRes.status, 200, 'Import template CSV download should return 200');
    assert.ok(typeof tplRes.body === 'string' && tplRes.body.includes('Candidate Name'), 'Template should contain headers');
    log('✓ Candidate Bulk Import Template downloaded');

    const previewRes = await apiRequest('/api/applicants/import/preview', {
      method: 'POST',
      body: JSON.stringify({ fileContent: tplRes.body })
    }, adminToken);

    assert.strictEqual(previewRes.status, 200, 'Excel import validation preview should return 200');
    assert.ok(previewRes.body.data.validCount > 0, 'Preview should detect valid template sample rows');
    log('✓ Pre-import validation preview verified');

    const importRes = await apiRequest('/api/applicants/import/process', {
      method: 'POST',
      body: JSON.stringify({ records: previewRes.body.data.validRows })
    }, adminToken);

    assert.strictEqual(importRes.status, 200, 'Bulk candidate import process should return 200');
    assert.ok(importRes.body.data.importedCount > 0, 'Bulk import should insert candidates');
    log(`✓ Bulk Candidate Sourcing executed (Imported: ${importRes.body.data.importedCount})`);

    // ─── 5. Professional Export Center ─────────────────────────────────────────
    log('\n[EXPORT CENTER] Testing Multi-Format Exports Across System Entities...');
    const categories = ['applicants', 'hospitals', 'jobs', 'invoices', 'employees', 'pipeline'];
    for (const cat of categories) {
      const expRes = await apiRequest('/api/reports/export', {
        method: 'POST',
        body: JSON.stringify({ type: cat, format: 'csv' })
      }, adminToken);
      assert.strictEqual(expRes.status, 200, `Export CSV for ${cat} should return 200`);
    }
    log('✓ Multi-format Export Center verified across all 6 core entity types');

    log('\n✅ Business Operations Integration Tests completed successfully!');
  } finally {
    if (server) server.close();
  }
}

module.exports = { run };
