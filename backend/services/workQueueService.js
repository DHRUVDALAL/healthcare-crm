'use strict';

const { getPool } = require('../config/db');

/**
 * Compute prioritized 6-tier work queue for an employee.
 * @param {number} userId - Logged in recruiter user ID
 * @returns {Promise<Array<Object>>} Prioritized items list
 */
async function getPrioritizedWorkQueue(userId) {
  const pool = getPool();
  const today = new Date().toISOString().slice(0, 10);
  const queue = [];

  // 🔴 Priority 1: Overdue follow-ups, pending offer responses, overdue tasks, pending joining
  const [overdueFollowups] = await pool.query(
    `SELECT f.id, f.applicant_id, a.full_name as candidate_name, f.follow_up_date, f.remarks as notes,
            j.job_title, h.name as hospital_name
     FROM candidate_follow_ups f
     JOIN applicants a ON f.applicant_id = a.id
     LEFT JOIN applications app ON app.applicant_id = a.id
     LEFT JOIN jobs j ON app.job_id = j.id
     LEFT JOIN hospitals h ON j.hospital_id = h.id
     WHERE (a.created_by = ? OR f.employee_id = ?)
       AND f.status = 'pending' AND f.follow_up_date < ?
     ORDER BY f.follow_up_date ASC LIMIT 10`,
    [Number(userId), Number(userId), today]
  );

  overdueFollowups.forEach(f => {
    queue.push({
      priority_tier: 1,
      priority_label: 'Priority 1',
      priority_color: '#ef4444',
      badge_type: 'overdue_followup',
      title: `Overdue Follow-up: ${f.candidate_name}`,
      candidate_name: f.candidate_name,
      applicant_id: f.applicant_id,
      hospital: f.hospital_name || 'General Hospital',
      job: f.job_title || 'Healthcare Position',
      due_time: `Overdue (${f.follow_up_date})`,
      status: 'Overdue Follow-up',
      assigned_by: 'System',
      quick_actions: ['open_candidate', 'call', 'complete']
    });
  });

  const [overdueTasks] = await pool.query(
    `SELECT t.id, t.title, t.due_date, t.priority FROM tasks t
     WHERE t.assigned_to = ? AND t.status IN ('pending','in_progress') AND t.due_date < ?
     ORDER BY t.due_date ASC LIMIT 10`,
    [Number(userId), today]
  );

  overdueTasks.forEach(t => {
    queue.push({
      priority_tier: 1,
      priority_label: 'Priority 1',
      priority_color: '#ef4444',
      badge_type: 'overdue_task',
      title: `Overdue Task: ${t.title}`,
      candidate_name: 'Task Management',
      applicant_id: null,
      hospital: '-',
      job: '-',
      due_time: `Overdue (${t.due_date})`,
      status: 'Overdue Task',
      assigned_by: 'System',
      quick_actions: ['complete', 'skip']
    });
  });

  // 🟠 Priority 2: Today's Interviews, Meetings, Follow-ups, Today's Joining
  const [todayInterviews] = await pool.query(
    `SELECT i.id, i.applicant_id, a.full_name as candidate_name, i.interview_date, i.interview_time,
            h.name as hospital_name, j.job_title
     FROM interviews i
     JOIN applicants a ON i.applicant_id = a.id
     JOIN hospitals h ON i.hospital_id = h.id
     JOIN jobs j ON i.job_id = j.id
     WHERE a.created_by = ? AND i.interview_date = ?
     ORDER BY i.interview_time ASC LIMIT 10`,
    [Number(userId), today]
  );

  todayInterviews.forEach(i => {
    queue.push({
      priority_tier: 2,
      priority_label: 'Priority 2',
      priority_color: '#f97316',
      badge_type: 'today_interview',
      title: `Today's Interview: ${i.candidate_name}`,
      candidate_name: i.candidate_name,
      applicant_id: i.applicant_id,
      hospital: i.hospital_name,
      job: i.job_title,
      due_time: i.interview_time || 'Today',
      status: 'Scheduled Interview',
      assigned_by: 'Recruitment Desk',
      quick_actions: ['open_candidate', 'schedule', 'complete']
    });
  });

  const [todayFollowups] = await pool.query(
    `SELECT f.id, f.applicant_id, a.full_name as candidate_name, f.remarks as notes
     FROM candidate_follow_ups f
     JOIN applicants a ON f.applicant_id = a.id
     WHERE (a.created_by = ? OR f.employee_id = ?)
       AND f.status = 'pending' AND f.follow_up_date = ?
     LIMIT 10`,
    [Number(userId), Number(userId), today]
  );

  todayFollowups.forEach(f => {
    queue.push({
      priority_tier: 2,
      priority_label: 'Priority 2',
      priority_color: '#f97316',
      badge_type: 'today_followup',
      title: `Today's Follow-up: ${f.candidate_name}`,
      candidate_name: f.candidate_name,
      applicant_id: f.applicant_id,
      hospital: 'Client Hospital',
      job: 'Active Position',
      due_time: 'Today',
      status: 'Scheduled Followup',
      assigned_by: 'Self',
      quick_actions: ['open_candidate', 'call', 'complete']
    });
  });

  // 🟡 Priority 3: Candidates waiting for Hospital Submission / Resume Pending
  const [pendingSubmissions] = await pool.query(
    `SELECT app.id, app.applicant_id, a.full_name as candidate_name, j.job_title, h.name as hospital_name
     FROM applications app
     JOIN applicants a ON app.applicant_id = a.id
     JOIN jobs j ON app.job_id = j.id
     JOIN hospitals h ON j.hospital_id = h.id
     WHERE a.created_by = ? AND app.current_stage = 'shortlisted'
     LIMIT 10`,
    [Number(userId)]
  );

  pendingSubmissions.forEach(s => {
    queue.push({
      priority_tier: 3,
      priority_label: 'Priority 3',
      priority_color: '#eab308',
      badge_type: 'hospital_submission_pending',
      title: `Hospital Submission Pending: ${s.candidate_name}`,
      candidate_name: s.candidate_name,
      applicant_id: s.applicant_id,
      hospital: s.hospital_name,
      job: s.job_title,
      due_time: 'Pending Submission',
      status: 'Shortlisted Stage',
      assigned_by: 'Pipeline Engine',
      quick_actions: ['open_candidate', 'email', 'complete']
    });
  });

  // 🔵 Priority 4: New Candidate Assignments (within 48 hours)
  const [newAssignments] = await pool.query(
    `SELECT a.id, a.full_name as candidate_name, a.current_designation, a.created_at
     FROM applicants a
     WHERE a.created_by = ? AND a.created_at >= DATE_SUB(NOW(), INTERVAL 48 HOUR)
     ORDER BY a.created_at DESC LIMIT 10`,
    [Number(userId)]
  );

  newAssignments.forEach(a => {
    queue.push({
      priority_tier: 4,
      priority_label: 'Priority 4',
      priority_color: '#3b82f6',
      badge_type: 'new_candidate',
      title: `New Candidate Assignment: ${a.candidate_name}`,
      candidate_name: a.candidate_name,
      applicant_id: a.id,
      hospital: 'Unassigned',
      job: a.current_designation || 'General',
      due_time: 'Recent',
      status: 'Newly Assigned',
      assigned_by: 'Admin Desk',
      quick_actions: ['open_candidate', 'call', 'add_note']
    });
  });

  // 🟢 Priority 5: Tasks Due Today
  const [todayTasks] = await pool.query(
    `SELECT t.id, t.title, t.priority FROM tasks t
     WHERE t.assigned_to = ? AND t.status IN ('pending','in_progress') AND t.due_date = ?
     LIMIT 10`,
    [Number(userId), today]
  );

  todayTasks.forEach(t => {
    queue.push({
      priority_tier: 5,
      priority_label: 'Priority 5',
      priority_color: '#22c55e',
      badge_type: 'task_due_today',
      title: `Task Due Today: ${t.title}`,
      candidate_name: 'Work Plan',
      applicant_id: null,
      hospital: '-',
      job: '-',
      due_time: 'Today',
      status: 'Task Pending',
      assigned_by: 'Self',
      quick_actions: ['complete', 'skip']
    });
  });

  // Sort queue by priority tier ASC
  queue.sort((a, b) => a.priority_tier - b.priority_tier);
  return queue;
}

module.exports = {
  getPrioritizedWorkQueue
};
