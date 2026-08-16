'use strict';

const { getPool } = require('../config/db');

class SalaryModel {
  static async list({ search, status, month }, conn = null) {
    const pool = conn || getPool();
    let q = `
      SELECT s.*, u.full_name as employee_name, u.email as employee_email, u.designation
      FROM salary_records s
      JOIN users u ON s.employee_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      q += ` AND u.full_name LIKE ?`;
      params.push(`%${search}%`);
    }

    if (status) {
      q += ` AND s.payment_status = ?`;
      params.push(status);
    }

    if (month) {
      q += ` AND s.salary_month = ?`;
      params.push(month);
    }

    q += ` ORDER BY s.salary_month DESC, s.created_at DESC`;

    const [rows] = await pool.query(q, params);
    return rows;
  }

  static async getById(id, conn = null) {
    const pool = conn || getPool();
    const [rows] = await pool.query(
      `SELECT s.*, u.full_name as employee_name, u.email as employee_email, u.designation, u.department
       FROM salary_records s
       JOIN users u ON s.employee_id = u.id
       WHERE s.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async create(payload, conn = null) {
    const pool = conn || getPool();
    const [res] = await pool.query(
      `INSERT INTO salary_records (
        employee_id, salary_month, base_salary, bonus, deductions, final_salary, payment_status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        base_salary = VALUES(base_salary),
        bonus = VALUES(bonus),
        deductions = VALUES(deductions),
        final_salary = VALUES(final_salary),
        payment_status = VALUES(payment_status),
        notes = VALUES(notes)`,
      [
        payload.employee_id, payload.salary_month, payload.base_salary,
        payload.bonus || 0, payload.deductions || 0, payload.final_salary,
        payload.payment_status || 'pending', payload.notes || ''
      ]
    );
    return { id: res.insertId };
  }

  static async updateStatus(id, status, paymentDate = null, conn = null) {
    const pool = conn || getPool();
    await pool.query(
      `UPDATE salary_records SET payment_status = ?, payment_date = ? WHERE id = ?`,
      [status, paymentDate, id]
    );
  }

  static async stats(conn = null) {
    const pool = conn || getPool();
    const [rows] = await pool.query(`
      SELECT 
        COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pendingSalaries
      FROM salary_records
    `);
    return rows[0] || { pendingSalaries: 0 };
  }
}

module.exports = SalaryModel;
