-- Employee Productivity & Performance Management System Database Migrations

CREATE TABLE IF NOT EXISTS daily_work_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  log_date DATE NOT NULL,
  login_time TIME NULL,
  logout_time TIME NULL,
  todays_goal TEXT NULL,
  todays_plan TEXT NULL,
  eod_summary TEXT NULL,
  candidates_contacted INT NOT NULL DEFAULT 0,
  candidates_processed INT NOT NULL DEFAULT 0,
  new_applicants_added INT NOT NULL DEFAULT 0,
  resumes_collected INT NOT NULL DEFAULT 0,
  hospital_calls INT NOT NULL DEFAULT 0,
  hospital_meetings INT NOT NULL DEFAULT 0,
  followups_completed INT NOT NULL DEFAULT 0,
  interviews_scheduled INT NOT NULL DEFAULT 0,
  interviews_completed INT NOT NULL DEFAULT 0,
  offers_released INT NOT NULL DEFAULT 0,
  placements_closed INT NOT NULL DEFAULT 0,
  invoices_followed_up INT NOT NULL DEFAULT 0,
  referral_calls INT NOT NULL DEFAULT 0,
  other_activities INT NOT NULL DEFAULT 0,
  work_completed TEXT NULL,
  pending_work TEXT NULL,
  problems_faced TEXT NULL,
  tomorrows_plan TEXT NULL,
  remarks TEXT NULL,
  review_status ENUM('pending_review', 'reviewed', 'approved', 'needs_improvement') NOT NULL DEFAULT 'pending_review',
  manager_remarks TEXT NULL,
  completion_percentage INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_daily_work_logs_emp_date (employee_id, log_date),
  KEY idx_daily_work_logs_date (log_date),
  KEY idx_daily_work_logs_status (review_status),
  CONSTRAINT fk_daily_work_logs_user FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(64) NOT NULL,
  module VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NULL,
  entity_id INT NULL,
  details TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_activity_logs_user (user_id),
  KEY idx_activity_logs_action (action),
  KEY idx_activity_logs_created (created_at),
  CONSTRAINT fk_activity_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS employee_goals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  goal_type ENUM('daily', 'weekly', 'monthly') NOT NULL DEFAULT 'monthly',
  target_candidates INT NOT NULL DEFAULT 0,
  target_placements INT NOT NULL DEFAULT 0,
  target_revenue DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  target_interviews INT NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status ENUM('in_progress', 'achieved', 'missed') NOT NULL DEFAULT 'in_progress',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_employee_goals_emp (employee_id),
  KEY idx_employee_goals_period (period_start, period_end),
  CONSTRAINT fk_employee_goals_user FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Extend tasks table for Productivity management
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(5,2) NULL DEFAULT 0.00;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_hours DECIMAL(5,2) NULL DEFAULT 0.00;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_archived TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category VARCHAR(64) NULL DEFAULT 'recruitment';
