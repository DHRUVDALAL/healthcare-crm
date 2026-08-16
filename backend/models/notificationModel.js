'use strict';

const { getPool } = require('../config/db');

class NotificationModel {
  static async list(userId, { limit = 50, offset = 0 } = {}) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, title, message, notification_type, entity_type, entity_id, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    return rows;
  }

  static async unreadCount(userId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [userId]
    );
    return rows[0]?.count || 0;
  }

  static async markRead(id, userId) {
    const pool = getPool();
    const [result] = await pool.query(
      `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    return result.affectedRows;
  }

  static async markAllRead(userId) {
    const pool = getPool();
    const [result] = await pool.query(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
      [userId]
    );
    return result.affectedRows;
  }

  static async create(payload) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO notifications (user_id, title, message, notification_type, entity_type, entity_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        payload.user_id,
        payload.title,
        payload.message,
        payload.notification_type,
        payload.entity_type || null,
        payload.entity_id || null
      ]
    );
    return { id: result.insertId };
  }

  static async delete(id, userId) {
    const pool = getPool();
    const [result] = await pool.query(
      `DELETE FROM notifications WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    return result.affectedRows;
  }

  /**
   * Purge notifications older than given days (default 90).
   */
  static async purgeOld(days = 90) {
    const pool = getPool();
    const [result] = await pool.query(
      `DELETE FROM notifications WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [days]
    );
    return result.affectedRows;
  }
}

module.exports = NotificationModel;
