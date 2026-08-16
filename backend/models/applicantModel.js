'use strict';

const { getPool } = require('../config/db');

function buildListWhere({ search, skills, jobId, minExperience, status, source, assignedRecruiterId, assignmentStatus, attendedBy, preferredHospitalId }) {
  const where = [];
  const params = [];

  if (search) {
    where.push('(a.full_name LIKE ? OR a.email LIKE ? OR a.phone LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (skills) {
    where.push('a.skills LIKE ?');
    params.push(`%${skills}%`);
  }

  if (jobId) {
    where.push('a.applied_job_id = ?');
    params.push(Number(jobId));
  }

  if (minExperience != null && minExperience !== '') {
    where.push('a.total_experience >= ?');
    params.push(Number(minExperience));
  }

  if (status) {
    where.push('a.candidate_status = ?');
    params.push(status);
  }

  if (source) {
    where.push('a.source = ?');
    params.push(source);
  }

  if (assignedRecruiterId != null && assignedRecruiterId !== '') {
    where.push('a.assigned_recruiter_id = ?');
    params.push(Number(assignedRecruiterId));
  }

  if (assignmentStatus) {
    where.push('a.assignment_status = ?');
    params.push(assignmentStatus);
  }

  if (attendedBy != null && attendedBy !== '') {
    where.push('a.attended_by = ?');
    params.push(Number(attendedBy));
  }

  if (preferredHospitalId != null && preferredHospitalId !== '') {
    where.push('a.preferred_hospital_id = ?');
    params.push(Number(preferredHospitalId));
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params
  };
}

async function list({ search, skills, jobId, minExperience, status, source, assignedRecruiterId, assignmentStatus, attendedBy, preferredHospitalId, limit = 200, offset = 0 }) {
  const pool = getPool();
  const { whereSql, params } = buildListWhere({ search, skills, jobId, minExperience, status, source, assignedRecruiterId, assignmentStatus, attendedBy, preferredHospitalId });

  const [rows] = await pool.query(
    `SELECT
      a.id,
      a.full_name,
      a.phone,
      a.email,
      a.dob,
      a.gender,
      a.city,
      a.state,
      a.address,
      a.total_experience,
      a.current_company,
      a.current_designation,
      a.current_salary,
      a.expected_salary,
      a.notice_period,
      a.qualification,
      a.skills,
      a.certifications,
      a.preferred_location,
      a.applied_job_id,
      j.job_title,
      h.name AS hospital_name,
      a.source,
      a.referred_by,
      a.referral_contact,
      a.referral_reward_status,
      a.notes,
      a.candidate_status,
      a.original_resume_path,
      a.masked_resume_path,
      a.pool_status,
      a.matching_score,
      a.created_by,
      u.full_name AS created_by_name,
      a.assigned_recruiter_id,
      recr.full_name AS assigned_recruiter_name,
      a.available_from,
      a.attended_by,
      att.full_name AS attended_by_name,
      a.assignment_status,
      a.priority,
      a.preferred_hospital_id,
      pref_h.name AS preferred_hospital_name,
      a.created_at,
      a.updated_at
     FROM applicants a
     LEFT JOIN jobs j ON j.id = a.applied_job_id
     LEFT JOIN hospitals h ON h.id = j.hospital_id
     LEFT JOIN users u ON u.id = a.created_by
     LEFT JOIN users recr ON recr.id = a.assigned_recruiter_id
     LEFT JOIN users att ON att.id = a.attended_by
     LEFT JOIN hospitals pref_h ON pref_h.id = a.preferred_hospital_id
     ${whereSql}
     ORDER BY a.updated_at DESC, a.id DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return rows;
}

async function listByJob(jobId, { limit = 200, offset = 0 } = {}) {
  return list({ jobId, limit, offset });
}

async function getById(id) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT
      a.id,
      a.full_name,
      a.phone,
      a.email,
      a.dob,
      a.gender,
      a.city,
      a.state,
      a.address,
      a.total_experience,
      a.current_company,
      a.current_designation,
      a.current_salary,
      a.expected_salary,
      a.notice_period,
      a.qualification,
      a.skills,
      a.certifications,
      a.preferred_location,
      a.applied_job_id,
      j.job_title,
      h.name AS hospital_name,
      a.source,
      a.referred_by,
      a.referral_contact,
      a.referral_reward_status,
      a.notes,
      a.candidate_status,
      a.original_resume_path,
      a.masked_resume_path,
      a.pool_status,
      a.matching_score,
      a.created_by,
      u.full_name AS created_by_name,
      a.assigned_recruiter_id,
      recr.full_name AS assigned_recruiter_name,
      a.available_from,
      a.attended_by,
      att.full_name AS attended_by_name,
      a.assignment_status,
      a.priority,
      a.preferred_hospital_id,
      pref_h.name AS preferred_hospital_name,
      a.created_at,
      a.updated_at
     FROM applicants a
     LEFT JOIN jobs j ON j.id = a.applied_job_id
     LEFT JOIN hospitals h ON h.id = j.hospital_id
     LEFT JOIN users u ON u.id = a.created_by
     LEFT JOIN users recr ON recr.id = a.assigned_recruiter_id
     LEFT JOIN users att ON att.id = a.attended_by
     LEFT JOIN hospitals pref_h ON pref_h.id = a.preferred_hospital_id
     WHERE a.id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function create(payload) {
  const pool = getPool();

  const [result] = await pool.query(
    `INSERT INTO applicants (
      full_name, phone, email, dob, gender,
      city, state, address,
      total_experience, current_company, current_designation,
      current_salary, expected_salary, notice_period,
      qualification, skills, certifications, preferred_location,
      applied_job_id,
      source, referred_by, referral_contact, referral_reward_status,
      notes, candidate_status,
      original_resume_path,
      masked_resume_path,
      pool_status,
      matching_score,
      created_by,
      assigned_recruiter_id,
      available_from,
      attended_by,
      assignment_status,
      priority,
      preferred_hospital_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.full_name,
      payload.phone,
      payload.email,
      payload.dob,
      payload.gender,
      payload.city,
      payload.state,
      payload.address,
      payload.total_experience,
      payload.current_company,
      payload.current_designation,
      payload.current_salary,
      payload.expected_salary,
      payload.notice_period,
      payload.qualification,
      payload.skills,
      payload.certifications,
      payload.preferred_location,
      payload.applied_job_id,
      payload.source,
      payload.referred_by,
      payload.referral_contact,
      payload.referral_reward_status,
      payload.notes,
      payload.candidate_status,
      payload.original_resume_path,
      payload.masked_resume_path || null,
      payload.pool_status == null ? 0 : Number(payload.pool_status),
      payload.matching_score == null ? null : Number(payload.matching_score),
      payload.created_by,
      payload.assigned_recruiter_id == null ? null : Number(payload.assigned_recruiter_id),
      payload.available_from || null,
      payload.attended_by == null ? null : Number(payload.attended_by),
      payload.assignment_status || 'Unassigned',
      payload.priority || 'medium',
      payload.preferred_hospital_id == null ? null : Number(payload.preferred_hospital_id)
    ]
  );

  return { id: result.insertId };
}

async function update(id, payload) {
  const pool = getPool();

  const [result] = await pool.query(
    `UPDATE applicants
     SET
      full_name = ?,
      phone = ?,
      email = ?,
      dob = ?,
      gender = ?,
      city = ?,
      state = ?,
      address = ?,
      total_experience = ?,
      current_company = ?,
      current_designation = ?,
      current_salary = ?,
      expected_salary = ?,
      notice_period = ?,
      qualification = ?,
      skills = ?,
      certifications = ?,
      preferred_location = ?,
      applied_job_id = ?,
      source = ?,
      referred_by = ?,
      referral_contact = ?,
      referral_reward_status = ?,
      notes = ?,
      candidate_status = ?,
      original_resume_path = ?,
      masked_resume_path = ?,
      pool_status = ?,
      matching_score = ?,
      assigned_recruiter_id = ?,
      available_from = ?,
      attended_by = ?,
      assignment_status = ?,
      priority = ?,
      preferred_hospital_id = ?
     WHERE id = ?`,
    [
      payload.full_name,
      payload.phone,
      payload.email,
      payload.dob,
      payload.gender,
      payload.city,
      payload.state,
      payload.address,
      payload.total_experience,
      payload.current_company,
      payload.current_designation,
      payload.current_salary,
      payload.expected_salary,
      payload.notice_period,
      payload.qualification,
      payload.skills,
      payload.certifications,
      payload.preferred_location,
      payload.applied_job_id,
      payload.source,
      payload.referred_by,
      payload.referral_contact,
      payload.referral_reward_status,
      payload.notes,
      payload.candidate_status,
      payload.original_resume_path,
      payload.masked_resume_path || null,
      payload.pool_status == null ? 0 : Number(payload.pool_status),
      payload.matching_score == null ? null : Number(payload.matching_score),
      payload.assigned_recruiter_id == null ? null : Number(payload.assigned_recruiter_id),
      payload.available_from || null,
      payload.attended_by == null ? null : Number(payload.attended_by),
      payload.assignment_status || 'Unassigned',
      payload.priority || 'medium',
      payload.preferred_hospital_id == null ? null : Number(payload.preferred_hospital_id),
      id
    ]
  );

  return { affectedRows: result.affectedRows };
}

async function assignRecruiter(id, recruiterId, assignedBy, reason = null) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT assigned_recruiter_id FROM applicants WHERE id = ?', [Number(id)]);
    if (!rows.length) {
      throw new Error('Applicant not found');
    }
    const prevRecruiterId = rows[0].assigned_recruiter_id;

    let nextStatus = 'Assigned';
    if (recruiterId == null) {
      nextStatus = 'Unassigned';
    } else if (prevRecruiterId !== null && Number(prevRecruiterId) !== Number(recruiterId)) {
      nextStatus = 'Transferred';
    }

    const recId = recruiterId == null ? null : Number(recruiterId);
    await conn.query(
      `UPDATE applicants 
       SET assigned_recruiter_id = ?, attended_by = ?, assignment_status = ? 
       WHERE id = ?`,
      [recId, recId, nextStatus, Number(id)]
    );

    await conn.query(
      `INSERT INTO assignment_history (applicant_id, prev_employee_id, new_employee_id, assigned_by, reason)
       VALUES (?, ?, ?, ?, ?)`,
      [
        Number(id),
        prevRecruiterId,
        recId,
        Number(assignedBy),
        reason || (recId ? (prevRecruiterId ? 'Transferred to new recruiter' : 'Assigned recruiter') : 'Unassigned recruiter')
      ]
    );

    await conn.commit();
    return { affectedRows: 1 };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function remove(id) {
  const pool = getPool();
  const [result] = await pool.query('DELETE FROM applicants WHERE id = ?', [id]);
  return { affectedRows: result.affectedRows };
}

async function setStatus(id, candidateStatus) {
  const pool = getPool();
  const [result] = await pool.query('UPDATE applicants SET candidate_status = ? WHERE id = ?', [candidateStatus, id]);
  return { affectedRows: result.affectedRows };
}

async function countTotalApplicants() {
  const pool = getPool();
  const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM applicants');
  return Number(rows[0]?.cnt || 0);
}

async function listRecentApplicants(limit = 5) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, full_name, candidate_status, created_at
     FROM applicants
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [Number(limit)]
  );
  return rows;
}

