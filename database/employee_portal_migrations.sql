-- 1. Alter users table for theme, photo, and notifications
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_path VARCHAR(500) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme VARCHAR(30) NOT NULL DEFAULT 'light';
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences TEXT NULL;

-- 2. Alter tasks table columns
ALTER TABLE tasks MODIFY COLUMN task_type VARCHAR(100) NOT NULL DEFAULT 'daily';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completion_percentage INT NOT NULL DEFAULT 0;
ALTER TABLE tasks MODIFY COLUMN status ENUM('pending', 'in_progress', 'completed', 'blocked', 'cancelled') NOT NULL DEFAULT 'pending';

-- 3. Create task_comments table
CREATE TABLE IF NOT EXISTS task_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_task_comments_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Create task_attachments table
CREATE TABLE IF NOT EXISTS task_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  uploaded_by INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_task_attachments_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_attachments_user FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Create candidate_follow_ups table
CREATE TABLE IF NOT EXISTS candidate_follow_ups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  applicant_id INT NOT NULL,
  employee_id INT NOT NULL,
  follow_up_date DATE NOT NULL,
  follow_up_time TIME NULL,
  remarks TEXT NULL,
  outcome TEXT NULL,
  next_follow_up_date DATE NULL,
  next_follow_up_time TIME NULL,
  reminder_set TINYINT(1) DEFAULT 0,
  status ENUM('pending', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_follow_ups_applicant FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE,
  CONSTRAINT fk_follow_ups_employee FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Alter reminders table
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS visibility ENUM('private', 'public') NOT NULL DEFAULT 'private';
