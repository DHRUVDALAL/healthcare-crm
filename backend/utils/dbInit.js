'use strict';

const { getPool } = require('../config/db');

async function initDb() {
  const pool = getPool();

  // Core schema (Part 1)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(100) NOT NULL,
      email VARCHAR(191) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role ENUM('admin','employee') NOT NULL DEFAULT 'employee',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Ensure users table extended columns exist
  await pool.query(`ALTER TABLE users ADD COLUMN phone VARCHAR(32) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN department VARCHAR(120) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN designation VARCHAR(120) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN joining_date DATE NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN monthly_salary DECIMAL(12,2) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN emergency_contact VARCHAR(80) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN address TEXT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN status ENUM('active','inactive') NOT NULL DEFAULT 'active'`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN notes TEXT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN photo_path VARCHAR(500) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN theme VARCHAR(30) NOT NULL DEFAULT 'light'`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN notification_preferences TEXT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN bank_name VARCHAR(160) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN bank_account_no VARCHAR(80) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN ifsc_code VARCHAR(40) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN pan_number VARCHAR(20) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN aadhar_number VARCHAR(20) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN custom_role_id INT NULL`).catch(() => {});

  // Ensure applicants table extended columns exist
  await pool.query(`ALTER TABLE applicants ADD COLUMN assigned_recruiter_id INT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE applicants ADD COLUMN available_from DATE NULL`).catch(() => {});
  await pool.query(`ALTER TABLE applicants ADD COLUMN attended_by INT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE applicants ADD COLUMN assignment_status ENUM('Unassigned', 'Assigned', 'Transferred', 'Completed', 'Archived') NOT NULL DEFAULT 'Unassigned'`).catch(() => {});
  await pool.query(`ALTER TABLE applicants ADD COLUMN priority ENUM('high', 'medium', 'low') NOT NULL DEFAULT 'medium'`).catch(() => {});
  await pool.query(`ALTER TABLE applicants ADD COLUMN preferred_hospital_id INT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE applicants ADD COLUMN offer_letter_path VARCHAR(500) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE applicants ADD COLUMN preferred_location VARCHAR(140) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE applicants ADD COLUMN current_ctc DECIMAL(12,2) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE applicants ADD COLUMN expected_ctc DECIMAL(12,2) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE applicants ADD COLUMN notice_period VARCHAR(80) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE applicants ADD COLUMN source VARCHAR(80) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE applicants ADD COLUMN referred_by VARCHAR(140) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE applicants ADD COLUMN referral_contact VARCHAR(80) NULL`).catch(() => {});

  // Ensure jobs table extended columns exist
  await pool.query(`ALTER TABLE jobs ADD COLUMN filled_count INT NOT NULL DEFAULT 0`).catch(() => {});
  await pool.query(`ALTER TABLE jobs ADD COLUMN expiry_date DATE NULL`).catch(() => {});

  // Ensure hospitals table extended columns exist
  await pool.query(`ALTER TABLE hospitals ADD COLUMN onboarding_status ENUM('prospecting','negotiation','signed','active','inactive') NOT NULL DEFAULT 'active'`).catch(() => {});

  // Ensure invoices table extended columns exist
  await pool.query(`ALTER TABLE invoices ADD COLUMN fee_type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage'`).catch(() => {});
  await pool.query(`ALTER TABLE invoices ADD COLUMN fixed_fee_amount DECIMAL(12,2) NULL DEFAULT 0.00`).catch(() => {});
  await pool.query(`ALTER TABLE invoices ADD COLUMN subtotal DECIMAL(12,2) NULL DEFAULT 0.00`).catch(() => {});
  await pool.query(`ALTER TABLE invoices ADD COLUMN gst_percentage DECIMAL(5,2) NULL DEFAULT 0.00`).catch(() => {});
  await pool.query(`ALTER TABLE invoices ADD COLUMN gst_amount DECIMAL(12,2) NULL DEFAULT 0.00`).catch(() => {});
  await pool.query(`ALTER TABLE invoices ADD COLUMN paid_amount DECIMAL(12,2) NULL DEFAULT 0.00`).catch(() => {});
  await pool.query(`ALTER TABLE invoices ADD COLUMN payment_method VARCHAR(64) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE invoices ADD COLUMN transaction_reference VARCHAR(128) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE invoices ADD COLUMN created_by INT NULL`).catch(() => {});

  // Ensure tasks table extended columns exist
  await pool.query(`ALTER TABLE tasks ADD COLUMN estimated_hours DECIMAL(5,2) NULL DEFAULT 0.00`).catch(() => {});
  await pool.query(`ALTER TABLE tasks ADD COLUMN actual_hours DECIMAL(5,2) NULL DEFAULT 0.00`).catch(() => {});
  await pool.query(`ALTER TABLE tasks ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0`).catch(() => {});
  await pool.query(`ALTER TABLE tasks ADD COLUMN category VARCHAR(64) NULL DEFAULT 'recruitment'`).catch(() => {});
  await pool.query(`ALTER TABLE tasks ADD COLUMN completion_percentage INT NOT NULL DEFAULT 0`).catch(() => {});

  // Ensure employee logs table extended columns exist
  await pool.query(`ALTER TABLE employee_logs ADD COLUMN attendance_status ENUM('present','absent','half_day','on_leave','remote','holiday') NULL`).catch(() => {});

  // Ensure salary records table extended columns exist
  await pool.query(`ALTER TABLE salary_records ADD COLUMN tax DECIMAL(10,2) NOT NULL DEFAULT 0.00`).catch(() => {});
  await pool.query(`ALTER TABLE salary_records ADD COLUMN pf DECIMAL(10,2) NOT NULL DEFAULT 0.00`).catch(() => {});
  await pool.query(`ALTER TABLE salary_records ADD COLUMN esi DECIMAL(10,2) NOT NULL DEFAULT 0.00`).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS employee_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      login_time DATETIME NULL,
      logout_time DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_employee_logs_user_logout (user_id, logout_time),
      CONSTRAINT fk_employee_logs_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Part 2 schema: hospitals + jobs
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hospitals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      contact_person VARCHAR(120) NOT NULL,
      phone VARCHAR(32) NOT NULL,
      email VARCHAR(191) NOT NULL,
      address VARCHAR(500) NOT NULL,
      city VARCHAR(80) NOT NULL,
      state VARCHAR(80) NOT NULL,
      commission_percentage DECIMAL(5,2) NOT NULL,
      agreement_start_date DATE NOT NULL,
      agreement_end_date DATE NOT NULL,
      notes TEXT NULL,
      status ENUM('active','inactive') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_hospitals_email (email),
      KEY idx_hospitals_name (name),
      KEY idx_hospitals_city (city),
      KEY idx_hospitals_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      hospital_id INT NOT NULL,
      job_title VARCHAR(140) NOT NULL,
      department VARCHAR(120) NOT NULL,
      qualification VARCHAR(200) NOT NULL,
      experience_required VARCHAR(120) NOT NULL,
      salary DECIMAL(12,2) NOT NULL,
      openings_count INT NOT NULL,
      location VARCHAR(120) NOT NULL,
      shift_timing VARCHAR(120) NOT NULL,
      job_description TEXT NOT NULL,
      required_skills VARCHAR(800) NOT NULL,
      joining_timeline VARCHAR(120) NOT NULL,
      priority_level ENUM('high','medium','low') NOT NULL DEFAULT 'medium',
      status ENUM('open','closed','hold') NOT NULL DEFAULT 'open',
      created_by INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_jobs_hospital (hospital_id),
      KEY idx_jobs_status (status),
      KEY idx_jobs_priority (priority_level),
      KEY idx_jobs_location (location),
      CONSTRAINT fk_jobs_hospital
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      CONSTRAINT fk_jobs_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Part 3 schema: applicants + resumes + referral base (extended in Part 4)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS applicants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(140) NOT NULL,
      phone VARCHAR(32) NOT NULL,
      email VARCHAR(191) NOT NULL,
      dob DATE NOT NULL,
      gender ENUM('male','female','other') NOT NULL,
      city VARCHAR(80) NOT NULL,
      state VARCHAR(80) NOT NULL,
      address VARCHAR(500) NOT NULL,
      total_experience DECIMAL(4,1) NOT NULL,
      current_company VARCHAR(160) NOT NULL,
      current_designation VARCHAR(160) NOT NULL,
      current_salary DECIMAL(12,2) NOT NULL,
      expected_salary DECIMAL(12,2) NOT NULL,
      notice_period VARCHAR(80) NOT NULL,
      qualification VARCHAR(200) NOT NULL,
      skills VARCHAR(1200) NOT NULL,
      certifications VARCHAR(600) NULL,
      preferred_location VARCHAR(120) NOT NULL,
      applied_job_id INT NULL,
      source ENUM('call','whatsapp','portal','social_media','referral') NOT NULL,
      referred_by VARCHAR(120) NULL,
      referral_contact VARCHAR(64) NULL,
      referral_reward_status ENUM('pending','eligible','rewarded') NOT NULL DEFAULT 'pending',
      notes TEXT NULL,
      candidate_status ENUM('active','hold','rejected','pool','selected') NOT NULL DEFAULT 'active',
      original_resume_path VARCHAR(500) NOT NULL,
      masked_resume_path VARCHAR(500) NULL,
      pool_status TINYINT(1) NOT NULL DEFAULT 0,
      matching_score INT NULL,
      created_by INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_applicants_name (full_name),
      KEY idx_applicants_status (candidate_status),
      KEY idx_applicants_pool (pool_status),
      KEY idx_applicants_source (source),
      KEY idx_applicants_job (applied_job_id),
      KEY idx_applicants_created_at (created_at),
      CONSTRAINT fk_applicants_job
        FOREIGN KEY (applied_job_id) REFERENCES jobs(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
      CONSTRAINT fk_applicants_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Backfill columns in existing installations (no-op if already present)
  await pool.query('ALTER TABLE applicants ADD COLUMN masked_resume_path VARCHAR(500) NULL').catch(() => {});
  await pool.query('ALTER TABLE applicants ADD COLUMN pool_status TINYINT(1) NOT NULL DEFAULT 0').catch(() => {});
  await pool.query('ALTER TABLE applicants ADD COLUMN matching_score INT NULL').catch(() => {});
  await pool.query('CREATE INDEX idx_applicants_pool ON applicants (pool_status)').catch(() => {});

  // Part 5 migration: extend candidate_status enum to include 'selected'
  await pool.query("ALTER TABLE applicants MODIFY COLUMN candidate_status ENUM('active','hold','rejected','pool','selected') NOT NULL DEFAULT 'active'");

  // Part 4 schema: candidate matches
  await pool.query(`
    CREATE TABLE IF NOT EXISTS candidate_matches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      applicant_id INT NOT NULL,
      job_id INT NOT NULL,
      match_score INT NOT NULL,
      match_notes VARCHAR(1000) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_candidate_matches_job (job_id),
      KEY idx_candidate_matches_applicant (applicant_id),
      CONSTRAINT fk_candidate_matches_applicant
        FOREIGN KEY (applicant_id) REFERENCES applicants(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      CONSTRAINT fk_candidate_matches_job
        FOREIGN KEY (job_id) REFERENCES jobs(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Part 5 schema: applications + stage history + interviews
  await pool.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      applicant_id INT NOT NULL,
      job_id INT NOT NULL,
      hospital_id INT NOT NULL,
      current_stage ENUM(
        'applied','shortlisted','sent_to_hospital','interview_scheduled','interview_completed','selected','rejected','moved_to_pool'
      ) NOT NULL DEFAULT 'applied',
      next_action VARCHAR(255) NOT NULL DEFAULT '',
      remarks TEXT NULL,
      created_by INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_applications_applicant_job (applicant_id, job_id),
      KEY idx_applications_stage (current_stage),
      KEY idx_applications_job (job_id),
      KEY idx_applications_hospital (hospital_id),
      KEY idx_applications_updated_at (updated_at),
      CONSTRAINT fk_applications_applicant
        FOREIGN KEY (applicant_id) REFERENCES applicants(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      CONSTRAINT fk_applications_job
        FOREIGN KEY (job_id) REFERENCES jobs(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      CONSTRAINT fk_applications_hospital
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      CONSTRAINT fk_applications_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS application_stage_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      application_id INT NOT NULL,
      old_stage VARCHAR(40) NOT NULL,
      new_stage VARCHAR(40) NOT NULL,
      changed_by INT NOT NULL,
      changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      notes VARCHAR(1000) NULL,
      KEY idx_app_stage_hist_application (application_id),
      KEY idx_app_stage_hist_changed_at (changed_at),
      CONSTRAINT fk_app_stage_hist_application
        FOREIGN KEY (application_id) REFERENCES applications(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      CONSTRAINT fk_app_stage_hist_changed_by
        FOREIGN KEY (changed_by) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS interviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      applicant_id INT NOT NULL,
      job_id INT NOT NULL,
      hospital_id INT NOT NULL,
      interview_date DATE NOT NULL,
      interview_time TIME NOT NULL,
      interview_mode ENUM('online','offline','telephonic') NOT NULL,
      interview_round INT NOT NULL DEFAULT 1,
      interviewer_name VARCHAR(160) NULL,
      meeting_details VARCHAR(500) NULL,
      feedback TEXT NULL,
      result ENUM('pending','selected','rejected','hold') NOT NULL DEFAULT 'pending',
      status ENUM('scheduled','completed','cancelled') NOT NULL DEFAULT 'scheduled',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_interviews_date (interview_date),
      KEY idx_interviews_status (status),
      KEY idx_interviews_result (result),
      KEY idx_interviews_applicant (applicant_id),
      KEY idx_interviews_job (job_id),
      KEY idx_interviews_hospital (hospital_id),
      CONSTRAINT fk_interviews_applicant
        FOREIGN KEY (applicant_id) REFERENCES applicants(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      CONSTRAINT fk_interviews_job
        FOREIGN KEY (job_id) REFERENCES jobs(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      CONSTRAINT fk_interviews_hospital
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Helpful index for finding active sessions quickly.
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_employee_logs_user_logout ON employee_logs (user_id, logout_time);`).catch(() => {
    // MySQL < 8.0 doesn't support IF NOT EXISTS for indexes; ignore.
  });

  // Create settings table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      setting_key VARCHAR(120) PRIMARY KEY,
      setting_value TEXT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Create invoices table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_number VARCHAR(64) NOT NULL UNIQUE,
      hospital_id INT NOT NULL,
      applicant_id INT NOT NULL,
      job_id INT NOT NULL,
      candidate_salary DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      commission_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      invoice_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      invoice_date DATE NOT NULL,
      due_date DATE NOT NULL,
      payment_status ENUM('pending','partially_paid','paid','overdue','cancelled') NOT NULL DEFAULT 'pending',
      payment_received_date DATE NULL,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_invoices_hospital (hospital_id),
      KEY idx_invoices_applicant (applicant_id),
      KEY idx_invoices_job (job_id),
      KEY idx_invoices_status (payment_status),
      CONSTRAINT fk_invoices_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE RESTRICT,
      CONSTRAINT fk_invoices_applicant FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE RESTRICT,
      CONSTRAINT fk_invoices_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Create invoice_payments table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoice_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_id INT NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      payment_date DATE NOT NULL,
      payment_method VARCHAR(64) NULL,
      transaction_reference VARCHAR(128) NULL,
      notes TEXT NULL,
      created_by INT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_invpay_invoice (invoice_id),
      CONSTRAINT fk_invoice_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Create referral_rewards table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS referral_rewards (
      id INT AUTO_INCREMENT PRIMARY KEY,
      applicant_id INT NOT NULL,
      referrer_name VARCHAR(140) NOT NULL,
      referrer_contact VARCHAR(80) NULL,
      reward_amount DECIMAL(12,2) NOT NULL DEFAULT 5000.00,
      reward_status ENUM('pending','eligible','rewarded','cancelled') NOT NULL DEFAULT 'pending',
      reward_paid_date DATE NULL,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_rr_applicant (applicant_id),
      KEY idx_rr_status (reward_status),
      CONSTRAINT fk_rr_applicant FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Create leaves table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leaves (
      id INT AUTO_INCREMENT PRIMARY KEY,
      employee_id INT NULL,
      user_id INT NULL,
      leave_type VARCHAR(60) NOT NULL DEFAULT 'Sick Leave',
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      total_days INT NOT NULL DEFAULT 1,
      reason TEXT NOT NULL,
      leave_status VARCHAR(50) NOT NULL DEFAULT 'pending',
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      admin_remarks TEXT NULL,
      approved_by INT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`ALTER TABLE leaves ADD COLUMN employee_id INT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE leaves ADD COLUMN user_id INT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE leaves ADD COLUMN total_days INT NOT NULL DEFAULT 1`).catch(() => {});
  await pool.query(`ALTER TABLE leaves ADD COLUMN leave_status VARCHAR(50) NOT NULL DEFAULT 'pending'`).catch(() => {});
  await pool.query(`ALTER TABLE leaves ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'pending'`).catch(() => {});
  await pool.query(`ALTER TABLE leaves ADD COLUMN admin_remarks TEXT NULL`).catch(() => {});

  // Create salary_records table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS salary_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      month VARCHAR(7) NOT NULL,
      basic_salary DECIMAL(10,2) NOT NULL,
      allowances DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      deductions DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      net_salary DECIMAL(10,2) NOT NULL,
      payment_date DATE NULL,
      status ENUM('pending','processed','paid') NOT NULL DEFAULT 'pending',
      remarks TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_salary_user_month (user_id, month),
      CONSTRAINT fk_salary_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`ALTER TABLE salary_records ADD COLUMN user_id INT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE salary_records ADD COLUMN employee_id INT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE salary_records ADD COLUMN salary_month VARCHAR(20) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE salary_records ADD COLUMN base_salary DECIMAL(10,2) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE salary_records ADD COLUMN bonus DECIMAL(10,2) NULL DEFAULT 0.00`).catch(() => {});
  await pool.query(`ALTER TABLE salary_records ADD COLUMN final_salary DECIMAL(10,2) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE salary_records ADD COLUMN payment_status VARCHAR(50) NOT NULL DEFAULT 'pending'`).catch(() => {});
  await pool.query(`ALTER TABLE salary_records ADD COLUMN notes TEXT NULL`).catch(() => {});

  // Create calendar_events table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT NULL,
      event_date DATE NOT NULL,
      event_time TIME NULL,
      event_type ENUM('interview','followup','meeting','deadline','reminder','other') NOT NULL DEFAULT 'other',
      entity_type ENUM('applicant','job','hospital','general') NOT NULL DEFAULT 'general',
      entity_id INT NULL,
      created_by INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_calevents_date (event_date),
      KEY idx_calevents_creator (created_by),
      CONSTRAINT fk_calevents_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Seed default settings
  const defaults = {
    company_name: 'HealthCRM Staffing',
    timezone: 'Asia/Kolkata',
    support_email: 'support@healthcrm.com',
    billing_currency: 'INR',
    invoice_prefix: 'HCRM',
    commission_percentage: '12',
    session_timeout: '30 minutes',
    require_otp: 'Enabled',
    interview_reminders: 'true',
    invoice_alerts: 'true',
    new_applicant_notifications: 'true',
    password_min_length: '8',
    password_require_special: 'true',
    smtp_host: 'smtp.gmail.com',
    smtp_port: '587',
    smtp_user: 'notifications@healthcrm.com',
    smtp_pass: '',
    max_upload_size_mb: '5'
  };

  for (const [key, value] of Object.entries(defaults)) {
    await pool.query(
      `INSERT IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`,
      [key, value]
    );
  }

  // --- Phase 1 Migrations ---

  // Alter applications table stage enum
  await pool.query(`
    ALTER TABLE applications MODIFY COLUMN current_stage ENUM(
      'applied','screening','shortlisted','sent_to_hospital','interview_scheduled','interview_completed','offer_released','selected','joined','rejected','moved_to_pool','archived'
    ) NOT NULL DEFAULT 'applied'
  `).catch(err => {
    console.error('Migration info: application current_stage modify ignored or failed:', err.message);
  });

  // Add assigned_recruiter_id to applicants
  await pool.query(`
    ALTER TABLE applicants ADD COLUMN assigned_recruiter_id INT NULL
  `).catch(() => {});
  
  await pool.query(`
    ALTER TABLE applicants ADD COLUMN available_from DATE NULL
  `).catch(() => {});

  // Add foreign key constraint to assigned_recruiter_id
  await pool.query(`
    ALTER TABLE applicants ADD CONSTRAINT fk_applicants_assigned_recruiter
    FOREIGN KEY (assigned_recruiter_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
  `).catch(() => {});

  // Add filled_count and expiry_date to jobs
  await pool.query(`
    ALTER TABLE jobs ADD COLUMN filled_count INT NOT NULL DEFAULT 0
  `).catch(() => {});

  await pool.query(`
    ALTER TABLE jobs ADD COLUMN expiry_date DATE NULL
  `).catch(() => {});

  // Create candidate_tags table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS candidate_tags (
      id INT AUTO_INCREMENT PRIMARY KEY,
      applicant_id INT NOT NULL,
      tag VARCHAR(80) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_candidate_tag (applicant_id, tag),
      KEY idx_tag_name (tag),
      CONSTRAINT fk_ctags_applicant FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Create candidate_notes table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS candidate_notes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      applicant_id INT NOT NULL,
      author_id INT NOT NULL,
      note_text TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_cnotes_applicant (applicant_id),
      CONSTRAINT fk_cnotes_applicant FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE,
      CONSTRAINT fk_cnotes_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Create resume_history table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS resume_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      applicant_id INT NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      file_type ENUM('original','masked') NOT NULL DEFAULT 'original',
      uploaded_by INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_reshist_applicant (applicant_id),
      CONSTRAINT fk_reshist_applicant FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE,
      CONSTRAINT fk_reshist_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Create tasks table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      task_type ENUM('daily','weekly','monthly') NOT NULL DEFAULT 'daily',
      priority ENUM('high','medium','low') NOT NULL DEFAULT 'medium',
      status ENUM('not_started','in_progress','completed','overdue') NOT NULL DEFAULT 'not_started',
      assigned_to INT NOT NULL,
      assigned_by INT NOT NULL,
      due_date DATE NOT NULL,
      due_time TIME NULL,
      completed_at DATETIME NULL,
      completion_notes TEXT NULL,
      review_notes TEXT NULL,
      review_rating TINYINT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_tasks_assigned (assigned_to),
      KEY idx_tasks_status (status),
      KEY idx_tasks_due (due_date),
      KEY idx_tasks_type (task_type),
      CONSTRAINT fk_tasks_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_tasks_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Create recruiter_targets table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS recruiter_targets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      recruiter_id INT NOT NULL,
      month VARCHAR(7) NOT NULL,
      submissions_target INT NOT NULL DEFAULT 0,
      selections_target INT NOT NULL DEFAULT 0,
      revenue_target DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_rt_recruiter_month (recruiter_id, month),
      CONSTRAINT fk_rt_recruiter FOREIGN KEY (recruiter_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // --- Phase 3 Migrations ---

  // Add onboarding_status to hospitals
  await pool.query(`
    ALTER TABLE hospitals ADD COLUMN onboarding_status ENUM('prospecting','negotiation','signed','active','inactive') NOT NULL DEFAULT 'active'
  `).catch(() => {});

  // Create referrers table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS referrers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(140) NOT NULL UNIQUE,
      email VARCHAR(191) NULL,
      phone VARCHAR(32) NULL,
      bank_name VARCHAR(160) NULL,
      bank_account_no VARCHAR(80) NULL,
      ifsc_code VARCHAR(40) NULL,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // --- Phase 4 Migrations ---

  // Create notifications table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      notification_type VARCHAR(60) NOT NULL,
      entity_type VARCHAR(60) NULL,
      entity_id INT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_notif_user_read (user_id, is_read),
      KEY idx_notif_created (created_at),
      CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Create audit_logs table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      action ENUM('create','update','delete','login','logout','status_change') NOT NULL,
      entity_type VARCHAR(60) NOT NULL,
      entity_id INT NULL,
      old_values JSON NULL,
      new_values JSON NULL,
      ip_address VARCHAR(45) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_audit_user (user_id),
      KEY idx_audit_entity (entity_type, entity_id),
      KEY idx_audit_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Create activity_logs table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      entity_type VARCHAR(60) NOT NULL,
      entity_id INT NOT NULL,
      user_id INT NOT NULL,
      activity_type VARCHAR(60) NOT NULL,
      description TEXT NOT NULL,
      metadata JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_activity_entity (entity_type, entity_id),
      KEY idx_activity_user (user_id),
      KEY idx_activity_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // --- Phase 6 Migrations ---

  // Create permissions table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      permission_key VARCHAR(100) NOT NULL UNIQUE,
      description VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Create role_permissions table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role ENUM('admin','employee') NOT NULL,
      permission_id INT NOT NULL,
      PRIMARY KEY (role, permission_id),
      CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Seed permissions if empty
  const [permRows] = await pool.query('SELECT COUNT(*) as count FROM permissions');
  if (permRows[0].count === 0) {
    const defaultPermissions = [
      { key: 'manage_all', desc: 'Global administrator access' },
      { key: 'view_dashboard', desc: 'View dashboard summary stats' },
      { key: 'view_hospitals', desc: 'View hospitals list and details' },
      { key: 'manage_hospitals', desc: 'Create, update or delete hospitals' },
      { key: 'view_jobs', desc: 'View job openings' },
      { key: 'manage_jobs', desc: 'Create, update or delete job openings' },
      { key: 'view_applicants', desc: 'View applicant profiles' },
      { key: 'manage_applicants', desc: 'Create and edit applicant profiles' },
      { key: 'delete_applicants', desc: 'Delete applicant profiles' },
      { key: 'assign_recruiter', desc: 'Assign recruiters to applicants' },
      { key: 'run_matching', desc: 'Execute applicant matching engine' },
      { key: 'view_pool', desc: 'View candidate pool database' },
      { key: 'reassign_pool', desc: 'Move candidates in/out of the pool' },
      { key: 'view_pipeline', desc: 'View application pipelines' },
      { key: 'update_pipeline_stage', desc: 'Move applications between stages' },
      { key: 'send_to_hospital', desc: 'Submit candidate details to hospitals' },
      { key: 'view_interviews', desc: 'View scheduled interviews' },
      { key: 'manage_interviews', desc: 'Schedule and edit interviews' },
      { key: 'record_feedback', desc: 'Record interview results and feedback' },
      { key: 'view_referrals', desc: 'View referral reward statuses' },
      { key: 'manage_referrals', desc: 'Edit referrers and referral milestones' },
      { key: 'view_invoices', desc: 'View hospital invoices' },
      { key: 'manage_invoices', desc: 'Generate and edit invoices' },
      { key: 'view_salary', desc: 'View employee salaries' },
      { key: 'manage_salary', desc: 'Generate and disburse salaries' },
      { key: 'view_reports', desc: 'Export system reports' },
      { key: 'view_projections', desc: 'View targets and projections' },
      { key: 'manage_projections', desc: 'Configure company projections' },
      { key: 'view_employees', desc: 'View system users/employees' },
      { key: 'manage_employees', desc: 'Create and update employee profiles' },
      { key: 'view_attendance', desc: 'View user attendance' },
      { key: 'manage_attendance', desc: 'View all attendance and logs' },
      { key: 'view_leaves', desc: 'View leaves status' },
      { key: 'approve_leaves', desc: 'Approve or reject leave requests' },
      { key: 'view_tasks', desc: 'View task assignments' },
      { key: 'manage_tasks', desc: 'Assign and review user tasks' },
      { key: 'view_calendar', desc: 'View calendar schedules' },
      { key: 'manage_calendar', desc: 'Add or modify calendar schedules' },
      { key: 'view_settings', desc: 'View agency settings' },
      { key: 'manage_settings', desc: 'Configure system settings' },
      { key: 'view_notifications', desc: 'Access in-app notifications' },
      { key: 'view_audit_logs', desc: 'View system audit logs' },
      { key: 'view_activity_logs', desc: 'View candidate activity timelines' }
    ];

    for (const p of defaultPermissions) {
      await pool.query('INSERT INTO permissions (permission_key, description) VALUES (?, ?)', [p.key, p.desc]);
    }

    // Load newly created permissions
    const [allPerms] = await pool.query('SELECT id, permission_key FROM permissions');

    // Admin gets ALL permissions
    for (const perm of allPerms) {
      await pool.query('INSERT INTO role_permissions (role, permission_id) VALUES (?, ?)', ['admin', perm.id]);
    }

    // Employee gets select permissions
    const employeeAllowedKeys = [
      'view_dashboard',
      'view_hospitals',
      'view_jobs',
      'view_applicants',
      'manage_applicants',
      'run_matching',
      'view_pool',
      'view_pipeline',
      'update_pipeline_stage',
      'view_interviews',
      'manage_interviews',
      'record_feedback',
      'view_referrals',
      'view_attendance',
      'view_leaves',
      'view_tasks',
      'view_calendar',
      'manage_calendar',
      'view_notifications'
    ];

    const employeePermIds = allPerms
      .filter(p => employeeAllowedKeys.includes(p.permission_key))
      .map(p => p.id);

    for (const pid of employeePermIds) {
      await pool.query('INSERT INTO role_permissions (role, permission_id) VALUES (?, ?)', ['employee', pid]);
    }
  }
}

module.exports = {
  initDb
};
