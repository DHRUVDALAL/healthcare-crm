ALTER TABLE applications MODIFY COLUMN current_stage VARCHAR(50) NOT NULL;
UPDATE applications SET current_stage = 'resume_review' WHERE current_stage = 'shortlisted' OR current_stage = 'screening';
UPDATE applications SET current_stage = 'hospital_submission' WHERE current_stage = 'sent_to_hospital';
UPDATE applications SET current_stage = 'returned_to_pool' WHERE current_stage = 'moved_to_pool';
ALTER TABLE applications MODIFY COLUMN current_stage ENUM('applied','assigned','resume_review','matched','hospital_submission','interview_scheduled','interview_completed','offer_released','selected','joined','rejected','returned_to_pool','archived') NOT NULL DEFAULT 'applied';
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS attended_by INT NULL;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS assignment_status ENUM('Unassigned', 'Assigned', 'Transferred', 'Completed', 'Archived') NOT NULL DEFAULT 'Unassigned';
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS priority ENUM('high', 'medium', 'low') NOT NULL DEFAULT 'medium';
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS preferred_hospital_id INT NULL;
ALTER TABLE applicants ADD CONSTRAINT fk_applicants_attended_by FOREIGN KEY IF NOT EXISTS (attended_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE applicants ADD CONSTRAINT fk_applicants_pref_hosp FOREIGN KEY IF NOT EXISTS (preferred_hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS assignment_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  applicant_id INT NOT NULL,
  prev_employee_id INT NULL,
  new_employee_id INT NULL,
  assigned_by INT NOT NULL,
  reason VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_assign_hist_applicant FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE,
  CONSTRAINT fk_assign_hist_prev FOREIGN KEY (prev_employee_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_assign_hist_new FOREIGN KEY (new_employee_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_assign_hist_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS candidate_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  applicant_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  uploaded_by INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_candidate_docs_applicant FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE,
  CONSTRAINT fk_candidate_docs_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
