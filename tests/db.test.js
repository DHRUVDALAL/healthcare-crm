'use strict';

const assert = require('assert');
const { getPool } = require('../backend/config/db');

async function run(log) {
  const pool = getPool();
  log('Starting Database Validation Tests...');

  // 1. Connection Ping
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    log('✓ Database connection ping successful');
  } catch (err) {
    throw new Error('Database connection failed: ' + err.message);
  }

  // 2. Table Exist Verification
  const expectedTables = [
    'users',
    'employee_logs',
    'hospitals',
    'jobs',
    'applicants',
    'candidate_matches',
    'applications',
    'application_stage_history',
    'interviews',
    'invoices',
    'referral_rewards',
    'leaves',
    'salary_records',
    'reminders',
    'monthly_projections',
    'permissions',
    'role_permissions',
    'notifications',
    'audit_logs',
    'activity_logs',
    'candidate_notes',
    'candidate_tags',
    'resume_history',
    'referrers'
  ];

  const [tables] = await pool.query('SHOW TABLES');
  const tableNames = tables.map(t => Object.values(t)[0]);

  for (const exp of expectedTables) {
    assert(tableNames.includes(exp), `Expected table "${exp}" does not exist in schema`);
    log(`✓ Table "${exp}" exists`);
  }

  // 3. Columns & Key Constraint checks (on users, jobs, applicants)
  const [userCols] = await pool.query('DESCRIBE users');
  const emailCol = userCols.find(c => c.Field === 'email');
  assert(emailCol, 'Table "users" must contain an "email" column');
  assert(emailCol.Key === 'UNI', 'Column "email" in table "users" must be UNIQUE');
  log('✓ Column "email" uniqueness constraint verified on "users"');

  const [jobCols] = await pool.query('DESCRIBE jobs');
  const openingsCol = jobCols.find(c => c.Field === 'openings_count');
  assert(openingsCol, 'Table "jobs" must contain "openings_count"');
  log('✓ Column "openings_count" verified on "jobs"');

  const [appCols] = await pool.query('DESCRIBE applicants');
  const resumeCol = appCols.find(c => c.Field === 'original_resume_path');
  assert(resumeCol, 'Table "applicants" must contain "original_resume_path"');
  log('✓ Column "original_resume_path" verified on "applicants"');

  // 4. Foreign Key Constraints check
  const [fkRows] = await pool.query(`
    SELECT TABLE_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE REFERENCED_TABLE_SCHEMA = ?
  `, [process.env.DB_NAME]);

  const fkApps = fkRows.filter(r => r.TABLE_NAME === 'applications');
  assert(fkApps.some(r => r.REFERENCED_TABLE_NAME === 'applicants'), 'applications table missing foreign key to applicants');
  assert(fkApps.some(r => r.REFERENCED_TABLE_NAME === 'jobs'), 'applications table missing foreign key to jobs');
  assert(fkApps.some(r => r.REFERENCED_TABLE_NAME === 'hospitals'), 'applications table missing foreign key to hospitals');
  log('✓ Referential Integrity: foreign key relations checked on table "applications"');

  log('All Database Schema and Connection tests PASSED.');
}

module.exports = { run };
