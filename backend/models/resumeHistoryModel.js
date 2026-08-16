'use strict';

const { getPool } = require('../config/db');

class ResumeHistoryModel {
  static async list(applicantId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT h.id, h.applicant_id, h.file_path, h.file_type, h.uploaded_by, u.full_name AS uploaded_by_name, h.created_at
       FROM resume_history h
       JOIN users u ON h.uploaded_by = u.id
       WHERE h.applicant_id = ?
       ORDER BY h.created_at DESC`,
      [Number(applicantId)]
    );
    return rows;
  }

  static async add(applicantId, filePath, fileType, uploadedBy) {
    const pool = getPool();
    const [result] = await pool.query(
      'INSERT INTO resume_history (applicant_id, file_path, file_type, uploaded_by) VALUES (?, ?, ?, ?)',
      [Number(applicantId), String(filePath), String(fileType || 'original'), Number(uploadedBy)]
    );
    return { id: result.insertId };
  }
}

module.exports = ResumeHistoryModel;
