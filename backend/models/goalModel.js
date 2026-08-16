'use strict';

const { getPool } = require('../config/db');

class GoalModel {
  static async list({ employeeId, status }) {
    const pool = getPool();
    let q = `SELECT eg.*, u.full_name as employee_name FROM employee_goals eg JOIN users u ON eg.employee_id = u.id WHERE 1=1`;
    const params = [];

    if (employeeId) {
      q += ` AND eg.employee_id = ?`;
      params.push(Number(employeeId));
    }
    if (status) {
      q += ` AND eg.status = ?`;
      params.push(status);
    }

    q += ` ORDER BY eg.period_end DESC`;
    const [rows] = await pool.query(q, params);
    return rows;
  }

  static async create(payload) {
    const pool = getPool();
    const [res] = await pool.query(
      `INSERT INTO employee_goals (
        employee_id, goal_type, target_candidates, target_placements,
        target_revenue, target_interviews, period_start, period_end, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(payload.employee_id), payload.goal_type || 'monthly',
        Number(payload.target_candidates || 0), Number(payload.target_placements || 0),
        Number(payload.target_revenue || 0), Number(payload.target_interviews || 0),
        payload.period_start, payload.period_end, payload.status || 'in_progress'
      ]
    );
    return { id: res.insertId };
  }

  static async update(id, payload) {
    const pool = getPool();
    await pool.query(
      `UPDATE employee_goals SET
        target_candidates = COALESCE(?, target_candidates),
        target_placements = COALESCE(?, target_placements),
        target_revenue = COALESCE(?, target_revenue),
        target_interviews = COALESCE(?, target_interviews),
        status = COALESCE(?, status)
       WHERE id = ?`,
      [
        payload.target_candidates ?? null, payload.target_placements ?? null,
        payload.target_revenue ?? null, payload.target_interviews ?? null,
        payload.status || null, Number(id)
      ]
    );
  }
}

module.exports = GoalModel;
