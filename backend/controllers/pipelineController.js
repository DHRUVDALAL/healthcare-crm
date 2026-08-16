'use strict';

const { getPool } = require('../config/db');
const { ok, fail, created } = require('../utils/response');
const ApplicationModel = require('../models/applicationModel');
const ApplicantModel = require('../models/applicantModel');
const JobModel = require('../models/jobModel');
const NotificationService = require('../services/notificationService');
const ActivityLogModel = require('../models/activityLogModel');
const {
  STAGES,
  isValidStage,
  canTransition,
  applicantStatusForStage,
  nextActionForStage
} = require('../utils/pipelineStages');
const { generateInvoiceAndReferral } = require('../utils/invoiceGenerator');

function isNonEmptyString(v, maxLen = 5000) {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= maxLen;
}

function isValidDateString(d) {
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

async function setApplicantWorkflow(conn, applicantId, jobId, hospitalId, stage) {
  const status = applicantStatusForStage(stage);
  const s = String(stage || '').trim().toLowerCase();
  const poolStatus = (s === 'moved_to_pool' || s === 'returned_to_pool') ? 1 : 0;

  // Referral reward eligibility is triggered on selection.
  if (s === 'selected') {
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
    
    if (jobId) {
      await JobModel.incrementFilledCount(jobId, 1);
    }

    if (jobId && hospitalId) {
      await generateInvoiceAndReferral(applicantId, jobId, hospitalId, conn);
    }
    return;
  }

  if (s === 'joined') {
    await conn.query(
      'UPDATE applicants SET candidate_status = ?, pool_status = 0 WHERE id = ?',
      [status, Number(applicantId)]
    );
    return;
  }

  await conn.query(
    'UPDATE applicants SET candidate_status = ?, pool_status = ? WHERE id = ?',
    [status, poolStatus, Number(applicantId)]
  );
}

async function list(req, res) {
  try {
    const { search, stage, jobId, hospitalId, applicantId } = req.query;

    const queryRecruiter = req.user.role === 'admin' ? '' : req.user.id;

    const rows = await ApplicationModel.list({
      search: typeof search === 'string' ? search.trim() : '',
      stage: typeof stage === 'string' ? stage.trim() : '',
      jobId: typeof jobId === 'string' ? jobId.trim() : '',
      hospitalId: typeof hospitalId === 'string' ? hospitalId.trim() : '',
      applicantId: typeof applicantId === 'string' ? applicantId.trim() : '',
      assignedRecruiterId: queryRecruiter
    });

    return ok(res, { applications: rows }, 'Pipeline');
  } catch (err) {
    return fail(res, 500, 'Failed to load pipeline');
  }
}

async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid application id');

    const row = await ApplicationModel.getById(id);
    if (!row) return fail(res, 404, 'Application not found');

    return ok(res, { application: row }, 'Application');
  } catch (err) {
    return fail(res, 500, 'Failed to load application');
  }
}

async function createApplication(req, res) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const applicant_id = Number(req.body?.applicant_id);
    const job_id = Number(req.body?.job_id);
    const next_action = String(req.body?.next_action || '').trim();
    const remarks = String(req.body?.remarks || '').trim();
    const stage = String(req.body?.current_stage || STAGES.APPLIED).trim();

    if (!Number.isInteger(applicant_id) || applicant_id <= 0) return fail(res, 400, 'Invalid applicant_id');
    if (!Number.isInteger(job_id) || job_id <= 0) return fail(res, 400, 'Invalid job_id');
    if (next_action && !isNonEmptyString(next_action, 255)) return fail(res, 400, 'Invalid next_action');
    if (remarks && !isNonEmptyString(remarks, 2000)) return fail(res, 400, 'Invalid remarks');
    if (!isValidStage(stage)) return fail(res, 400, 'Invalid stage');

    const applicant = await ApplicantModel.getById(applicant_id);
    if (!applicant) return fail(res, 404, 'Applicant not found');

    const job = await JobModel.getById(job_id);
    if (!job) return fail(res, 404, 'Job not found');

    await conn.beginTransaction();

    // Auto-populate next_action if not explicitly provided
    const resolvedNextAction = next_action || nextActionForStage(stage);

    const { id } = await ApplicationModel.create({
      applicant_id,
      job_id,
      hospital_id: job.hospital_id,
      current_stage: stage,
      next_action: resolvedNextAction,
      remarks,
      created_by: Number(req.user.id)
    }, conn);

    await conn.query(
      `INSERT INTO application_stage_history (application_id, old_stage, new_stage, changed_by, notes)
       VALUES (?, '', ?, ?, ?)`,
      [Number(id), String(stage), Number(req.user.id), 'Created']
    );

    await setApplicantWorkflow(conn, applicant_id, job_id, job.hospital_id, stage);

    await conn.commit();
    return created(res, { id }, 'Application created');
  } catch (err) {
    await conn.rollback().catch(() => {});
    // Likely duplicate (applicant_id,job_id)
    if (String(err?.code || '').toLowerCase().includes('dup')) {
      return fail(res, 409, 'Application already exists for this applicant + job');
    }
    return fail(res, 500, 'Failed to create application');
  } finally {
    conn.release();
  }
}