const fs = require('fs');
const path = require('path');

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');
const RESUMES_ROOT = path.join(UPLOADS_ROOT, 'resumes');

function resolveResumePath(relativePath) {
  const rel = String(relativePath || '');
  const abs = path.resolve(UPLOADS_ROOT, rel);
  const allowedRoot = path.resolve(RESUMES_ROOT) + path.sep;
  if (!abs.startsWith(allowedRoot)) return null;
  return abs;
}

async function deleteMaskedFileIfExists(maskedResumeRelPath) {
  const abs = resolveResumePath(maskedResumeRelPath);
  if (!abs) return;
  await fs.promises.unlink(abs).catch(() => {});
}

async function setMaskedResumePath(id, maskedResumeRelPath) {
  const pool = getPool();
  const [result] = await pool.query(
    'UPDATE applicants SET masked_resume_path = ? WHERE id = ?',
    [String(maskedResumeRelPath || ''), Number(id)]
  );
  return { affectedRows: result.affectedRows };
}

async function setMatchingScore(id, score) {
  const pool = getPool();
  const [result] = await pool.query(
    'UPDATE applicants SET matching_score = ? WHERE id = ?',
    [score == null ? null : Number(score), Number(id)]
  );
  return { affectedRows: result.affectedRows };
}

async function setPoolStatus(id, poolStatus) {
  const pool = getPool();
  const val = poolStatus ? 1 : 0;
  const [result] = await pool.query(
    'UPDATE applicants SET pool_status = ? WHERE id = ?',
    [val, Number(id)]
  );
  return { affectedRows: result.affectedRows };
}

