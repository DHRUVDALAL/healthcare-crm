const assert = require('assert');
const app = require('../backend/app');
const { getPool } = require('../backend/config/db');

const PORT = 5056;
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
  log(`Admin ERP test server started on ${BASE_URL}`);

  try {
    // ─── 2. Admin Auth Login ──────────────────────────────────────────────────
    const adminLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@crm.com', password: 'admin123' })
    });
    assert.strictEqual(adminLogin.status, 200, 'Admin login should succeed');
    const adminToken = adminLogin.body.data.token;
    log('✓ Admin login authenticated');

    // ─── 3. Module 1 & 13: Admin Dashboard & Analytics ─────────────────────────
    log('\n[MODULE 1 & 13] Executive Admin Dashboard & Analytics');
    const dashRes = await apiRequest('/api/dashboard/stats', {}, adminToken);
    assert.strictEqual(dashRes.status, 200, 'Dashboard stats API should return 200');
    assert.ok(dashRes.body.data.recruitment, 'Dashboard should return recruitment KPIs');
    assert.ok(dashRes.body.data.employees, 'Dashboard should return employee KPIs');
    assert.ok(dashRes.body.data.finance, 'Dashboard should return business & finance KPIs');
    assert.ok(dashRes.body.data.productivity, 'Dashboard should return productivity KPIs');
    assert.ok(dashRes.body.data.charts, 'Dashboard should return chart datasets');
    log('✓ Executive Admin Dashboard KPIs & Charts verified');

    const perfRes = await apiRequest('/api/analytics/performance', {}, adminToken);
    assert.strictEqual(perfRes.status, 200, 'Analytics performance endpoint should return 200');
    log('✓ Performance Analytics endpoint verified');

    // ─── 4. Module 2: Employee Management & Profile ───────────────────────────
    log('\n[MODULE 2] Employee Management & Employee Profile');
    const empList = await apiRequest('/api/employees', {}, adminToken);
    assert.strictEqual(empList.status, 200, 'Employee list API should return 200');
    assert.ok(Array.isArray(empList.body.data.employees), 'Employee list should be an array');
    log(`✓ Employees listed (${empList.body.data.employees.length} users)`);

    const workloadRes = await apiRequest('/api/employees/workload', {}, adminToken);
    assert.strictEqual(workloadRes.status, 200, 'Workload API should return 200');
    log('✓ Employee workload analysis verified');

    // Test Detailed Profile endpoint
    const firstEmpId = empList.body.data.employees[0]?.id || 1;
    const profileRes = await apiRequest(`/api/employees/${firstEmpId}/profile`, {}, adminToken);
    assert.strictEqual(profileRes.status, 200, 'Employee Profile API should return 200');
    assert.ok(profileRes.body.data.employee, 'Profile should include employee detail object');
    assert.ok(Array.isArray(profileRes.body.data.assigned_candidates), 'Profile should include assigned candidates');
    log('✓ Detailed Employee Profile endpoint verified');

    // ─── 5. Module 3: Role Management (RBAC) ──────────────────────────────────
    log('\n[MODULE 3] Role Management (RBAC)');
    const rolesRes = await apiRequest('/api/custom-roles', {}, adminToken);
    assert.strictEqual(rolesRes.status, 200, 'Custom roles list should return 200');
    assert.ok(Array.isArray(rolesRes.body.data.roles), 'Roles should return array');

    const permsRes = await apiRequest('/api/custom-roles/permissions', {}, adminToken);
    assert.strictEqual(permsRes.status, 200, 'Permissions matrix map should return 200');
    assert.ok(Array.isArray(permsRes.body.data.permissions), 'Permissions should return array');
    log('✓ RBAC Custom Roles & Permission Matrix endpoints verified');

    // ─── 6. Module 4: Attendance Management ────────────────────────────────────
    log('\n[MODULE 4] Attendance Management');
    const dailyAtt = await apiRequest('/api/attendance-admin/daily', {}, adminToken);
    assert.strictEqual(dailyAtt.status, 200, 'Daily attendance API should return 200');
    assert.ok(Array.isArray(dailyAtt.body.data.attendance), 'Daily attendance should return array');

    const summaryAtt = await apiRequest('/api/attendance-admin/monthly', {}, adminToken);
    assert.strictEqual(summaryAtt.status, 200, 'Attendance monthly summary should return 200');
    log('✓ Daily Attendance & Monthly Summary endpoints verified');

    // ─── 7. Module 5: Leave Management ─────────────────────────────────────────
    log('\n[MODULE 5] Leave Management');
    const leavePending = await apiRequest('/api/leaves?status=pending', {}, adminToken);
    assert.strictEqual(leavePending.status, 200, 'Pending leaves list API should return 200');

    const leaveBalance = await apiRequest('/api/leaves/balance', {}, adminToken);
    assert.strictEqual(leaveBalance.status, 200, 'Leave balance API should return 200');
    log('✓ Leave Requests & Leave Balance verified');

    // ─── 8. Module 6 & 7: Salary & Finance ─────────────────────────────────────
    log('\n[MODULE 6 & 7] Salary & Finance ERP');
    const salRes = await apiRequest('/api/salary', {}, adminToken);
    assert.strictEqual(salRes.status, 200, 'Salary list API should return 200');

    const invRes = await apiRequest('/api/invoices', {}, adminToken);
    assert.strictEqual(invRes.status, 200, 'Invoices list API should return 200');

    const hospPayRes = await apiRequest('/api/hospital-payments', {}, adminToken);
    assert.strictEqual(hospPayRes.status, 200, 'Hospital Payments API should return 200');
    log('✓ Salary, Invoices, and Hospital Payments endpoints verified');

    // ─── 9. Module 8: Reports Engine & Export ──────────────────────────────────
    log('\n[MODULE 8] Reports Engine & Export Formats');
    const reportExport = await apiRequest('/api/reports/export', {
      method: 'POST',
      body: JSON.stringify({ type: 'hospitals', format: 'csv' })
    }, adminToken);
    assert.strictEqual(reportExport.status, 200, 'CSV report export should return 200');
    log('✓ CSV Report Export generated successfully');

    // ─── 10. Modules 9-12: Calendar, Notifications, Settings & Audit Logs ─────
    log('\n[MODULES 9-12] Calendar, Notifications, Settings & Audit Logs');
    const calEvents = await apiRequest('/api/calendar/events', {}, adminToken);
    assert.strictEqual(calEvents.status, 200, 'Calendar events API should return 200');

    const notifRes = await apiRequest('/api/notifications', {}, adminToken);
    assert.strictEqual(notifRes.status, 200, 'Notifications API should return 200');

    const settingsRes = await apiRequest('/api/settings', {}, adminToken);
    assert.strictEqual(settingsRes.status, 200, 'Settings API should return 200');

    const auditRes = await apiRequest('/api/audit-logs', {}, adminToken);
    assert.strictEqual(auditRes.status, 200, 'Audit logs API should return 200');
    log('✓ Calendar, Notifications, Settings, and Audit Logs verified');

    log('\n✅ All Admin ERP 13 Modules verified successfully!');
  } finally {
    if (server) {
      server.close();
    }
  }
}

module.exports = { run };
