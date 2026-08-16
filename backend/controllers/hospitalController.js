'use strict';

const HospitalModel = require('../models/hospitalModel');
const { ok, fail, created } = require('../utils/response');

function isNonEmptyString(v, maxLen = 500) {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= maxLen;
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePhone(phone) {
  if (typeof phone !== 'string') return '';
  return phone.replace(/[^0-9+]/g, '').trim();
}

function isValidStatus(status) {
  return status === 'active' || status === 'inactive';
}

function isValidDateString(d) {
  // expecting YYYY-MM-DD
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function validateHospitalPayload(body) {
  const payload = {
    name: body?.name,
    contact_person: body?.contact_person,
    phone: normalizePhone(body?.phone),
    email: (body?.email || '').toLowerCase().trim(),
    address: body?.address,
    city: body?.city,
    state: body?.state,
    commission_percentage: body?.commission_percentage,
    agreement_start_date: body?.agreement_start_date,
    agreement_end_date: body?.agreement_end_date,
    notes: body?.notes,
    status: body?.status
  };

  if (!isNonEmptyString(payload.name, 120)) return { error: 'Hospital name is required' };
  if (!isNonEmptyString(payload.contact_person, 120)) return { error: 'Contact person name is required' };
  if (!isNonEmptyString(payload.phone, 32)) return { error: 'Phone number is required' };
  if (!isValidEmail(payload.email)) return { error: 'Valid email is required' };
  if (!isNonEmptyString(payload.address, 500)) return { error: 'Full address is required' };
  if (!isNonEmptyString(payload.city, 80)) return { error: 'City is required' };
  if (!isNonEmptyString(payload.state, 80)) return { error: 'State is required' };

  const commission = Number(payload.commission_percentage);
  if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
    return { error: 'Commission percentage must be between 0 and 100' };
  }
  payload.commission_percentage = commission;

  if (!isValidDateString(payload.agreement_start_date)) return { error: 'Agreement start date is required (YYYY-MM-DD)' };
  if (!isValidDateString(payload.agreement_end_date)) return { error: 'Agreement end date is required (YYYY-MM-DD)' };

  if (!isValidStatus(payload.status)) return { error: 'Status must be active or inactive' };

  if (payload.notes != null && typeof payload.notes !== 'string') {
    return { error: 'Notes must be a string' };
  }

  return { payload };
}

async function list(req, res) {
  try {
    const { search, city, status } = req.query;

    const rows = await HospitalModel.list({
      search: typeof search === 'string' ? search.trim() : '',
      city: typeof city === 'string' && city.trim() ? city.trim() : '',
      status: typeof status === 'string' && status.trim() ? status.trim() : ''
    });

    const cities = await HospitalModel.distinctCities();

    return ok(res, { hospitals: rows, cities }, 'Hospitals');
  } catch (err) {
    return fail(res, 500, 'Failed to load hospitals');
  }
}

async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid hospital id');

    const row = await HospitalModel.getById(id);
    if (!row) return fail(res, 404, 'Hospital not found');

    const pool = require('../config/db').getPool();
    
    const [jobs] = await pool.query(
      'SELECT id, job_title, department, openings_count, filled_count, status, created_at FROM jobs WHERE hospital_id = ?',
      [id]
    );

    const [placements] = await pool.query(
      `SELECT a.id, a.full_name, a.candidate_status, a.updated_at, j.job_title
       FROM applicants a
       JOIN jobs j ON a.applied_job_id = j.id
       WHERE j.hospital_id = ? AND a.candidate_status IN ('selected', 'joined')`,
      [id]
    );

    const [candidates] = await pool.query(
      `SELECT a.id, a.full_name, a.total_experience, a.skills, a.candidate_status, j.job_title, u.full_name AS assigned_recruiter_name
       FROM applicants a
       JOIN jobs j ON a.applied_job_id = j.id
       LEFT JOIN users u ON a.assigned_recruiter_id = u.id
       WHERE j.hospital_id = ?`,
      [id]
    );

    const [recruiters] = await pool.query(
      `SELECT DISTINCT u.id, u.full_name, u.email, u.phone
       FROM applicants a
       JOIN jobs j ON a.applied_job_id = j.id
       JOIN users u ON a.assigned_recruiter_id = u.id
       WHERE j.hospital_id = ?`,
      [id]
    );

    const [invoices] = await pool.query(
      `SELECT id, invoice_number, invoice_amount, payment_status, due_date, invoice_date 
       FROM invoices 
       WHERE hospital_id = ?`,
      [id]
    );

    const timeline = [];
    jobs.forEach(jb => {
      timeline.push({
        type: 'job_created',
        title: `Job Opening Created: ${jb.job_title}`,
        time: jb.created_at
      });
    });
    placements.forEach(pl => {
      timeline.push({
        type: 'candidate_placed',
        title: `Candidate Placed: ${pl.full_name} as ${pl.job_title}`,
        time: pl.updated_at
      });
    });
    timeline.sort((a,b) => new Date(b.time) - new Date(a.time));

    const extendedHospital = {
      ...row,
      jobs,
      placements,
      candidates,
      recruiters,
      invoices,
      timeline
    };

    return ok(res, { hospital: extendedHospital }, 'Hospital');
  } catch (err) {
    return fail(res, 500, 'Failed to load hospital');
  }
}

async function create(req, res) {
  try {
    const { payload, error } = validateHospitalPayload(req.body);
    if (error) return fail(res, 400, error);

    const result = await HospitalModel.create(payload);
    const createdRow = await HospitalModel.getById(result.id);

    return created(res, { hospital: createdRow }, 'Hospital created');
  } catch (err) {
    if (String(err.message || '').includes('Duplicate')) {
      return fail(res, 409, 'Hospital email already exists');
    }
    return fail(res, 500, 'Failed to create hospital');
  }
}

async function update(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid hospital id');

    const exists = await HospitalModel.getById(id);
    if (!exists) return fail(res, 404, 'Hospital not found');

    const { payload, error } = validateHospitalPayload(req.body);
    if (error) return fail(res, 400, error);

    await HospitalModel.update(id, payload);
    const updated = await HospitalModel.getById(id);

    return ok(res, { hospital: updated }, 'Hospital updated');
  } catch (err) {
    if (String(err.message || '').includes('Duplicate')) {
      return fail(res, 409, 'Hospital email already exists');
    }
    return fail(res, 500, 'Failed to update hospital');
  }
}

async function remove(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid hospital id');

    const exists = await HospitalModel.getById(id);
    if (!exists) return fail(res, 404, 'Hospital not found');

    const result = await HospitalModel.remove(id);
    if (!result.affectedRows) return fail(res, 404, 'Hospital not found');

    return ok(res, { deleted: true }, 'Hospital deleted');
  } catch (err) {
    // likely FK restriction
    return fail(res, 409, 'Cannot delete hospital with linked job openings');
  }
}

async function setStatus(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid hospital id');

    const { status } = req.body || {};
    if (!isValidStatus(status)) return fail(res, 400, 'Status must be active or inactive');

    const exists = await HospitalModel.getById(id);
    if (!exists) return fail(res, 404, 'Hospital not found');

    await HospitalModel.setStatus(id, status);
    const updated = await HospitalModel.getById(id);

    return ok(res, { hospital: updated }, 'Hospital status updated');
  } catch (err) {
    return fail(res, 500, 'Failed to update hospital status');
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  setStatus
};
