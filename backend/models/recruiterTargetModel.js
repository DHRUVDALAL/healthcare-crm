'use strict';

const { getPool } = require('../config/db');

class RecruiterTargetModel {
  static async setTarget(recruiterId, month, payload) {
    const pool = getPool();
    await pool.query(
      `INSERT INTO recruiter_targets (recruiter_id, month, submissions_target, selections_target, revenue_target, notes)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         submissions_target = VALUES(submissions_target),
         selections_target = VALUES(selections_target),
         revenue_target = VALUES(revenue_target),
         notes = VALUES(notes)`,
      [
        Number(recruiterId),
        String(month).trim(), // YYYY-MM
        Number(payload.submissions_target || 0),
        Number(payload.selections_target || 0),
        Number(payload.revenue_target || 0),
        payload.notes || null
      ]
    );
    return { success: true };
  }

  static async getTargets(month) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT t.id, t.recruiter_id, u.full_name AS recruiter_name, t.month,
              t.submissions_target, t.selections_target, t.revenue_target, t.notes
       FROM recruiter_targets t
       JOIN users u ON t.recruiter_id = u.id
       WHERE t.month = ?`,
      [String(month).trim()]
    );
    return rows;
  }

  static async getTargetForRecruiter(recruiterId, month) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT submissions_target, selections_target, revenue_target, notes
       FROM recruiter_targets
       WHERE recruiter_id = ? AND month = ?
       LIMIT 1`,
      [Number(recruiterId), String(month).trim()]
    );
    return rows[0] || { submissions_target: 0, selections_target: 0, revenue_target: 0.00, notes: '' };
  }
}

module.exports = RecruiterTargetModel;
