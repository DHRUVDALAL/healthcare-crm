'use strict';

const { getPool } = require('../config/db');

class ProjectionModel {
  static async list(conn = null) {
    const pool = conn || getPool();
    const [rows] = await pool.query(`
      SELECT * FROM monthly_projections
      ORDER BY month DESC
    `);
    return rows;
  }

  static async getByMonth(month, conn = null) {
    const pool = conn || getPool();
    const [rows] = await pool.query(
      `SELECT * FROM monthly_projections WHERE month = ?`,
      [month]
    );
    return rows[0] || null;
  }

  static async getById(id, conn = null) {
    const pool = conn || getPool();
    const [rows] = await pool.query(
      `SELECT * FROM monthly_projections WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async upsert(payload, conn = null) {
    const pool = conn || getPool();
    const [res] = await pool.query(
      `INSERT INTO monthly_projections (
        month, hiring_target, revenue_target, placement_target, team_notes
      ) VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        hiring_target = VALUES(hiring_target),
        revenue_target = VALUES(revenue_target),
        placement_target = VALUES(placement_target),
        team_notes = VALUES(team_notes)`,
      [
        payload.month, payload.hiring_target || 0, payload.revenue_target || 0.00,
        payload.placement_target || 0, payload.team_notes || ''
      ]
    );
    return { id: res.insertId || res.updateId };
  }
}

module.exports = ProjectionModel;
