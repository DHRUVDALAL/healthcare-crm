'use strict';

const { getPool } = require('../config/db');
const { ok, fail, created } = require('../utils/response');
const InterviewModel = require('../models/interviewModel');
const ApplicationModel = require('../models/applicationModel');
const ApplicantModel = require('../models/applicantModel');
const JobModel = require('../models/jobModel');
const {
  STAGES,
  INTERVIEW_MODES,
  INTERVIEW_RESULTS,
  INTERVIEW_STATUS,
  isValidStage,
  canTransition,
  applicantStatusForStage
} = require('../utils/pipelineStages');
const { generateInvoiceAndReferral } = require('../utils/invoiceGenerator');

async function checkCandidateOwnership(req, applicantId) {
  const applicant = await ApplicantModel.getById(applicantId);
  if (!applicant) {
    const err = new Error('Applicant not found');
    err.status = 404;
    throw err;
  }
  const isAdmin = req.user && req.user.role === 'admin';
  const isOwner = req.user && Number(req.user.id) === Number(applicant.created_by);
  const isAssignee = req.user && (
    (applicant.assigned_recruiter_id && Number(req.user.id) === Number(applicant.assigned_recruiter_id)) ||
    (applicant.attended_by && Number(req.user.id) === Number(applicant.attended_by))
  );

  if (!isAdmin && !isOwner && !isAssignee) {
    const err = new Error('Forbidden: Access denied to this candidate');
    err.status = 403;
    throw err;
  }
}

function isNonEmptyString(v, maxLen = 5000) {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= maxLen;
}

