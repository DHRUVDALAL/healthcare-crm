'use strict';

const WorkLogModel = require('../models/workLogModel');
const { logActivity } = require('../services/activityTrackerService');
const { ok, fail } = require('../utils/response');

async function getTodayLog(req, res) {
  try {
    const userId = req.user.id;
    const log = await WorkLogModel.getOrCreateToday(userId);
    return ok(res, { workLog: log }, 'Today work log');
  } catch (err) {
    return fail(res, 500, 'Failed to retrieve today work log: ' + err.message);
  }
}

async function updateTodayLog(req, res) {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().slice(0, 10);
    const updated = await WorkLogModel.update(userId, today, req.body || {});
    await logActivity(userId, 'WORK_LOG_UPDATED', 'work_logs', { details: `Updated daily work log for ${today}` });
    return ok(res, { workLog: updated }, 'Daily work log updated successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to update daily work log: ' + err.message);
  }
}

async function listWorkLogs(req, res) {
  try {
    const { date, employee_id, department, review_status, limit, offset } = req.query;
    const logs = await WorkLogModel.list({
      date: typeof date === 'string' ? date.trim() : null,
      employeeId: employee_id ? Number(employee_id) : null,
      department: typeof department === 'string' ? department.trim() : null,
      reviewStatus: typeof review_status === 'string' ? review_status.trim() : null,
      limit: limit ? Number(limit) : 100,
      offset: offset ? Number(offset) : 0
    });
    return ok(res, { workLogs: logs }, 'Daily work logs list');
  } catch (err) {
    return fail(res, 500, 'Failed to list work logs: ' + err.message);
  }
}

async function reviewWorkLog(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid work log id');

    const { review_status, manager_remarks } = req.body || {};
    if (!['pending_review', 'reviewed', 'approved', 'needs_improvement'].includes(review_status)) {
      return fail(res, 400, 'Invalid review status');
    }

    await WorkLogModel.review(id, { review_status, manager_remarks });
    await logActivity(req.user.id, 'WORK_LOG_REVIEWED', 'work_logs', { entity_id: id, details: `Status: ${review_status}` });
    return ok(res, { reviewed: true, status: review_status }, 'Daily work log review updated');
  } catch (err) {
    return fail(res, 500, 'Failed to review work log: ' + err.message);
  }
}

module.exports = {
  getTodayLog,
  updateTodayLog,
  listWorkLogs,
  reviewWorkLog
};
