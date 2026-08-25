'use strict';

const LeaveModel = require('../models/leaveModel');
const NotificationService = require('../services/notificationService');
const { ok, fail } = require('../utils/response');

async function list(req, res) {
  try {
    const { search, status, employeeId } = req.query;
    // Admins see all. Non-admins only see their own.
    const queryEmployeeId = req.user.role === 'admin' ? (employeeId || null) : req.user.id;

    const rows = await LeaveModel.list({
      search: typeof search === 'string' ? search.trim() : '',
      status: typeof status === 'string' ? status.trim() : '',
      employeeId: queryEmployeeId
    });
    return ok(res, { leaves: rows }, 'Leave requests');
  } catch (err) {
    return fail(res, 500, 'Failed to load leaves');
  }
}

async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid leave id');

    const row = await LeaveModel.getById(id);
    if (!row) return fail(res, 404, 'Leave request not found');

    if (req.user.role !== 'admin' && row.employee_id !== req.user.id) {
      return fail(res, 403, 'Access denied');
    }

    return ok(res, { leave: row }, 'Leave request details');
  } catch (err) {
    return fail(res, 500, 'Failed to load leave request');
  }
}

async function create(req, res) {
  try {
    const payload = req.body;
    if (!payload.leave_type || !payload.start_date || !payload.end_date || !payload.reason) {
      return fail(res, 400, 'All fields are required');
    }

    payload.employee_id = req.user.id;
    payload.leave_status = 'pending';

    const { id } = await LeaveModel.create(payload);

    // Notify admins about new leave request
    NotificationService.onLeaveSubmitted(
      { ...payload, id }, req.user.full_name || req.user.email
    ).catch(() => {});

    return ok(res, { id }, 'Leave request created');
  } catch (err) {
    return fail(res, 500, 'Failed to create leave request');
  }
}

async function updateStatus(req, res) {
  try {
    // Only admin can do this (protected by route middleware)
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid leave id');

    const status = String(req.body?.status || '').trim();
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return fail(res, 400, 'Invalid status');
    }

    const remarks = String(req.body?.admin_remarks || '').trim();

    const row = await LeaveModel.getById(id);
    if (!row) return fail(res, 404, 'Leave request not found');

    await LeaveModel.updateStatus(id, status, remarks);

    // Notify the employee about their leave decision
    NotificationService.onLeaveStatusChanged(row, row.employee_id, status).catch(() => {});

    return ok(res, { updated: true, status }, 'Leave status updated');
  } catch (err) {
    return fail(res, 500, 'Failed to update leave status');
  }
}

async function getBalance(req, res) {
  try {
    const employeeId = req.user.role === 'admin' && req.query.employeeId
      ? Number(req.query.employeeId)
      : req.user.id;

    const pool = require('../config/db').getPool();
    const currentYear = new Date().getFullYear();

    // Query approved leaves for the employee in the current year
    const [rows] = await pool.query(
      `SELECT leave_type, start_date, end_date
       FROM leaves
       WHERE employee_id = ? AND leave_status = 'approved'`,
      [employeeId]
    );

    const takenMap = {};
    for (const r of rows) {
      const year = r.start_date ? new Date(r.start_date).getFullYear() : currentYear;
      if (year === currentYear) {
        let days = 1;
        if (r.start_date && r.end_date) {
          const diffMs = new Date(r.end_date) - new Date(r.start_date);
          days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
        }
        takenMap[r.leave_type] = (takenMap[r.leave_type] || 0) + days;
      }
    }

    const limits = {
      sick: 10,
      casual: 10,
      paid: 15,
      emergency: 5
    };

    const balances = Object.keys(limits).map(type => {
      const allowed = limits[type];
      const taken = takenMap[type] || 0;
      return {
        leave_type: type,
        allowed,
        taken,
        remaining: Math.max(0, allowed - taken)
      };
    });

    return ok(res, { year: currentYear, balances }, 'Leave balances');
  } catch (err) {
    return fail(res, 500, 'Failed to load leave balances');
  }
}

module.exports = {
  list,
  getById,
  create,
  updateStatus,
  getBalance
};
