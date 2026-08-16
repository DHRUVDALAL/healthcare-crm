'use strict';

const ProjectionModel = require('../models/projectionModel');
const RecruiterTargetModel = require('../models/recruiterTargetModel');
const { getPool } = require('../config/db');
const { ok, fail } = require('../utils/response');

async function list(req, res) {
  try {
    const rows = await ProjectionModel.list();
    return ok(res, { projections: rows }, 'Projections');
  } catch (err) {
    return fail(res, 500, 'Failed to load projections');
  }
}

async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid id');

    const row = await ProjectionModel.getById(id);
    if (!row) return fail(res, 404, 'Projection not found');

    return ok(res, { projection: row }, 'Projection details');
  } catch (err) {
    return fail(res, 500, 'Failed to load projection');
  }
}

async function upsert(req, res) {
  try {
    const payload = req.body;
    if (!payload.month) return fail(res, 400, 'Month is required');

    const { id } = await ProjectionModel.upsert(payload);
    return ok(res, { id }, 'Projection saved');
  } catch (err) {
    return fail(res, 500, 'Failed to save projection');
  }
}

async function getProgress(req, res) {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const proj = await ProjectionModel.getByMonth(month);

    if (!proj) {
      return ok(res, { month, target: null, actual: null }, 'No projection for this month');
    }

    const pool = getPool();
    
    // Revenue achieved this month (from paid invoices in this month)
    const [revRows] = await pool.query(`
      SELECT SUM(invoice_amount) as achieved_revenue
      FROM invoices
      WHERE payment_status = 'paid' AND DATE_FORMAT(payment_received_date, '%Y-%m') = ?
    `, [month]);

    // Hires achieved this month (selected applications)
    const [hireRows] = await pool.query(`
      SELECT COUNT(*) as achieved_hires
      FROM application_stage_history
      WHERE new_stage = 'selected' AND DATE_FORMAT(changed_at, '%Y-%m') = ?
    `, [month]);

    const actual = {
      revenue: Number(revRows[0]?.achieved_revenue || 0),
      hires: Number(hireRows[0]?.achieved_hires || 0)
    };

    return ok(res, {
      month,
      target: {
        hiring_target: proj.hiring_target,
        revenue_target: proj.revenue_target,
        placement_target: proj.placement_target,
        team_notes: proj.team_notes
      },
      actual
    }, 'Progress data');

  } catch (err) {
    return fail(res, 500, 'Failed to load progress');
  }
}

async function getRecruiterTargets(req, res) {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const rows = await RecruiterTargetModel.getTargets(month);
    return ok(res, { targets: rows }, 'Recruiter targets loaded');
  } catch (err) {
    return fail(res, 500, 'Failed to load recruiter targets');
  }
}

async function upsertRecruiterTarget(req, res) {
  try {
    const { recruiter_id, month, submissions_target, selections_target, revenue_target, notes } = req.body || {};

    if (!Number.isInteger(Number(recruiter_id)) || Number(recruiter_id) <= 0) {
      return fail(res, 400, 'Valid recruiter ID is required');
    }
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return fail(res, 400, 'Valid month is required (YYYY-MM)');
    }

    await RecruiterTargetModel.setTarget(recruiter_id, month, {
      submissions_target,
      selections_target,
      revenue_target,
      notes
    });

    const target = await RecruiterTargetModel.getTargetForRecruiter(recruiter_id, month);
    return ok(res, { target }, 'Recruiter target configured successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to configure recruiter target');
  }
}

module.exports = {
  list,
  getById,
  upsert,
  getProgress,
  getRecruiterTargets,
  upsertRecruiterTarget
};
