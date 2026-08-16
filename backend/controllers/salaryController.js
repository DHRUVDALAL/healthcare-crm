'use strict';

const SalaryModel = require('../models/salaryModel');
const { generatePayslip } = require('../utils/salarySlipGenerator');
const { ok, fail } = require('../utils/response');

async function list(req, res) {
  try {
    const { search, status, month } = req.query;
    const rows = await SalaryModel.list({
      search: typeof search === 'string' ? search.trim() : '',
      status: typeof status === 'string' ? status.trim() : '',
      month: typeof month === 'string' ? month.trim() : ''
    });
    return ok(res, { salaries: rows }, 'Salary records');
  } catch (err) {
    return fail(res, 500, 'Failed to load salary records');
  }
}

async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid salary id');

    const row = await SalaryModel.getById(id);
    if (!row) return fail(res, 404, 'Salary record not found');

    return ok(res, { salary: row }, 'Salary record details');
  } catch (err) {
    return fail(res, 500, 'Failed to load salary record');
  }
}

async function create(req, res) {
  try {
    const payload = req.body;
    if (!payload.employee_id || !payload.salary_month || !payload.base_salary) {
      return fail(res, 400, 'Employee, month, and base salary are required');
    }

    const base = Number(payload.base_salary);
    const bonus = Number(payload.bonus || 0);
    const deductions = Number(payload.deductions || 0);
    payload.final_salary = base + bonus - deductions;

    const { id } = await SalaryModel.create(payload);
    return ok(res, { id }, 'Salary record created');
  } catch (err) {
    return fail(res, 500, 'Failed to create salary record');
  }
}

async function updateStatus(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid salary id');

    const status = String(req.body?.status || '').trim();
    if (!['pending', 'paid'].includes(status)) {
      return fail(res, 400, 'Invalid status');
    }

    const row = await SalaryModel.getById(id);
    if (!row) return fail(res, 404, 'Salary record not found');

    const paymentDate = status === 'paid' ? new Date().toISOString().slice(0, 10) : null;
    await SalaryModel.updateStatus(id, status, paymentDate);

    return ok(res, { updated: true, status, paymentDate }, 'Salary status updated');
  } catch (err) {
    return fail(res, 500, 'Failed to update salary status');
  }
}

async function downloadPayslip(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid salary id');

    const row = await SalaryModel.getById(id);
    if (!row) return fail(res, 404, 'Salary record not found');

    const html = generatePayslip(row);
    return ok(res, { html, record: row }, 'Payslip HTML');
  } catch (err) {
    return fail(res, 500, 'Failed to generate payslip');
  }
}

/**
 * Bulk generate salary records for all active employees for a given month.
 * Calculates attendance-based deductions using employee_logs (distinct days worked)
 * and leaves (approved days taken). Assumes 26 working days per month.
 */
async function bulkGenerate(req, res) {
  try {
    const month = String(req.body?.month || '').trim();
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return fail(res, 400, 'Valid month is required (YYYY-MM)');
    }

    const { getPool } = require('../config/db');
    const pool = getPool();

    // Fetch all active employees with configured salary
    const [employees] = await pool.query(
      `SELECT id, full_name, monthly_salary FROM users WHERE status = 'active' AND monthly_salary > 0`
    );

    if (employees.length === 0) {
      return ok(res, { generated: 0 }, 'No active employees with configured monthly salary');
    }

    const WORKING_DAYS = 26;
    const generated = [];

    for (const emp of employees) {
      // Count distinct days employee logged in during this month
      const [attendanceRows] = await pool.query(
        `SELECT COUNT(DISTINCT DATE(login_time)) as days_present
         FROM employee_logs
         WHERE user_id = ? AND DATE_FORMAT(login_time, '%Y-%m') = ?`,
        [emp.id, month]
      );
      const daysPresent = attendanceRows[0]?.days_present || 0;

      // Count approved leave days in this month
      const [leaveRows] = await pool.query(
        `SELECT COALESCE(SUM(
           DATEDIFF(
             LEAST(end_date, LAST_DAY(CONCAT(?, '-01'))),
             GREATEST(start_date, CONCAT(?, '-01'))
           ) + 1
         ), 0) as leave_days
         FROM leaves
         WHERE employee_id = ?
           AND leave_status = 'approved'
           AND start_date <= LAST_DAY(CONCAT(?, '-01'))
           AND end_date >= CONCAT(?, '-01')`,
        [month, month, emp.id, month, month]
      );
      const leaveDays = Math.max(0, leaveRows[0]?.leave_days || 0);

      // Calculate effective working days and deductions
      const effectiveDays = Math.min(daysPresent + leaveDays, WORKING_DAYS);
      const absentDays = Math.max(0, WORKING_DAYS - effectiveDays);
      const baseSalary = Number(emp.monthly_salary);
      const perDayRate = baseSalary / WORKING_DAYS;
      const deductions = Math.round(absentDays * perDayRate * 100) / 100;
      const finalSalary = Math.round((baseSalary - deductions) * 100) / 100;

      const payload = {
        employee_id: emp.id,
        salary_month: month,
        base_salary: baseSalary,
        bonus: 0,
        deductions,
        final_salary: finalSalary,
        payment_status: 'pending',
        notes: `Auto-generated. Days present: ${daysPresent}, Approved leaves: ${leaveDays}, Absent: ${absentDays}`
      };

      await SalaryModel.create(payload);
      generated.push({
        employee_id: emp.id,
        employee_name: emp.full_name,
        days_present: daysPresent,
        leave_days: leaveDays,
        absent_days: absentDays,
        base_salary: baseSalary,
        deductions,
        final_salary: finalSalary
      });
    }

    return ok(res, { generated: generated.length, month, records: generated }, 'Bulk salary records generated');
  } catch (err) {
    return fail(res, 500, 'Failed to generate bulk salary records');
  }
}

module.exports = {
  list,
  getById,
  create,
  updateStatus,
  downloadPayslip,
  bulkGenerate
};
