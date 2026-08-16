'use strict';

require('dotenv').config();

const app = require('./app');
const { testDbConnection, getPool } = require('./config/db');
const { initDb } = require('./utils/dbInit');
const UserModel = require('./models/userModel');

const PORT = Number(process.env.PORT || 5050);

async function runAdminErpMigrations() {
  const pool = getPool();
  const migrations = [
    `CREATE TABLE IF NOT EXISTS custom_roles (id INT AUTO_INCREMENT PRIMARY KEY, role_name VARCHAR(100) NOT NULL UNIQUE, display_name VARCHAR(150) NOT NULL, description TEXT NULL, is_system TINYINT(1) NOT NULL DEFAULT 0, created_by INT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS custom_role_permissions (custom_role_id INT NOT NULL, permission_id INT NOT NULL, PRIMARY KEY (custom_role_id, permission_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS hospital_payments (id INT AUTO_INCREMENT PRIMARY KEY, hospital_id INT NOT NULL, invoice_number VARCHAR(64) NULL, amount DECIMAL(12,2) NOT NULL, due_date DATE NOT NULL, paid_date DATE NULL, payment_method ENUM('bank_transfer','cheque','cash','upi','card','other') NULL, status ENUM('pending','paid','overdue','cancelled') NOT NULL DEFAULT 'pending', remarks TEXT NULL, created_by INT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, KEY idx_hp_hospital (hospital_id), KEY idx_hp_status (status), KEY idx_hp_due (due_date)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS company_holidays (id INT AUTO_INCREMENT PRIMARY KEY, holiday_name VARCHAR(200) NOT NULL, holiday_date DATE NOT NULL, holiday_type ENUM('national','optional','company','other') NOT NULL DEFAULT 'national', is_active TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_holiday_date (holiday_date)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS employee_documents (id INT AUTO_INCREMENT PRIMARY KEY, employee_id INT NOT NULL, document_type ENUM('offer_letter','id_proof','address_proof','education_cert','experience_letter','salary_slip','other') NOT NULL, file_name VARCHAR(255) NOT NULL, file_path VARCHAR(500) NOT NULL, uploaded_by INT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `ALTER TABLE employee_logs ADD COLUMN IF NOT EXISTS attendance_status ENUM('present','absent','half_day','on_leave','remote','holiday') NULL`,
    `ALTER TABLE leaves MODIFY COLUMN leave_type ENUM('sick','casual','paid','emergency','earned','wfh','compensatory') NOT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_name VARCHAR(160) NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_account_no VARCHAR(80) NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(40) NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS pan_number VARCHAR(20) NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhar_number VARCHAR(20) NULL`,
    `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS tax DECIMAL(10,2) NOT NULL DEFAULT 0.00`,
    `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS pf DECIMAL(10,2) NOT NULL DEFAULT 0.00`,
    `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS esi DECIMAL(10,2) NOT NULL DEFAULT 0.00`
  ];

  for (const sql of migrations) {
    try { await pool.query(sql); } catch (e) { /* skip existing */ }
  }

  // Seed default custom roles
  const defaultRoles = [
    ['system_admin', 'System Admin', 'Full system access', 1],
    ['hr_admin', 'HR Admin', 'Human resources administration', 0],
    ['recruitment_manager', 'Recruitment Manager', 'Manages recruitment team', 0],
    ['recruiter', 'Recruiter', 'Handles candidate recruitment', 0],
    ['finance_manager', 'Finance Manager', 'Manages financial operations', 0],
    ['hr_executive', 'HR Executive', 'Handles day-to-day HR tasks', 0],
    ['viewer', 'Viewer', 'Read-only access', 0]
  ];
  for (const [name, display, desc, sys] of defaultRoles) {
    try { await pool.query('INSERT IGNORE INTO custom_roles (role_name, display_name, description, is_system) VALUES (?, ?, ?, ?)', [name, display, desc, sys]); } catch (e) { /* skip */ }
  }

  // Seed company holidays
  const year = new Date().getFullYear();
  const holidays = [
    ['New Year Day', `${year}-01-01`, 'national'],
    ['Republic Day', `${year}-01-26`, 'national'],
    ['Independence Day', `${year}-08-15`, 'national'],
    ['Gandhi Jayanti', `${year}-10-02`, 'national'],
    ['Christmas', `${year}-12-25`, 'national']
  ];
  for (const [name, date, type] of holidays) {
    try { await pool.query('INSERT IGNORE INTO company_holidays (holiday_name, holiday_date, holiday_type) VALUES (?, ?, ?)', [name, date, type]); } catch (e) { /* skip */ }
  }

  // Assign permissions to custom roles
  const [roles] = await pool.query('SELECT id, role_name FROM custom_roles');
  const [allPerms] = await pool.query('SELECT id, permission_key FROM permissions');
  if (allPerms.length > 0) {
    const rolePermMap = {
      'system_admin': allPerms.map(p => p.id),
      'hr_admin': allPerms.filter(p => ['view_dashboard','view_employees','manage_employees','view_attendance','manage_attendance','view_leaves','approve_leaves','view_tasks','manage_tasks','view_calendar','manage_calendar','view_notifications','view_reports','view_salary','manage_salary','view_audit_logs'].includes(p.permission_key)).map(p => p.id),
      'recruitment_manager': allPerms.filter(p => ['view_dashboard','view_hospitals','manage_hospitals','view_jobs','manage_jobs','view_applicants','manage_applicants','assign_recruiter','run_matching','view_pool','reassign_pool','view_pipeline','update_pipeline_stage','view_interviews','manage_interviews','record_feedback','view_referrals','view_tasks','manage_tasks','view_calendar','manage_calendar','view_reports'].includes(p.permission_key)).map(p => p.id),
      'recruiter': allPerms.filter(p => ['view_dashboard','view_hospitals','view_jobs','view_applicants','manage_applicants','run_matching','view_pool','view_pipeline','update_pipeline_stage','view_interviews','manage_interviews','record_feedback','view_referrals','view_leaves','view_tasks','view_calendar','manage_calendar','view_notifications'].includes(p.permission_key)).map(p => p.id),
      'finance_manager': allPerms.filter(p => ['view_dashboard','view_hospitals','view_invoices','manage_invoices','view_salary','manage_salary','view_reports','view_projections','manage_projections','view_audit_logs'].includes(p.permission_key)).map(p => p.id),
      'hr_executive': allPerms.filter(p => ['view_dashboard','view_employees','view_attendance','manage_attendance','view_leaves','approve_leaves','view_tasks','view_calendar','manage_calendar','view_notifications','view_reports'].includes(p.permission_key)).map(p => p.id),
      'viewer': allPerms.filter(p => p.permission_key.startsWith('view_')).map(p => p.id)
    };
    for (const role of roles) {
      const permIds = rolePermMap[role.role_name] || [];
      for (const pid of permIds) {
        try { await pool.query('INSERT IGNORE INTO custom_role_permissions (custom_role_id, permission_id) VALUES (?, ?)', [role.id, pid]); } catch (e) { /* skip */ }
      }
    }
  }

  console.log('Admin ERP migrations completed');
}

async function start() {
  try {
    await testDbConnection();
    await initDb();
    await UserModel.ensureAdminSeed();
    await runAdminErpMigrations();

    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Backend running on http://localhost:${PORT}`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
