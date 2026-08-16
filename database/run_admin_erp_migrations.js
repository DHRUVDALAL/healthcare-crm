'use strict';

const fs = require('fs');
const path = require('path');
const backendDir = path.join(__dirname, '..', 'backend');

require(path.join(backendDir, 'node_modules', 'dotenv')).config({ path: path.join(backendDir, '.env') });
const { getPool } = require(path.join(backendDir, 'config', 'db'));

async function runMigration(pool, title, sql) {
  try {
    console.log(`  Running: ${title}`);
    await pool.query(sql);
    console.log(`  ✓ ${title}`);
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_KEYNAME' || err.message.includes('Duplicate column') || err.message.includes('Duplicate key name')) {
      console.log(`  ⊘ ${title} (already exists, skipping)`);
    } else {
      console.error(`  ✗ ${title}: ${err.message}`);
    }
  }
}

async function main() {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    console.log('Starting Admin ERP migrations...');

    // 1. Custom Roles
    console.log('\n[1/12] Custom Roles tables...');
    await runMigration(conn, 'custom_roles table', `
      CREATE TABLE IF NOT EXISTS custom_roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_name VARCHAR(100) NOT NULL UNIQUE,
        display_name VARCHAR(150) NOT NULL,
        description TEXT NULL,
        is_system TINYINT(1) NOT NULL DEFAULT 0,
        created_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await runMigration(conn, 'custom_role_permissions table', `
      CREATE TABLE IF NOT EXISTS custom_role_permissions (
        custom_role_id INT NOT NULL,
        permission_id INT NOT NULL,
        PRIMARY KEY (custom_role_id, permission_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 2. Hospital Payments
    console.log('\n[2/12] Hospital Payments table...');
    await runMigration(conn, 'hospital_payments table', `
      CREATE TABLE IF NOT EXISTS hospital_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        hospital_id INT NOT NULL,
        invoice_number VARCHAR(64) NULL,
        amount DECIMAL(12,2) NOT NULL,
        due_date DATE NOT NULL,
        paid_date DATE NULL,
        payment_method ENUM('bank_transfer','cheque','cash','upi','card','other') NULL,
        status ENUM('pending','paid','overdue','cancelled') NOT NULL DEFAULT 'pending',
        remarks TEXT NULL,
        created_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_hp_hospital (hospital_id),
        KEY idx_hp_status (status),
        KEY idx_hp_due (due_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 3. Company Holidays
    console.log('\n[3/12] Company Holidays table...');
    await runMigration(conn, 'company_holidays table', `
      CREATE TABLE IF NOT EXISTS company_holidays (
        id INT AUTO_INCREMENT PRIMARY KEY,
        holiday_name VARCHAR(200) NOT NULL,
        holiday_date DATE NOT NULL,
        holiday_type ENUM('national','optional','company','other') NOT NULL DEFAULT 'national',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_holiday_date (holiday_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 4. Employee Documents
    console.log('\n[4/12] Employee Documents table...');
    await runMigration(conn, 'employee_documents table', `
      CREATE TABLE IF NOT EXISTS employee_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id INT NOT NULL,
        document_type ENUM('offer_letter','id_proof','address_proof','education_cert','experience_letter','salary_slip','other') NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        uploaded_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 5. Add attendance_status to employee_logs
    console.log('\n[5/12] Attendance status column...');
    await runMigration(conn, 'employee_logs.attendance_status', `
      ALTER TABLE employee_logs ADD COLUMN attendance_status ENUM('present','absent','half_day','on_leave','remote','holiday') NULL
    `);

    // 6. Extend leave types
    console.log('\n[6/12] Extended leave types...');
    await runMigration(conn, 'leaves.leave_type extend', `
      ALTER TABLE leaves MODIFY COLUMN leave_type ENUM('sick','casual','paid','emergency','earned','wfh','compensatory') NOT NULL
    `);

    // 7. Add bank/tax columns to users
    console.log('\n[7/12] Employee financial columns...');
    await runMigration(conn, 'users.bank_name', `ALTER TABLE users ADD COLUMN bank_name VARCHAR(160) NULL`);
    await runMigration(conn, 'users.bank_account_no', `ALTER TABLE users ADD COLUMN bank_account_no VARCHAR(80) NULL`);
    await runMigration(conn, 'users.ifsc_code', `ALTER TABLE users ADD COLUMN ifsc_code VARCHAR(40) NULL`);
    await runMigration(conn, 'users.pan_number', `ALTER TABLE users ADD COLUMN pan_number VARCHAR(20) NULL`);
    await runMigration(conn, 'users.aadhar_number', `ALTER TABLE users ADD COLUMN aadhar_number VARCHAR(20) NULL`);

    // 8. Add tax/pf/esi to salary_records
    console.log('\n[8/12] Salary tax columns...');
    await runMigration(conn, 'salary_records.tax', `ALTER TABLE salary_records ADD COLUMN tax DECIMAL(10,2) NOT NULL DEFAULT 0.00`);
    await runMigration(conn, 'salary_records.pf', `ALTER TABLE salary_records ADD COLUMN pf DECIMAL(10,2) NOT NULL DEFAULT 0.00`);
    await runMigration(conn, 'salary_records.esi', `ALTER TABLE salary_records ADD COLUMN esi DECIMAL(10,2) NOT NULL DEFAULT 0.00`);

    // 9. Seed default company holidays
    console.log('\n[9/12] Seeding company holidays...');
    const year = new Date().getFullYear();
    const holidays = [
      ['New Year Day', `${year}-01-01`, 'national'],
      ['Republic Day', `${year}-01-26`, 'national'],
      ['Holi', `${year}-03-14`, 'national'],
      ['Good Friday', `${year}-04-18`, 'national'],
      ['May Day', `${year}-05-01`, 'national'],
      ['Independence Day', `${year}-08-15`, 'national'],
      ['Ganesh Chaturthi', `${year}-08-27`, 'national'],
      ['Gandhi Jayanti', `${year}-10-02`, 'national'],
      ['Dussehra', `${year}-10-11`, 'national'],
      ['Diwali', `${year}-10-31`, 'national'],
      ['Christmas', `${year}-12-25`, 'national']
    ];
    for (const [name, date, type] of holidays) {
      await conn.query('INSERT IGNORE INTO company_holidays (holiday_name, holiday_date, holiday_type) VALUES (?, ?, ?)', [name, date, type]);
    }
    console.log('  ✓ Company holidays seeded');

    // 10. Ensure attendance_status is set for today's logs
    console.log('\n[10/12] Setting attendance status for existing logs...');
    await runMigration(conn, 'Backfill attendance_status', `
      UPDATE employee_logs SET attendance_status = 'present' WHERE attendance_status IS NULL
    `);

    // 11. Insert default custom roles
    console.log('\n[11/12] Seeding default custom roles...');
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
      await conn.query('INSERT IGNORE INTO custom_roles (role_name, display_name, description, is_system) VALUES (?, ?, ?, ?)', [name, display, desc, sys]);
    }
    console.log('  ✓ Default custom roles seeded');

    // 12. Assign permissions to default roles
    console.log('\n[12/12] Assigning permissions to custom roles...');
    const [roles] = await conn.query('SELECT id, role_name FROM custom_roles');
    const [allPerms] = await conn.query('SELECT id, permission_key FROM permissions');

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
        await conn.query('INSERT IGNORE INTO custom_role_permissions (custom_role_id, permission_id) VALUES (?, ?)', [role.id, pid]);
      }
    }
    console.log('  ✓ Permissions assigned to custom roles');

    console.log('\nAdmin ERP migrations completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    conn.release();
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
