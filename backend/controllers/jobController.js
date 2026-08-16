'use strict';

const JobModel = require('../models/jobModel');
const HospitalModel = require('../models/hospitalModel');
const { ok, fail, created } = require('../utils/response');

function isNonEmptyString(v, maxLen = 2000) {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= maxLen;
}

function isValidPriority(p) {
  return p === 'high' || p === 'medium' || p === 'low';
}

function isValidStatus(s) {
  return s === 'open' || s === 'closed' || s === 'hold';
}

function toNumberOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function validateJobPayload(body) {
  const payload = {
    hospital_id: toNumberOrNull(body?.hospital_id),
    job_title: body?.job_title,
    department: body?.department,
    qualification: body?.qualification,
    experience_required: body?.experience_required,
    salary: toNumberOrNull(body?.salary),
    openings_count: toNumberOrNull(body?.openings_count),
    filled_count: toNumberOrNull(body?.filled_count),
    location: body?.location,
    shift_timing: body?.shift_timing,
    job_description: body?.job_description,
    required_skills: body?.required_skills,
    joining_timeline: body?.joining_timeline,
    priority_level: body?.priority_level,
    status: body?.status,
    expiry_date: body?.expiry_date ? String(body.expiry_date).trim() : null
  };

  if (!Number.isInteger(payload.hospital_id) || payload.hospital_id <= 0) return { error: 'Hospital is required' };
  if (!isNonEmptyString(payload.job_title, 140)) return { error: 'Job title is required' };
  if (!isNonEmptyString(payload.department, 120)) return { error: 'Department is required' };
  if (!isNonEmptyString(payload.qualification, 200)) return { error: 'Qualification is required' };
  if (!isNonEmptyString(payload.experience_required, 120)) return { error: 'Experience required is required' };

  if (payload.salary === null || payload.salary < 0) return { error: 'Salary offered is required' };
  payload.salary = Number(payload.salary);

  if (!Number.isInteger(Number(payload.openings_count)) || Number(payload.openings_count) <= 0) {
    return { error: 'Number of openings must be a positive integer' };
  }
  payload.openings_count = Number(payload.openings_count);

  if (payload.filled_count !== null && (payload.filled_count < 0 || !Number.isInteger(payload.filled_count))) {
    return { error: 'Filled count must be a non-negative integer' };
  }

  if (!isNonEmptyString(payload.location, 120)) return { error: 'Job location is required' };
  if (!isNonEmptyString(payload.shift_timing, 120)) return { error: 'Shift timing is required' };
  if (!isNonEmptyString(payload.job_description, 4000)) return { error: 'Job description is required' };
  if (!isNonEmptyString(payload.required_skills, 800)) return { error: 'Required skills is required' };
  if (!isNonEmptyString(payload.joining_timeline, 120)) return { error: 'Joining timeline is required' };

  if (!isValidPriority(payload.priority_level)) return { error: 'Priority level must be high, medium, or low' };
  if (!isValidStatus(payload.status)) return { error: 'Status must be open, closed, or hold' };

  return { payload };
}

async function list(req, res) {
  try {
    const { hospital, search, status, priority, location } = req.query;

    const rows = await JobModel.list({
      hospitalId: typeof hospital === 'string' && hospital.trim() ? hospital.trim() : '',
      search: typeof search === 'string' ? search.trim() : '',
      status: typeof status === 'string' && status.trim() ? status.trim() : '',
      priority: typeof priority === 'string' && priority.trim() ? priority.trim() : '',
      location: typeof location === 'string' && location.trim() ? location.trim() : ''
    });

    return ok(res, { jobs: rows }, 'Jobs');
  } catch (err) {
    return fail(res, 500, 'Failed to load jobs');
  }
}

