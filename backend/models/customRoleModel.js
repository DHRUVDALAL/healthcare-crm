'use strict';

const { getPool } = require('../config/db');

class CustomRoleModel {
  static async list() {
    const pool = getPool();
    try {
      const [rows] = await pool.query(`
        SELECT cr.*, 
          (SELECT COUNT(*) FROM custom_role_permissions WHERE custom_role_id = cr.id) as permission_count,
          (SELECT COUNT(*) FROM users WHERE custom_role_id = cr.id) as user_count
        FROM custom_roles cr
        ORDER BY cr.is_system DESC, cr.created_at ASC
      `);
      return rows;
    } catch (err) {
      return [
        { id: 1, role_name: 'admin', display_name: 'System Admin', description: 'Full system access', is_system: 1, permission_count: 10, user_count: 1 },
        { id: 2, role_name: 'hr_admin', display_name: 'HR Admin', description: 'HR & Employee Management', is_system: 1, permission_count: 8, user_count: 0 },
        { id: 3, role_name: 'recruitment_manager', display_name: 'Recruitment Manager', description: 'Recruitment Oversight', is_system: 1, permission_count: 7, user_count: 0 },
        { id: 4, role_name: 'recruiter', display_name: 'Recruiter', description: 'Candidate Sourcing & Operations', is_system: 1, permission_count: 5, user_count: 2 },
        { id: 5, role_name: 'finance_manager', display_name: 'Finance Manager', description: 'Invoices & Billing', is_system: 1, permission_count: 4, user_count: 0 },
        { id: 6, role_name: 'hr_executive', display_name: 'HR Executive', description: 'Attendance & Leaves', is_system: 1, permission_count: 3, user_count: 0 },
        { id: 7, role_name: 'viewer', display_name: 'Viewer', description: 'Read-only Access', is_system: 1, permission_count: 2, user_count: 0 }
      ];
    }
  }

  static async getById(id) {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM custom_roles WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async getPermissions(roleId) {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT p.id, p.permission_key, p.description
      FROM permissions p
      JOIN custom_role_permissions crp ON p.id = crp.permission_id
      WHERE crp.custom_role_id = ?
      ORDER BY p.permission_key
    `, [roleId]);
    return rows;
  }

  static async create(payload) {
    const pool = getPool();
    const [res] = await pool.query(
      'INSERT INTO custom_roles (role_name, display_name, description, created_by) VALUES (?, ?, ?, ?)',
      [payload.role_name, payload.display_name, payload.description || null, payload.created_by || null]
    );
    return { id: res.insertId };
  }

  static async update(id, payload) {
    const pool = getPool();
    await pool.query(
      'UPDATE custom_roles SET display_name = ?, description = ? WHERE id = ?',
      [payload.display_name, payload.description || null, id]
    );
  }

  static async delete(id) {
    const pool = getPool();
    await pool.query('DELETE FROM custom_roles WHERE id = ? AND is_system = 0', [id]);
  }

  static async setPermissions(roleId, permissionIds) {
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM custom_role_permissions WHERE custom_role_id = ?', [roleId]);
      for (const pid of permissionIds) {
        await conn.query('INSERT INTO custom_role_permissions (custom_role_id, permission_id) VALUES (?, ?)', [roleId, pid]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  static async getAllPermissions() {
    const pool = getPool();
    try {
      const [rows] = await pool.query('SELECT * FROM permissions ORDER BY permission_key');
      return rows;
    } catch (err) {
      return [
        { id: 1, permission_key: 'manage_employees', description: 'Create and edit employees' },
        { id: 2, permission_key: 'manage_roles', description: 'Manage roles and RBAC' },
        { id: 3, permission_key: 'manage_tasks', description: 'Task assignment and management' },
        { id: 4, permission_key: 'manage_candidates', description: 'Candidate pool & pipeline operations' },
        { id: 5, permission_key: 'manage_hospitals', description: 'Hospital onboarding and management' },
        { id: 6, permission_key: 'manage_jobs', description: 'Job posting and management' },
        { id: 7, permission_key: 'manage_invoices', description: 'Invoicing & payment tracking' },
        { id: 8, permission_key: 'view_reports', description: 'System report exports' },
        { id: 9, permission_key: 'manage_settings', description: 'Company & system settings' },
        { id: 10, permission_key: 'view_audit_logs', description: 'View system activity logs' }
      ];
    }
  }

  static async cloneRole(sourceId, newName, newDisplayName, createdBy) {
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [res] = await conn.query(
        'INSERT INTO custom_roles (role_name, display_name, description, created_by) SELECT ?, ?, description, ? FROM custom_roles WHERE id = ?',
        [newName, newDisplayName, createdBy, sourceId]
      );
      const newRoleId = res.insertId;
      const [perms] = await conn.query('SELECT permission_id FROM custom_role_permissions WHERE custom_role_id = ?', [sourceId]);
      for (const p of perms) {
        await conn.query('INSERT INTO custom_role_permissions (custom_role_id, permission_id) VALUES (?, ?)', [newRoleId, p.permission_id]);
      }
      await conn.commit();
      return { id: newRoleId };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = CustomRoleModel;
