'use strict';

const bcrypt = require('bcrypt');
const { getPool } = require('../config/db');

class EmployeeModel {
  static async list({ search, role, department, status }) {
    const pool = getPool();
    let q = `
      SELECT id, full_name, email, phone, role, department, designation, 
             joining_date, monthly_salary, emergency_contact, address, status, notes, created_at 
      FROM users 
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      q += ` AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (role) {
      q += ` AND role = ?`;
      params.push(role);
    }

    if (department) {
      q += ` AND department = ?`;
      params.push(department);
    }

    if (status) {
      q += ` AND status = ?`;
      params.push(status);
    }

    q += ` ORDER BY created_at DESC`;
    const [rows] = await pool.query(q, params);
    return rows;
  }

  static async getById(id, conn = null) {
    const pool = conn || getPool();
    const [rows] = await pool.query(
      `SELECT id, full_name, email, phone, role, department, designation, 
              joining_date, monthly_salary, emergency_contact, address, status, notes, created_at 
       FROM users 
       WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async create(payload, conn = null) {
    const pool = conn || getPool();
    const hashed = await bcrypt.hash(payload.password, 12);
    
    const [res] = await pool.query(
      `INSERT INTO users (
        full_name, email, password, phone, role, department, designation, 
        joining_date, monthly_salary, emergency_contact, address, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.full_name, payload.email, hashed, payload.phone || null, payload.role || 'employee',
        payload.department || null, payload.designation || null, payload.joining_date || null,
        payload.monthly_salary || null, payload.emergency_contact || null, payload.address || null,
        payload.status || 'active', payload.notes || ''
      ]
    );
    return { id: res.insertId };
  }

  static async update(id, payload, conn = null) {
    const pool = conn || getPool();
    let q = `UPDATE users SET full_name=?, email=?, phone=?, role=?, department=?, designation=?, joining_date=?, monthly_salary=?, emergency_contact=?, address=?, status=?, notes=?`;
    const params = [
      payload.full_name, payload.email, payload.phone || null, payload.role || 'employee',
      payload.department || null, payload.designation || null, payload.joining_date || null,
      payload.monthly_salary || null, payload.emergency_contact || null, payload.address || null,
      payload.status || 'active', payload.notes || ''
    ];

    if (payload.password) {
      const hashed = await bcrypt.hash(payload.password, 12);
      q += `, password=?`;
      params.push(hashed);
    }

    q += ` WHERE id=?`;
    params.push(id);

    await pool.query(q, params);
  }

  static async updateStatus(id, status, conn = null) {
    const pool = conn || getPool();
    await pool.query(`UPDATE users SET status = ? WHERE id = ?`, [status, id]);
  }

  static async stats(conn = null) {
    const pool = conn || getPool();
    const [rows] = await pool.query(`
      SELECT 
        COUNT(*) as totalEmployees
      FROM users
    `);
    return rows[0] || { totalEmployees: 0 };
  }
}

module.exports = EmployeeModel;