async function setAppliedJob(id, jobId) {
  const pool = getPool();
  const [result] = await pool.query(
    'UPDATE applicants SET applied_job_id = ? WHERE id = ?',
    [jobId == null ? null : Number(jobId), Number(id)]
  );
  return { affectedRows: result.affectedRows };
}

function buildPoolWhere({ search, skills, minExperience, location, prevJobId, assignedRecruiterId, status }) {
  const where = [];
  const params = [];

  if (search) {
    where.push('(a.full_name LIKE ? OR a.email LIKE ? OR a.phone LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (skills) {
    where.push('a.skills LIKE ?');
    params.push(`%${skills}%`);
  }

  if (minExperience != null && minExperience !== '') {
    where.push('a.total_experience >= ?');
    params.push(Number(minExperience));
  }

  if (location) {
    where.push('a.preferred_location LIKE ?');
    params.push(`%${location}%`);
  }

  if (prevJobId) {
    where.push('a.applied_job_id = ?');
    params.push(Number(prevJobId));
  }

  if (assignedRecruiterId != null && assignedRecruiterId !== '') {
    where.push('a.assigned_recruiter_id = ?');
    params.push(Number(assignedRecruiterId));
  }

  if (status) {
    where.push('a.candidate_status = ?');
    params.push(status);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params
  };
}

async function listPool({ search, skills, minExperience, location, prevJobId, assignedRecruiterId, status, limit = 200, offset = 0 }) {
  const pool = getPool();
  const { whereSql, params } = buildPoolWhere({ search, skills, minExperience, location, prevJobId, assignedRecruiterId, status });

  const [rows] = await pool.query(
    `SELECT
      a.id,
      a.full_name,
      a.phone,
      a.email,
      a.total_experience,
      a.skills,
      a.qualification,
      a.preferred_location,
      a.applied_job_id,
      j.job_title,
      h.name AS hospital_name,
      a.candidate_status,
      a.pool_status,
      a.masked_resume_path,
      a.matching_score,
      a.assigned_recruiter_id,
      recr.full_name AS assigned_recruiter_name,
      a.attended_by,
      a.assignment_status,
      a.priority,
      a.preferred_hospital_id,
      a.created_at,
      a.updated_at
     FROM applicants a
     LEFT JOIN jobs j ON j.id = a.applied_job_id
     LEFT JOIN hospitals h ON h.id = j.hospital_id
     LEFT JOIN users recr ON recr.id = a.assigned_recruiter_id
     ${whereSql}
     ORDER BY a.updated_at DESC, a.id DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return rows;
}

async function listAllForMatching({ limit = 5000 } = {}) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT
      id,
      full_name,
      phone,
      email,
      total_experience,
      current_designation,
      qualification,
      skills,
      preferred_location,
      candidate_status,
      pool_status,
      applied_job_id,
      masked_resume_path
     FROM applicants
     ORDER BY updated_at DESC, id DESC
     LIMIT ?`,
    [Number(limit)]
  );
  return rows;
}

async function countPoolCandidates() {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM applicants WHERE pool_status = 1 OR candidate_status = 'pool'"
  );
  return Number(rows[0]?.cnt || 0);
}

