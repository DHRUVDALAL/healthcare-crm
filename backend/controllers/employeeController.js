'use strict';

const EmployeeModel = require('../models/employeeModel');
const SettingsModel = require('../models/settingsModel');
const { ok, fail } = require('../utils/response');

async function validatePasswordPolicy(password) {
  const rows = await SettingsModel.getAll();
  const settings = {};
  rows.forEach(r => {
    settings[r.setting_key] = r.setting_value;
  });

  const minLength = Number(settings.password_min_length || 8);
  const requireSpecial = settings.password_require_special === 'true';

  if (password.length < minLength) {
    throw new Error(`Password must be at least ${minLength} characters long`);
  }

  if (requireSpecial) {
    const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
    if (!specialCharRegex.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
  }
}

async function list(req, res) {
  try {
    const { search, role, department, status } = req.query;
    const rows = await EmployeeModel.list({
      search: typeof search === 'string' ? search.trim() : '',
      role: typeof role === 'string' ? role.trim() : '',
      department: typeof department === 'string' ? department.trim() : '',
      status: typeof status === 'string' ? status.trim() : ''
    });
    return ok(res, { employees: rows }, 'Employees');
  } catch (err) {
    return fail(res, 500, 'Failed to load employees');
  }
}

async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid employee id');

    const row = await EmployeeModel.getById(id);
    if (!row) return fail(res, 404, 'Employee not found');

    return ok(res, { employee: row }, 'Employee details');
  } catch (err) {
    return fail(res, 500, 'Failed to load employee');
  }
}

async function create(req, res) {
  try {
    const payload = req.body;
    if (!payload.full_name || !payload.email || !payload.password) {
      return fail(res, 400, 'Name, email, and password are required');
    }

    // Validate password policy
    try {
      await validatePasswordPolicy(payload.password);
    } catch (e) {
      return fail(res, 400, e.message);
    }

    const { id } = await EmployeeModel.create(payload);
    return ok(res, { id }, 'Employee created');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 400, 'Email already exists');
    return fail(res, 500, 'Failed to create employee');
  }
}

async function update(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid employee id');

    const row = await EmployeeModel.getById(id);
    if (!row) return fail(res, 404, 'Employee not found');

    const payload = req.body;
    if (!payload.full_name || !payload.email) {
      return fail(res, 400, 'Name and email are required');
    }

    // Validate password policy if a new password is being set
    if (payload.password) {
      try {
        await validatePasswordPolicy(payload.password);
      } catch (e) {
        return fail(res, 400, e.message);
      }
    }

    await EmployeeModel.update(id, payload);
    return ok(res, { updated: true }, 'Employee updated');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 400, 'Email already exists');
    return fail(res, 500, 'Failed to update employee');
  }
}

async function updateStatus(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid employee id');

    const status = String(req.body?.status || '').trim();
    if (!['active', 'inactive'].includes(status)) {
      return fail(res, 400, 'Invalid status');
    }

    const row = await EmployeeModel.getById(id);
    if (!row) return fail(res, 404, 'Employee not found');

    await EmployeeModel.updateStatus(id, status);
    return ok(res, { updated: true, status }, 'Employee status updated');
  } catch (err) {
    return fail(res, 500, 'Failed to update employee status');
  }
}

