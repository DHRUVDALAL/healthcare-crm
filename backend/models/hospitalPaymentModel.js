'use strict';

const { getPool } = require('../config/db');

class HospitalPaymentModel {
  static async list({ search, status, hospital_id }) {
    const pool = getPool();
    let q = `
      SELECT hp.*, h.name as hospital_name, u.full_name as created_by_name
      FROM hospital_payments hp
      JOIN hospitals h ON hp.hospital_id = h.id
      LEFT JOIN users u ON hp.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      q += ` AND (h.name LIKE ? OR hp.invoice_number LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status) {
      q += ` AND hp.status = ?`;
      params.push(status);
    }
    if (hospital_id) {
      q += ` AND hp.hospital_id = ?`;
      params.push(hospital_id);
    }

    q += ` ORDER BY hp.due_date ASC`;
    const [rows] = await pool.query(q, params);
    return rows;
  }

  static async getById(id) {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT hp.*, h.name as hospital_name
      FROM hospital_payments hp
      JOIN hospitals h ON hp.hospital_id = h.id
      WHERE hp.id = ?
    `, [id]);
    return rows[0] || null;
  }

  static async create(payload) {
    const pool = getPool();
    const [res] = await pool.query(
      `INSERT INTO hospital_payments (hospital_id, invoice_number, amount, due_date, payment_method, status, remarks, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [payload.hospital_id, payload.invoice_number || null, payload.amount, payload.due_date,
       payload.payment_method || null, payload.status || 'pending', payload.remarks || null, payload.created_by || null]
    );
    return { id: res.insertId };
  }

  static async update(id, payload) {
    const pool = getPool();
    await pool.query(
      `UPDATE hospital_payments SET invoice_number = ?, amount = ?, due_date = ?, paid_date = ?, payment_method = ?, status = ?, remarks = ? WHERE id = ?`,
      [payload.invoice_number || null, payload.amount, payload.due_date, payload.paid_date || null,
       payload.payment_method || null, payload.status, payload.remarks || null, id]
    );
  }

  static async updateStatus(id, status, paidDate) {
    const pool = getPool();
    await pool.query('UPDATE hospital_payments SET status = ?, paid_date = ? WHERE id = ?', [status, paidDate, id]);
  }

  static async delete(id) {
    const pool = getPool();
    await pool.query('DELETE FROM hospital_payments WHERE id = ?', [id]);
  }

  static async getFinanceSummary() {
    const pool = getPool();
    const [summary] = await pool.query(`
      SELECT 
        COUNT(*) as total_payments,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_paid,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending,
        SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END) as total_overdue,
        SUM(amount) as total_amount
      FROM hospital_payments
    `);

    const [monthly] = await pool.query(`
      SELECT DATE_FORMAT(due_date, '%Y-%m') as month,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as collected,
        SUM(CASE WHEN status IN ('pending','overdue') THEN amount ELSE 0 END) as outstanding,
        COUNT(*) as total
      FROM hospital_payments
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `);

    const [byHospital] = await pool.query(`
      SELECT h.name as hospital_name, h.id as hospital_id,
        SUM(hp.amount) as total_amount,
        SUM(CASE WHEN hp.status = 'paid' THEN hp.amount ELSE 0 END) as paid_amount,
        SUM(CASE WHEN hp.status IN ('pending','overdue') THEN hp.amount ELSE 0 END) as pending_amount
      FROM hospital_payments hp
      JOIN hospitals h ON hp.hospital_id = h.id
      GROUP BY h.id, h.name
      ORDER BY total_amount DESC
    `);

    return { summary: summary[0], monthly, byHospital };
  }

  static async autoMarkOverdue() {
    const pool = getPool();
    await pool.query(
      `UPDATE hospital_payments SET status = 'overdue' WHERE status = 'pending' AND due_date < CURDATE()`
    );
  }
}

module.exports = HospitalPaymentModel;
