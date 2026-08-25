'use strict';

const { getPool } = require('../config/db');

class InvoiceModel {
  static async list({ search, status, fromDate, toDate }) {
    const pool = getPool();
    let q = `
      SELECT i.*, 
             a.full_name as applicant_name, 
             j.job_title, 
             h.name as hospital_name
      FROM invoices i
      JOIN applicants a ON i.applicant_id = a.id
      JOIN jobs j ON i.job_id = j.id
      JOIN hospitals h ON i.hospital_id = h.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      q += ` AND (i.invoice_number LIKE ? OR a.full_name LIKE ? OR h.name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      q += ` AND i.payment_status = ?`;
      params.push(status);
    }

    if (fromDate) {
      q += ` AND i.invoice_date >= ?`;
      params.push(fromDate);
    }

    if (toDate) {
      q += ` AND i.invoice_date <= ?`;
      params.push(toDate);
    }

    q += ` ORDER BY i.created_at DESC`;

    const [rows] = await pool.query(q, params);
    return rows;
  }

  static async getById(id, conn = null) {
    const pool = conn || getPool();
    const [rows] = await pool.query(
      `SELECT i.*, 
              a.full_name as applicant_name, a.email as applicant_email,
              j.job_title, 
              h.name as hospital_name, h.address as hospital_address, h.email as hospital_email
       FROM invoices i
       JOIN applicants a ON i.applicant_id = a.id
       JOIN jobs j ON i.job_id = j.id
       JOIN hospitals h ON i.hospital_id = h.id
       WHERE i.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async create(payload, conn = null) {
    const pool = conn || getPool();

    const candidateSalary = Number(payload.candidate_salary || payload.candidate_annual_ctc || 0);
    const feeType = payload.fee_type === 'fixed' ? 'fixed' : 'percentage';
    const feePct = Number(payload.commission_percentage || payload.placement_fee_percentage || payload.fee_percentage || 0);
    const fixedFee = Number(payload.fixed_fee_amount || 0);

    let subtotal = Number(payload.subtotal || 0);
    if (!subtotal) {
      subtotal = feeType === 'fixed' ? fixedFee : (candidateSalary * (feePct / 100));
    }

    const gstPct = Number(payload.gst_percentage || 0);
    const gstAmt = Number(payload.gst_amount || (subtotal * (gstPct / 100)));
    const totalAmt = Number(payload.invoice_amount || payload.total_amount || (subtotal + gstAmt));

    const [res] = await pool.query(
      `INSERT INTO invoices (
        invoice_number, hospital_id, applicant_id, job_id, 
        candidate_salary, commission_percentage, fee_type, fixed_fee_amount,
        subtotal, gst_percentage, gst_amount, invoice_amount, 
        invoice_date, due_date, payment_status, payment_method, transaction_reference, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.invoice_number, Number(payload.hospital_id), Number(payload.applicant_id), Number(payload.job_id),
        candidateSalary, feePct, feeType, fixedFee,
        subtotal, gstPct, gstAmt, totalAmt,
        payload.invoice_date, payload.due_date, payload.payment_status || 'pending',
        payload.payment_method || null, payload.transaction_reference || null, payload.notes || '', payload.created_by || null
      ]
    );
    return { id: res.insertId, invoice_amount: totalAmt };
  }

  static async update(id, payload, conn = null) {
    const pool = conn || getPool();

    const candidateSalary = Number(payload.candidate_salary || 0);
    const feeType = payload.fee_type === 'fixed' ? 'fixed' : 'percentage';
    const feePct = Number(payload.commission_percentage || payload.fee_percentage || 0);
    const fixedFee = Number(payload.fixed_fee_amount || 0);

    let subtotal = Number(payload.subtotal || 0);
    if (!subtotal) {
      subtotal = feeType === 'fixed' ? fixedFee : (candidateSalary * (feePct / 100));
    }

    const gstPct = Number(payload.gst_percentage || 0);
    const gstAmt = Number(payload.gst_amount || (subtotal * (gstPct / 100)));
    const totalAmt = Number(payload.invoice_amount || payload.total_amount || (subtotal + gstAmt));

    await pool.query(
      `UPDATE invoices SET
        hospital_id = ?, applicant_id = ?, job_id = ?, candidate_salary = ?,
        commission_percentage = ?, fee_type = ?, fixed_fee_amount = ?,
        subtotal = ?, gst_percentage = ?, gst_amount = ?, invoice_amount = ?,
        invoice_date = ?, due_date = ?, payment_status = ?, payment_method = ?,
        transaction_reference = ?, notes = ?
       WHERE id = ?`,
      [
        Number(payload.hospital_id), Number(payload.applicant_id), Number(payload.job_id), candidateSalary,
        feePct, feeType, fixedFee,
        subtotal, gstPct, gstAmt, totalAmt,
        payload.invoice_date, payload.due_date, payload.payment_status, payload.payment_method || null,
        payload.transaction_reference || null, payload.notes || '', Number(id)
      ]
    );
  }

