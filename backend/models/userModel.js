'use strict';

const bcrypt = require('bcrypt');
const { getPool } = require('../config/db');

const SALT_ROUNDS = 12;

async function findByEmail(email) {
  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT id, full_name, email, password, role, created_at FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  return rows[0] || null;
}

async function findById(id) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, full_name, email, role, phone, department, designation,
            joining_date, emergency_contact, address, photo_path, theme,
            notification_preferences, created_at
     FROM users WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function createUser({ fullName, email, password, role }) {
  const pool = getPool();
  const hashed = await bcrypt.hash(password, SALT_ROUNDS);

  const [result] = await pool.query(
    'INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)',
    [fullName, email, hashed, role]
  );

  return { id: result.insertId };
}

async function updateProfile(id, payload) {
  const pool = getPool();
  const [result] = await pool.query(
    `UPDATE users
     SET full_name = ?, email = ?, phone = ?, emergency_contact = ?, address = ?, theme = ?, notification_preferences = ?
     WHERE id = ?`,
    [
      payload.full_name,
      payload.email,
      payload.phone || null,
      payload.emergency_contact || null,
      payload.address || null,
      payload.theme || 'light',
      payload.notification_preferences || null,
      Number(id)
    ]
  );
  return { affectedRows: result.affectedRows };
}

async function updatePassword(id, password) {
  const pool = getPool();
  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const [result] = await pool.query(
    'UPDATE users SET password = ? WHERE id = ?',
    [hashed, Number(id)]
  );
  return { affectedRows: result.affectedRows };
}

async function updatePhoto(id, photoPath) {
  const pool = getPool();
  const [result] = await pool.query(
    'UPDATE users SET photo_path = ? WHERE id = ?',
    [photoPath, Number(id)]
  );
  return { affectedRows: result.affectedRows };
}

async function ensureAdminSeed() {
  const adminEmail = 'admin@crm.com';
  const existing = await findByEmail(adminEmail);
  if (existing) return;

  await createUser({
    fullName: 'System Admin',
    email: adminEmail,
    password: 'admin123',
    role: 'admin'
  });
}

module.exports = {
  findByEmail,
  findById,
  createUser,
  updateProfile,
  updatePassword,
  updatePhoto,
  ensureAdminSeed
};
