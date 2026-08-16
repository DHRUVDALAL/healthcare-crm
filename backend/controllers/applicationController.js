'use strict';

const { ok, fail, created } = require('../utils/response');
const ApplicationModel = require('../models/applicationModel');

async function list(req, res) {
  try {
    const { search, stage, jobId, hospitalId, applicantId } = req.query;
    const rows = await ApplicationModel.list({
      search: typeof search === 'string' ? search.trim() : '',
      stage: typeof stage === 'string' ? stage.trim() : '',
      jobId: typeof jobId === 'string' ? jobId.trim() : '',
      hospitalId: typeof hospitalId === 'string' ? hospitalId.trim() : '',
      applicantId: typeof applicantId === 'string' ? applicantId.trim() : ''
    });
    return ok(res, { applications: rows }, 'Applications');
  } catch (err) {
    return fail(res, 500, 'Failed to load applications');
  }
}

async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid application id');
    const row = await ApplicationModel.getById(id);
    if (!row) return fail(res, 404, 'Application not found');
    return ok(res, { application: row }, 'Application');
  } catch (err) {
    return fail(res, 500, 'Failed to load application');
  }
}

async function create(req, res) {
  // Prefer /api/pipeline for lifecycle + history; keep this for compatibility.
  try {
    const applicant_id = Number(req.body?.applicant_id);
    const job_id = Number(req.body?.job_id);
    const hospital_id = Number(req.body?.hospital_id);
    const current_stage = String(req.body?.current_stage || 'applied').trim();
    const next_action = String(req.body?.next_action || '').trim();
    const remarks = String(req.body?.remarks || '').trim();

    if (!Number.isInteger(applicant_id) || applicant_id <= 0) return fail(res, 400, 'Invalid applicant_id');
    if (!Number.isInteger(job_id) || job_id <= 0) return fail(res, 400, 'Invalid job_id');
    if (!Number.isInteger(hospital_id) || hospital_id <= 0) return fail(res, 400, 'Invalid hospital_id');

    const { id } = await ApplicationModel.create({
      applicant_id,
      job_id,
      hospital_id,
      current_stage,
      next_action,
      remarks,
      created_by: Number(req.user.id)
    });

    return created(res, { id }, 'Application created');
  } catch (err) {
    if (String(err?.code || '').toLowerCase().includes('dup')) {
      return fail(res, 409, 'Application already exists');
    }
    return fail(res, 500, 'Failed to create application');
  }
}

async function update(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid application id');

    const next_action = String(req.body?.next_action || '').trim();
    const remarks = String(req.body?.remarks || '').trim();

    const row = await ApplicationModel.getById(id);
    if (!row) return fail(res, 404, 'Application not found');

    await ApplicationModel.update(id, { next_action, remarks });
    return ok(res, { updated: true }, 'Application updated');
  } catch (err) {
    return fail(res, 500, 'Failed to update application');
  }
}

module.exports = {
  list,
  getById,
  create,
  update
};
