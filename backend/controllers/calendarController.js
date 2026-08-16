'use strict';

const CalendarModel = require('../models/calendarModel');
const { ok, fail } = require('../utils/response');

async function list(req, res) {
  try {
    const { search, type, status, userId } = req.query;
    // Admins see all by default, or filtered by userId. 
    // Employees see only their own.
    const queryUserId = req.user.role === 'admin' ? (userId || null) : req.user.id;

    const rows = await CalendarModel.list({
      search: typeof search === 'string' ? search.trim() : '',
      type: typeof type === 'string' ? type.trim() : '',
      status: typeof status === 'string' ? status.trim() : '',
      userId: queryUserId,
      role: req.user.role
    });

    return ok(res, { reminders: rows }, 'Reminders');
  } catch (err) {
    return fail(res, 500, 'Failed to load reminders');
  }
}

async function getToday(req, res) {
  try {
    const rows = await CalendarModel.getToday(req.user.id, req.user.role);
    return ok(res, { reminders: rows }, 'Today reminders');
  } catch (err) {
    return fail(res, 500, 'Failed to load today reminders');
  }
}

async function getUpcoming(req, res) {
  try {
    const rows = await CalendarModel.getUpcoming(req.user.id, req.user.role);
    return ok(res, { reminders: rows }, 'Upcoming reminders');
  } catch (err) {
    return fail(res, 500, 'Failed to load upcoming reminders');
  }
}

async function getEvents(req, res) {
  try {
    const pool = require('../config/db').getPool();
    const userId = req.user.id;
    const role = req.user.role;

    // 1. Query Interviews
    let interviewQuery = `
      SELECT i.id, i.interview_date AS event_date, i.interview_time AS event_time, 'interview' AS type, 
             CONCAT('Interview: ', a.full_name, ' (', i.interview_mode, ')') AS title, i.interviewer_name AS description
      FROM interviews i
      JOIN applicants a ON i.applicant_id = a.id
    `;
    const interviewParams = [];
    if (role !== 'admin') {
      interviewQuery += ' WHERE a.attended_by = ?';
      interviewParams.push(userId);
    }
    const [interviews] = await pool.query(interviewQuery, interviewParams);

    // 2. Query Follow-ups
    let followUpQuery = `
      SELECT f.id, f.follow_up_date AS event_date, f.follow_up_time AS event_time, 'followup' AS type,
             CONCAT('Follow-up: ', a.full_name) AS title, f.remarks AS description
      FROM candidate_follow_ups f
      JOIN applicants a ON f.applicant_id = a.id
    `;
    const followUpParams = [];
    if (role !== 'admin') {
      followUpQuery += ' WHERE f.employee_id = ?';
      followUpParams.push(userId);
    }
    const [followups] = await pool.query(followUpQuery, followUpParams);

    // 3. Query Tasks
    let taskQuery = `
      SELECT t.id, t.due_date AS event_date, t.due_time AS event_time, 'task' AS type,
             CONCAT('Task: ', t.title, ' [', t.status, ']') AS title, t.description
      FROM tasks t
    `;
    const taskParams = [];
    if (role !== 'admin') {
      taskQuery += ' WHERE t.assigned_to = ?';
      taskParams.push(userId);
    }
    const [tasks] = await pool.query(taskQuery, taskParams);

    // 4. Query Leaves
    const [leavesRaw] = await pool.query(`
      SELECT l.id, l.start_date, l.end_date, 'leave' AS type,
             CONCAT('Leave: ', u.full_name, ' (', l.leave_type, ')') AS title, l.reason AS description
      FROM leaves l
      JOIN users u ON l.employee_id = u.id
      WHERE l.leave_status = 'approved'
    `);
    
    // Convert leaves date ranges into individual day events
    const leaves = [];
    leavesRaw.forEach(l => {
      let start = new Date(l.start_date);
      const end = new Date(l.end_date);
      while (start <= end) {
        leaves.push({
          id: `${l.id}_${start.toISOString().slice(0, 10)}`,
          event_date: start.toISOString().slice(0, 10),
          event_time: null,
          type: l.type,
          title: l.title,
          description: l.description
        });
        start.setDate(start.getDate() + 1);
      }
    });

    // 5. Query Work Anniversaries / Birthdays mock
    const [anniversaries] = await pool.query(`
      SELECT id, joining_date AS event_date, 'birthday' AS type,
             CONCAT('Work Anniversary: ', full_name) AS title, designation AS description
      FROM users
      WHERE joining_date IS NOT NULL
    `);

    // Convert joining anniversary date to current year
    const currentYear = new Date().getFullYear();
    const anniversaryEvents = anniversaries.map(a => {
      const parts = String(a.event_date).split('-');
      const monthDay = parts.length >= 3 ? `-${parts[1]}-${parts[2].slice(0, 2)}` : '';
      return {
        ...a,
        event_date: monthDay ? `${currentYear}${monthDay}` : a.event_date
      };
    });

    // 6. Query Reminders (Private to self or Public)
    let reminderQuery = `
      SELECT r.id, r.reminder_date AS event_date, r.reminder_time AS event_time, 'reminder' AS type,
             r.title, r.description
      FROM reminders r
      WHERE r.assigned_to = ? OR r.visibility = 'public'
    `;
    const [reminders] = await pool.query(reminderQuery, [userId]);

    // Aggregate
    const allEvents = [
      ...interviews,
      ...followups,
      ...tasks,
      ...leaves,
      ...anniversaryEvents,
      ...reminders
    ];

    return ok(res, { events: allEvents }, 'Aggregated calendar events loaded');
  } catch (err) {
    return fail(res, 500, 'Failed to load calendar events: ' + err.message);
  }
}

