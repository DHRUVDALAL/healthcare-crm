'use strict';

const { getPool } = require('../config/db');

class ReferralModel {
  static async list({ search, status }) {
    const pool = getPool();
    let q = `
      SELECT r.*, a.full_name as applicant_name, a.email as applicant_email
      FROM referral_rewards r
      JOIN applicants a ON r.applicant_id = a.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      q += ` AND (r.referrer_name LIKE ? OR a.full_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      q += ` AND r.reward_status = ?`;
      params.push(status);
    }

    q += ` ORDER BY r.created_at DESC`;

    const [rows] = await pool.query(q, params);
    return rows;
  }

  static async getById(id, conn = null) {
    const pool = conn || getPool();
    const [rows] = await pool.query(
      `SELECT r.*, a.full_name as applicant_name
       FROM referral_rewards r
       JOIN applicants a ON r.applicant_id = a.id
       WHERE r.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async getByApplicantId(applicantId, conn = null) {
    const pool = conn || getPool();
    const [rows] = await pool.query(`SELECT * FROM referral_rewards WHERE applicant_id = ?`, [applicantId]);
    return rows[0] || null;
  }

  static async create(payload, conn = null) {
    const pool = conn || getPool();
    const [res] = await pool.query(
      `INSERT INTO referral_rewards (
        applicant_id, referrer_name, referrer_contact, reward_amount, reward_status, notes
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        payload.applicant_id, payload.referrer_name, payload.referrer_contact,
        payload.reward_amount, payload.reward_status, payload.notes || ''
      ]
    );
    return { id: res.insertId };
  }

  static async updateStatus(id, status, paidDate = null, conn = null) {
    const pool = conn || getPool();
    await pool.query(
      `UPDATE referral_rewards SET reward_status = ?, reward_paid_date = ? WHERE id = ?`,
      [status, paidDate, id]
    );
  }

  static async stats(conn = null) {
    const pool = conn || getPool();
    const [rows] = await pool.query(`
      SELECT 
        COUNT(CASE WHEN reward_status = 'pending' THEN 1 END) as pendingRewards
      FROM referral_rewards
    `);
    return rows[0] || { pendingRewards: 0 };
  }

  /**
   * List referral rewards grouped by referrer identity.
   * Groups by LOWER(TRIM(referrer_name)) + LOWER(TRIM(referrer_contact)).
   * Counts successful referrals (eligible + rewarded = candidate reached selected).
   */
  static async listGroupedByReferrer({ search = '', milestoneStatus = '' } = {}) {
    const pool = getPool();
    const where = [];
    const params = [];

    if (search) {
      where.push('(r.referrer_name LIKE ? OR r.referrer_contact LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(`
      SELECT
        LOWER(TRIM(r.referrer_name)) AS referrer_key,
        MIN(r.referrer_name) AS referrer_name,
        MIN(r.referrer_contact) AS referrer_contact,
        COUNT(*) AS total_referred,
        SUM(CASE WHEN r.reward_status IN ('eligible', 'rewarded') THEN 1 ELSE 0 END) AS successful_count,
        SUM(CASE WHEN r.reward_status = 'rewarded' THEN 1 ELSE 0 END) AS rewarded_count,
        SUM(CASE WHEN r.reward_status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
        MIN(r.created_at) AS first_referral_at,
        MAX(r.updated_at) AS last_updated_at
      FROM referral_rewards r
      ${whereSql}
      GROUP BY LOWER(TRIM(r.referrer_name)), LOWER(TRIM(COALESCE(r.referrer_contact, '')))
      ORDER BY successful_count DESC, total_referred DESC
    `, params);

    return rows;
  }

  /**
   * Get all referral detail rows for a specific referrer (by name + contact).
   * Returns each referred candidate with their application status.
   */
  static async getReferrerCandidates(referrerName, referrerContact = '') {
    const pool = getPool();
    const normalizedName = String(referrerName || '').trim().toLowerCase();
    const normalizedContact = String(referrerContact || '').trim().toLowerCase();

    const [rows] = await pool.query(`
      SELECT
        r.id AS referral_id,
        r.applicant_id,
        a.full_name AS applicant_name,
        a.email AS applicant_email,
        a.phone AS applicant_phone,
        a.candidate_status,
        r.reward_status,
        r.reward_amount,
        r.reward_paid_date,
        r.created_at AS referral_date,
        r.referrer_name,
        r.referrer_contact,
        app.job_id,
        j.job_title,
        h.name AS hospital_name,
        app.current_stage
      FROM referral_rewards r
      JOIN applicants a ON r.applicant_id = a.id
      LEFT JOIN applications app ON app.applicant_id = a.id
      LEFT JOIN jobs j ON j.id = app.job_id
      LEFT JOIN hospitals h ON h.id = app.hospital_id
      WHERE LOWER(TRIM(r.referrer_name)) = ?
        AND LOWER(TRIM(COALESCE(r.referrer_contact, ''))) = ?
      ORDER BY r.created_at DESC
    `, [normalizedName, normalizedContact]);

    return rows;
  }

  static async syncReferralFromApplicant(applicant, conn = null) {
    const pool = conn || getPool();
    const applicantId = applicant.id;
    const isReferral = applicant.source === 'referral' || (applicant.referred_by && applicant.referred_by.trim() !== '');

    if (isReferral) {
      const [existing] = await pool.query('SELECT * FROM referral_rewards WHERE applicant_id = ?', [applicantId]);
      
      let status = 'pending';
      if (applicant.candidate_status === 'selected' || applicant.candidate_status === 'joined') {
        status = 'eligible';
      }
      
      if (existing.length > 0) {
        const currentRewardStatus = existing[0].reward_status;
        const targetStatus = currentRewardStatus === 'rewarded' ? 'rewarded' : status;
        
        await pool.query(
          `UPDATE referral_rewards
           SET referrer_name = ?, referrer_contact = ?, reward_status = ?
           WHERE applicant_id = ?`,
          [
            applicant.referred_by || 'Unknown',
            applicant.referral_contact || '',
            targetStatus,
            applicantId
          ]
        );
      } else {
        await pool.query(
          `INSERT INTO referral_rewards (
            applicant_id, referrer_name, referrer_contact, reward_amount, reward_status, notes
           ) VALUES (?, ?, ?, 5000.00, ?, 'Auto-synced from applicant details')`,
          [
            applicantId,
            applicant.referred_by || 'Unknown',
            applicant.referral_contact || '',
            status
          ]
        );
      }
    } else {
      await pool.query('DELETE FROM referral_rewards WHERE applicant_id = ?', [applicantId]);
    }
  }
}

module.exports = ReferralModel;
