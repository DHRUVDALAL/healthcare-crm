'use strict';

const AuditLogModel = require('../models/auditLogModel');
const { ok, fail } = require('../utils/response');

async function list(req, res) {
  try {
    const { userId, entityType, action, fromDate, toDate } = req.query;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const logs = await AuditLogModel.list({
      userId: userId ? Number(userId) : null,
      entityType: entityType || null,
      action: action || null,
      fromDate: fromDate || null,
      toDate: toDate || null,
      limit,
      offset
    });
    return ok(res, { logs }, 'Audit logs');
  } catch (err) {
    return fail(res, 500, 'Failed to load audit logs');
  }
}

module.exports = {
  list
};
