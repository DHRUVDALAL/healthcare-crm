'use strict';

const { getPool } = require('../config/db');

async function getById(id, db = getPool()) {
  const [rows] = await db.query(
    `SELECT
      i.*,
      ap.full_name AS applicant_name,
      j.job_title,
      h.name AS hospital_name
     FROM interviews i
     JOIN applicants ap ON ap.id = i.applicant_id
     JOIN jobs j ON j.id = i.job_id
     JOIN hospitals h ON h.id = i.hospital_id
     WHERE i.id = ?
     LIMIT 1`,
    [Number(id)]
  );
  return rows[0] || null;
}

async function list({ search = '', status = '', result = '', jobId = '', hospitalId = '', fromDate = '', toDate = '', limit = 200, offset = 0 } = {}, db = getPool()) {
  const where = [];
  const params = [];

  if (search) {
    where.push('(ap.full_name LIKE ? OR j.job_title LIKE ? OR h.name LIKE ? OR i.interviewer_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status) {
    where.push('i.status = ?');
    params.push(String(status));
  }

  if (result) {
    where.push('i.result = ?');
    params.push(String(result));
  }

  if (jobId) {
    where.push('i.job_id = ?');
    params.push(Number(jobId));
  }

  if (hospitalId) {
    where.push('i.hospital_id = ?');
    params.push(Number(hospitalId));
  }

  if (fromDate) {
    where.push('i.interview_date >= ?');
    params.push(String(fromDate));
  }

  if (toDate) {
    where.push('i.interview_date <= ?');
    params.push(String(toDate));
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT
      i.id,
      i.applicant_id,
      ap.full_name AS applicant_name,
      i.job_id,
      j.job_title,
      i.hospital_id,
      h.name AS hospital_name,
      i.interview_date,
      i.interview_time,
      i.interview_mode,
      i.interview_round,
      i.interviewer_name,
      i.meeting_details,
      i.feedback,
      i.result,
      i.status,
      i.created_at,
      i.updated_at
     FROM interviews i
     JOIN applicants ap ON ap.id = i.applicant_id
     JOIN jobs j ON j.id = i.job_id
     JOIN hospitals h ON h.id = i.hospital_id
     ${whereSql}
     ORDER BY i.interview_date DESC, i.interview_time DESC, i.id DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return rows;
}

async function create(payload, db = getPool()) {
  const [result] = await db.query(
    `INSERT INTO interviews (
      applicant_id, job_id, hospital_id,
      interview_date, interview_time,
      interview_mode, interview_round,
      interviewer_name, meeting_details,
      feedback, result, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(payload.applicant_id),
      Number(payload.job_id),
      Number(payload.hospital_id),
      String(payload.interview_date),
      String(payload.interview_time),
      String(payload.interview_mode),
      Number(payload.interview_round),
      String(payload.interviewer_name || ''),
      String(payload.meeting_details || ''),
      String(payload.feedback || ''),
      String(payload.result || 'pending'),
      String(payload.status || 'scheduled')
    ]
  );
  return { id: result.insertId };
}

async function update(id, payload, db = getPool()) {
  const [result] = await db.query(
    `UPDATE interviews
     SET interview_date = ?, interview_time = ?, interview_mode = ?, interview_round = ?,
         interviewer_name = ?, meeting_details = ?
     WHERE id = ?`,
    [
      String(payload.interview_date),
      String(payload.interview_time),
      String(payload.interview_mode),
      Number(payload.interview_round),
      String(payload.interviewer_name || ''),
      String(payload.meeting_details || ''),
      Number(id)
    ]
  );
  return { affectedRows: result.affectedRows };
}

async function setStatus(id, status, db = getPool()) {
  const [result] = await db.query('UPDATE interviews SET status = ? WHERE id = ?', [String(status), Number(id)]);
  return { affectedRows: result.affectedRows };
}

async function setFeedback(id, feedback, db = getPool()) {
  const [result] = await db.query('UPDATE interviews SET feedback = ? WHERE id = ?', [String(feedback || ''), Number(id)]);
  return { affectedRows: result.affectedRows };
}

async function setResult(id, resultValue, status, db = getPool()) {
  const [result] = await db.query(
    'UPDATE interviews SET result = ?, status = ? WHERE id = ?',
    [String(resultValue), String(status), Number(id)]
  );
  return { affectedRows: result.affectedRows };
}

async function countScheduled(db = getPool()) {
  const [rows] = await db.query("SELECT COUNT(*) AS cnt FROM interviews WHERE status = 'scheduled'");
  return Number(rows[0]?.cnt || 0);
}

module.exports = {
  getById,
  list,
  create,
  update,
  setStatus,
  setFeedback,
  setResult,
  countScheduled
};
