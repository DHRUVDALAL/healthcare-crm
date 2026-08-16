'use strict';

const { getPool } = require('../config/db');

class SettingsModel {
  static async getAll() {
    const pool = getPool();
    const [rows] = await pool.query('SELECT setting_key, setting_value FROM settings');
    return rows;
  }

  static async getByKey(key) {
    const pool = getPool();
    const [rows] = await pool.query('SELECT setting_value FROM settings WHERE setting_key = ? LIMIT 1', [key]);
    return rows[0] ? rows[0].setting_value : null;
  }

  static async upsert(key, value) {
    const pool = getPool();
    await pool.query(
      `INSERT INTO settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = ?`,
      [key, value, value]
    );
  }
}

module.exports = SettingsModel;