async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid id');

    const row = await CalendarModel.getById(id);
    if (!row) return fail(res, 404, 'Reminder not found');

    if (req.user.role !== 'admin' && row.assigned_to !== req.user.id) {
      return fail(res, 403, 'Access denied');
    }

    return ok(res, { reminder: row }, 'Reminder details');
  } catch (err) {
    return fail(res, 500, 'Failed to load reminder');
  }
}

async function create(req, res) {
  try {
    const payload = req.body;
    if (!payload.title || !payload.reminder_date) {
      return fail(res, 400, 'Title and Date are required');
    }

    // Assign to self if not provided or not admin
    if (!payload.assigned_to || req.user.role !== 'admin') {
      payload.assigned_to = req.user.id;
    }

    const { id } = await CalendarModel.create(payload);
    return ok(res, { id }, 'Reminder created');
  } catch (err) {
    return fail(res, 500, 'Failed to create reminder');
  }
}

async function update(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid id');

    const row = await CalendarModel.getById(id);
    if (!row) return fail(res, 404, 'Reminder not found');

    if (req.user.role !== 'admin' && row.assigned_to !== req.user.id) {
      return fail(res, 403, 'Access denied');
    }

    const payload = req.body;
    if (!payload.assigned_to || req.user.role !== 'admin') {
      payload.assigned_to = row.assigned_to; // keep original
    }

    await CalendarModel.update(id, payload);
    return ok(res, { updated: true }, 'Reminder updated');
  } catch (err) {
    return fail(res, 500, 'Failed to update reminder');
  }
}

async function updateStatus(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid id');

    const status = String(req.body?.status || '').trim();
    if (!['pending', 'completed', 'cancelled'].includes(status)) {
      return fail(res, 400, 'Invalid status');
    }

    const row = await CalendarModel.getById(id);
    if (!row) return fail(res, 404, 'Reminder not found');

    if (req.user.role !== 'admin' && row.assigned_to !== req.user.id) {
      return fail(res, 403, 'Access denied');
    }

    await CalendarModel.updateStatus(id, status);
    return ok(res, { updated: true, status }, 'Status updated');
  } catch (err) {
    return fail(res, 500, 'Failed to update status');
  }
}

async function deleteReminder(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid id');

    const row = await CalendarModel.getById(id);
    if (!row) return fail(res, 404, 'Reminder not found');

    if (req.user.role !== 'admin' && row.assigned_to !== req.user.id) {
      return fail(res, 403, 'Access denied');
    }

    await CalendarModel.delete(id);
    return ok(res, { deleted: true }, 'Reminder deleted');
  } catch (err) {
    return fail(res, 500, 'Failed to delete reminder');
  }
}

module.exports = {
  list,
  getToday,
  getUpcoming,
  getEvents,
  getById,
  create,
  update,
  updateStatus,
  delete: deleteReminder
};