async function updateApplication(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid application id');

    const next_action = String(req.body?.next_action || '').trim();
    const remarks = String(req.body?.remarks || '').trim();

    if (next_action && !isNonEmptyString(next_action, 255)) return fail(res, 400, 'Invalid next_action');
    if (remarks && !isNonEmptyString(remarks, 2000)) return fail(res, 400, 'Invalid remarks');

    const row = await ApplicationModel.getById(id);
    if (!row) return fail(res, 404, 'Application not found');

    await ApplicationModel.update(id, { next_action, remarks });

    return ok(res, { updated: true }, 'Application updated');
  } catch (err) {
    return fail(res, 500, 'Failed to update application');
  }
}

async function updateStatus(req, res) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid application id');

    const new_stage = String(req.body?.new_stage || '').trim();
    const notes = String(req.body?.notes || '').trim();

    if (!isValidStage(new_stage)) return fail(res, 400, 'Invalid stage');
    if (notes && !isNonEmptyString(notes, 1000)) return fail(res, 400, 'Invalid notes');

    const row = await ApplicationModel.getById(id, conn);
    if (!row) return fail(res, 404, 'Application not found');

    const applicant = await ApplicantModel.getById(row.applicant_id);
    if (!applicant) return fail(res, 404, 'Applicant not found');

    const isAdmin = req.user && req.user.role === 'admin';
    const isOwner = req.user && Number(req.user.id) === Number(applicant.created_by);
    const isAssignee = req.user && (
      (applicant.assigned_recruiter_id && Number(req.user.id) === Number(applicant.assigned_recruiter_id)) ||
      (applicant.attended_by && Number(req.user.id) === Number(applicant.attended_by))
    );

    if (!isAdmin && !isOwner && !isAssignee) {
      return fail(res, 403, "Forbidden: You cannot modify this candidate's pipeline");
    }

    const old_stage = String(row.current_stage || STAGES.APPLIED);
    if (!canTransition(old_stage, new_stage)) {
      return fail(res, 400, `Invalid transition: ${old_stage} → ${new_stage}`);
    }

    if (old_stage === new_stage) {
      return ok(res, { stage: new_stage }, 'No stage change');
    }

    await conn.beginTransaction();

    await ApplicationModel.setStage(id, {
      old_stage,
      new_stage,
      changed_by: Number(req.user.id),
      notes
    }, conn);

    // Auto-populate next_action based on the new stage
    const autoNextAction = nextActionForStage(new_stage);
    await ApplicationModel.update(id, { next_action: autoNextAction, remarks: row.remarks || '' }, conn);

    await setApplicantWorkflow(conn, row.applicant_id, row.job_id, row.hospital_id, new_stage);

    await conn.commit();

    // Fire notification to assigned recruiter (non-blocking)
    const applicantAfterCommit = await ApplicantModel.getById(row.applicant_id);
    if (applicantAfterCommit && applicantAfterCommit.assigned_recruiter_id) {
      NotificationService.onPipelineStageChange(
        { id, applicant_id: row.applicant_id },
        new_stage,
        applicantAfterCommit.assigned_recruiter_id
      ).catch(() => {});
    }

    // Log activity (non-blocking)
    ActivityLogModel.create({
      entity_type: 'application',
      entity_id: id,
      user_id: req.user.id,
      activity_type: 'stage_changed',
      description: `Pipeline stage changed from ${old_stage} to ${new_stage}`,
      metadata: { old_stage, new_stage, notes }
    }).catch(() => {});

    return ok(res, { stage: new_stage }, 'Stage updated');
  } catch (err) {
    await conn.rollback().catch(() => {});
    return fail(res, 500, 'Failed to update stage');
  } finally {
    conn.release();
  }
}

