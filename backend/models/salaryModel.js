'use strict';

const { getPool } = require('../config/db');

class SalaryModel {
  static async list({ search, status, month }, conn = null) {
    const pool = conn || getPool();
    let q = `
      SELECT s.*, u.full_name as employee_name, u.email as employee_email, u.designation
      FROM salary_records s
      LEFT JOIN users u ON s.employee_id = u.id
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

    q += ` ORDER BY s.created_at DESC`;

    const [rows] = await pool.query(q, params);
    return rows;
  }

  static async getById(id, conn = null) {
    const pool = conn || getPool();
    const [rows] = await pool.query(
      `SELECT s.*, u.full_name as employee_name, u.email as employee_email, u.designation, u.department
       FROM salary_records s
       LEFT JOIN users u ON s.employee_id = u.id
       WHERE s.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async create(payload, conn = null) {
    const pool = conn || getPool();
    const empId = Number(payload.employee_id || payload.user_id || 0);
    const month = String(payload.salary_month || payload.month || '').trim();
    const base = Number(payload.base_salary || payload.basic_salary || 0);
    const bonus = Number(payload.bonus || payload.allowances || 0);
    const deductions = Number(payload.deductions || 0);
    const finalSalary = Number(payload.final_salary || payload.net_salary || (base + bonus - deductions));
    const status = String(payload.payment_status || payload.status || 'pending').trim();
    const notes = String(payload.notes || payload.remarks || '').trim();

    // Check if record exists for this employee and month
    const [existing] = await pool.query(
      `SELECT id FROM salary_records WHERE (employee_id = ? OR user_id = ?) AND (salary_month = ? OR month = ?)`,
      [empId, empId, month, month]
    );

    if (existing && existing.length > 0) {
      const id = existing[0].id;
      await pool.query(
        `UPDATE salary_records SET
          employee_id = ?, user_id = ?, salary_month = ?, month = ?,
          base_salary = ?, basic_salary = ?, bonus = ?, allowances = ?,
          deductions = ?, final_salary = ?, net_salary = ?,
          payment_status = ?, status = ?, notes = ?, remarks = ?
         WHERE id = ?`,
        [
          empId, empId, month, month,
          base, base, bonus, bonus,
          deductions, finalSalary, finalSalary,
          status, status, notes, notes,
          id
        ]
      );
      return { id };
    } else {
      const [res] = await pool.query(
        `INSERT INTO salary_records (
          employee_id, user_id, salary_month, month,
          base_salary, basic_salary, bonus, allowances,
          deductions, final_salary, net_salary,
          payment_status, status, notes, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          empId, empId, month, month,
          base, base, bonus, bonus,
          deductions, finalSalary, finalSalary,
          status, status, notes, notes
        ]
      );
      return { id: res.insertId };
    }
  }

  static async updateStatus(id, status, paymentDate = null, conn = null) {
    const pool = conn || getPool();
    await pool.query(
      `UPDATE salary_records SET payment_status = ?, status = ?, payment_date = ? WHERE id = ?`,
      [status, status, paymentDate, id]
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
