'use strict';

/**
 * employeePortal.test.js
 * 
 * Comprehensive integration tests for the Employee Recruitment Portal:
 *  - Role-based access control (RBAC)
 *  - Recruiter candidate ownership isolation
 *  - Follow-up CRUD operations
 *  - Task comments & attachments APIs
 *  - Analytics (my-performance, leaderboard)
 *  - Calendar aggregated events
 *  - Profile self-management (details, password)
 */

const assert = require('assert');
const app = require('../backend/app');
const { getPool } = require('../backend/config/db');
const bcrypt = require('../backend/node_modules/bcrypt');

const PORT = 5055;
const BASE_URL = `http://localhost:${PORT}`;

async function apiRequest(path, options = {}, token = null) {
  const headers = Object.assign({}, options.headers || {});
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function run(log) {
  const server = app.listen(PORT);
  await new Promise((resolve) => server.once('listening', resolve));
  log(`Test server started on ${BASE_URL}`);

  const pool = getPool();

  // ─── Email constants (used by pre-cleanup and seed) ─────────────────────────
  const emp1Email = 'emp1_portal_test@crm.com';
  const emp2Email = 'emp2_portal_test@crm.com';
  const pwHash = await bcrypt.hash('Password123!', 12);

  // ─── Pre-cleanup: Remove any leftover data from previous runs ──────────────
  const prevUsers = await pool.query('SELECT id FROM users WHERE email IN (?, ?)', [emp1Email, emp2Email]);
  if (prevUsers[0].length > 0) {
    const prevIds = prevUsers[0].map(u => u.id);
    for (const id of prevIds) {
      await pool.query('DELETE FROM task_comments WHERE task_id IN (SELECT id FROM tasks WHERE assigned_to = ?)', [id]);
      await pool.query('DELETE FROM tasks WHERE assigned_to = ? OR assigned_by = ?', [id, id]);
      await pool.query('DELETE FROM candidate_follow_ups WHERE employee_id = ?', [id]);
      await pool.query('DELETE FROM applicants WHERE attended_by = ? OR created_by = ?', [id, id]);
    }
    await pool.query('DELETE FROM users WHERE email IN (?, ?)', [emp1Email, emp2Email]);
  }

  // ─── Seed Data ─────────────────────────────────────────────────────────────
  const [emp1Insert] = await pool.query(
    `INSERT INTO users (full_name, email, password, role, status, phone) VALUES (?, ?, ?, 'employee', 'active', ?)`,
    ['Employee One', emp1Email, pwHash, '9000000001']
  );
  const emp1Id = emp1Insert.insertId;

  const [emp2Insert] = await pool.query(
    `INSERT INTO users (full_name, email, password, role, status, phone) VALUES (?, ?, ?, 'employee', 'active', ?)`,
    ['Employee Two', emp2Email, pwHash, '9000000002']
  );
  const emp2Id = emp2Insert.insertId;

  log(`✓ Seeded test employees: emp1_id=${emp1Id}, emp2_id=${emp2Id}`);

  // ─── Login ──────────────────────────────────────────────────────────────────
  const adminLogin = await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@crm.com', password: 'admin123' }) });
  assert.strictEqual(adminLogin.status, 200, 'Admin login should succeed');
  const adminToken = adminLogin.body.data.token;
  log('✓ Admin login succeeded');

  const emp1Login = await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: emp1Email, password: 'Password123!' }) });
  assert.strictEqual(emp1Login.status, 200, 'Employee 1 login should succeed');
  const emp1Token = emp1Login.body.data.token;
  log('✓ Employee 1 login succeeded');

  const emp2Login = await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: emp2Email, password: 'Password123!' }) });
  assert.strictEqual(emp2Login.status, 200, 'Employee 2 login should succeed');
  const emp2Token = emp2Login.body.data.token;
  log('✓ Employee 2 login succeeded');

  // ─── 1. Role-Based Page Access (RBAC) ───────────────────────────────────────
  log('\n[RBAC] Testing admin-only route access...');
  const salaryForbidden = await apiRequest('/api/salary', {}, emp1Token);
  assert.ok([403, 401, 404].includes(salaryForbidden.status), 'Employee should NOT access salary endpoint');
  log('✓ Employee blocked from /api/salary');

  const invoiceForbidden = await apiRequest('/api/invoices', {}, emp1Token);
  assert.ok([403, 401].includes(invoiceForbidden.status), 'Employee should NOT access invoices');
  log('✓ Employee blocked from /api/invoices');

  const reportsForbidden = await apiRequest('/api/analytics/performance', {}, emp1Token);
  assert.ok([403, 401].includes(reportsForbidden.status), 'Employee should NOT access admin performance analytics');
  log('✓ Employee blocked from /api/analytics/performance (admin-only)');

  // ─── 2. Employee-specific analytics endpoints ───────────────────────────────
  log('\n[ANALYTICS] Testing employee analytics endpoints...');
  const myPerf = await apiRequest('/api/analytics/my-performance', {}, emp1Token);
  assert.strictEqual(myPerf.status, 200, 'Employee should access /api/analytics/my-performance');
  assert.ok(myPerf.body.data.todaySummary, 'Response should contain todaySummary');
  assert.ok(myPerf.body.data.stats, 'Response should contain stats');
  assert.ok(myPerf.body.data.stats.weekly, 'Stats should contain weekly');
  assert.ok(myPerf.body.data.stats.monthly, 'Stats should contain monthly');
  assert.ok(myPerf.body.data.stats.quarterly, 'Stats should contain quarterly');
  log('✓ /api/analytics/my-performance accessible and returns correct shape');

  const leaderboard = await apiRequest('/api/analytics/leaderboard', {}, emp1Token);
  assert.strictEqual(leaderboard.status, 200, 'Employee should access /api/analytics/leaderboard');
  assert.ok(Array.isArray(leaderboard.body.data.leaderboard), 'Leaderboard should be an array');
  log('✓ /api/analytics/leaderboard accessible and returns array');

  // ─── 3. Calendar Aggregated Events ──────────────────────────────────────────
  log('\n[CALENDAR] Testing calendar/events endpoint...');
  const calEvents = await apiRequest('/api/calendar/events', {}, emp1Token);
  assert.strictEqual(calEvents.status, 200, '/api/calendar/events should return 200');
  assert.ok(Array.isArray(calEvents.body.data.events), 'events should be an array');
  log('✓ /api/calendar/events accessible and returns array');

  // ─── 4. Candidate Ownership Isolation ───────────────────────────────────────
  log('\n[OWNERSHIP] Testing recruiter candidate ownership...');

  // Seed an applicant assigned to emp1
  const [jobRows] = await pool.query('SELECT id FROM jobs LIMIT 1');
  const jobId = jobRows.length ? jobRows[0].id : null;

  const [applicantInsert] = await pool.query(
    `INSERT INTO applicants (full_name, email, phone, dob, gender, city, state, address,
      total_experience, current_company, current_designation, current_salary, expected_salary,
      notice_period, qualification, skills, preferred_location, source, candidate_status,
      attended_by, created_by, original_resume_path)
     VALUES ('Test Candidate', 'testcand_eptest@mail.com', '9111111111', '1990-01-01', 'male',
      'Mumbai', 'Maharashtra', '123 Test St', 2, 'TestCo', 'Recruiter', 40000, 50000,
      '30 days', 'Bachelors', 'Nursing', 'Mumbai', 'call', 'active', ?, ?, '')`,
    [emp1Id, emp1Id]
  );
  const candidateId = applicantInsert.insertId;
  log(`✓ Test candidate seeded with id=${candidateId}, assigned to emp1`);

  // Emp1 can view their own candidate
  const emp1ViewOwn = await apiRequest(`/api/applicants/${candidateId}`, {}, emp1Token);
  assert.strictEqual(emp1ViewOwn.status, 200, 'emp1 should see own candidate');
  log('✓ Employee 1 can view their own assigned candidate');

  // Emp2 should NOT be able to view emp1's candidate
  const emp2ViewOther = await apiRequest(`/api/applicants/${candidateId}`, {}, emp2Token);
  assert.ok([403, 404].includes(emp2ViewOther.status), 'emp2 should not access emp1\'s candidate');
  log('✓ Employee 2 blocked from viewing emp1\'s candidate (ownership enforced)');

  // Emp2 should NOT be able to update emp1's candidate
  const emp2UpdateOther = await apiRequest(`/api/applicants/${candidateId}`, {
    method: 'PUT',
    body: JSON.stringify({ full_name: 'Hack Attempt' })
  }, emp2Token);
  assert.ok([403, 404].includes(emp2UpdateOther.status), 'emp2 should not update emp1\'s candidate');
  log('✓ Employee 2 blocked from updating emp1\'s candidate');

  // ─── 5. Follow-up CRUD ──────────────────────────────────────────────────────
  log('\n[FOLLOW-UPS] Testing follow-up CRUD operations...');

  // Create follow-up for own candidate
  const fuCreate = await apiRequest('/api/follow-ups', {
    method: 'POST',
    body: JSON.stringify({
      applicant_id: candidateId,
      follow_up_date: new Date().toISOString().slice(0, 10),
      mode: 'call',
      outcome: 'interested',
      remarks: 'Candidate is interested in the role'
    })
  }, emp1Token);
  assert.strictEqual(fuCreate.status, 201, 'Follow-up creation should return 201');
  const followUpId = fuCreate.body.data.id;
  log(`✓ Follow-up created with id=${followUpId}`);

  // Emp2 should NOT be able to create follow-up for emp1's candidate
  const fuCreateForbidden = await apiRequest('/api/follow-ups', {
    method: 'POST',
    body: JSON.stringify({
      applicant_id: candidateId,
      follow_up_date: new Date().toISOString().slice(0, 10),
      mode: 'call',
      outcome: 'interested'
    })
  }, emp2Token);
  assert.ok([403, 404].includes(fuCreateForbidden.status), 'emp2 should not create follow-up for emp1\'s candidate');
  log('✓ Employee 2 blocked from adding follow-up on emp1\'s candidate');

  // List follow-ups
  const fuList = await apiRequest(`/api/follow-ups?applicant_id=${candidateId}`, {}, emp1Token);
  assert.strictEqual(fuList.status, 200, 'Follow-up list should return 200');
  assert.ok(Array.isArray(fuList.body.data.followUps), 'Should return followUps array');
  log('✓ Follow-up list returned correctly');

  // Delete follow-up
  const fuDelete = await apiRequest(`/api/follow-ups/${followUpId}`, { method: 'DELETE' }, emp1Token);
  assert.strictEqual(fuDelete.status, 200, 'Follow-up deletion should return 200');
  log('✓ Follow-up deleted successfully');

  // ─── 6. Task Comments and Completion % ─────────────────────────────────────
  log('\n[TASKS] Testing task comments and completion % APIs...');

  // Seed a task assigned to emp1
  const [taskInsert] = await pool.query(
    `INSERT INTO tasks (title, description, assigned_to, assigned_by, due_date, priority, status, completion_percentage)
     VALUES ('EP Test Task', 'Employee portal test task', ?, ?, DATE_ADD(CURDATE(), INTERVAL 3 DAY), 'medium', 'pending', 0)`,
    [emp1Id, emp1Id]
  );
  const taskId = taskInsert.insertId;
  log(`✓ Test task seeded with id=${taskId}`);

  // Update completion %
  const taskPctUpdate = await apiRequest(`/api/tasks/${taskId}/completion`, {
    method: 'PATCH',
    body: JSON.stringify({ completion_percentage: 50 })
  }, emp1Token);
  assert.strictEqual(taskPctUpdate.status, 200, 'Completion % update should return 200');
  log('✓ Task completion percentage updated to 50%');

  // Add comment
  const commentCreate = await apiRequest(`/api/tasks/${taskId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ comment_text: 'Making progress on this task' })
  }, emp1Token);
  assert.strictEqual(commentCreate.status, 201, 'Task comment creation should return 201');
  const commentId = commentCreate.body.data.id;
  log(`✓ Task comment created with id=${commentId}`);

  // List comments
  const commentList = await apiRequest(`/api/tasks/${taskId}/comments`, {}, emp1Token);
  assert.strictEqual(commentList.status, 200, 'Comment list should return 200');
  assert.ok(Array.isArray(commentList.body.data.comments), 'Should return comments array');
  log('✓ Task comment list returned correctly');

  // Delete comment
  const commentDelete = await apiRequest(`/api/tasks/comments/${commentId}`, { method: 'DELETE' }, emp1Token);
  assert.strictEqual(commentDelete.status, 200, 'Comment deletion should return 200');
  log('✓ Task comment deleted successfully');

  // ─── 7. Profile Self-Management ─────────────────────────────────────────────
  log('\n[PROFILE] Testing self-profile management...');

  // Get own profile
  const profileGet = await apiRequest('/api/auth/profile', {}, emp1Token);
  assert.strictEqual(profileGet.status, 200, 'Profile GET should return 200');
  assert.strictEqual(profileGet.body.data.user.email, emp1Email, 'Returned profile should match logged-in user');
  log('✓ Profile GET returns own profile data correctly');

  // Update profile details
  const profileUpdate = await apiRequest('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify({ full_name: 'Employee One Updated', phone: '9000000099' })
  }, emp1Token);
  assert.strictEqual(profileUpdate.status, 200, 'Profile PUT should return 200');
  log('✓ Profile details updated successfully');

  // Verify update persisted
  const profileGetAfter = await apiRequest('/api/auth/profile', {}, emp1Token);
  assert.strictEqual(profileGetAfter.body.data.user.full_name, 'Employee One Updated', 'Profile name should be updated');
  log('✓ Profile update persisted correctly');

  // Change password
  const pwChange = await apiRequest('/api/auth/password', {
    method: 'PATCH',
    body: JSON.stringify({ current_password: 'Password123!', new_password: 'NewPassword456!' })
  }, emp1Token);
  assert.strictEqual(pwChange.status, 200, 'Password change should return 200');
  log('✓ Password changed successfully');

  // Verify old password no longer works
  const loginOldPw = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: emp1Email, password: 'Password123!' })
  });
  assert.ok([401, 400].includes(loginOldPw.status), 'Old password should no longer work after change');
  log('✓ Old password rejected after password change');

  // Verify new password works
  const loginNewPw = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: emp1Email, password: 'NewPassword456!' })
  });
  assert.strictEqual(loginNewPw.status, 200, 'New password should log in successfully');
  log('✓ New password works after change');

  // ─── 8. Admin Can Access All ─────────────────────────────────────────────────
  log('\n[ADMIN] Verifying admin can access all candidates...');
  const adminViewCandidate = await apiRequest(`/api/applicants/${candidateId}`, {}, adminToken);
  assert.strictEqual(adminViewCandidate.status, 200, 'Admin should see any candidate regardless of assignment');
  log('✓ Admin can view any candidate');

  const adminPerf = await apiRequest('/api/analytics/my-performance', {}, adminToken);
  assert.strictEqual(adminPerf.status, 200, 'Admin should also access my-performance');
  log('✓ Admin can access /api/analytics/my-performance');

  // ─── 9. Unauthenticated Access Blocked ──────────────────────────────────────
  log('\n[SECURITY] Testing unauthenticated access...');
  const unauthMyPerf = await apiRequest('/api/analytics/my-performance');
  assert.ok([401, 403].includes(unauthMyPerf.status), 'Unauthenticated access to my-performance must be blocked');
  log('✓ Unauthenticated request to /api/analytics/my-performance blocked');

  const unauthFollowups = await apiRequest('/api/follow-ups?applicant_id=1');
  assert.ok([401, 403].includes(unauthFollowups.status), 'Unauthenticated access to follow-ups must be blocked');
  log('✓ Unauthenticated request to /api/follow-ups blocked');

  // ─── Cleanup ────────────────────────────────────────────────────────────────
  log('\n[CLEANUP] Removing test data...');
  await pool.query('DELETE FROM task_comments WHERE task_id = ?', [taskId]);
  await pool.query('DELETE FROM tasks WHERE id = ?', [taskId]);
  await pool.query('DELETE FROM candidate_follow_ups WHERE applicant_id = ?', [candidateId]);
  await pool.query('DELETE FROM applicants WHERE id = ?', [candidateId]);
  await pool.query('DELETE FROM users WHERE email IN (?, ?)', [emp1Email, emp2Email]);
  log('✓ Test data cleaned up');

  log('\n✅ All Employee Portal tests passed!');

  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

module.exports = { run };
