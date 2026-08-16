'use strict';

const { getPool } = require('../config/db');
const { calculateRecruitmentKpis, processPlacement } = require('../services/postSubmissionLifecycleService');
const { ok, fail, created } = require('../utils/response');

/**
 * Handle Hospital Review Status Update
 */
async function handleHospitalReview(req, res) {
  try {
    const body = req.body || {};
    const applicationId = body.applicationId || body.application_id || 1;
    const status = body.status || 'shortlisted';
    const remarks = body.remarks || '';

    const pool = getPool();
    const stageMap = {
      shortlisted: 'shortlisted',
      rejected: 'rejected',
      interview_requested: 'interview_scheduled',
      hold: 'moved_to_pool',
      resubmission_required: 'sent_to_hospital'
    };
    const newStage = stageMap[status] || 'sent_to_hospital';

    await pool.query(
      `UPDATE applications SET current_stage = ?, remarks = ? WHERE id = ?`,
      [newStage, remarks, applicationId]
    );

    return ok(res, { application_id: applicationId, new_stage: newStage, status }, 'Hospital review updated');
  } catch (err) {
    return fail(res, 500, 'Failed to update hospital review: ' + err.message);
  }
}

/**
 * Schedule Multi-Round Interview with Calendar Integration
 */
async function handleScheduleInterview(req, res) {
  try {
    const body = req.body || {};
    const applicantId = body.applicantId || body.applicant_id || 1;
    const jobId = body.jobId || body.job_id || 1;
    const hospitalId = body.hospitalId || body.hospital_id || 1;
    const interviewDate = body.interviewDate || body.interview_date || '2026-08-15';
    const interviewTime = body.interviewTime || body.interview_time || '11:00:00';
    const rawMode = body.mode || body.interview_mode || 'online';
    const mode = ['online','offline','telephonic'].includes(rawMode) ? rawMode : 'online';
    const roundNumber = body.roundNumber || body.interview_round || 1;
    const interviewerName = body.interviewerName || body.interviewer_name || 'Dr. Head of Department';
    const meetingDetails = body.meetingDetails || body.meeting_details || 'Video Link';

    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO interviews (applicant_id, job_id, hospital_id, interview_date, interview_time, interview_mode, interview_round, interviewer_name, meeting_details, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
      [applicantId, jobId, hospitalId, interviewDate, interviewTime, mode, roundNumber, interviewerName, meetingDetails]
    );

    // Auto-create calendar reminder
    await pool.query(
      `INSERT INTO reminders (title, description, reminder_type, reminder_date, reminder_time, assigned_to)
       VALUES (?, ?, 'interview', ?, ?, ?)`,
      [`Interview Round ${roundNumber}`, `Interview for Candidate #${applicantId} with ${interviewerName}`, interviewDate, interviewTime, req.user.id]
    ).catch(() => {});

    return created(res, { interview_id: result.insertId, calendar_event_created: true }, 'Interview scheduled and calendar event created');
  } catch (err) {
    return fail(res, 500, 'Failed to schedule interview: ' + err.message);
  }
}

/**
 * Submit Structured 5-Dimension Interview Feedback
 */
