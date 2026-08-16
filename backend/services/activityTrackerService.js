'use strict';

const { getPool } = require('../config/db');

/**
 * Log a user activity event to the activity_logs database table.
 * @param {number} userId - ID of the employee performing the action.
 * @param {string} action - Event action description (e.g., 'CANDIDATE_CREATED', 'INTERVIEW_SCHEDULED').
 * @param {string} module - Functional module ('applicants', 'interviews', 'tasks', 'invoices', etc.).
 * @param {Object} [options] - Additional details, entity_type, entity_id.
 */
async function logActivity(userId, action, module, options = {}) {
  if (!userId) return;
  try {
    const pool = getPool();
    const entityType = options.entity_type || null;
    const entityId = options.entity_id ? Number(options.entity_id) : null;
    const details = options.details ? String(options.details) : null;

    await pool.query(
      `INSERT INTO activity_logs (user_id, action, module, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [Number(userId), String(action), String(module), entityType, entityId, details]
    );
  } catch (err) {
    console.error('Activity logger warning:', err.message);
  }
}

/**
 * Get formatted chronological timeline of activities for an employee.
 * @param {number} userId 
 * @param {number} [limit=50] 
 * @returns {Promise<Array<Object>>}
 */
async function getEmployeeTimeline(userId, limit = 50) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT al.id, al.user_id, u.full_name as employee_name, al.action, al.module,
            al.entity_type, al.entity_id, al.details, al.created_at
     FROM activity_logs al
     JOIN users u ON al.user_id = u.id
     WHERE al.user_id = ?
     ORDER BY al.created_at DESC
     LIMIT ?`,
    [Number(userId), Number(limit)]
  );
  return rows;
}

module.exports = {
  logActivity,
  getEmployeeTimeline
};
