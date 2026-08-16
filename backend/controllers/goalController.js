'use strict';

const GoalModel = require('../models/goalModel');
const { ok, fail } = require('../utils/response');

async function listGoals(req, res) {
  try {
    const employeeId = req.query.employee_id || (req.user.role !== 'admin' ? req.user.id : null);
    const goals = await GoalModel.list({
      employeeId: employeeId ? Number(employeeId) : null,
      status: req.query.status
    });
    return ok(res, { goals }, 'Employee goals list');
  } catch (err) {
    return fail(res, 500, 'Failed to fetch employee goals: ' + err.message);
  }
}

async function createGoal(req, res) {
  try {
    const payload = req.body || {};
    if (!payload.employee_id && req.user) {
      payload.employee_id = req.user.id;
    }
    if (!payload.period_start || !payload.period_end) {
      const now = new Date();
      payload.period_start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      payload.period_end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    }

    const result = await GoalModel.create(payload);
    return ok(res, { id: result.id }, 'Goal created successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to create goal: ' + err.message);
  }
}

async function updateGoal(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid goal id');

    await GoalModel.update(id, req.body || {});
    return ok(res, { updated: true }, 'Goal updated successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to update goal: ' + err.message);
  }
}

module.exports = {
  listGoals,
  createGoal,
  updateGoal
};
