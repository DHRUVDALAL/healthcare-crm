'use strict';

const { getPool } = require('../config/db');

function buildListWhere({ hospitalId, search, status, priority, location }) {
  const where = [];
  const params = [];

  if (hospitalId) {
    where.push('j.hospital_id = ?');
    params.push(Number(hospitalId));
  }

  if (search) {
    where.push('(j.job_title LIKE ? OR j.department LIKE ? OR h.name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status) {
    where.push('j.status = ?');
    params.push(status);
  }

  if (priority) {
    where.push('j.priority_level = ?');
    params.push(priority);
  }

  if (location) {
    where.push('j.location LIKE ?');
    params.push(`%${location}%`);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params
  };
}

async function list({ hospitalId, search, status, priority, location, limit = 200, offset = 0 }) {
  const pool = getPool();
  const { whereSql, params } = buildListWhere({ hospitalId, search, status, priority, location });

  const [rows] = await pool.query(
    `SELECT
      j.id,
      j.hospital_id,
      h.name AS hospital_name,
      j.job_title,
      j.department,
      j.qualification,
      j.experience_required,
      j.salary,
      j.openings_count,
      j.filled_count,
      j.location,
      j.shift_timing,
      j.job_description,
      j.required_skills,
      j.joining_timeline,
      j.priority_level,
      j.status,
      j.created_by,
      u.full_name AS created_by_name,
      j.expiry_date,
      j.created_at,
      j.updated_at
     FROM jobs j
     JOIN hospitals h ON h.id = j.hospital_id
     LEFT JOIN users u ON u.id = j.created_by
     ${whereSql}
     ORDER BY j.updated_at DESC, j.id DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return rows;
}

async function getById(id) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT
      j.id,
      j.hospital_id,
      h.name AS hospital_name,
      j.job_title,
      j.department,
      j.qualification,
      j.experience_required,
      j.salary,
      j.openings_count,
      j.filled_count,
      j.location,
      j.shift_timing,
      j.job_description,
      j.required_skills,
      j.joining_timeline,
      j.priority_level,
      j.status,
      j.created_by,
      u.full_name AS created_by_name,
      j.expiry_date,
      j.created_at,
      j.updated_at
     FROM jobs j
     JOIN hospitals h ON h.id = j.hospital_id
     LEFT JOIN users u ON u.id = j.created_by
     WHERE j.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function create(payload) {
  const pool = getPool();

  const [result] = await pool.query(
    `INSERT INTO jobs
      (hospital_id, job_title, department, qualification, experience_required,
       salary, openings_count, filled_count, location, shift_timing, job_description,
       required_skills, joining_timeline, priority_level, status, created_by, expiry_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.hospital_id,
      payload.job_title,
      payload.department,
      payload.qualification,
      payload.experience_required,
      payload.salary,
      payload.openings_count,
      payload.filled_count == null ? 0 : Number(payload.filled_count),
      payload.location,
      payload.shift_timing,
      payload.job_description,
      payload.required_skills,
      payload.joining_timeline,
      payload.priority_level,
      payload.status,
      payload.created_by,
      payload.expiry_date || null
    ]
  );

  return { id: result.insertId };
}

async function update(id, payload) {
  const pool = getPool();

  const [result] = await pool.query(
    `UPDATE jobs
     SET
      hospital_id = ?,
      job_title = ?,
      department = ?,
      qualification = ?,
      experience_required = ?,
      salary = ?,
      openings_count = ?,
      filled_count = ?,
      location = ?,
      shift_timing = ?,
      job_description = ?,
      required_skills = ?,
      joining_timeline = ?,
      priority_level = ?,
      status = ?,
      expiry_date = ?
     WHERE id = ?`,
    [
      payload.hospital_id,
      payload.job_title,
      payload.department,
      payload.qualification,
      payload.experience_required,
      payload.salary,
      payload.openings_count,
      payload.filled_count == null ? 0 : Number(payload.filled_count),
      payload.location,
      payload.shift_timing,
      payload.job_description,
      payload.required_skills,
      payload.joining_timeline,
      payload.priority_level,
      payload.status,
      payload.expiry_date || null,
      id
    ]
  );

  return { affectedRows: result.affectedRows };
}

async function incrementFilledCount(id, amount = 1) {
  const pool = getPool();
  await pool.query(
    'UPDATE jobs SET filled_count = filled_count + ? WHERE id = ?',
    [Number(amount), Number(id)]
  );
  
  const [rows] = await pool.query('SELECT filled_count, openings_count FROM jobs WHERE id = ? LIMIT 1', [Number(id)]);
  if (rows[0] && rows[0].filled_count >= rows[0].openings_count) {
    await pool.query('UPDATE jobs SET status = \'closed\' WHERE id = ?', [Number(id)]);
  }
}

async function remove(id) {
  const pool = getPool();
  const [result] = await pool.query('DELETE FROM jobs WHERE id = ?', [id]);
  return { affectedRows: result.affectedRows };
}

async function setStatus(id, status) {
  const pool = getPool();
  const [result] = await pool.query('UPDATE jobs SET status = ? WHERE id = ?', [status, id]);
  return { affectedRows: result.affectedRows };
}

async function listByHospital(hospitalId, { limit = 200, offset = 0 } = {}) {
  return list({ hospitalId, limit, offset });
}

async function countActiveJobs() {
  const pool = getPool();
  const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM jobs WHERE status = ?',[ 'open' ]);
  return Number(rows[0]?.cnt || 0);
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  setStatus,
  listByHospital,
  countActiveJobs,
  incrementFilledCount
};
