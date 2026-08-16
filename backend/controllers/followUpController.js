'use strict';

const FollowUpModel = require('../models/followUpModel');
const ApplicantModel = require('../models/applicantModel');
const { ok, fail, created } = require('../utils/response');

async function checkApplicantOwnership(req, applicantId) {
  const applicant = await ApplicantModel.getById(applicantId);
  if (!applicant) {
    throw new Error('Applicant not found');
  }
  if (req.user.role !== 'admin' && Number(applicant.attended_by) !== Number(req.user.id)) {
    throw new Error('Forbidden: Candidate not assigned to you');
  }
  return applicant;
}

async function list(req, res) {
  try {
    const { applicantId } = req.query;
    
    // Ownership check if querying a specific applicant
    if (applicantId) {
      try {
        await checkApplicantOwnership(req, applicantId);
      } catch (err) {
        return fail(res, err.message.includes('Forbidden') ? 403 : 404, err.message);
      }
    }

    const employeeId = req.user.role === 'admin' ? null : req.user.id;
    const followUps = await FollowUpModel.list({
      applicantId: applicantId ? Number(applicantId) : null,
      employeeId
    });

    return ok(res, { followUps }, 'Follow-ups list');
  } catch (err) {
    return fail(res, 500, 'Failed to load follow-ups: ' + err.message);
  }
}

async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid follow-up ID');

    const followUp = await FollowUpModel.getById(id);
    if (!followUp) return fail(res, 404, 'Follow-up not found');

    try {
      await checkApplicantOwnership(req, followUp.applicant_id);
    } catch (err) {
      return fail(res, 403, err.message);
    }

    return ok(res, { followUp }, 'Follow-up details');
  } catch (err) {
    return fail(res, 500, 'Failed to load follow-up: ' + err.message);
  }
}

async function create(req, res) {
  try {
    const { applicant_id, follow_up_date, follow_up_time, remarks, outcome, next_follow_up_date, next_follow_up_time, reminder_set, status } = req.body || {};
    
    if (!applicant_id || !follow_up_date) {
      return fail(res, 400, 'Applicant ID and Follow-up Date are required');
    }

    try {
      await checkApplicantOwnership(req, applicant_id);
    } catch (err) {
      return fail(res, err.message.includes('Forbidden') ? 403 : 404, err.message);
    }

    const payload = {
      applicant_id: Number(applicant_id),
      employee_id: req.user.id,
      follow_up_date,
      follow_up_time,
      remarks,
      outcome,
      next_follow_up_date,
      next_follow_up_time,
      reminder_set,
      status
    };

    const result = await FollowUpModel.create(payload);
    return created(res, { id: result.id }, 'Follow-up created successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to create follow-up: ' + err.message);
  }
}

async function update(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid follow-up ID');

    const existing = await FollowUpModel.getById(id);
    if (!existing) return fail(res, 404, 'Follow-up not found');

    try {
      await checkApplicantOwnership(req, existing.applicant_id);
    } catch (err) {
      return fail(res, 403, err.message);
    }

    const { follow_up_date, follow_up_time, remarks, outcome, next_follow_up_date, next_follow_up_time, reminder_set, status } = req.body || {};
    
    if (!follow_up_date) {
      return fail(res, 400, 'Follow-up Date is required');
    }

    const payload = {
      follow_up_date,
      follow_up_time,
      remarks,
      outcome,
      next_follow_up_date,
      next_follow_up_time,
      reminder_set,
      status: status || existing.status
    };

    await FollowUpModel.update(id, payload);
    return ok(res, { updated: true }, 'Follow-up updated successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to update follow-up: ' + err.message);
  }
}

async function remove(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid follow-up ID');

    const existing = await FollowUpModel.getById(id);
    if (!existing) return fail(res, 404, 'Follow-up not found');

    try {
      await checkApplicantOwnership(req, existing.applicant_id);
    } catch (err) {
      return fail(res, 403, err.message);
    }

    await FollowUpModel.delete(id);
    return ok(res, { deleted: true }, 'Follow-up deleted successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to delete follow-up: ' + err.message);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove
};