function isValidDateString(d) {
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function isValidTimeString(t) {
  return typeof t === 'string' && /^\d{2}:\d{2}$/.test(t);
}

function isValidMode(m) {
  return m === INTERVIEW_MODES.ONLINE || m === INTERVIEW_MODES.OFFLINE || m === INTERVIEW_MODES.TELEPHONIC;
}

function isValidResult(r) {
  return r === INTERVIEW_RESULTS.PENDING || r === INTERVIEW_RESULTS.SELECTED || r === INTERVIEW_RESULTS.REJECTED || r === INTERVIEW_RESULTS.HOLD;
}

async function setApplicantWorkflow(conn, applicantId, jobId, hospitalId, stage) {
  const status = applicantStatusForStage(stage);
  const poolStatus = stage === STAGES.MOVED_TO_POOL ? 1 : 0;

  if (stage === STAGES.SELECTED) {
    await conn.query(
      `UPDATE applicants
       SET candidate_status = ?, pool_status = 0,
           referral_reward_status = CASE
             WHEN source = 'referral' AND referral_reward_status = 'pending' THEN 'eligible'
             WHEN referred_by IS NOT NULL AND referred_by <> '' AND referral_reward_status = 'pending' THEN 'eligible'
             ELSE referral_reward_status
           END
       WHERE id = ?`,
      [status, Number(applicantId)]
    );
    
    if (jobId && hospitalId) {
      await generateInvoiceAndReferral(applicantId, jobId, hospitalId, conn);
    }
    return;
  }

  await conn.query(
    'UPDATE applicants SET candidate_status = ?, pool_status = ? WHERE id = ?',
    [status, poolStatus, Number(applicantId)]
  );
}

async function ensureApplicationStage(conn, { applicant_id, job_id, hospital_id, created_by }, targetStage, note) {
  // Ensure an application row exists.
  await conn.query(
    `INSERT INTO applications (applicant_id, job_id, hospital_id, current_stage, next_action, remarks, created_by)
     VALUES (?, ?, ?, ?, '', '', ?)
     ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
    [Number(applicant_id), Number(job_id), Number(hospital_id), STAGES.HOSPITAL_SUBMISSION, Number(created_by)]
  );

  const app = await ApplicationModel.getByApplicantJob(applicant_id, job_id, conn);
  if (!app) throw new Error('Application not found');

  let current = String(app.current_stage || STAGES.HOSPITAL_SUBMISSION);

  // Advance through required stages if needed.
  const advance = async (from, to, n) => {
    if (!canTransition(from, to)) return;
    await ApplicationModel.setStage(Number(app.id), {
      old_stage: from,
      new_stage: to,
      changed_by: Number(created_by),
      notes: n
    }, conn);
    current = to;
  };

  if (current === STAGES.APPLIED) {
    await advance(STAGES.APPLIED, STAGES.ASSIGNED, 'Auto: assigned');
    await advance(STAGES.ASSIGNED, STAGES.RESUME_REVIEW, 'Auto: resume review');
    await advance(STAGES.RESUME_REVIEW, STAGES.MATCHED, 'Auto: matched');
    await advance(STAGES.MATCHED, STAGES.HOSPITAL_SUBMISSION, 'Auto: hospital submission');
  }

  if (current === STAGES.ASSIGNED) {
    await advance(STAGES.ASSIGNED, STAGES.RESUME_REVIEW, 'Auto: resume review');
    await advance(STAGES.RESUME_REVIEW, STAGES.MATCHED, 'Auto: matched');
    await advance(STAGES.MATCHED, STAGES.HOSPITAL_SUBMISSION, 'Auto: hospital submission');
  }

  if (current === STAGES.RESUME_REVIEW) {
    await advance(STAGES.RESUME_REVIEW, STAGES.MATCHED, 'Auto: matched');
    await advance(STAGES.MATCHED, STAGES.HOSPITAL_SUBMISSION, 'Auto: hospital submission');
  }

  if (current === STAGES.MATCHED) {
    await advance(STAGES.MATCHED, STAGES.HOSPITAL_SUBMISSION, 'Auto: hospital submission');
  }

  if (current === STAGES.HOSPITAL_SUBMISSION && targetStage === STAGES.INTERVIEW_SCHEDULED) {
    await advance(STAGES.HOSPITAL_SUBMISSION, STAGES.INTERVIEW_SCHEDULED, note || 'Interview scheduled');
  }

  if (current === STAGES.INTERVIEW_SCHEDULED && targetStage === STAGES.INTERVIEW_COMPLETED) {
    await advance(STAGES.INTERVIEW_SCHEDULED, STAGES.INTERVIEW_COMPLETED, note || 'Interview completed');
  }

  if (current === STAGES.INTERVIEW_COMPLETED && (targetStage === STAGES.SELECTED || targetStage === STAGES.REJECTED || targetStage === STAGES.RETURNED_TO_POOL)) {
    await advance(STAGES.INTERVIEW_COMPLETED, targetStage, note || 'Updated from interview result');
  }

  return { application_id: Number(app.id), current_stage: current };
}

async function list(req, res) {
  try {
    const { search, status, result, jobId, hospitalId, fromDate, toDate } = req.query;

    const rows = await InterviewModel.list({
      search: typeof search === 'string' ? search.trim() : '',
      status: typeof status === 'string' ? status.trim() : '',
      result: typeof result === 'string' ? result.trim() : '',
      jobId: typeof jobId === 'string' ? jobId.trim() : '',
      hospitalId: typeof hospitalId === 'string' ? hospitalId.trim() : '',
      fromDate: typeof fromDate === 'string' ? fromDate.trim() : '',
      toDate: typeof toDate === 'string' ? toDate.trim() : ''
    });

    return ok(res, { interviews: rows }, 'Interviews');
  } catch (err) {
    return fail(res, 500, 'Failed to load interviews');
  }
}

async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid interview id');

    const row = await InterviewModel.getById(id);
    if (!row) return fail(res, 404, 'Interview not found');

    return ok(res, { interview: row }, 'Interview');
  } catch (err) {
    return fail(res, 500, 'Failed to load interview');
  }
}

async function createInterview(req, res) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const payload = {
      applicant_id: Number(req.body?.applicant_id),
      job_id: Number(req.body?.job_id),
      hospital_id: Number(req.body?.hospital_id),
      interview_date: String(req.body?.interview_date || '').trim(),
      interview_time: String(req.body?.interview_time || '').trim(),
      interview_mode: String(req.body?.interview_mode || '').trim(),
      interview_round: Number(req.body?.interview_round),
      interviewer_name: String(req.body?.interviewer_name || '').trim(),
      meeting_details: String(req.body?.meeting_details || '').trim()
    };

    if (!Number.isInteger(payload.applicant_id) || payload.applicant_id <= 0) return fail(res, 400, 'Invalid applicant_id');
    if (!Number.isInteger(payload.job_id) || payload.job_id <= 0) return fail(res, 400, 'Invalid job_id');
    if (!Number.isInteger(payload.hospital_id) || payload.hospital_id <= 0) return fail(res, 400, 'Invalid hospital_id');

    if (!isValidDateString(payload.interview_date)) return fail(res, 400, 'Invalid interview_date (YYYY-MM-DD)');
    if (!isValidTimeString(payload.interview_time)) return fail(res, 400, 'Invalid interview_time (HH:MM)');
    if (!isValidMode(payload.interview_mode)) return fail(res, 400, 'Invalid interview_mode');

    if (!Number.isInteger(payload.interview_round) || payload.interview_round <= 0 || payload.interview_round > 20) {
      return fail(res, 400, 'Invalid interview_round');
    }

    if (payload.interviewer_name && !isNonEmptyString(payload.interviewer_name, 120)) return fail(res, 400, 'Invalid interviewer_name');
    if (payload.meeting_details && !isNonEmptyString(payload.meeting_details, 500)) return fail(res, 400, 'Invalid meeting_details');

    const applicant = await ApplicantModel.getById(payload.applicant_id);
    if (!applicant) return fail(res, 404, 'Applicant not found');

    try {
      await checkCandidateOwnership(req, payload.applicant_id);
    } catch (err) {
      conn.release();
      return fail(res, err.status || 500, err.message);
    }

    const job = await JobModel.getById(payload.job_id);
    if (!job) return fail(res, 404, 'Job not found');

    if (Number(job.hospital_id) !== Number(payload.hospital_id)) {
      return fail(res, 400, 'hospital_id does not match job');
    }

    await conn.beginTransaction();

    const { id } = await InterviewModel.create({
      ...payload,
      feedback: '',
      result: INTERVIEW_RESULTS.PENDING,
      status: INTERVIEW_STATUS.SCHEDULED
    }, conn);

    await ensureApplicationStage(
      conn,
      {
        applicant_id: payload.applicant_id,
        job_id: payload.job_id,
        hospital_id: payload.hospital_id,
        created_by: Number(req.user.id)
      },
      STAGES.INTERVIEW_SCHEDULED,
      'Auto: interview scheduled'
    );

    await setApplicantWorkflow(conn, payload.applicant_id, payload.job_id, payload.hospital_id, STAGES.INTERVIEW_SCHEDULED);

    await conn.commit();
    return created(res, { id }, 'Interview scheduled');
  } catch (err) {
    await conn.rollback().catch(() => {});
    return fail(res, 500, 'Failed to schedule interview');
  } finally {
    conn.release();
  }
}

async function updateInterview(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid interview id');

    const payload = {
      interview_date: String(req.body?.interview_date || '').trim(),
      interview_time: String(req.body?.interview_time || '').trim(),
      interview_mode: String(req.body?.interview_mode || '').trim(),
      interview_round: Number(req.body?.interview_round),
      interviewer_name: String(req.body?.interviewer_name || '').trim(),
      meeting_details: String(req.body?.meeting_details || '').trim()
    };

    if (!isValidDateString(payload.interview_date)) return fail(res, 400, 'Invalid interview_date');
    if (!isValidTimeString(payload.interview_time)) return fail(res, 400, 'Invalid interview_time');
    if (!isValidMode(payload.interview_mode)) return fail(res, 400, 'Invalid interview_mode');

    if (!Number.isInteger(payload.interview_round) || payload.interview_round <= 0 || payload.interview_round > 20) {
      return fail(res, 400, 'Invalid interview_round');
    }

    if (payload.interviewer_name && !isNonEmptyString(payload.interviewer_name, 120)) return fail(res, 400, 'Invalid interviewer_name');
    if (payload.meeting_details && !isNonEmptyString(payload.meeting_details, 500)) return fail(res, 400, 'Invalid meeting_details');

    const row = await InterviewModel.getById(id);
    if (!row) return fail(res, 404, 'Interview not found');

    try {
      await checkCandidateOwnership(req, row.applicant_id);
    } catch (err) {
      return fail(res, err.status || 500, err.message);
    }

    if (String(row.status) === INTERVIEW_STATUS.CANCELLED) {
      return fail(res, 400, 'Cannot edit a cancelled interview');
    }

    await InterviewModel.update(id, payload);

    return ok(res, { updated: true }, 'Interview updated');
  } catch (err) {
    return fail(res, 500, 'Failed to update interview');
  }
}

async function removeInterview(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid interview id');

    const row = await InterviewModel.getById(id);
    if (!row) return fail(res, 404, 'Interview not found');

    try {
      await checkCandidateOwnership(req, row.applicant_id);
    } catch (err) {
      return fail(res, err.status || 500, err.message);
    }

    await InterviewModel.setStatus(id, INTERVIEW_STATUS.CANCELLED);

    return ok(res, { cancelled: true }, 'Interview cancelled');
  } catch (err) {
    return fail(res, 500, 'Failed to cancel interview');
  }
}

async function updateFeedback(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid interview id');

    const feedback = String(req.body?.feedback || '').trim();
    if (feedback && !isNonEmptyString(feedback, 5000)) return fail(res, 400, 'Invalid feedback');

    const row = await InterviewModel.getById(id);
    if (!row) return fail(res, 404, 'Interview not found');

    try {
      await checkCandidateOwnership(req, row.applicant_id);
    } catch (err) {
      return fail(res, err.status || 500, err.message);
    }

    await InterviewModel.setFeedback(id, feedback);

    return ok(res, { updated: true }, 'Feedback updated');
  } catch (err) {
    return fail(res, 500, 'Failed to update feedback');
  }
}

async function updateResult(req, res) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      conn.release();
      return fail(res, 400, 'Invalid interview id');
    }

    const resultValue = String(req.body?.result || '').trim();
    if (!isValidResult(resultValue)) {
      conn.release();
      return fail(res, 400, 'Invalid result');
    }

    const row = await InterviewModel.getById(id, conn);
    if (!row) {
      conn.release();
      return fail(res, 404, 'Interview not found');
    }

    try {
      await checkCandidateOwnership(req, row.applicant_id);
    } catch (err) {
      conn.release();
      return fail(res, err.status || 500, err.message);
    }

    const targetStage = resultValue === INTERVIEW_RESULTS.SELECTED
      ? STAGES.SELECTED
      : resultValue === INTERVIEW_RESULTS.REJECTED
        ? STAGES.REJECTED
        : STAGES.INTERVIEW_COMPLETED;

    await conn.beginTransaction();

    await InterviewModel.setResult(id, resultValue, INTERVIEW_STATUS.COMPLETED, conn);

    // Ensure pipeline progresses.
    // First guarantee interview_scheduled stage exists, then mark completed, then terminal if needed.
    await ensureApplicationStage(
      conn,
      {
        applicant_id: row.applicant_id,
        job_id: row.job_id,
        hospital_id: row.hospital_id,
        created_by: Number(req.user.id)
      },
      STAGES.INTERVIEW_SCHEDULED,
      'Auto: interview exists'
    );

    let appRow = await ApplicationModel.getByApplicantJob(row.applicant_id, row.job_id, conn);
    if (!appRow) throw new Error('Application not found');

    const moveIfPossible = async (from, to, note) => {
      if (!canTransition(from, to)) return false;
      await ApplicationModel.setStage(Number(appRow.id), {
        old_stage: from,
        new_stage: to,
        changed_by: Number(req.user.id),
        notes: note
      }, conn);
      appRow = await ApplicationModel.getByApplicantJob(row.applicant_id, row.job_id, conn);
      return true;
    };

    // Ensure we reach interview_completed first.
    const stage1 = String(appRow.current_stage || STAGES.SENT_TO_HOSPITAL);
    if (stage1 === STAGES.SENT_TO_HOSPITAL) {
      await moveIfPossible(STAGES.SENT_TO_HOSPITAL, STAGES.INTERVIEW_SCHEDULED, 'Auto: interview scheduled');
    }

    const stage2 = String(appRow.current_stage || STAGES.INTERVIEW_SCHEDULED);
    if (stage2 === STAGES.INTERVIEW_SCHEDULED) {
      await moveIfPossible(STAGES.INTERVIEW_SCHEDULED, STAGES.INTERVIEW_COMPLETED, 'Auto: interview completed');
    }

    // Move to terminal stage based on result.
    const stage3 = String(appRow.current_stage || STAGES.INTERVIEW_COMPLETED);
    if (stage3 === STAGES.INTERVIEW_COMPLETED && targetStage !== STAGES.INTERVIEW_COMPLETED) {
      await moveIfPossible(STAGES.INTERVIEW_COMPLETED, targetStage, `Auto: interview result ${resultValue}`);
    }

    await setApplicantWorkflow(conn, row.applicant_id, row.job_id, row.hospital_id, targetStage);

    await conn.commit();

    return ok(res, { result: resultValue }, 'Result updated');
  } catch (err) {
    await conn.rollback().catch(() => {});
    return fail(res, 500, 'Failed to update result');
  } finally {
    conn.release();
  }
}

module.exports = {
  list,
  getById,
  createInterview,
  updateInterview,
  removeInterview,
  updateResult,
  updateFeedback
};
