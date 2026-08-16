-- Admin ERP Migration
-- Adds tables and columns for the complete Admin ERP system

-- 1. Custom Roles table (beyond the hardcoded admin/employee ENUM)
CREATE TABLE IF NOT EXISTS custom_roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_custom_roles_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Custom Role Permissions mapping
CREATE TABLE IF NOT EXISTS custom_role_permissions (
  custom_role_id INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (custom_role_id, permission_id),
  CONSTRAINT fk_crp_role FOREIGN KEY (custom_role_id) REFERENCES custom_roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_crp_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Add custom_role_id to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_role_id INT NULL;
ALTER TABLE users ADD CONSTRAINT fk_users_custom_role FOREIGN KEY (custom_role_id) REFERENCES custom_roles(id) ON DELETE SET NULL;

-- 4. Hospital Payments tracking table
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
  KEY idx_hp_due (due_date),
  CONSTRAINT fk_hp_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE,
  CONSTRAINT fk_hp_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Company Holidays table
CREATE TABLE IF NOT EXISTS company_holidays (
  id INT AUTO_INCREMENT PRIMARY KEY,
  holiday_name VARCHAR(200) NOT NULL,
  holiday_date DATE NOT NULL,
  holiday_type ENUM('national','optional','company','other') NOT NULL DEFAULT 'national',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_holiday_date (holiday_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Employee Documents table
CREATE TABLE IF NOT EXISTS employee_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  document_type ENUM('offer_letter','id_proof','address_proof','education_cert','experience_letter','salary_slip','other') NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  uploaded_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_emp_docs_employee FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_emp_docs_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Attendance redesign - add status column
ALTER TABLE employee_logs ADD COLUMN IF NOT EXISTS attendance_status ENUM('present','absent','half_day','on_leave','remote','holiday') NULL;

-- 8. Extend leaves table with more types
ALTER TABLE leaves MODIFY COLUMN leave_type ENUM('sick','casual','paid','emergency','earned','wfh','compensatory') NOT NULL;

-- 9. Add photo_path column to users if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_path VARCHAR(500) NULL;

-- 10. Add salary-related columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_name VARCHAR(160) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_account_no VARCHAR(80) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(40) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pan_number VARCHAR(20) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhar_number VARCHAR(20) NULL;

-- 11. Add tax column to salary_records
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS tax DECIMAL(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS pf DECIMAL(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS esi DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- 12. Insert default company holidays for current year
INSERT IGNORE INTO company_holidays (holiday_name, holiday_date, holiday_type) VALUES
  ('New Year Day', CONCAT(YEAR(CURDATE()), '-01-01'), 'national'),
  ('Republic Day', CONCAT(YEAR(CURDATE()), '-01-26'), 'national'),
  ('Holi', CONCAT(YEAR(CURDATE()), '-03-14'), 'national'),
  ('Good Friday', CONCAT(YEAR(CURDATE()), '-04-18'), 'national'),
  ('May Day', CONCAT(YEAR(CURDATE()), '-05-01'), 'national'),
  ('Independence Day', CONCAT(YEAR(CURDATE()), '-08-15'), 'national'),
  ('Ganesh Chaturthi', CONCAT(YEAR(CURDATE()), '-08-27'), 'national'),
  ('Gandhi Jayanti', CONCAT(YEAR(CURDATE()), '-10-02'), 'national'),
  ('Dussehra', CONCAT(YEAR(CURDATE()), '-10-11'), 'national'),
  ('Diwali', CONCAT(YEAR(CURDATE()), '-10-31'), 'national'),
  ('Christmas', CONCAT(YEAR(CURDATE()), '-12-25'), 'national');