  static async recordPayment(invoiceId, payload, conn = null) {
    const pool = conn || getPool();
    const inv = await InvoiceModel.getById(invoiceId, pool);
    if (!inv) throw new Error('Invoice not found');

    const paymentAmount = Number(payload.amount || 0);
    if (paymentAmount <= 0) throw new Error('Invalid payment amount');

    await pool.query(
      `INSERT INTO invoice_payments (invoice_id, amount, payment_method, transaction_reference, payment_date, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(invoiceId), paymentAmount, payload.payment_method || 'bank_transfer',
        payload.transaction_reference || null, payload.payment_date || new Date().toISOString().slice(0, 10),
        payload.notes || '', payload.created_by || null
      ]
    );

    const newPaidAmount = Number(inv.paid_amount || 0) + paymentAmount;
    const totalAmount = Number(inv.invoice_amount || 0);
    let newStatus = inv.payment_status;

    if (newPaidAmount >= totalAmount) {
      newStatus = 'paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'partially_paid';
    }

    const paidDate = newStatus === 'paid' ? (payload.payment_date || new Date().toISOString().slice(0, 10)) : inv.payment_received_date;

    await pool.query(
      `UPDATE invoices SET paid_amount = ?, payment_status = ?, payment_received_date = ? WHERE id = ?`,
      [newPaidAmount, newStatus, paidDate, Number(invoiceId)]
    );

    return { paid_amount: newPaidAmount, status: newStatus };
  }

  static async getPayments(invoiceId, conn = null) {
    const pool = conn || getPool();
    const [rows] = await pool.query(
      `SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_date DESC, id DESC`,
      [Number(invoiceId)]
    );
    return rows;
  }

  static async setStatus(id, status, paidDate = null, conn = null) {
    const pool = conn || getPool();
    await pool.query(
      `UPDATE invoices SET payment_status = ?, payment_received_date = ? WHERE id = ?`,
      [status, paidDate, id]
    );
  }

  static async delete(id, conn = null) {
    const pool = conn || getPool();
    await pool.query(`DELETE FROM invoices WHERE id = ?`, [id]);
  }

  static async stats(conn = null) {
    const pool = conn || getPool();
    const [rows] = await pool.query(`
      SELECT 
        SUM(CASE WHEN payment_status = 'paid' THEN invoice_amount ELSE 0 END) as totalRevenue,
        SUM(CASE WHEN payment_status IN ('pending', 'overdue', 'partially_paid') THEN (invoice_amount - COALESCE(paid_amount, 0)) ELSE 0 END) as pendingRevenue,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paidInvoices,
        COUNT(CASE WHEN payment_status IN ('pending', 'overdue', 'partially_paid') THEN 1 END) as pendingInvoices
      FROM invoices
    `);
    return rows[0] || { totalRevenue: 0, pendingRevenue: 0, paidInvoices: 0, pendingInvoices: 0 };
  }

  static async getFinancialSummary(conn = null) {
    const pool = conn || getPool();

    const [totals] = await pool.query(`
      SELECT 
        COALESCE(SUM(invoice_amount), 0) as totalInvoiced,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN invoice_amount ELSE paid_amount END), 0) as collectedRevenue,
        COALESCE(SUM(CASE WHEN payment_status IN ('pending', 'overdue', 'partially_paid') THEN (invoice_amount - COALESCE(paid_amount, 0)) ELSE 0 END), 0) as outstandingRevenue,
        COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN invoice_amount ELSE 0 END), 0) as pendingPayments
      FROM invoices
    `);

    const [hospitals] = await pool.query(`
      SELECT h.id, h.name as hospital_name, COALESCE(SUM(i.invoice_amount), 0) as total_revenue
      FROM invoices i JOIN hospitals h ON i.hospital_id = h.id
      GROUP BY h.id ORDER BY total_revenue DESC LIMIT 10
    `);

    const [recruiters] = await pool.query(`
      SELECT u.id, u.full_name as recruiter_name, COALESCE(SUM(i.invoice_amount), 0) as total_revenue
      FROM invoices i
      JOIN applicants a ON i.applicant_id = a.id
      JOIN users u ON a.created_by = u.id
      GROUP BY u.id ORDER BY total_revenue DESC LIMIT 10
    `);

    const [monthly] = await pool.query(`
      SELECT DATE_FORMAT(invoice_date, '%Y-%m') as month, SUM(invoice_amount) as revenue
      FROM invoices
      WHERE invoice_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY month ORDER BY month
    `);

    return {
      totals: totals[0] || {},
      hospital_revenue: hospitals,
      recruiter_revenue: recruiters,
      monthly_revenue: monthly
    };
  }

  /**
   * Auto-update any pending invoices past their due_date to 'overdue'.
   * Returns the number of rows affected.
   */
  static async updateOverdueInvoices(conn = null) {
    const pool = conn || getPool();
    const [result] = await pool.query(`
      UPDATE invoices
      SET payment_status = 'overdue'
      WHERE payment_status = 'pending'
        AND due_date IS NOT NULL
        AND due_date < CURDATE()
    `);
    return result.affectedRows || 0;
  }
}

module.exports = InvoiceModel;
