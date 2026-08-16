'use strict';

const { getPool } = require('../config/db');

function buildListWhere({ search, city, status }) {
  const where = [];
  const params = [];

  if (search) {
    where.push('h.name LIKE ?');
    params.push(`%${search}%`);
  }

  if (city) {
    where.push('h.city = ?');
    params.push(city);
  }

  if (status) {
    where.push('h.status = ?');
    params.push(status);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params
  };
}

async function list({ search, city, status, limit = 200, offset = 0 }) {
  const pool = getPool();
  const { whereSql, params } = buildListWhere({ search, city, status });

  const [rows] = await pool.query(
    `SELECT
      h.id,
      h.name,
      h.contact_person,
      h.phone,
      h.email,
      h.address,
      h.city,
      h.state,
      h.commission_percentage,
      h.agreement_start_date,
      h.agreement_end_date,
      h.notes,
      h.status,
      h.created_at,
      h.updated_at
     FROM hospitals h
     ${whereSql}
     ORDER BY h.updated_at DESC, h.id DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return rows;
}

async function getById(id) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT
      id, name, contact_person, phone, email, address, city, state,
      commission_percentage, agreement_start_date, agreement_end_date,
      notes, status, created_at, updated_at
     FROM hospitals
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function create(payload) {
  const pool = getPool();

  const [result] = await pool.query(
    `INSERT INTO hospitals
      (name, contact_person, phone, email, address, city, state,
       commission_percentage, agreement_start_date, agreement_end_date,
       notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.name,
      payload.contact_person,
      payload.phone,
      payload.email,
      payload.address,
      payload.city,
      payload.state,
      payload.commission_percentage,
      payload.agreement_start_date,
      payload.agreement_end_date,
      payload.notes || null,
      payload.status
    ]
  );

  return { id: result.insertId };
}

async function update(id, payload) {
  const pool = getPool();

  const [result] = await pool.query(
    `UPDATE hospitals
     SET
      name = ?,
      contact_person = ?,
      phone = ?,
      email = ?,
      address = ?,
      city = ?,
      state = ?,
      commission_percentage = ?,
      agreement_start_date = ?,
      agreement_end_date = ?,
      notes = ?,
      status = ?
     WHERE id = ?`,
    [
      payload.name,
      payload.contact_person,
      payload.phone,
      payload.email,
      payload.address,
      payload.city,
      payload.state,
      payload.commission_percentage,
      payload.agreement_start_date,
      payload.agreement_end_date,
      payload.notes || null,
      payload.status,
      id
    ]
  );

  return { affectedRows: result.affectedRows };
}

async function remove(id) {
  const pool = getPool();
  const [result] = await pool.query('DELETE FROM hospitals WHERE id = ?', [id]);
  return { affectedRows: result.affectedRows };
}

async function setStatus(id, status) {
  const pool = getPool();
  const [result] = await pool.query('UPDATE hospitals SET status = ? WHERE id = ?', [status, id]);
  return { affectedRows: result.affectedRows };
}

async function distinctCities() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT DISTINCT city
     FROM hospitals
     WHERE city IS NOT NULL AND city <> ''
     ORDER BY city ASC`
  );
  return rows.map(r => r.city);
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  setStatus,
  distinctCities
};
