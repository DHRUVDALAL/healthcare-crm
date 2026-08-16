'use strict';

const { getPool } = require('../config/db');

class WorkLogModel {
  static async getOrCreateToday(employeeId, conn = null) {
    const pool = conn || getPool();
    const today = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toTimeString().slice(0, 8);

    const [existing] = await pool.query(
      `SELECT * FROM daily_work_logs WHERE employee_id = ? AND log_date = ?`,
      [Number(employeeId), today]
    );

    if (existing.length) {
      return existing[0];
    }

    const [res] = await pool.query(
      `INSERT INTO daily_work_logs (employee_id, log_date, login_time, review_status)
       VALUES (?, ?, ?, 'pending_review')`,
      [Number(employeeId), today, nowTime]
    );

    const [newLog] = await pool.query(`SELECT * FROM daily_work_logs WHERE id = ?`, [res.insertId]);
    return newLog[0];
  }

  static async update(employeeId, logDate, payload, conn = null) {
    const pool = conn || getPool();
    const nowTime = new Date().toTimeString().slice(0, 8);

    await pool.query(
      `UPDATE daily_work_logs SET
        logout_time = COALESCE(?, logout_time),
        todays_goal = COALESCE(?, todays_goal),
        todays_plan = COALESCE(?, todays_plan),
        eod_summary = COALESCE(?, eod_summary),
        candidates_contacted = COALESCE(?, candidates_contacted),
        candidates_processed = COALESCE(?, candidates_processed),
        new_applicants_added = COALESCE(?, new_applicants_added),
        resumes_collected = COALESCE(?, resumes_collected),
        hospital_calls = COALESCE(?, hospital_calls),
        hospital_meetings = COALESCE(?, hospital_meetings),
        followups_completed = COALESCE(?, followups_completed),
        interviews_scheduled = COALESCE(?, interviews_scheduled),
        interviews_completed = COALESCE(?, interviews_completed),
        offers_released = COALESCE(?, offers_released),
        placements_closed = COALESCE(?, placements_closed),
        invoices_followed_up = COALESCE(?, invoices_followed_up),
        referral_calls = COALESCE(?, referral_calls),
        other_activities = COALESCE(?, other_activities),
        work_completed = COALESCE(?, work_completed),
        pending_work = COALESCE(?, pending_work),
        problems_faced = COALESCE(?, problems_faced),
        tomorrows_plan = COALESCE(?, tomorrows_plan),
        remarks = COALESCE(?, remarks),
        completion_percentage = COALESCE(?, completion_percentage)
       WHERE employee_id = ? AND log_date = ?`,
      [
        payload.logout_time || (payload.eod_summary ? nowTime : null),
        payload.todays_goal || null, payload.todays_plan || null, payload.eod_summary || null,
        payload.candidates_contacted ?? null, payload.candidates_processed ?? null, payload.new_applicants_added ?? null,
        payload.resumes_collected ?? null, payload.hospital_calls ?? null, payload.hospital_meetings ?? null,
        payload.followups_completed ?? null, payload.interviews_scheduled ?? null, payload.interviews_completed ?? null,
        payload.offers_released ?? null, payload.placements_closed ?? null, payload.invoices_followed_up ?? null,
        payload.referral_calls ?? null, payload.other_activities ?? null,
        payload.work_completed || null, payload.pending_work || null, payload.problems_faced || null,
        payload.tomorrows_plan || null, payload.remarks || null, payload.completion_percentage ?? null,
        Number(employeeId), logDate
      ]
    );

    const [updated] = await pool.query(
      `SELECT * FROM daily_work_logs WHERE employee_id = ? AND log_date = ?`,
      [Number(employeeId), logDate]
    );
    return updated[0] || null;
  }

  static async list({ date, employeeId, department, reviewStatus, limit = 100, offset = 0 } = {}, conn = null) {
    const pool = conn || getPool();
    const where = [];
    const params = [];

    if (date) {
      where.push('dwl.log_date = ?');
      params.push(date);
    }
    if (employeeId) {
      where.push('dwl.employee_id = ?');
      params.push(Number(employeeId));
    }
    if (reviewStatus) {
      where.push('dwl.review_status = ?');
      params.push(reviewStatus);
    }
    if (department) {
      where.push('u.department = ?');
      params.push(department);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT dwl.*, u.full_name as employee_name, u.email as employee_email, u.department, u.designation
       FROM daily_work_logs dwl
       JOIN users u ON dwl.employee_id = u.id
       ${whereSql}
       ORDER BY dwl.log_date DESC, dwl.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
    return rows;
  }

  static async review(id, { review_status, manager_remarks }, conn = null) {
    const pool = conn || getPool();
    await pool.query(
      `UPDATE daily_work_logs SET review_status = ?, manager_remarks = ? WHERE id = ?`,
      [review_status, manager_remarks || '', Number(id)]
    );
  }
}

module.exports = WorkLogModel;