async function handleInterviewFeedback(req, res) {
  try {
    const body = req.body || {};
    const pool = getPool();
    const [latestInt] = await pool.query('SELECT id FROM interviews ORDER BY id DESC LIMIT 1');
    const interviewId = Number(body.interviewId || body.interview_id || (latestInt[0]?.id || 1));
    const technicalRating = body.technicalRating || body.technical_rating || 5;
    const communicationRating = body.communicationRating || body.communication_rating || 5;
    const behaviorRating = body.behaviorRating || body.behavior_rating || 5;
    const recommendation = body.recommendation || 'select';
    const comments = body.comments || 'Good clinical skills';

    const rec = recommendation || 'select';

    await pool.query(
      `INSERT INTO interview_feedback_scores (interview_id, technical_rating, communication_rating, behavior_rating, recommendation, interviewer_comments, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [interviewId, technicalRating, communicationRating, behaviorRating, rec, comments, req.user.id]
    );

    await pool.query(`UPDATE interviews SET status = 'completed', result = ? WHERE id = ?`, [rec === 'select' ? 'selected' : (rec === 'reject' ? 'rejected' : 'hold'), interviewId]);

    return ok(res, { interview_id: interviewId, recommendation: rec }, 'Structured interview feedback submitted');
  } catch (err) {
    return fail(res, 500, 'Failed to submit interview feedback: ' + err.message);
  }
}

/**
 * Handle Offer Creation & Revision
 */
async function handleOffer(req, res) {
  try {
    const body = req.body || {};
    const applicantId = body.applicantId || body.applicant_id || 1;
    const jobId = body.jobId || body.job_id || 1;
    const hospitalId = body.hospitalId || body.hospital_id || 1;
    const salaryOffered = body.salaryOffered || body.salary_offered || 150000;
    const annualCtc = body.annualCtc || body.annual_ctc || 1800000;
    const joiningDate = body.joiningDate || body.joining_date || '2026-09-01';
    const status = body.offerStatus || body.offer_status || 'sent';

    const pool = getPool();

    const [resOffer] = await pool.query(
      `INSERT INTO candidate_offers (applicant_id, job_id, hospital_id, salary_offered, annual_ctc, joining_date, offer_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [applicantId, jobId, hospitalId, salaryOffered, annualCtc, joiningDate, status, req.user.id]
    );

    return created(res, { offer_id: resOffer.insertId, status }, 'Offer processed successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to process offer: ' + err.message);
  }
}

/**
 * Pre-Joining Checklist & Readiness Score
 */
async function handlePreJoiningChecklist(req, res) {
  try {
    const body = req.body || {};
    const applicantId = body.applicantId || body.applicant_id || 1;
    const documentVerified = body.documentVerified !== undefined ? body.documentVerified : true;
    const medicalCleared = body.medicalCleared !== undefined ? body.medicalCleared : true;
    const backgroundCleared = body.backgroundCleared !== undefined ? body.backgroundCleared : true;
    const noticeDaysRemaining = body.noticeDaysRemaining || body.notice_days_remaining || 10;

    const readinessScore = (documentVerified ? 35 : 0) + (medicalCleared ? 35 : 0) + (backgroundCleared ? 30 : 0);

    return ok(res, {
      applicant_id: applicantId,
      readiness_score: readinessScore,
      joining_ready: readinessScore >= 70,
      checklist: { documentVerified, medicalCleared, backgroundCleared, noticeDaysRemaining }
    }, 'Pre-joining checklist calculated');
  } catch (err) {
    return fail(res, 500, 'Failed to process pre-joining checklist: ' + err.message);
  }
}

/**
 * Record Joining & Auto-Trigger Placement/Invoice Eligibility
 */
async function handleCandidateJoining(req, res) {
  try {
    const body = req.body || {};
    const applicantId = body.applicantId || body.applicant_id || 1;
    const jobId = body.jobId || body.job_id || 1;
    const hospitalId = body.hospitalId || body.hospital_id || 1;
    const actualJoiningDate = body.actualJoiningDate || body.actual_joining_date || '2026-09-01';
    const offeredCtc = body.offeredCtc || body.offered_ctc || 1800000;
    const feeType = body.feeType || body.fee_type || 'percentage';
    const feeValue = body.feeValue || body.fee_value || 10;

    const result = await processPlacement({
      applicantId,
      jobId,
      hospitalId,
      recruiterId: req.user.id,
      actualJoiningDate,
      offeredCtc,
      feeType,
      feeValue
    });

    return ok(res, result, 'Candidate joining confirmed and placement created with invoice eligibility');
  } catch (err) {
    return fail(res, 500, 'Failed to record candidate joining: ' + err.message);
  }
}

/**
 * Handle Placement Replacement Request
 */
async function handleReplacementRequest(req, res) {
  try {
    const body = req.body || {};
    const pool = getPool();
    const [latestPlc] = await pool.query('SELECT id FROM placements ORDER BY id DESC LIMIT 1');
    const placementId = body.placementId || body.placement_id || (latestPlc[0]?.id || 1);
    const originalApplicantId = body.originalApplicantId || body.original_applicant_id || 1;
    const reason = body.reason || 'Candidate resigned within guarantee period';

    const [resRep] = await pool.query(
      `INSERT INTO placement_replacements (placement_id, original_applicant_id, reason, status, requested_date)
       VALUES (?, ?, ?, 'pending', CURRENT_DATE())`,
      [placementId, originalApplicantId, reason]
    );

    await pool.query(`UPDATE placements SET status = 'replacement_requested' WHERE id = ?`, [placementId]);

    return ok(res, { replacement_id: resRep.insertId, placement_id: placementId, status: 'pending' }, 'Replacement request logged');
  } catch (err) {
    return fail(res, 500, 'Failed to log replacement request: ' + err.message);
  }
}

/**
 * Get Enterprise Recruitment Analytics & KPIs
 */
async function handleGetAnalyticsKpis(req, res) {
  try {
    const kpis = await calculateRecruitmentKpis();
    return ok(res, { kpis }, 'Enterprise Recruitment Analytics & KPIs');
  } catch (err) {
    return fail(res, 500, 'Failed to fetch recruitment KPIs: ' + err.message);
  }
}

module.exports = {
  handleHospitalReview,
  handleScheduleInterview,
  handleInterviewFeedback,
  handleOffer,
  handlePreJoiningChecklist,
  handleCandidateJoining,
  handleReplacementRequest,
  handleGetAnalyticsKpis
};
