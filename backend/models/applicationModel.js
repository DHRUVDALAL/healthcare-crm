'use strict';

const { getPool } = require('../config/db');

async function getById(id, db = getPool()) {
  const [rows] = await db.query(
    `SELECT
      a.id,
      a.applicant_id,
      a.job_id,
      a.hospital_id,
      a.current_stage,
      a.next_action,
      a.remarks,
      a.created_by,
      u.full_name AS created_by_name,
      a.created_at,
      a.updated_at,
      ap.full_name AS applicant_name,
      ap.candidate_status,
      j.job_title,
      h.name AS hospital_name
     FROM applications a
     JOIN applicants ap ON ap.id = a.applicant_id
     JOIN jobs j ON j.id = a.job_id
     JOIN hospitals h ON h.id = a.hospital_id
     LEFT JOIN users u ON u.id = a.created_by
     WHERE a.id = ?
     LIMIT 1`,
    [Number(id)]
  );
  return rows[0] || null;
}

async function getByApplicantJob(applicantId, jobId, db = getPool()) {
  const [rows] = await db.query(
    `SELECT id, applicant_id, job_id, hospital_id, current_stage, next_action, remarks, created_by, created_at, updated_at
     FROM applications
     WHERE applicant_id = ? AND job_id = ?
     LIMIT 1`,
    [Number(applicantId), Number(jobId)]
  );
  return rows[0] || null;
}

async function list({ search = '', stage = '', jobId = '', hospitalId = '', applicantId = '', assignedRecruiterId = '', limit = 200, offset = 0 } = {}, db = getPool()) {
  const where = [];
  const params = [];

  if (search) {
    where.push('(ap.full_name LIKE ? OR ap.email LIKE ? OR ap.phone LIKE ? OR j.job_title LIKE ? OR h.name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (stage) {
    where.push('a.current_stage = ?');
    params.push(String(stage));
  }

  if (jobId) {
    where.push('a.job_id = ?');
    params.push(Number(jobId));
  }

  if (hospitalId) {
    where.push('a.hospital_id = ?');
    params.push(Number(hospitalId));
  }

  if (applicantId) {
    where.push('a.applicant_id = ?');
    params.push(Number(applicantId));
  }

  if (assignedRecruiterId != null && assignedRecruiterId !== '') {
    where.push('ap.assigned_recruiter_id = ?');
    params.push(Number(assignedRecruiterId));
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT
      a.id,
      a.applicant_id,
      ap.full_name AS applicant_name,
      a.job_id,
      j.job_title,
      a.hospital_id,
      h.name AS hospital_name,
      a.current_stage,
      a.next_action,
      a.updated_at
     FROM applications a
     JOIN applicants ap ON ap.id = a.applicant_id
     JOIN jobs j ON j.id = a.job_id
     JOIN hospitals h ON h.id = a.hospital_id
     ${whereSql}
     ORDER BY a.updated_at DESC, a.id DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return rows;
}

async function create({ applicant_id, job_id, hospital_id, current_stage, next_action, remarks, created_by }, db = getPool()) {
  const [result] = await db.query(
    `INSERT INTO applications (applicant_id, job_id, hospital_id, current_stage, next_action, remarks, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(applicant_id),
      Number(job_id),
      Number(hospital_id),
      String(current_stage),
      String(next_action || ''),
      String(remarks || ''),
      Number(created_by)
    ]
  );
  return { id: result.insertId };
}

async function update(id, { next_action, remarks }, db = getPool()) {
  const [result] = await db.query(
    `UPDATE applications
     SET next_action = ?, remarks = ?
     WHERE id = ?`,
    [String(next_action || ''), String(remarks || ''), Number(id)]
  );
  return { affectedRows: result.affectedRows };
}

async function setStage(applicationId, { old_stage, new_stage, changed_by, notes }, db = getPool()) {
  // Assumes caller validated transition and ran in a transaction.
  const [r1] = await db.query(
    'UPDATE applications SET current_stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [String(new_stage), Number(applicationId)]
  );

  await db.query(
    `INSERT INTO application_stage_history (application_id, old_stage, new_stage, changed_by, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [
      Number(applicationId),
      String(old_stage || ''),
      String(new_stage),
      Number(changed_by),
      String(notes || '')
    ]
  );

  return { affectedRows: r1.affectedRows };
}

async function history(applicationId, { limit = 300 } = {}, db = getPool()) {
  const [rows] = await db.query(
    `SELECT
      h.id,
      h.application_id,
      h.old_stage,
      h.new_stage,
      h.changed_by,
      u.full_name AS changed_by_name,
      h.changed_at,
      h.notes
     FROM application_stage_history h
     LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.application_id = ?
     ORDER BY h.id DESC
     LIMIT ?`,
    [Number(applicationId), Number(limit)]
  );
  return rows;
}

async function createIfMissing({ applicant_id, job_id, hospital_id, created_by, next_action = '', remarks = '' }, db = getPool()) {
  try {
    const [result] = await db.query(
      `INSERT INTO applications (applicant_id, job_id, hospital_id, current_stage, next_action, remarks, created_by)
       VALUES (?, ?, ?, 'applied', ?, ?, ?)`,
      [Number(applicant_id), Number(job_id), Number(hospital_id), String(next_action || ''), String(remarks || ''), Number(created_by)]
    );
    return { id: result.insertId, created: true };
  } catch (e) {
    // Duplicate key (applicant_id, job_id)
    const existing = await getByApplicantJob(applicant_id, job_id, db);
    return { id: existing?.id || null, created: false };
  }
}

async function countByStage(stage, db = getPool()) {
  const [rows] = await db.query('SELECT COUNT(*) AS cnt FROM applications WHERE current_stage = ?', [String(stage)]);
  return Number(rows[0]?.cnt || 0);
}

async function countInPipeline(db = getPool()) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt
     FROM applications
     WHERE current_stage NOT IN ('selected','rejected','moved_to_pool')`
  );
  return Number(rows[0]?.cnt || 0);
}

module.exports = {
  getById,
  getByApplicantJob,
  list,
  create,
  update,
  setStage,
  history,
  createIfMissing,
  countByStage,
  countInPipeline
};
