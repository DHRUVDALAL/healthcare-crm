'use strict';

const { getPool } = require('../config/db');

class AuditLogModel {
  static async create(payload) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.user_id,
        payload.action,
        payload.entity_type,
        payload.entity_id || null,
        payload.old_values ? JSON.stringify(payload.old_values) : null,
        payload.new_values ? JSON.stringify(payload.new_values) : null,
        payload.ip_address || null
      ]
    );
    return { id: result.insertId };
  }

  static async list({ userId, entityType, action, fromDate, toDate, limit = 100, offset = 0 } = {}) {
    const pool = getPool();
    let q = `
      SELECT al.*, u.full_name as user_name, u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (userId) {
      q += ` AND al.user_id = ?`;
      params.push(userId);
    }
    if (entityType) {
      q += ` AND al.entity_type = ?`;
      params.push(entityType);
    }
    if (action) {
      q += ` AND al.action = ?`;
      params.push(action);
    }
    if (fromDate) {
      q += ` AND al.created_at >= ?`;
      params.push(fromDate);
    }
    if (toDate) {
      q += ` AND al.created_at <= ?`;
      params.push(toDate + ' 23:59:59');
    }

    q += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await pool.query(q, params);
    return rows;
  }
}

module.exports = AuditLogModel;
