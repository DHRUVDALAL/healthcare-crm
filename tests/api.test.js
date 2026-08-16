'use strict';

const assert = require('assert');
const app = require('../backend/app');
const { getPool } = require('../backend/config/db');
const bcrypt = require('../backend/node_modules/bcrypt');

const PORT = 5051;
const BASE_URL = `http://localhost:${PORT}`;

async function run(log) {
  const server = app.listen(PORT);
  await new Promise((resolve) => server.once('listening', resolve));
  log(`Express test server listening on ${BASE_URL}`);

  const pool = getPool();

  try {
    // 1. Create a test recruiter user in the database directly
    const testRecruiterEmail = 'recruiter_test@crm.com';
    await pool.query('DELETE FROM users WHERE email = ?', [testRecruiterEmail]);
    
    // Hash password 'recruiter123'
    const passwordHash = await bcrypt.hash('recruiter123', 12);
    const [userInsert] = await pool.query(
      `INSERT INTO users (full_name, email, password, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['Test Recruiter', testRecruiterEmail, passwordHash, 'employee', 'active']
    );
    const recruiterId = userInsert.insertId;
    log('✓ Test recruiter user seeded directly in database');

    // 2. Admin Login API Test
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@crm.com', password: 'admin123' })
    });
    
    assert.strictEqual(adminLoginRes.status, 200, 'Admin login status should be 200');
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginData.data.token, 'Admin login must return a token');
    const adminToken = adminLoginData.data.token;
    log('✓ Admin login API test passed');

    // 3. Recruiter Login API Test
    const recruiterLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testRecruiterEmail, password: 'recruiter123' })
    });
    
    assert.strictEqual(recruiterLoginRes.status, 200, 'Recruiter login status should be 200');
    const recruiterLoginData = await recruiterLoginRes.json();
    assert(recruiterLoginData.data.token, 'Recruiter login must return a token');
    const recruiterToken = recruiterLoginData.data.token;
    log('✓ Recruiter login API test passed');

    // 4. Invalid Login Credentials Test
    const badLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@crm.com', password: 'wrongpassword' })
    });
    assert.strictEqual(badLoginRes.status, 401, 'Bad credentials should return 401');
    log('✓ Invalid credentials test passed');

    // 5. Auth Middleware Protection (401 Unauthorized)
    const protectedRes = await fetch(`${BASE_URL}/api/dashboard/stats`);
    assert.strictEqual(protectedRes.status, 401, 'Request without token should return 401');
    log('✓ Unauthenticated request protection verified');

    // 6. Admin accessing protected dashboard
    const adminDashboardRes = await fetch(`${BASE_URL}/api/dashboard/stats`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(adminDashboardRes.status, 200, 'Admin dashboard request should be 200');
    const dbStats = await adminDashboardRes.json();
    assert(dbStats.data, 'Dashboard stats should return data object');
    log('✓ Authorized admin dashboard access verified');

    // 7. Role-Based Access Control (403 Forbidden)
    // Recruiter trying to save settings (POST /api/settings)
    const recruiterSettingsRes = await fetch(`${BASE_URL}/api/settings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${recruiterToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ company_name: 'Malicious Inc' })
    });
    assert.strictEqual(recruiterSettingsRes.status, 403, 'Employee should be forbidden from modifying settings');
    log('✓ RBAC Authorization: Employee access restriction verified (403)');

    // 8. 404 Route Handling
    const unknownRes = await fetch(`${BASE_URL}/api/invalid-route-name-123`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(unknownRes.status, 404, 'Unknown routes should return 404');
    log('✓ API 404 error handler verified');

    // Clean up test recruiter
    await pool.query('DELETE FROM users WHERE id = ?', [recruiterId]);
    log('✓ Test recruiter user cleaned up');

  } finally {
    server.close();
    log('Express test server stopped.');
  }
}

module.exports = { run };
