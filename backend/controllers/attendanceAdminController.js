'use strict';

const { getPool } = require('../config/db');
const { ok, fail } = require('../utils/response');

async function getDailyAttendance(req, res) {
  try {
    const pool = getPool();
    const { date, search, status } = req.query;
    const targetDate = date || new Date().toISOString().slice(0, 10);

    let q = `
      SELECT 
        u.id as employee_id,
        u.full_name,
        u.email,
        u.department,
        u.designation,
        el.login_time as first_login,
        el.logout_time as last_logout,
        el.total_hours as total_active_hours,
        el.attendance_status as status,
        el.id as log_id
      FROM users u
      LEFT JOIN employee_logs el ON u.id = el.user_id AND DATE(el.login_time) = ?
      WHERE u.status = 'active' AND u.role IN ('employee', 'admin')
    `;
    const params = [targetDate];

    if (search) {
      q += ` AND (u.full_name LIKE ? OR u.email LIKE ? OR u.department LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    q += ` GROUP BY u.id, el.id ORDER BY u.full_name`;

    const [rows] = await pool.query(q, params);

    const enriched = rows.map(row => {
      let statusText = row.status || 'absent';
      if (!row.log_id) statusText = 'absent';

      return {
        ...row,
        status: statusText,
        first_login: row.first_login ? new Date(row.first_login).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null,
        last_logout: row.last_logout ? new Date(row.last_logout).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null,
        total_active_hours: row.total_active_hours ? Number(row.total_active_hours).toFixed(1) : '0.0'
      };
    });

    return ok(res, { attendance: enriched, date: targetDate }, 'Daily attendance');
  } catch (err) {
    return fail(res, 500, 'Failed to load attendance: ' + err.message);
  }
}

async function getMonthlySummary(req, res) {
  try {
    const pool = getPool();
    const { month, employee_id } = req.query;
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    let q = `
      SELECT 
        u.id as employee_id,
        u.full_name,
        u.department,
        COUNT(DISTINCT DATE(el.login_time)) as days_present,
        COUNT(DISTINCT CASE WHEN el.attendance_status = 'on_leave' THEN DATE(el.login_time) END) as days_on_leave,
        COALESCE(SUM(el.total_hours), 0) as total_hours,
        ROUND(COALESCE(SUM(el.total_hours), 0) / COUNT(DISTINCT DATE(el.login_time)), 1) as avg_hours_per_day
      FROM users u
      LEFT JOIN employee_logs el ON u.id = el.user_id AND DATE_FORMAT(el.login_time, '%Y-%m') = ?
      WHERE u.status = 'active' AND u.role IN ('employee', 'admin')
    `;
    const params = [targetMonth];

    if (employee_id) {
      q += ` AND u.id = ?`;
      params.push(employee_id);
    }

    q += ` GROUP BY u.id ORDER BY u.full_name`;

    const [rows] = await pool.query(q, params);

    const enriched = rows.map(row => ({
      ...row,
      days_absent: Math.max(0, 26 - row.days_present - (row.days_on_leave || 0)),
      attendance_rate: Math.round((row.days_present / 26) * 100)
    }));

    return ok(res, { summary: enriched, month: targetMonth }, 'Monthly summary');
  } catch (err) {
    return fail(res, 500, 'Failed to load monthly summary: ' + err.message);
  }
}

async function getAttendanceAnalytics(req, res) {
  try {
    const pool = getPool();

    const [trend] = await pool.query(`
      SELECT DATE_FORMAT(login_time, '%Y-%m') as month,
        COUNT(DISTINCT user_id) as unique_employees,
        COUNT(DISTINCT DATE(login_time)) as total_days_with_logs,
        ROUND(AVG(total_hours), 1) as avg_hours
      FROM employee_logs
      WHERE login_time >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month ORDER BY month
    `);

    const [todayStats] = await pool.query(`
      SELECT 
        COUNT(DISTINCT user_id) as present_today
      FROM employee_logs
      WHERE DATE(login_time) = CURDATE()
    `);

    const [totalActive] = await pool.query(`
      SELECT COUNT(*) as total FROM users WHERE status = 'active' AND role IN ('employee', 'admin')
    `);

    return ok(res, {
      trend,
      today_present: todayStats[0]?.present_today || 0,
      total_active: totalActive[0]?.total || 0
    }, 'Attendance analytics');
  } catch (err) {
    return fail(res, 500, 'Failed to load analytics');
  }
}

module.exports = { getDailyAttendance, getMonthlySummary, getAttendanceAnalytics };
