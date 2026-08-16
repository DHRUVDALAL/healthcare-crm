'use strict';

const { getPool } = require('../config/db');

class CalendarModel {
  static async list({ search, type, status, userId, role }, conn = null) {
    const pool = conn || getPool();
    let q = `
      SELECT r.*, u.full_name as assigned_name
      FROM reminders r
      JOIN users u ON r.assigned_to = u.id
      WHERE 1=1
    `;
    const params = [];

    if (role !== 'admin') {
      q += ` AND r.assigned_to = ?`;
      params.push(userId);
    }

    if (search) {
      q += ` AND (r.title LIKE ? OR r.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (type) {
      q += ` AND r.reminder_type = ?`;
      params.push(type);
    }

    if (status) {
      q += ` AND r.status = ?`;
      params.push(status);
    }

    q += ` ORDER BY r.reminder_date ASC, r.reminder_time ASC`;

    const [rows] = await pool.query(q, params);
    return rows;
  }

  static async getToday(userId, role, conn = null) {
    const pool = conn || getPool();
    let q = `
      SELECT r.*, u.full_name as assigned_name
      FROM reminders r
      JOIN users u ON r.assigned_to = u.id
      WHERE r.reminder_date = CURDATE() AND r.status = 'pending'
    `;
    const params = [];

    if (role !== 'admin') {
      q += ` AND r.assigned_to = ?`;
      params.push(userId);
    }

    q += ` ORDER BY r.reminder_time ASC`;
    const [rows] = await pool.query(q, params);
    return rows;
  }

  static async getUpcoming(userId, role, conn = null) {
    const pool = conn || getPool();
    let q = `
      SELECT r.*, u.full_name as assigned_name
      FROM reminders r
      JOIN users u ON r.assigned_to = u.id
      WHERE r.reminder_date >= CURDATE() AND r.status = 'pending'
    `;
    const params = [];

    if (role !== 'admin') {
      q += ` AND r.assigned_to = ?`;
      params.push(userId);
    }

    q += ` ORDER BY r.reminder_date ASC, r.reminder_time ASC LIMIT 5`;
    const [rows] = await pool.query(q, params);
    return rows;
  }

  static async getById(id, conn = null) {
    const pool = conn || getPool();
    const [rows] = await pool.query(
      `SELECT * FROM reminders WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async create(payload, conn = null) {
    const pool = conn || getPool();
    const [res] = await pool.query(
      `INSERT INTO reminders (
        title, description, reminder_type, reminder_date, reminder_time,
        assigned_to, priority, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.title, payload.description || '', payload.reminder_type,
        payload.reminder_date, payload.reminder_time || null, payload.assigned_to,
        payload.priority || 'medium', payload.status || 'pending', payload.notes || ''
      ]
    );
    return { id: res.insertId };
  }

  static async update(id, payload, conn = null) {
    const pool = conn || getPool();
    await pool.query(
      `UPDATE reminders SET
        title = ?, description = ?, reminder_type = ?, reminder_date = ?,
        reminder_time = ?, assigned_to = ?, priority = ?, status = ?, notes = ?
       WHERE id = ?`,
      [
        payload.title, payload.description || '', payload.reminder_type,
        payload.reminder_date, payload.reminder_time || null, payload.assigned_to,
        payload.priority || 'medium', payload.status || 'pending', payload.notes || '',
        id
      ]
    );
  }

  static async updateStatus(id, status, conn = null) {
    const pool = conn || getPool();
    await pool.query(`UPDATE reminders SET status = ? WHERE id = ?`, [status, id]);
  }

  static async delete(id, conn = null) {
    const pool = conn || getPool();
    await pool.query(`DELETE FROM reminders WHERE id = ?`, [id]);
  }
}

module.exports = CalendarModel;