async function countShortlistedCandidates() {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM applicants WHERE candidate_status = 'hold'"
  );
  return Number(rows[0]?.cnt || 0);
}

async function addDocument(applicantId, fileName, filePath, uploadedBy) {
  const pool = getPool();
  const [result] = await pool.query(
    'INSERT INTO candidate_documents (applicant_id, file_name, file_path, uploaded_by) VALUES (?, ?, ?, ?)',
    [Number(applicantId), fileName, filePath, Number(uploadedBy)]
  );
  return { id: result.insertId };
}

async function listDocuments(applicantId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT d.*, u.full_name AS uploaded_by_name
     FROM candidate_documents d
     JOIN users u ON d.uploaded_by = u.id
     WHERE d.applicant_id = ?
     ORDER BY d.created_at DESC`,
    [Number(applicantId)]
  );
  return rows;
}

async function getDocumentById(docId) {
  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT * FROM candidate_documents WHERE id = ? LIMIT 1',
    [Number(docId)]
  );
  return rows[0] || null;
}

async function deleteDocument(docId) {
  const pool = getPool();
  const [result] = await pool.query(
    'DELETE FROM candidate_documents WHERE id = ?',
    [Number(docId)]
  );
  return { affectedRows: result.affectedRows };
}

module.exports = {
  list,
  listByJob,
  getById,
  create,
  update,
  remove,
  setStatus,
  setMaskedResumePath,
  setMatchingScore,
  setPoolStatus,
  setAppliedJob,
  deleteMaskedFileIfExists,
  listPool,
  listAllForMatching,
  countTotalApplicants,
  countPoolCandidates,
  countShortlistedCandidates,
  listRecentApplicants,
  assignRecruiter,
  addDocument,
  listDocuments,
  getDocumentById,
  deleteDocument
};