async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid job id');

    const row = await JobModel.getById(id);
    if (!row) return fail(res, 404, 'Job not found');

    const pool = require('../config/db').getPool();

    const [recruiterRows] = await pool.query(
      'SELECT id, full_name, email, phone FROM users WHERE id = ?',
      [row.created_by]
    );
    const assignedRecruiter = recruiterRows[0] || null;

    const [candidates] = await pool.query(
      `SELECT a.id, a.full_name, a.total_experience, a.skills, a.candidate_status, ap.current_stage, a.updated_at
       FROM applicants a
       LEFT JOIN applications ap ON ap.applicant_id = a.id AND ap.job_id = a.applied_job_id
       WHERE a.applied_job_id = ?`,
      [id]
    );

    const timeline = [];
    timeline.push({
      type: 'job_created',
      title: `Job opening created with ${row.openings_count} openings`,
      time: row.created_at
    });
    candidates.forEach(cand => {
      if (cand.candidate_status === 'selected' || cand.candidate_status === 'joined') {
        timeline.push({
          type: 'candidate_selected',
          title: `Candidate ${cand.full_name} selected for this position`,
          time: cand.updated_at || new Date()
        });
      }
    });

    const extendedJob = {
      ...row,
      assigned_recruiter: assignedRecruiter,
      candidates,
      remaining_positions: Math.max(0, Number(row.openings_count || 0) - Number(row.filled_count || 0)),
      timeline
    };

    return ok(res, { job: extendedJob }, 'Job');
  } catch (err) {
    return fail(res, 500, 'Failed to load job');
  }
}

async function create(req, res) {
  try {
    const { payload, error } = validateJobPayload(req.body);
    if (error) return fail(res, 400, error);

    const hospital = await HospitalModel.getById(payload.hospital_id);
    if (!hospital) return fail(res, 400, 'Invalid hospital');

    payload.created_by = req.user.id;

    const result = await JobModel.create(payload);
    const createdRow = await JobModel.getById(result.id);

    return created(res, { job: createdRow }, 'Job created');
  } catch (err) {
    return fail(res, 500, 'Failed to create job');
  }
}

async function update(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid job id');

    const exists = await JobModel.getById(id);
    if (!exists) return fail(res, 404, 'Job not found');

    const { payload, error } = validateJobPayload(req.body);
    if (error) return fail(res, 400, error);

    const hospital = await HospitalModel.getById(payload.hospital_id);
    if (!hospital) return fail(res, 400, 'Invalid hospital');

    await JobModel.update(id, payload);
    const updated = await JobModel.getById(id);

    return ok(res, { job: updated }, 'Job updated');
  } catch (err) {
    return fail(res, 500, 'Failed to update job');
  }
}

async function remove(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid job id');

    const exists = await JobModel.getById(id);
    if (!exists) return fail(res, 404, 'Job not found');

    const result = await JobModel.remove(id);
    if (!result.affectedRows) return fail(res, 404, 'Job not found');

    return ok(res, { deleted: true }, 'Job deleted');
  } catch (err) {
    return fail(res, 500, 'Failed to delete job');
  }
}

async function setStatus(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid job id');

    const { status } = req.body || {};
    if (!isValidStatus(status)) return fail(res, 400, 'Status must be open, closed, or hold');

    const exists = await JobModel.getById(id);
    if (!exists) return fail(res, 404, 'Job not found');

    await JobModel.setStatus(id, status);
    const updated = await JobModel.getById(id);

    return ok(res, { job: updated }, 'Job status updated');
  } catch (err) {
    return fail(res, 500, 'Failed to update job status');
  }
}

async function byHospital(req, res) {
  try {
    const hospitalId = Number(req.params.hospitalId);
    if (!Number.isInteger(hospitalId) || hospitalId <= 0) return fail(res, 400, 'Invalid hospital id');

    const rows = await JobModel.listByHospital(hospitalId);
    return ok(res, { jobs: rows }, 'Jobs by hospital');
  } catch (err) {
    return fail(res, 500, 'Failed to load jobs');
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  setStatus,
  byHospital
};
