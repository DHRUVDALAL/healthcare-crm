'use strict';

const { getPool } = require('../config/db');

/**
 * Log communication history entry for candidate.
 */
async function logCommunication({ applicantId, type, summary, nextFollowupDate, userId }) {
  const pool = getPool();
  const commType = type || 'phone_call';
  const [res] = await pool.query(
    `INSERT INTO candidate_communications (applicant_id, type, summary, next_followup_date, logged_by)
     VALUES (?, ?, ?, ?, ?)`,
    [applicantId, commType, summary || 'Communication logged', nextFollowupDate || null, userId]
  );

  return { id: res.insertId, applicant_id: applicantId, type: commType, summary };
}

/**
 * Get Candidate Communication History
 */
async function getCommunicationHistory(applicantId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT c.*, u.full_name as logged_by_name
     FROM candidate_communications c
     JOIN users u ON c.logged_by = u.id
     WHERE c.applicant_id = ?
     ORDER BY c.created_at DESC`,
    [applicantId]
  );
  return rows;
}

module.exports = {
  logCommunication,
  getCommunicationHistory
};
