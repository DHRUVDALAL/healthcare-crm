-- Healthcare Recruitment CRM Portal (Part 1 + Part 2 + Part 3 + Part 4 + Part 5)
-- MySQL schema: users, employee_logs, hospitals, jobs, applicants, candidate_matches, applications, application_stage_history, interviews

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(191) NOT NULL UNIQUE,
  phone VARCHAR(32) NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin','employee') NOT NULL DEFAULT 'employee',
  department VARCHAR(100) NULL,
  designation VARCHAR(100) NULL,
  joining_date DATE NULL,
  monthly_salary DECIMAL(12,2) NULL,
  emergency_contact VARCHAR(64) NULL,
  address VARCHAR(500) NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS employee_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  login_time DATETIME NULL,
  logout_time DATETIME NULL,
  total_hours DECIMAL(5,2) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_employee_logs_user_logout (user_id, logout_time),
  CONSTRAINT fk_employee_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

-- Part 4: candidate matching history
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

-- Part 5: applications (pipeline)
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

-- Part 5: application stage history (audit trail)
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

-- Part 5: interviews
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

-- Part 6: Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(64) NOT NULL UNIQUE,
  hospital_id INT NOT NULL,
  applicant_id INT NOT NULL,
  job_id INT NOT NULL,
  candidate_salary DECIMAL(12,2) NOT NULL,
  commission_percentage DECIMAL(5,2) NOT NULL,
  invoice_amount DECIMAL(12,2) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payment_status ENUM('pending','paid','overdue') NOT NULL DEFAULT 'pending',
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

-- Part 6: Referral Rewards
CREATE TABLE IF NOT EXISTS referral_rewards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  applicant_id INT NOT NULL,
  referrer_name VARCHAR(140) NOT NULL,
  referrer_contact VARCHAR(64) NULL,
  reward_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  reward_status ENUM('pending','eligible','rewarded') NOT NULL DEFAULT 'pending',
  reward_paid_date DATE NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_referral_rewards_applicant (applicant_id),
  KEY idx_referral_rewards_status (reward_status),
  CONSTRAINT fk_referral_rewards_applicant FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Part 7: Leaves
CREATE TABLE IF NOT EXISTS leaves (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  leave_type ENUM('sick','casual','paid','emergency') NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  leave_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  admin_remarks TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_leaves_employee (employee_id),
  KEY idx_leaves_status (leave_status),
  CONSTRAINT fk_leaves_employee FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Part 7: Salary Records
CREATE TABLE IF NOT EXISTS salary_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  salary_month VARCHAR(7) NOT NULL, -- Format YYYY-MM
  base_salary DECIMAL(12,2) NOT NULL,
  bonus DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  deductions DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  final_salary DECIMAL(12,2) NOT NULL,
  payment_status ENUM('pending','paid') NOT NULL DEFAULT 'pending',
  payment_date DATE NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_salary_records_emp_month (employee_id, salary_month),
  KEY idx_salary_records_status (payment_status),
  CONSTRAINT fk_salary_records_employee FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Part 8: Reminders & Calendar
CREATE TABLE IF NOT EXISTS reminders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  reminder_type ENUM('interview','follow-up','invoice','leave','personal') NOT NULL DEFAULT 'personal',
  reminder_date DATE NOT NULL,
  reminder_time TIME NULL,
  assigned_to INT NOT NULL,
  priority ENUM('high','medium','low') NOT NULL DEFAULT 'medium',
  status ENUM('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_reminders_assigned_date (assigned_to, reminder_date),
  CONSTRAINT fk_reminders_user FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Part 8: Monthly Projections
CREATE TABLE IF NOT EXISTS monthly_projections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  month VARCHAR(7) NOT NULL UNIQUE, -- Format YYYY-MM
  hiring_target INT NOT NULL DEFAULT 0,
  revenue_target DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  placement_target INT NOT NULL DEFAULT 0,
  team_notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
