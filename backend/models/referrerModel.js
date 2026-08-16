'use strict';

const { getPool } = require('../config/db');

class ReferrerModel {
  static async list({ search } = {}) {
    const pool = getPool();
    let q = `
      SELECT r.id, r.name, r.email, r.phone, r.bank_name, r.bank_account_no, r.ifsc_code, r.notes, r.created_at,
             COALESCE(COUNT(rr.id), 0) AS total_referred,
             COALESCE(SUM(CASE WHEN rr.reward_status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count,
             COALESCE(SUM(CASE WHEN rr.reward_status = 'eligible' THEN 1 ELSE 0 END), 0) AS eligible_count,
             COALESCE(SUM(CASE WHEN rr.reward_status = 'rewarded' THEN 1 ELSE 0 END), 0) AS rewarded_count
      FROM referrers r
      LEFT JOIN referral_rewards rr ON rr.referrer_name = r.name
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      q += ` AND (r.name LIKE ? OR r.email LIKE ? OR r.phone LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    q += ` GROUP BY r.id ORDER BY r.name ASC`;

    const [rows] = await pool.query(q, params);
    return rows;
  }

  static async getById(id) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT r.id, r.name, r.email, r.phone, r.bank_name, r.bank_account_no, r.ifsc_code, r.notes, r.created_at,
              COALESCE(COUNT(rr.id), 0) AS total_referred,
              COALESCE(SUM(CASE WHEN rr.reward_status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count,
              COALESCE(SUM(CASE WHEN rr.reward_status = 'eligible' THEN 1 ELSE 0 END), 0) AS eligible_count,
              COALESCE(SUM(CASE WHEN rr.reward_status = 'rewarded' THEN 1 ELSE 0 END), 0) AS rewarded_count
       FROM referrers r
       LEFT JOIN referral_rewards rr ON rr.referrer_name = r.name
       WHERE r.id = ?
       GROUP BY r.id
       LIMIT 1`,
      [Number(id)]
    );
    return rows[0] || null;
  }

  static async getByName(name) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT r.id, r.name, r.email, r.phone, r.bank_name, r.bank_account_no, r.ifsc_code, r.notes, r.created_at
       FROM referrers r
       WHERE r.name = ?
       LIMIT 1`,
      [String(name).trim()]
    );
    return rows[0] || null;
  }

  static async create(payload) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO referrers (name, email, phone, bank_name, bank_account_no, ifsc_code, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.name.trim(),
        payload.email ? payload.email.trim().toLowerCase() : null,
        payload.phone ? payload.phone.trim() : null,
        payload.bank_name ? payload.bank_name.trim() : null,
        payload.bank_account_no ? payload.bank_account_no.trim() : null,
        payload.ifsc_code ? payload.ifsc_code.trim() : null,
        payload.notes ? payload.notes.trim() : null
      ]
    );
    return { id: result.insertId };
  }

  static async update(id, payload) {
    const pool = getPool();
    const [result] = await pool.query(
      `UPDATE referrers
       SET name = ?, email = ?, phone = ?, bank_name = ?, bank_account_no = ?, ifsc_code = ?, notes = ?
       WHERE id = ?`,
      [
        payload.name.trim(),
        payload.email ? payload.email.trim().toLowerCase() : null,
        payload.phone ? payload.phone.trim() : null,
        payload.bank_name ? payload.bank_name.trim() : null,
        payload.bank_account_no ? payload.bank_account_no.trim() : null,
        payload.ifsc_code ? payload.ifsc_code.trim() : null,
        payload.notes ? payload.notes.trim() : null,
        Number(id)
      ]
    );
    return { affectedRows: result.affectedRows };
  }

  static async delete(id) {
    const pool = getPool();
    const [result] = await pool.query('DELETE FROM referrers WHERE id = ?', [Number(id)]);
    return { affectedRows: result.affectedRows };
  }

  static async listReferrals(referrerName) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT rr.id, rr.applicant_id, a.full_name AS applicant_name, rr.reward_amount, rr.reward_status, rr.reward_paid_date, rr.notes, rr.created_at
       FROM referral_rewards rr
       JOIN applicants a ON rr.applicant_id = a.id
       WHERE rr.referrer_name = ?
       ORDER BY rr.created_at DESC`,
      [String(referrerName).trim()]
    );
    return rows;
  }
}

module.exports = ReferrerModel;
