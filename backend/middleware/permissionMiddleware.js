'use strict';

const { fail } = require('../utils/response');
const { getPool } = require('../config/db');

function permissionMiddleware(requiredPermission) {
  return async (req, res, next) => {
    if (!req.user || !req.user.role) {
      return fail(res, 401, 'Unauthorized');
    }

    // Admins always have access to everything (master bypass)
    if (req.user.role === 'admin') {
      return next();
    }

    try {
      const pool = getPool();
      const [rows] = await pool.query(
        `SELECT COUNT(*) as count 
         FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.id
         WHERE rp.role = ? AND p.permission_key = ?`,
        [req.user.role, requiredPermission]
      );

      if (rows[0].count === 0) {
        return fail(res, 403, 'Forbidden: Insufficient permissions');
      }

      return next();
    } catch (err) {
      console.error('Permission check failed:', err);
      return fail(res, 500, 'Internal Server Error during permission check');
    }
  };
}

module.exports = permissionMiddleware;
