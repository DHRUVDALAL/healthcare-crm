'use strict';

const { getPool } = require('../config/db');

async function insertMatch({ applicant_id, job_id, match_score, match_notes }) {
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO candidate_matches (applicant_id, job_id, match_score, match_notes)
     VALUES (?, ?, ?, ?)`
    , [
      Number(applicant_id),
      Number(job_id),
      Number(match_score),
      String(match_notes || '')
    ]
  );
  return { id: result.insertId };
}

async function listLatestByJob(jobId, { limit = 200 } = {}) {
  const pool = getPool();

  const [rows] = await pool.query(
    `SELECT
      cm.id,
      cm.applicant_id,
      cm.job_id,
      cm.match_score,
      cm.match_notes,
      cm.created_at,
      a.full_name,
      a.phone,
      a.email,
      a.total_experience,
      a.skills,
      a.qualification,
      a.preferred_location,
      a.candidate_status,
      a.pool_status,
      a.masked_resume_path
     FROM candidate_matches cm
     JOIN (
       SELECT applicant_id, MAX(id) AS max_id
       FROM candidate_matches
       WHERE job_id = ?
       GROUP BY applicant_id
     ) latest ON latest.max_id = cm.id
     JOIN applicants a ON a.id = cm.applicant_id
     WHERE cm.job_id = ?
     ORDER BY cm.match_score DESC, cm.id DESC
     LIMIT ?`,
    [Number(jobId), Number(jobId), Number(limit)]
  );

  return rows;
}

module.exports = {
  insertMatch,
  listLatestByJob
};