async function getWorkload(req, res) {
  try {
    const { getPool } = require('../config/db');
    const pool = getPool();
    const currentMonth = new Date().toISOString().substring(0, 7);

    const [employees] = await pool.query(
      `SELECT id, full_name, email, role, department, designation, status
       FROM users
       WHERE status = 'active' AND role IN ('employee', 'admin')`
    );

    const workloads = [];

    for (const emp of employees) {
      let target = { submissions_target: 8, selections_target: 8 };
      try {
        const [targetRows] = await pool.query(
          `SELECT submissions_target, selections_target, revenue_target 
           FROM recruiter_targets 
           WHERE recruiter_id = ? AND month = ? 
           LIMIT 1`,
          [emp.id, currentMonth]
        );
        if (targetRows.length) target = targetRows[0];
      } catch (e) {}

      const monthlyTarget = target.selections_target || 8;
      const weeklyTarget = Math.ceil(monthlyTarget / 4);

      let currentCandidates = 0;
      try {
        const [candRows] = await pool.query(
          `SELECT COUNT(*) AS cnt 
           FROM applicants 
           WHERE created_by = ? AND candidate_status IN ('active', 'hold')`,
          [emp.id]
        );
        currentCandidates = candRows[0]?.cnt || 0;
      } catch (e) {}

      let placements = 0;
      try {
        const [placementRows] = await pool.query(
          `SELECT COUNT(*) AS cnt 
           FROM applicants 
           WHERE created_by = ? AND candidate_status IN ('selected', 'joined')
             AND updated_at >= DATE_FORMAT(NOW() ,'%Y-%m-01')`,
          [emp.id]
        );
        placements = placementRows[0]?.cnt || 0;
      } catch (e) {}

      let interviews = 0;
      try {
        const [interviewRows] = await pool.query(
          `SELECT COUNT(*) AS cnt 
           FROM interviews i
           JOIN applications a ON i.application_id = a.id
           JOIN applicants ap ON a.applicant_id = ap.id
           WHERE ap.created_by = ? 
             AND i.interview_date >= DATE_FORMAT(NOW() ,'%Y-%m-01')`,
          [emp.id]
        );
        interviews = interviewRows[0]?.cnt || 0;
      } catch (e) {}

      let openTasks = 0;
      try {
        const [taskRows] = await pool.query(
          `SELECT COUNT(*) AS cnt 
           FROM tasks 
           WHERE assigned_to = ? AND status != 'completed'`,
          [emp.id]
        );
        openTasks = taskRows[0]?.cnt || 0;
      } catch (e) {}

      const workloadPct = monthlyTarget > 0 ? Math.round((currentCandidates / monthlyTarget) * 100) : 0;

      const todayStr = new Date().toISOString().substring(0, 10);
      let onLeave = false;
      try {
        const [leaveRows] = await pool.query(
          `SELECT COUNT(*) AS cnt 
           FROM leaves 
           WHERE employee_id = ? AND leave_status = 'approved' 
             AND ? BETWEEN start_date AND end_date`,
          [emp.id, todayStr]
        );
        onLeave = (leaveRows[0]?.cnt || 0) > 0;
      } catch (e) {}
      const availability = onLeave ? 'On Leave' : 'Available';

      workloads.push({
        id: emp.id,
        full_name: emp.full_name,
        email: emp.email,
        role: emp.role,
        department: emp.department,
        designation: emp.designation,
        current_candidates: currentCandidates,
        weekly_target: weeklyTarget,
        monthly_target: monthlyTarget,
        placements,
        interviews,
        workload_pct: workloadPct,
        open_tasks: openTasks,
        availability
      });
    }

    return ok(res, { workloads }, 'Employee workloads');
  } catch (err) {
    return fail(res, 500, 'Failed to fetch workloads: ' + err.message);
  }
}

async function getProfile(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid employee id');

    const { getPool } = require('../config/db');
    const pool = getPool();
    
    // 1. Employee basic details
    const [empRows] = await pool.query(
      `SELECT * FROM users WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!empRows.length) return fail(res, 404, 'Employee not found');
    const employee = empRows[0];
    delete employee.password;

    // 2. Assigned Candidates
    let candidates = [];
    try {
      const [candRows] = await pool.query(
        `SELECT id, full_name, email, phone, candidate_status, created_at
         FROM applicants WHERE created_by = ?
         ORDER BY id DESC LIMIT 50`,
        [id]
      );
      candidates = candRows;
    } catch (e) {}

    // 3. Performance Summary
    let performance = { total_placements: 0, total_activities: 0 };
    try {
      const [perfRows] = await pool.query(
        `SELECT 
          COUNT(DISTINCT CASE WHEN ash.new_stage = 'selected' THEN ash.application_id END) as total_placements,
          COUNT(DISTINCT ash.application_id) as total_activities
         FROM application_stage_history ash
         WHERE ash.changed_by = ?`,
        [id]
      );
      if (perfRows.length) performance = perfRows[0];
    } catch (e) {}

    // 4. Attendance Summary
    let attendance = { days_present: 0, total_hours: 0 };
    try {
      const [attRows] = await pool.query(
        `SELECT COUNT(DISTINCT DATE(login_time)) as days_present, SUM(total_hours) as total_hours
         FROM employee_logs WHERE user_id = ?`,
        [id]
      );
      if (attRows.length) attendance = attRows[0];
    } catch (e) {}

    // 5. Leaves Summary
    let leaveRows = [];
    try {
      const [lRows] = await pool.query(
        `SELECT leave_type, leave_status, COUNT(*) as count
         FROM leaves WHERE employee_id = ?
         GROUP BY leave_type, leave_status`,
        [id]
      );
      leaveRows = lRows;
    } catch (e) {}

    // 6. Salary History
    let salaryRows = [];
    try {
      const [sRows] = await pool.query(
        `SELECT * FROM salaries WHERE employee_id = ? ORDER BY month DESC LIMIT 12`,
        [id]
      );
      salaryRows = sRows;
    } catch (e) {}

    // 7. Activity Timeline
    let timeline = [];
    try {
      const [tRows] = await pool.query(
        `SELECT ash.old_stage, ash.new_stage, ash.changed_at, ash.notes, app.applicant_id, a.full_name as candidate_name
         FROM application_stage_history ash
         JOIN applications app ON ash.application_id = app.id
         JOIN applicants a ON app.applicant_id = a.id
         WHERE ash.changed_by = ?
         ORDER BY ash.changed_at DESC LIMIT 20`,
        [id]
      );
      timeline = tRows;
    } catch (e) {}

    return ok(res, {
      employee,
      assigned_candidates: candidates,
      performance,
      attendance,
      leaves: leaveRows,
      salary_history: salaryRows,
      activity_timeline: timeline
    }, 'Employee profile details');
  } catch (err) {
    console.error('DEBUG getProfile ERROR:', err);
    return fail(res, 500, 'Failed to fetch employee profile: ' + err.message);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  updateStatus,
  getWorkload,
  getProfile
};
