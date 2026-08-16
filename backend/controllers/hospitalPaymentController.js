'use strict';

const HospitalPaymentModel = require('../models/hospitalPaymentModel');
const { ok, fail } = require('../utils/response');

async function list(req, res) {
  try {
    await HospitalPaymentModel.autoMarkOverdue();
    const { search, status, hospital_id } = req.query;
    const rows = await HospitalPaymentModel.list({
      search: search || '',
      status: status || '',
      hospital_id: hospital_id || null
    });
    return ok(res, { payments: rows }, 'Hospital payments');
  } catch (err) {
    return fail(res, 500, 'Failed to load payments');
  }
}

async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return fail(res, 400, 'Invalid id');
    const row = await HospitalPaymentModel.getById(id);
    if (!row) return fail(res, 404, 'Payment not found');
    return ok(res, { payment: row }, 'Payment details');
  } catch (err) {
    return fail(res, 500, 'Failed to load payment');
  }
}

async function create(req, res) {
  try {
    const { hospital_id, amount, due_date } = req.body;
    if (!hospital_id || !amount || !due_date) return fail(res, 400, 'Hospital, amount, and due date are required');
    const payload = { ...req.body, created_by: req.user.id };
    const { id } = await HospitalPaymentModel.create(payload);
    return ok(res, { id }, 'Payment created');
  } catch (err) {
    return fail(res, 500, 'Failed to create payment');
  }
}

async function update(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return fail(res, 400, 'Invalid id');
    await HospitalPaymentModel.update(id, req.body);
    return ok(res, { updated: true }, 'Payment updated');
  } catch (err) {
    return fail(res, 500, 'Failed to update payment');
  }
}

async function updateStatus(req, res) {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (!id || !status) return fail(res, 400, 'Invalid parameters');
    const paidDate = status === 'paid' ? new Date().toISOString().slice(0, 10) : null;
    await HospitalPaymentModel.updateStatus(id, status, paidDate);
    return ok(res, { updated: true }, 'Status updated');
  } catch (err) {
    return fail(res, 500, 'Failed to update status');
  }
}

async function remove(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return fail(res, 400, 'Invalid id');
    await HospitalPaymentModel.delete(id);
    return ok(res, { deleted: true }, 'Payment deleted');
  } catch (err) {
    return fail(res, 500, 'Failed to delete payment');
  }
}

async function financeSummary(req, res) {
  try {
    const summary = await HospitalPaymentModel.getFinanceSummary();
    return ok(res, summary, 'Finance summary');
  } catch (err) {
    return fail(res, 500, 'Failed to load finance summary');
  }
}

module.exports = { list, getById, create, update, updateStatus, remove, financeSummary };
