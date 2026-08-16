'use strict';

const ReferrerModel = require('../models/referrerModel');
const { calculateMilestoneInfo } = require('../utils/milestoneConfig');
const { ok, fail, created } = require('../utils/response');

function isNonEmptyString(v, maxLen = 2000) {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= maxLen;
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function list(req, res) {
  try {
    const { search } = req.query || {};
    const referrers = await ReferrerModel.list({ search });
    return ok(res, { referrers }, 'Referrer list');
  } catch (err) {
    return fail(res, 500, 'Failed to load referrers');
  }
}

async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid referrer ID');

    const referrer = await ReferrerModel.getById(id);
    if (!referrer) return fail(res, 404, 'Referrer profile not found');

    const referrals = await ReferrerModel.listReferrals(referrer.name);
    
    // Compute milestones progress based on active selection placements (eligible & rewarded)
    const successCount = Number(referrer.eligible_count) + Number(referrer.rewarded_count);
    const milestones = calculateMilestoneInfo(successCount);

    return ok(res, { referrer, referrals, milestones }, 'Referrer details loaded');
  } catch (err) {
    return fail(res, 500, 'Failed to load referrer details');
  }
}

async function create(req, res) {
  try {
    const { name, email, phone, bank_name, bank_account_no, ifsc_code, notes } = req.body || {};

    if (!isNonEmptyString(name, 140)) return fail(res, 400, 'Referrer name is required (max 140 chars)');
    if (email && !isValidEmail(email)) return fail(res, 400, 'Invalid email format');

    // Check duplicate name
    const existing = await ReferrerModel.getByName(name);
    if (existing) return fail(res, 409, 'Referrer with this name already exists');

    const payload = { name, email, phone, bank_name, bank_account_no, ifsc_code, notes };
    const result = await ReferrerModel.create(payload);
    const createdProfile = await ReferrerModel.getById(result.id);

    return created(res, { referrer: createdProfile }, 'Referrer profile created successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to create referrer profile');
  }
}

async function update(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid referrer ID');

    const existing = await ReferrerModel.getById(id);
    if (!existing) return fail(res, 404, 'Referrer profile not found');

    const { name, email, phone, bank_name, bank_account_no, ifsc_code, notes } = req.body || {};
    if (!isNonEmptyString(name, 140)) return fail(res, 400, 'Referrer name is required');
    if (email && !isValidEmail(email)) return fail(res, 400, 'Invalid email format');

    // Check duplicate name on rename
    if (name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const nameCheck = await ReferrerModel.getByName(name);
      if (nameCheck) return fail(res, 409, 'Another referrer with this name already exists');
    }

    const payload = { name, email, phone, bank_name, bank_account_no, ifsc_code, notes };
    await ReferrerModel.update(id, payload);
    const updated = await ReferrerModel.getById(id);

    return ok(res, { referrer: updated }, 'Referrer profile updated successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to update referrer profile');
  }
}

async function remove(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid referrer ID');

    const result = await ReferrerModel.delete(id);
    if (!result.affectedRows) return fail(res, 404, 'Referrer profile not found');

    return ok(res, { deleted: true }, 'Referrer profile deleted successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to delete referrer profile');
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove
};
