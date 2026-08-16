'use strict';

const { getPool } = require('../config/db');

class ActivityLogModel {
  static async create(payload) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO activity_logs (entity_type, entity_id, user_id, activity_type, description, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        payload.entity_type,
        payload.entity_id,
        payload.user_id,
        payload.activity_type,
        payload.description,
        payload.metadata ? JSON.stringify(payload.metadata) : null
      ]
    );
    return { id: result.insertId };
  }

  static async listByEntity(entityType, entityId, { limit = 50 } = {}) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT al.*, u.full_name as user_name
       FROM activity_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.entity_type = ? AND al.entity_id = ?
       ORDER BY al.created_at DESC
       LIMIT ?`,
      [entityType, entityId, limit]
    );
    return rows;
  }

  static async listByUser(userId, { limit = 50 } = {}) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT * FROM activity_logs
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit]
    );
    return rows;
  }
}

module.exports = ActivityLogModel;