async function history(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid application id');

    const row = await ApplicationModel.getById(id);
    if (!row) return fail(res, 404, 'Application not found');

    const h = await ApplicationModel.history(id);
    return ok(res, { history: h }, 'Stage history');
  } catch (err) {
    return fail(res, 500, 'Failed to load stage history');
  }
}

async function sendCandidate(req, res) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const applicantId = Number(req.params.applicantId);
    if (!Number.isInteger(applicantId) || applicantId <= 0) return fail(res, 400, 'Invalid applicant id');

    const bodyJobId = req.body?.job_id;
    const jobId = bodyJobId == null || bodyJobId === '' ? null : Number(bodyJobId);

    const applicant = await ApplicantModel.getById(applicantId);
    if (!applicant) return fail(res, 404, 'Applicant not found');

    if (!applicant.masked_resume_path) {
      return fail(res, 400, 'Masked resume is required before sending to hospital');
    }

    const resolvedJobId = Number.isInteger(jobId) && jobId > 0
      ? jobId
      : Number(applicant.applied_job_id);

    if (!Number.isInteger(resolvedJobId) || resolvedJobId <= 0) {
      return fail(res, 400, 'Job is required to send candidate');
    }

    const job = await JobModel.getById(resolvedJobId);
    if (!job) return fail(res, 404, 'Job not found');

    await conn.beginTransaction();

    // Ensure an application row exists.
    await conn.query(
      `INSERT INTO applications (applicant_id, job_id, hospital_id, current_stage, next_action, remarks, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
      [
        applicantId,
        resolvedJobId,
        Number(job.hospital_id),
        STAGES.SHORTLISTED,
        'Await hospital response',
        '',
        Number(req.user.id)
      ]
    );

    const existing = await ApplicationModel.getByApplicantJob(applicantId, resolvedJobId, conn);
    if (!existing) throw new Error('Failed to create application');

    const appId = Number(existing.id);
    const current = String(existing.current_stage || STAGES.SHORTLISTED);

    // Move to Sent to Hospital in a controlled manner.
    if (current === STAGES.APPLIED) {
      await ApplicationModel.setStage(appId, {
        old_stage: STAGES.APPLIED,
        new_stage: STAGES.SHORTLISTED,
        changed_by: Number(req.user.id),
        notes: 'Auto: shortlisted before sending'
      }, conn);

      await ApplicationModel.setStage(appId, {
        old_stage: STAGES.SHORTLISTED,
        new_stage: STAGES.SENT_TO_HOSPITAL,
        changed_by: Number(req.user.id),
        notes: 'Sent candidate to hospital'
      }, conn);
    } else if (current === STAGES.SHORTLISTED) {
      await ApplicationModel.setStage(appId, {
        old_stage: STAGES.SHORTLISTED,
        new_stage: STAGES.SENT_TO_HOSPITAL,
        changed_by: Number(req.user.id),
        notes: 'Sent candidate to hospital'
      }, conn);
    } else if (current === STAGES.SENT_TO_HOSPITAL) {
      // no-op
    } else {
      // Already beyond or terminal.
    }

    await setApplicantWorkflow(conn, applicantId, resolvedJobId, job.hospital_id, STAGES.SENT_TO_HOSPITAL);

    await conn.commit();
    return ok(res, { application_id: appId, stage: STAGES.SENT_TO_HOSPITAL }, 'Candidate sent');
  } catch (err) {
    await conn.rollback().catch(() => {});
    return fail(res, 500, 'Failed to send candidate');
  } finally {
    conn.release();
  }
}

module.exports = {
  list,
  getById,
  createApplication,
  updateApplication,
  updateStatus,
  history,
  sendCandidate
};
