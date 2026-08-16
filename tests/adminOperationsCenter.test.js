'use strict';

const assert = require('assert');
const app = require('../backend/app');

const PORT = 5069;
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
  log(`Admin Operations Center System test server started on ${BASE_URL}`);

  try {
    // ─── 1. Admin Authentication ───────────────────────────────────────
    const loginRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@crm.com', password: 'admin123' })
    });
    assert.strictEqual(loginRes.status, 200, 'Login should succeed');
    const token = loginRes.body.data.token;
    log('✓ Admin authenticated');

    // ─── 2. Executive 25-KPI Dashboard ───────────────────────────────
    log('\n[EXECUTIVE DASHBOARD] Testing Executive 25-KPI Dashboard Dataset...');
    const kpiRes = await apiRequest('/api/admin-operations-center/dashboard-kpis', {}, token);
    assert.strictEqual(kpiRes.status, 200, 'Dashboard KPIs should return 200');
    assert.ok(kpiRes.body.data.kpis.total_hospitals >= 0, 'Total hospitals KPI present');
    assert.ok(kpiRes.body.data.kpis.jobs_open >= 0, 'Jobs open KPI present');
    assert.ok(kpiRes.body.data.kpis.daily_productivity_score > 0, 'Daily productivity score present');
    log('✓ Executive 25-KPI Dashboard dataset verified');

    // ─── 3. Extended Hospital ERP Profiles ───────────────────────────
    log('\n[HOSPITAL ERP] Testing Extended Hospital ERP Profiles & Contracts...');
    const hospRes = await apiRequest('/api/admin-operations-center/hospitals/extended', {}, token);
    assert.strictEqual(hospRes.status, 200, 'Extended hospitals should return 200');
    assert.ok(Array.isArray(hospRes.body.data.hospitals), 'Hospitals list should be array');
    log('✓ Extended Hospital ERP profiles dataset verified');

    // ─── 4. Employee Management & Fine-Grained RBAC ─────────────────
    log('\n[EMPLOYEE RBAC] Testing Employee RBAC Role & Permission Updates...');
    const rbacRes = await apiRequest('/api/admin-operations-center/employees/rbac', {
      method: 'POST',
      body: JSON.stringify({
        userId: 2,
        role: 'recruiter',
        permissions: ['manage_candidates', 'schedule_interviews']
      })
    }, token);
    if (rbacRes.status !== 200) {
      console.error('EMPLOYEE RBAC FAILED BODY:', rbacRes.body);
    }
    assert.strictEqual(rbacRes.status, 200, 'Employee RBAC update should return 200');
    log('✓ Employee RBAC role and permissions updated');

    // ─── 5. Task Management ERP Bulk Assignment ──────────────────────
    log('\n[TASK ERP] Testing Task Management ERP Bulk Assignment...');
    const taskRes = await apiRequest('/api/admin-operations-center/tasks/bulk', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Complete Monthly Recruitment Audit',
        description: 'Verify all candidate submission packages for hospital submissions',
        priority: 'high',
        dueDate: '2026-08-20'
      })
    }, token);
    assert.strictEqual(taskRes.status, 201, 'Task bulk assignment should return 201');
    log('✓ Task assigned successfully via Admin Task ERP');

    // ─── 6. Finance ERP Summary & GST Ledger ─────────────────────────
    log('\n[FINANCE ERP] Testing Finance ERP Summary & GST Ledger...');
    const finRes = await apiRequest('/api/admin-operations-center/finance/summary', {}, token);
    assert.strictEqual(finRes.status, 200, 'Finance ERP summary should return 200');
    assert.ok(finRes.body.data.summary.total_billed_amount >= 0, 'Billed amount present');
    log('✓ Finance ERP summary dataset verified');

    // ─── 7. Enterprise Report Center & Multi-Format Export ───────────
    log('\n[REPORT CENTER] Testing Report Export Center...');
    const repRes = await apiRequest('/api/admin-operations-center/reports/export-center', {
      method: 'POST',
      body: JSON.stringify({
        reportType: 'placement_revenue',
        format: 'pdf'
      })
    }, token);
    assert.strictEqual(repRes.status, 200, 'Report export should return 200');
    log('✓ Enterprise report export generated');

    // ─── 8. Aggregated Enterprise Calendar ───────────────────────────
    log('\n[ENTERPRISE CALENDAR] Testing Enterprise Calendar Aggregation...');
    const calRes = await apiRequest('/api/admin-operations-center/calendar/enterprise', {}, token);
    assert.strictEqual(calRes.status, 200, 'Enterprise calendar should return 200');
    assert.ok(Array.isArray(calRes.body.data.events), 'Calendar events list should be array');
    log('✓ Aggregated Enterprise Calendar events verified');

    // ─── 9. System Audit Log Trail ───────────────────────────────────
    log('\n[AUDIT LOGS] Testing System Audit Log Trail...');
    const auditRes = await apiRequest('/api/admin-operations-center/audit-logs', {}, token);
    assert.strictEqual(auditRes.status, 200, 'Audit logs should return 200');
    log('✓ System Audit Log trail verified');

    // ─── 10. Company Settings Management ─────────────────────────────
    log('\n[COMPANY SETTINGS] Testing Company Settings Get & Post...');
    const setRes = await apiRequest('/api/admin-operations-center/settings', {
      method: 'POST',
      body: JSON.stringify({
        settingKey: 'company_working_hours',
        settingValue: { start: '09:00', end: '18:00', timezone: 'IST' },
        category: 'general'
      })
    }, token);
    assert.strictEqual(setRes.status, 200, 'Company settings save should return 200');
    log('✓ Company settings saved');

    // ─── 11. Database Backup & Restore Engine ────────────────────────
    log('\n[BACKUP ENGINE] Testing Manual Database Backup Creation...');
    const bupRes = await apiRequest('/api/admin-operations-center/backup/create', {
      method: 'POST'
    }, token);
    assert.strictEqual(bupRes.status, 201, 'Backup creation should return 201');
    log('✓ Manual database backup file created & logged');

    // ─── 12. Live Server System Health ──────────────────────────────
    log('\n[SYSTEM HEALTH] Testing Live System Health Metrics...');
    const healthRes = await apiRequest('/api/admin-operations-center/system-health', {}, token);
    assert.strictEqual(healthRes.status, 200, 'System health should return 200');
    assert.ok(healthRes.body.data.health.memory_used_mb > 0, 'Memory usage present');
    assert.strictEqual(healthRes.body.data.health.api_health, 'healthy', 'API health status healthy');
    log('✓ Live server System Health indicators verified');

    log('\n✅ All Admin Operations Center System tests completed successfully!');
  } finally {
    if (server) server.close();
  }
}

module.exports = { run };
