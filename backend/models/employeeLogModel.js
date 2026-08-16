'use strict';

const { getPool } = require('../config/db');

class EmployeeLogModel {
  static async logLogin(userId, conn = null) {
    const pool = conn || getPool();
    const [res] = await pool.query(
      `INSERT INTO employee_logs (user_id, login_time) VALUES (?, CURRENT_TIMESTAMP)`,
      [userId]
    );
    return res.insertId;
  }

  static async logLogout(userId, conn = null) {
    const pool = conn || getPool();
    
    // Find the latest log for this user that has no logout_time
    const [rows] = await pool.query(
      `SELECT id, login_time FROM employee_logs WHERE user_id = ? AND logout_time IS NULL ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (rows.length > 0) {
      const logId = rows[0].id;
      await pool.query(
        `UPDATE employee_logs 
         SET logout_time = CURRENT_TIMESTAMP, 
             total_hours = TIMESTAMPDIFF(MINUTE, login_time, CURRENT_TIMESTAMP) / 60.0 
         WHERE id = ?`,
        [logId]
      );
    } else {
      // fallback if no login found but logging out
      await pool.query(
        `INSERT INTO employee_logs (user_id, logout_time) VALUES (?, CURRENT_TIMESTAMP)`,
        [userId]
      );
    }
  }

  static async list({ search, date }, conn = null) {
    const pool = conn || getPool();
    let q = `
      SELECT el.*, u.full_name, u.email, u.role
      FROM employee_logs el
      JOIN users u ON el.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      q += ` AND (u.full_name LIKE ? OR u.email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (date) {
      q += ` AND DATE(el.login_time) = ?`;
      params.push(date);
    }

    q += ` ORDER BY el.created_at DESC LIMIT 1000`;
    
    const [rows] = await pool.query(q, params);
    return rows;
  }

  static async getPresentTodayCount(conn = null) {
    const pool = conn || getPool();
    const [rows] = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as presentToday
      FROM employee_logs
      WHERE DATE(login_time) = CURDATE()
    `);
    return rows[0]?.presentToday || 0;
  }
}

module.exports = EmployeeLogModel;
