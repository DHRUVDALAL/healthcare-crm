'use strict';

const { getPool } = require('../config/db');

class CandidateNotesModel {
  static async list(applicantId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT n.id, n.applicant_id, n.author_id, u.full_name AS author_name, n.note_text, n.created_at
       FROM candidate_notes n
       JOIN users u ON n.author_id = u.id
       WHERE n.applicant_id = ?
       ORDER BY n.created_at DESC`,
      [Number(applicantId)]
    );
    return rows;
  }

  static async create(applicantId, authorId, noteText) {
    const pool = getPool();
    const [result] = await pool.query(
      'INSERT INTO candidate_notes (applicant_id, author_id, note_text) VALUES (?, ?, ?)',
      [Number(applicantId), Number(authorId), String(noteText).trim()]
    );
    return { id: result.insertId };
  }

  static async delete(id) {
    const pool = getPool();
    const [result] = await pool.query(
      'DELETE FROM candidate_notes WHERE id = ?',
      [Number(id)]
    );
    return { affectedRows: result.affectedRows };
  }
}

module.exports = CandidateNotesModel;
