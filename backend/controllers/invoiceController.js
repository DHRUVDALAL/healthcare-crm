'use strict';

const InvoiceModel = require('../models/invoiceModel');
const { ok, fail } = require('../utils/response');

async function list(req, res) {
  try {
    // Auto-mark overdue invoices before listing
    await InvoiceModel.updateOverdueInvoices();

    const { search, status, fromDate, toDate } = req.query;
    const rows = await InvoiceModel.list({
      search: typeof search === 'string' ? search.trim() : '',
      status: typeof status === 'string' ? status.trim() : '',
      fromDate: typeof fromDate === 'string' ? fromDate.trim() : '',
      toDate: typeof toDate === 'string' ? toDate.trim() : ''
    });
    return ok(res, { invoices: rows }, 'Invoices');
  } catch (err) {
    return fail(res, 500, 'Failed to load invoices');
  }
}

async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid invoice id');

    const row = await InvoiceModel.getById(id);
    if (!row) return fail(res, 404, 'Invoice not found');

    return ok(res, { invoice: row }, 'Invoice details');
  } catch (err) {
    return fail(res, 500, 'Failed to load invoice');
  }
}

async function updateStatus(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid invoice id');

    const status = String(req.body?.status || '').trim();
    if (!['pending', 'paid', 'overdue'].includes(status)) {
      return fail(res, 400, 'Invalid status');
    }

    const row = await InvoiceModel.getById(id);
    if (!row) return fail(res, 404, 'Invoice not found');

    const paidDate = status === 'paid' ? new Date().toISOString().slice(0, 10) : null;
    await InvoiceModel.setStatus(id, status, paidDate);

    return ok(res, { updated: true, status, paidDate }, 'Invoice status updated');
  } catch (err) {
    return fail(res, 500, 'Failed to update invoice status');
  }
}

async function remove(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid invoice id');

    const row = await InvoiceModel.getById(id);
    if (!row) return fail(res, 404, 'Invoice not found');

    await InvoiceModel.delete(id);
    return ok(res, { deleted: true }, 'Invoice deleted');
  } catch (err) {
    return fail(res, 500, 'Failed to delete invoice');
  }
}

