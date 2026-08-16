'use strict';

const { getPool } = require('../config/db');

/**
 * Consolidate Today's Work Center payload (10 sections)
 */
async function getTodaysWorkCenterPayload(userId) {
  const pool = getPool();
  const todayStr = new Date().toISOString().slice(0, 10);

  // 1. Overdue follow-ups
  const [overdueFollowups] = await pool.query(
    `SELECT id, applicant_id, type, summary, next_followup_date FROM candidate_communications WHERE next_followup_date < ? ORDER BY next_followup_date ASC LIMIT 10`,
    [todayStr]
  );

  // 2. Interviews Today
  const [interviewsToday] = await pool.query(
    `SELECT i.id, i.applicant_id, i.interview_date, i.interview_time, i.interview_mode, i.interview_round, i.interviewer_name, a.full_name as candidate_name, j.job_title as job_title
     FROM interviews i
     JOIN applicants a ON i.applicant_id = a.id
     JOIN jobs j ON i.job_id = j.id
     WHERE i.interview_date = ?
     ORDER BY i.interview_time ASC`,
    [todayStr]
  );

  // 3. Hospital Feedback Pending
  const [hospitalFeedbackPending] = await pool.query(
    `SELECT app.id, app.applicant_id, app.job_id, app.hospital_id, a.full_name as candidate_name, h.name as hospital_name
     FROM applications app
     JOIN applicants a ON app.applicant_id = a.id
     JOIN hospitals h ON app.hospital_id = h.id
     WHERE app.current_stage = 'sent_to_hospital' LIMIT 10`
  );

  // 4. New Candidate Assignments
  const [newAssignments] = await pool.query(
    `SELECT id, full_name, current_designation as role_title, total_experience as experience_years, candidate_status, created_at FROM applicants WHERE assigned_recruiter_id = ? AND candidate_status = 'active' ORDER BY created_at DESC LIMIT 10`,
    [userId]
  );

  // 5. Candidates Ready For Submission
  const [readyForSubmission] = await pool.query(
    `SELECT id, full_name, current_designation as role_title, total_experience as experience_years FROM applicants WHERE candidate_status = 'active' LIMIT 10`
  );

  // 6. Tasks Due Today
  const [tasksDueToday] = await pool.query(
    `SELECT id, title, priority, status, completion_percentage, due_date as deadline FROM tasks WHERE assigned_to = ? AND (due_date = ? OR status = 'in_progress') LIMIT 10`,
    [userId, todayStr]
  );

  // 7. Personal Notes
  const [personalNotes] = await pool.query(
    `SELECT id, title, content, note_type, is_pinned, created_at FROM recruiter_notes WHERE user_id = ? ORDER BY is_pinned DESC, created_at DESC LIMIT 10`,
    [userId]
  );

  // 8. Calendar Events Today
  const [calendarEvents] = await pool.query(
    `SELECT id, title, description, reminder_date as event_date, reminder_time as event_time FROM reminders WHERE assigned_to = ? AND reminder_date = ? ORDER BY reminder_time ASC`,
    [userId, todayStr]
  );

  // 9. Upcoming Joinings
  const [upcomingJoinings] = await pool.query(
    `SELECT id, applicant_id, job_id, hospital_id, joining_date, salary_offered FROM candidate_offers WHERE offer_status = 'accepted' ORDER BY joining_date ASC LIMIT 10`
  );

  // 10. Offer Follow-ups
  const [offerFollowups] = await pool.query(
    `SELECT id, applicant_id, job_id, hospital_id, salary_offered, offer_status FROM candidate_offers WHERE offer_status = 'sent' LIMIT 10`
  );

  return {
    overdue_followups: overdueFollowups,
    interviews_today: interviewsToday,
    hospital_feedback_pending: hospitalFeedbackPending,
    new_assignments: newAssignments,
    ready_for_submission: readyForSubmission,
    tasks_due_today: tasksDueToday,
    personal_notes: personalNotes,
    calendar_events: calendarEvents,
    upcoming_joinings: upcomingJoinings,
    offer_followups: offerFollowups
  };
}

/**
 * Calculate Recruiter Leaderboard Rankings
 */
async function getRecruiterLeaderboard() {
  const pool = getPool();

  const [users] = await pool.query(`SELECT id, full_name, email, department FROM users WHERE role IN ('recruiter','admin')`);

  const leaderboard = await Promise.all(users.map(async (u) => {
    const [placeRes] = await pool.query(`SELECT COUNT(*) as cnt, COALESCE(SUM(placement_amount),0) as total_rev FROM placements WHERE recruiter_id = ?`, [u.id]);
    const [intRes] = await pool.query(`SELECT COUNT(*) as cnt FROM interviews WHERE created_at >= NOW() - INTERVAL 30 DAY`);

    const placements = Number(placeRes[0]?.cnt || 0);
    const revenue = Number(placeRes[0]?.total_rev || 0);

    const score = Math.min(100, Math.round((placements * 25) + (revenue / 50000) * 20 + 40));

    return {
      user_id: u.id,
      name: u.full_name,
      department: u.department || 'Recruitment',
      placements_count: placements,
      revenue_generated: revenue,
      score,
      rank: 1
    };
  }));

  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard.forEach((item, index) => {
    item.rank = index + 1;
  });

  return leaderboard;
}

module.exports = {
  getTodaysWorkCenterPayload,
  getRecruiterLeaderboard
};
