'use strict';

const { getPool } = require('../config/db');

class CandidateTagModel {
  static async list(applicantId) {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT tag FROM candidate_tags WHERE applicant_id = ? ORDER BY tag ASC',
      [Number(applicantId)]
    );
    return rows.map(r => r.tag);
  }

  static async add(applicantId, tag) {
    const pool = getPool();
    await pool.query(
      'INSERT IGNORE INTO candidate_tags (applicant_id, tag) VALUES (?, ?)',
      [Number(applicantId), String(tag).trim()]
    );
    return { success: true };
  }

  static async remove(applicantId, tag) {
    const pool = getPool();
    await pool.query(
      'DELETE FROM candidate_tags WHERE applicant_id = ? AND tag = ?',
      [Number(applicantId), String(tag).trim()]
    );
    return { success: true };
  }
}

module.exports = CandidateTagModel;
