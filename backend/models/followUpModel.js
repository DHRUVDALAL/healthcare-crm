'use strict';

const { getPool } = require('../config/db');

class FollowUpModel {
  static async list({ applicantId, employeeId } = {}) {
    const pool = getPool();
    const where = [];
    const params = [];

    if (applicantId) {
      where.push('f.applicant_id = ?');
      params.push(Number(applicantId));
    }
    if (employeeId) {
      where.push('f.employee_id = ?');
      params.push(Number(employeeId));
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT f.*, a.full_name AS applicant_name, u.full_name AS employee_name
       FROM candidate_follow_ups f
       JOIN applicants a ON f.applicant_id = a.id
       JOIN users u ON f.employee_id = u.id
       ${whereSql}
       ORDER BY f.follow_up_date DESC, f.follow_up_time DESC`,
      params
    );
    return rows;
  }

  static async getById(id) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT f.*, a.full_name AS applicant_name
       FROM candidate_follow_ups f
       JOIN applicants a ON f.applicant_id = a.id
       WHERE f.id = ? LIMIT 1`,
      [Number(id)]
    );
    return rows[0] || null;
  }

  static async create(payload) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO candidate_follow_ups (
         applicant_id, employee_id, follow_up_date, follow_up_time, remarks,
         outcome, next_follow_up_date, next_follow_up_time, reminder_set, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(payload.applicant_id),
        Number(payload.employee_id),
        payload.follow_up_date,
        payload.follow_up_time || null,
        payload.remarks || null,
        payload.outcome || null,
        payload.next_follow_up_date || null,
        payload.next_follow_up_time || null,
        payload.reminder_set ? 1 : 0,
        payload.status || 'pending'
      ]
    );
    return { id: result.insertId };
  }

  static async update(id, payload) {
    const pool = getPool();
    const [result] = await pool.query(
      `UPDATE candidate_follow_ups
       SET follow_up_date = ?, follow_up_time = ?, remarks = ?, outcome = ?,
           next_follow_up_date = ?, next_follow_up_time = ?, reminder_set = ?, status = ?
       WHERE id = ?`,
      [
        payload.follow_up_date,
        payload.follow_up_time || null,
        payload.remarks || null,
        payload.outcome || null,
        payload.next_follow_up_date || null,
        payload.next_follow_up_time || null,
        payload.reminder_set ? 1 : 0,
        payload.status,
        Number(id)
      ]
    );
    return { affectedRows: result.affectedRows };
  }

  static async delete(id) {
    const pool = getPool();
    const [result] = await pool.query('DELETE FROM candidate_follow_ups WHERE id = ?', [Number(id)]);
    return { affectedRows: result.affectedRows };
  }

  static async getUpcomingFollowUps(employeeId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT f.*, a.full_name AS applicant_name
       FROM candidate_follow_ups f
       JOIN applicants a ON f.applicant_id = a.id
       WHERE f.employee_id = ? AND f.status = 'pending' AND f.follow_up_date >= CURDATE()
       ORDER BY f.follow_up_date ASC, f.follow_up_time ASC LIMIT 5`,
      [Number(employeeId)]
    );
    return rows;
  }
}

module.exports = FollowUpModel;
