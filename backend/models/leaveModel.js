'use strict';

const { getPool } = require('../config/db');

class LeaveModel {
  static async list({ search, status, employeeId }, conn = null) {
    const pool = conn || getPool();
    let q = `
      SELECT l.*, u.full_name as employee_name, u.email as employee_email
      FROM leaves l
      JOIN users u ON l.employee_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      q += ` AND u.full_name LIKE ?`;
      params.push(`%${search}%`);
    }

    if (status) {
      q += ` AND l.leave_status = ?`;
      params.push(status);
    }

    if (employeeId) {
      q += ` AND l.employee_id = ?`;
      params.push(employeeId);
    }

    q += ` ORDER BY l.created_at DESC`;

    const [rows] = await pool.query(q, params);
    return rows;
  }

  static async getById(id, conn = null) {
    const pool = conn || getPool();
    const [rows] = await pool.query(
      `SELECT l.*, u.full_name as employee_name
       FROM leaves l
       JOIN users u ON l.employee_id = u.id
       WHERE l.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async create(payload, conn = null) {
    const pool = conn || getPool();
    const [res] = await pool.query(
      `INSERT INTO leaves (
        employee_id, leave_type, start_date, end_date, reason, leave_status
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        payload.employee_id, payload.leave_type, payload.start_date,
        payload.end_date, payload.reason, payload.leave_status || 'pending'
      ]
    );
    return { id: res.insertId };
  }

  static async updateStatus(id, status, remarks = null, conn = null) {
    const pool = conn || getPool();
    await pool.query(
      `UPDATE leaves SET leave_status = ?, admin_remarks = ? WHERE id = ?`,
      [status, remarks || '', id]
    );
  }

  static async stats(conn = null) {
    const pool = conn || getPool();
    const [rows] = await pool.query(`
      SELECT 
        COUNT(CASE WHEN leave_status = 'pending' THEN 1 END) as pendingLeaves
      FROM leaves
    `);
    return rows[0] || { pendingLeaves: 0 };
  }
}

module.exports = LeaveModel;
