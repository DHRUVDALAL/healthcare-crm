'use strict';

const InvoiceModel = require('../models/invoiceModel');
const ReferralModel = require('../models/referralModel');
const { getPool } = require('../config/db');
const { ok, fail } = require('../utils/response');

async function stats(req, res) {
  try {
    const invStats = await InvoiceModel.stats();
    const refStats = await ReferralModel.stats();

    return ok(res, {
      totalRevenue: Number(invStats.totalRevenue) || 0,
      pendingRevenue: Number(invStats.pendingRevenue) || 0,
      paidInvoices: Number(invStats.paidInvoices) || 0,
      pendingInvoices: Number(invStats.pendingInvoices) || 0,
      pendingReferrals: Number(refStats.pendingRewards) || 0
    }, 'Revenue Stats');
  } catch (err) {
    return fail(res, 500, 'Failed to load revenue stats');
  }
}

async function monthly(req, res) {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT 
        DATE_FORMAT(invoice_date, '%Y-%m') as month,
        SUM(invoice_amount) as revenue
      FROM invoices
      WHERE payment_status = 'paid'
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `);
    return ok(res, { monthly: rows }, 'Monthly Revenue');
  } catch (err) {
    return fail(res, 500, 'Failed to load monthly revenue');
  }
}

async function pending(req, res) {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT i.*, h.name as hospital_name 
      FROM invoices i
      JOIN hospitals h ON i.hospital_id = h.id
      WHERE i.payment_status = 'pending' OR i.payment_status = 'overdue'
      ORDER BY i.due_date ASC
      LIMIT 20
    `);
    return ok(res, { pending: rows }, 'Pending Invoices');
  } catch (err) {
    return fail(res, 500, 'Failed to load pending invoices');
  }
}

module.exports = {
  stats,
  monthly,
  pending
};
