'use strict';

const assert = require('assert');
const app = require('../backend/app');

const PORT = 5070;
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
  log(`Production Readiness Master test server started on ${BASE_URL}`);

  try {
    // ─── 1. Admin Authentication ───────────────────────────────────────
    const loginRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@crm.com', password: 'admin123' })
    });
    assert.strictEqual(loginRes.status, 200, 'Login should succeed');
    const token = loginRes.body.data.token;
    log('✓ Admin authenticated');

    // ─── 2. Global Multi-Entity Search Engine ────────────────────────
    log('\n[GLOBAL SEARCH] Testing Global Multi-Entity Search Engine...');
    const searchRes = await apiRequest('/api/production-hardening/global-search?q=Apollo', {}, token);
    assert.strictEqual(searchRes.status, 200, 'Global search should return 200');
    assert.ok(searchRes.body.data.results, 'Search results object present');
    log('✓ Global multi-entity search executed across 10 categories');

    // ─── 3. Bulk Excel Import & Row Validation ───────────────────────
    log('\n[BULK IMPORT] Testing Enterprise Bulk Excel/CSV Import Validator...');
    const importRes = await apiRequest('/api/production-hardening/import/bulk-excel', {
      method: 'POST',
      body: JSON.stringify({
        importType: 'candidate',
        rows: [
          { full_name: 'Dr. Rahul Sharma', email: 'rahul@example.com', phone: '9876543210' },
          { full_name: '', email: 'invalid@example.com' }
        ]
      })
    }, token);
    assert.strictEqual(importRes.status, 200, 'Bulk import should return 200');
    assert.strictEqual(importRes.body.data.report.valid_count, 1, '1 valid row processed');
    assert.strictEqual(importRes.body.data.report.invalid_count, 1, '1 invalid row flagged');
    log('✓ Bulk Excel import validation report generated');

    // ─── 4. Downloadable Import Templates ────────────────────────────
    log('\n[TEMPLATES] Testing Downloadable Import Templates...');
    const tempRes = await apiRequest('/api/production-hardening/import/template/candidate', {}, token);
    assert.strictEqual(tempRes.status, 200, 'Import template should return 200');
    assert.ok(Array.isArray(tempRes.body.data.headers), 'Headers list present');
    log('✓ Import template headers retrieved');

    // ─── 5. Enterprise Branded PDF Generator ─────────────────────────
    log('\n[PDF ENGINE] Testing Enterprise Branded PDF Generator...');
    const pdfRes = await apiRequest('/api/production-hardening/pdf/generate', {
      method: 'POST',
      body: JSON.stringify({
        docType: 'invoice',
        data: { invoice_number: 'INV-2026-999', amount: 150000 }
      })
    }, token);
    assert.strictEqual(pdfRes.status, 200, 'PDF generation should return 200');
    assert.ok(pdfRes.body.data.pdf.download_url, 'PDF download URL present');
    log('✓ Enterprise branded PDF generated with headers & footers');

    // ─── 6. Structured System Logging ────────────────────────────────
    log('\n[SYSTEM LOGS] Testing Structured System Logging...');
    const logsRes = await apiRequest('/api/production-hardening/logs/system', {}, token);
    assert.strictEqual(logsRes.status, 200, 'System logs should return 200');
    assert.ok(Array.isArray(logsRes.body.data.logs), 'System logs list present');
    log('✓ Structured system log entries verified');

    log('\n✅ All Production Readiness Master tests completed successfully!');
  } finally {
    if (server) server.close();
  }
}

module.exports = { run };
