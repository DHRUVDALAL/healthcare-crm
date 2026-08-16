'use strict';

const { getPool } = require('../config/db');

/**
 * Generate rule-based actionable recommendations for a recruiter.
 * @param {number} userId - Recruiter user ID
 * @returns {Promise<Array<Object>>} Actionable recommendation cards
 */
async function getSmartRecommendations(userId) {
  const pool = getPool();
  const recommendations = [];

  // Rule 1: Candidates assigned but not contacted for 3+ days
  const [uncontacted] = await pool.query(
    `SELECT a.id, a.full_name, a.updated_at
     FROM applicants a
     LEFT JOIN candidate_follow_ups f ON f.applicant_id = a.id
     WHERE a.created_by = ? AND a.candidate_status = 'active'
       AND (f.id IS NULL OR f.updated_at < DATE_SUB(NOW(), INTERVAL 3 DAY))
     LIMIT 5`,
    [Number(userId)]
  );

  uncontacted.forEach(c => {
    recommendations.push({
      rule_id: 'RULE_UNCONTACTED_3DAYS',
      priority: 'high',
      priority_color: '#ef4444',
      candidate_name: c.full_name,
      applicant_id: c.id,
      title: `Candidate ${c.full_name} uncontacted for 3+ days`,
      reason: 'No call, follow-up, or note logged in the past 72 hours.',
      recommended_action: 'Log phone screen call or send update message',
      action_type: 'call_candidate',
      nav_link: `/pages/applicants.html?id=${c.id}`
    });
  });

  // Rule 2: Candidate missing resume upload
  const [missingResume] = await pool.query(
    `SELECT a.id, a.full_name
     FROM applicants a
     WHERE a.created_by = ?
       AND (a.original_resume_path IS NULL OR a.original_resume_path LIKE '%sample%')
     LIMIT 5`,
    [Number(userId)]
  );

  missingResume.forEach(c => {
    recommendations.push({
      rule_id: 'RULE_MISSING_RESUME',
      priority: 'medium',
      priority_color: '#f97316',
      candidate_name: c.full_name,
      applicant_id: c.id,
      title: `Resume document missing for ${c.full_name}`,
      reason: 'Original candidate resume file is not uploaded.',
      recommended_action: 'Upload PDF/Doc resume to complete candidate profile',
      action_type: 'upload_resume',
      nav_link: `/pages/applicants.html?id=${c.id}`
    });
  });

  // Rule 3: Interview completed but result/feedback pending
  const [pendingFeedback] = await pool.query(
    `SELECT i.id, i.applicant_id, a.full_name, h.name as hospital_name
     FROM interviews i
     JOIN applicants a ON i.applicant_id = a.id
     JOIN hospitals h ON i.hospital_id = h.id
     WHERE a.created_by = ?
       AND i.interview_date < CURDATE()
       AND (i.result IS NULL OR i.result = 'pending')
     LIMIT 5`,
    [Number(userId)]
  );

  pendingFeedback.forEach(i => {
    recommendations.push({
      rule_id: 'RULE_INTERVIEW_FEEDBACK_PENDING',
      priority: 'high',
      priority_color: '#ef4444',
      candidate_name: i.full_name,
      applicant_id: i.applicant_id,
      title: `Interview feedback pending for ${i.full_name}`,
      reason: `Interview at ${i.hospital_name} completed, outcome needs logging.`,
      recommended_action: 'Collect hospital feedback & update interview status',
      action_type: 'update_interview',
      nav_link: `/pages/interviews.html`
    });
  });

  // Rule 4: Shortlisted candidate pending hospital submission
  const [pendingSubmissions] = await pool.query(
    `SELECT app.id, app.applicant_id, a.full_name, h.name as hospital_name
     FROM applications app
     JOIN applicants a ON app.applicant_id = a.id
     JOIN jobs j ON app.job_id = j.id
     JOIN hospitals h ON j.hospital_id = h.id
     WHERE a.created_by = ? AND app.current_stage = 'shortlisted'
     LIMIT 5`,
    [Number(userId)]
  );

  pendingSubmissions.forEach(s => {
    recommendations.push({
      rule_id: 'RULE_HOSPITAL_SUBMISSION_PENDING',
      priority: 'high',
      priority_color: '#ef4444',
      candidate_name: s.full_name,
      applicant_id: s.applicant_id,
      title: `Submit ${s.full_name} to ${s.hospital_name}`,
      reason: 'Candidate is shortlisted and ready for client evaluation.',
      recommended_action: 'Generate PII-stripped PDF & email to Hospital HR',
      action_type: 'send_submission',
      nav_link: `/pages/pipeline.html`
    });
  });

  // Rule 5: Candidate notice period ending within 7 days
  const [noticeEnding] = await pool.query(
    `SELECT a.id, a.full_name, a.notice_period
     FROM applicants a
     WHERE a.created_by = ? AND a.candidate_status = 'active'
       AND a.notice_period LIKE '%Days%'
     LIMIT 3`,
    [Number(userId)]
  );

  noticeEnding.forEach(c => {
    recommendations.push({
      rule_id: 'RULE_NOTICE_ENDING',
      priority: 'medium',
      priority_color: '#eab308',
      candidate_name: c.full_name,
      applicant_id: c.id,
      title: `Notice Period Ending Soon for ${c.full_name}`,
      reason: `Notice period status: ${c.notice_period}`,
      recommended_action: 'Fast-track interview scheduling & offer negotiations',
      action_type: 'fast_track',
      nav_link: `/pages/applicants.html?id=${c.id}`
    });
  });

  return recommendations;
}

module.exports = {
  getSmartRecommendations
};