async function downloadInvoice(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid invoice id');

    const row = await InvoiceModel.getById(id);
    if (!row) return fail(res, 404, 'Invoice not found');

    const fmtDate = (d) => {
      if (!d) return '—';
      try { return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: '2-digit' }); }
      catch { return String(d).slice(0, 10); }
    };

    const fmtINR = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice ${esc(row.invoice_number)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; background: #fff; padding: 48px; font-size: 14px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #1a56db; padding-bottom: 24px; }
    .brand { font-size: 22px; font-weight: 900; color: #1a56db; }
    .brand small { display: block; font-size: 12px; font-weight: 400; color: #555; margin-top: 4px; }
    .inv-meta { text-align: right; }
    .inv-meta h1 { font-size: 32px; font-weight: 900; color: #1a56db; letter-spacing: -1px; }
    .inv-meta p { font-size: 13px; color: #555; margin-top: 4px; }
    .parties { display: flex; justify-content: space-between; margin-bottom: 36px; gap: 40px; }
    .party h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 8px; }
    .party p { font-size: 14px; font-weight: 700; }
    .party small { display: block; font-size: 13px; color: #555; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
    thead th { background: #1a56db; color: #fff; padding: 12px 14px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    tbody td { padding: 12px 14px; border-bottom: 1px solid #e8eaf0; }
    tbody tr:last-child td { border-bottom: none; }
    .totals { max-width: 320px; margin-left: auto; }
    .totals table thead th { background: transparent; color: #333; font-size: 13px; text-transform: none; letter-spacing: 0; border-bottom: 1px solid #e8eaf0; }
    .totals table tbody td { padding: 8px 14px; }
    .totals .grand-total td { font-weight: 900; font-size: 16px; color: #1a56db; border-top: 2px solid #1a56db; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .status-paid { background: #d1fae5; color: #065f46; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-overdue { background: #fee2e2; color: #991b1b; }
    .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e8eaf0; display: flex; justify-content: space-between; font-size: 12px; color: #888; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      Healthcare Recruitment CRM
      <small>Staffing &amp; Placement Services</small>
    </div>
    <div class="inv-meta">
      <h1>INVOICE</h1>
      <p><strong>#${esc(row.invoice_number)}</strong></p>
      <p>Date: ${fmtDate(row.invoice_date)}</p>
      <p>Due: ${fmtDate(row.due_date)}</p>
      <p style="margin-top:8px;">
        <span class="status-badge status-${esc(row.payment_status)}">${esc(row.payment_status)}</span>
      </p>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h3>Billed To</h3>
      <p>${esc(row.hospital_name)}</p>
      <small>Hospital / Client</small>
    </div>
    <div class="party" style="text-align:right;">
      <h3>Candidate Placed</h3>
      <p>${esc(row.applicant_name)}</p>
      <small>${esc(row.job_title)}</small>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:right;">Candidate Salary (INR)</th>
        <th style="text-align:right;">Commission Rate</th>
        <th style="text-align:right;">Invoice Amount (INR)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Placement Fee — ${esc(row.applicant_name)} for <em>${esc(row.job_title)}</em></td>
        <td style="text-align:right;">${fmtINR(row.candidate_salary)}</td>
        <td style="text-align:right;">${esc(row.commission_percentage)}%</td>
        <td style="text-align:right; font-weight:700;">${fmtINR(row.invoice_amount)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tbody>
        <tr>
          <td>Subtotal</td>
          <td style="text-align:right;">INR ${fmtINR(row.invoice_amount)}</td>
        </tr>
        <tr>
          <td>Tax (0%)</td>
          <td style="text-align:right;">INR 0.00</td>
        </tr>
        <tr class="grand-total">
          <td>Total Due</td>
          <td style="text-align:right;">INR ${fmtINR(row.invoice_amount)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  ${row.notes ? `<div style="margin-top:28px; padding:16px; background:#f8f9ff; border-radius:8px; font-size:13px;"><strong>Notes:</strong> ${esc(row.notes)}</div>` : ''}

  <div class="footer">
    <span>Healthcare Recruitment CRM — Confidential</span>
    <span>Generated: ${new Date().toLocaleDateString('en-IN')}</span>
  </div>

  <div class="no-print" style="margin-top:32px; text-align:center;">
    <button onclick="window.print()" style="background:#1a56db;color:#fff;border:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;">
      🖨️ Print / Save as PDF
    </button>
  </div>

  <script>
    // Auto-open print dialog when opened as download
    window.addEventListener('load', () => {
      // Only auto-print if opened directly (not embedded)
      if (window.self === window.top) {
        setTimeout(() => window.print(), 400);
      }
    });
  </script>
</body>
</html>`;

    return ok(res, { html, invoice: row }, 'Invoice generated');
  } catch (err) {
    return fail(res, 500, 'Failed to generate invoice');
  }
}

async function create(req, res) {
  try {
    const payload = req.body || {};
    if (!payload.hospital_id || !payload.applicant_id || !payload.job_id) {
      return fail(res, 400, 'Hospital, candidate, and job are required');
    }

    if (!payload.invoice_number) {
      const year = new Date().getFullYear();
      const rand = Math.floor(1000 + Math.random() * 9000);
      payload.invoice_number = `INV-${year}-${rand}`;
    }

    if (!payload.invoice_date) {
      payload.invoice_date = new Date().toISOString().slice(0, 10);
    }
    if (!payload.due_date) {
      const due = new Date();
      due.setDate(due.getDate() + 30);
      payload.due_date = due.toISOString().slice(0, 10);
    }

    payload.created_by = req.user ? req.user.id : null;

    const result = await InvoiceModel.create(payload);
    return ok(res, { id: result.id, invoice_number: payload.invoice_number, invoice_amount: result.invoice_amount }, 'Invoice generated successfully');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 400, 'Invoice number already exists');
    return fail(res, 500, 'Failed to create invoice: ' + err.message);
  }
}

async function update(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid invoice id');

    const inv = await InvoiceModel.getById(id);
    if (!inv) return fail(res, 404, 'Invoice not found');

    await InvoiceModel.update(id, req.body || {});
    return ok(res, { updated: true }, 'Invoice updated successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to update invoice: ' + err.message);
  }
}

async function recordPayment(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid invoice id');

    const payload = req.body || {};
    payload.created_by = req.user ? req.user.id : null;

    const result = await InvoiceModel.recordPayment(id, payload);
    return ok(res, result, 'Payment recorded successfully');
  } catch (err) {
    return fail(res, 400, err.message || 'Failed to record payment');
  }
}

async function getPayments(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid invoice id');

    const payments = await InvoiceModel.getPayments(id);
    return ok(res, { payments }, 'Invoice payment history');
  } catch (err) {
    return fail(res, 500, 'Failed to fetch payment history');
  }
}

async function duplicateInvoice(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid invoice id');

    const inv = await InvoiceModel.getById(id);
    if (!inv) return fail(res, 404, 'Invoice not found');

    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    const newInvoiceNumber = `INV-${year}-${rand}`;

    const newPayload = {
      ...inv,
      invoice_number: newInvoiceNumber,
      invoice_date: new Date().toISOString().slice(0, 10),
      payment_status: 'pending',
      paid_amount: 0,
      created_by: req.user ? req.user.id : null
    };
    delete newPayload.id;
    delete newPayload.created_at;
    delete newPayload.updated_at;

    const result = await InvoiceModel.create(newPayload);
    return ok(res, { id: result.id, invoice_number: newInvoiceNumber }, 'Invoice duplicated successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to duplicate invoice');
  }
}

async function getFinancialSummary(req, res) {
  try {
    const summary = await InvoiceModel.getFinancialSummary();
    return ok(res, summary, 'Financial summary');
  } catch (err) {
    return fail(res, 500, 'Failed to load financial summary');
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  updateStatus,
  recordPayment,
  getPayments,
  duplicateInvoice,
  getFinancialSummary,
  remove,
  downloadInvoice
};
