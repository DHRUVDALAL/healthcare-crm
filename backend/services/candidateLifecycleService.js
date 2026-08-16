'use strict';

const { getPool } = require('../config/db');

const STAGE_PROGRESSION = [
  'New Applicant',
  'Profile Under Review',
  'Documents Pending',
  'Verified',
  'Assigned',
  'Matched',
  'Recruiter Review',
  'Ready For Submission',
  'Submitted To Hospital',
  'Hospital Review',
  'Selected / Placed',
  'Rejected',
  'Hold'
];

/**
 * Validate and execute unified candidate status transition.
 */
async function transitionCandidateStatus({ applicantId, newStatus, remarks, userId }) {
  const pool = getPool();
  const [apps] = await pool.query(`SELECT id, candidate_status, assigned_recruiter_id FROM applicants WHERE id = ?`, [applicantId]);
  if (!apps.length) throw new Error('Applicant not found');

  const current = apps[0];
  const oldStatus = current.candidate_status;

  // Enforce rule validation for critical stages
  if (newStatus === 'Ready For Submission') {
    const [docs] = await pool.query(
      `SELECT COUNT(*) as cnt FROM candidate_documents WHERE applicant_id = ? AND verification_status = 'verified'`,
      [applicantId]
    );
    if (!docs[0]?.cnt && !current.assigned_recruiter_id) {
      throw new Error('Candidate must have assigned recruiter and verified documents before marking Ready For Submission');
    }
  }

  // Map status string to database enum value
  let dbEnumStatus = 'active';
  const s = String(newStatus || '').toLowerCase();
  if (s.includes('hold')) dbEnumStatus = 'hold';
  else if (s.includes('reject')) dbEnumStatus = 'rejected';
  else if (s.includes('select') || s.includes('place')) dbEnumStatus = 'selected';
  else if (s.includes('pool')) dbEnumStatus = 'pool';

  // Update candidate_status in applicants table with valid enum
  await pool.query(`UPDATE applicants SET candidate_status = ? WHERE id = ?`, [dbEnumStatus, applicantId]);

  // Log transition in candidate_status_history
  await pool.query(
    `INSERT INTO candidate_status_history (applicant_id, old_status, new_status, remarks, changed_by) VALUES (?, ?, ?, ?, ?)`,
    [applicantId, oldStatus, newStatus, remarks || '', userId]
  );

  return { applicant_id: applicantId, old_status: oldStatus, new_status: newStatus };
}

/**
 * Get Candidate Status History
 */
async function getStatusHistory(applicantId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT h.id, h.old_status, h.new_status, h.remarks, h.created_at, u.full_name as changed_by_name
     FROM candidate_status_history h
     JOIN users u ON h.changed_by = u.id
     WHERE h.applicant_id = ?
     ORDER BY h.created_at DESC`,
    [applicantId]
  );
  return rows;
}

module.exports = {
  STAGE_PROGRESSION,
  transitionCandidateStatus,
  getStatusHistory
};
