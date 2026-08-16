'use strict';

const EmployeeLogModel = require('../models/employeeLogModel');
const { ok, fail } = require('../utils/response');

async function list(req, res) {
  try {
    const { search, date } = req.query;
    const rows = await EmployeeLogModel.list({
      search: typeof search === 'string' ? search.trim() : '',
      date: typeof date === 'string' ? date.trim() : ''
    });
    return ok(res, { attendance: rows }, 'Attendance records');
  } catch (err) {
    return fail(res, 500, 'Failed to load attendance');
  }
}

async function logLogin(req, res) {
  try {
    const userId = req.user.id; // from authMiddleware
    await EmployeeLogModel.logLogin(userId);
    return ok(res, { loggedIn: true }, 'Login recorded');
  } catch (err) {
    return fail(res, 500, 'Failed to record login');
  }
}

async function logLogout(req, res) {
  try {
    const userId = req.user.id;
    await EmployeeLogModel.logLogout(userId);
    return ok(res, { loggedOut: true }, 'Logout recorded');
  } catch (err) {
    return fail(res, 500, 'Failed to record logout');
  }
}

module.exports = {
  list,
  logLogin,
  logLogout
};
