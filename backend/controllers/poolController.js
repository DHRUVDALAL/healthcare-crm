'use strict';

const ApplicantModel = require('../models/applicantModel');
const JobModel = require('../models/jobModel');
const { ok, fail } = require('../utils/response');

const { nextActionForStage } = require('../utils/pipelineStages');
const { getPool } = require('../config/db');

async function listPool(req, res) {
  try {
    const { search, skills, minExperience, location, prevJobId, status } = req.query;

    const queryRecruiter = req.user.role === 'admin' ? '' : req.user.id;

    const rows = await ApplicantModel.listPool({
      search: typeof search === 'string' ? search.trim() : '',
      skills: typeof skills === 'string' ? skills.trim() : '',
      minExperience: typeof minExperience === 'string' ? minExperience.trim() : '',
      location: typeof location === 'string' ? location.trim() : '',
      prevJobId: typeof prevJobId === 'string' ? prevJobId.trim() : '',
      assignedRecruiterId: queryRecruiter,
      status: typeof status === 'string' ? status.trim() : ''
    });

    return ok(res, { candidates: rows }, 'Pool candidates');
  } catch (err) {
    return fail(res, 500, 'Failed to load pool');
  }
}

async function moveToPool(req, res) {
  try {
    const applicantId = Number(req.params.applicantId);
    if (!Number.isInteger(applicantId) || applicantId <= 0) return fail(res, 400, 'Invalid applicant id');

    const existing = await ApplicantModel.getById(applicantId);
    if (!existing) return fail(res, 404, 'Applicant not found');

    await ApplicantModel.setPoolStatus(applicantId, 1);
    await ApplicantModel.setStatus(applicantId, 'pool');

    const updated = await ApplicantModel.getById(applicantId);
    return ok(res, { applicant: updated }, 'Moved to pool');
  } catch (err) {
    return fail(res, 500, 'Failed to move to pool');
  }
}

async function reassignFromPool(req, res) {
  const conn = await getPool().getConnection();
  try {
    const applicantId = Number(req.params.applicantId);
    if (!Number.isInteger(applicantId) || applicantId <= 0) {
      conn.release();
      return fail(res, 400, 'Invalid applicant id');
    }

    const { job_id } = req.body || {};
    const jobId = job_id == null || job_id === '' ? null : Number(job_id);

    const existing = await ApplicantModel.getById(applicantId);
    if (!existing) {
      conn.release();
      return fail(res, 404, 'Applicant not found');
    }

    await conn.beginTransaction();

    if (jobId != null) {
      if (!Number.isInteger(jobId) || jobId <= 0) {
        await conn.rollback();
        conn.release();
        return fail(res, 400, 'Invalid job id');
      }
      const job = await JobModel.getById(jobId);
      if (!job) {
        await conn.rollback();
        conn.release();
        return fail(res, 404, 'Job not found');
      }

      await conn.query('UPDATE applicants SET applied_job_id = ? WHERE id = ?', [Number(jobId), Number(applicantId)]);

      // Check if application exists for this applicant and job
      const [existingAppRows] = await conn.query(
        'SELECT id FROM applications WHERE applicant_id = ? AND job_id = ? LIMIT 1',
        [Number(applicantId), Number(jobId)]
      );

      if (existingAppRows.length === 0) {
        // Create new application
        const nextAction = nextActionForStage('applied');
        const [appRes] = await conn.query(
          `INSERT INTO applications (applicant_id, job_id, hospital_id, current_stage, next_action, remarks, created_by)
           VALUES (?, ?, ?, 'applied', ?, '', ?)`,
          [Number(applicantId), Number(jobId), Number(job.hospital_id), nextAction, Number(req.user.id)]
        );
        const appId = appRes.insertId;

        // Log stage history
        await conn.query(
          `INSERT INTO application_stage_history (application_id, old_stage, new_stage, changed_by, notes)
           VALUES (?, '', 'applied', ?, ?)`,
          [Number(appId), Number(req.user.id), 'Reassigned from Pool']
        );
      }
    }

    await conn.query('UPDATE applicants SET pool_status = 0, candidate_status = \'active\' WHERE id = ?', [Number(applicantId)]);

    await conn.commit();
    conn.release();

    const updated = await ApplicantModel.getById(applicantId);
    return ok(res, { applicant: updated }, 'Reassigned from pool');
  } catch (err) {
    await conn.rollback().catch(() => {});
    conn.release();
    return fail(res, 500, 'Failed to reassign candidate');
  }
}

async function bulkReassign(req, res) {
  const conn = await getPool().getConnection();
  try {
    const { applicant_ids, job_id } = req.body || {};
    if (!Array.isArray(applicant_ids) || !applicant_ids.length) {
      conn.release();
      return fail(res, 400, 'applicant_ids must be a non-empty array');
    }
    const jobId = job_id == null || job_id === '' ? null : Number(job_id);

    if (jobId == null) {
      conn.release();
      return fail(res, 400, 'Job ID is required');
    }

    const job = await JobModel.getById(jobId);
    if (!job) {
      conn.release();
      return fail(res, 404, 'Job not found');
    }

    await conn.beginTransaction();

    for (const applicantId of applicant_ids) {
      const id = Number(applicantId);
      if (Number.isInteger(id) && id > 0) {
        await conn.query('UPDATE applicants SET applied_job_id = ? WHERE id = ?', [Number(jobId), Number(id)]);

        const [existingAppRows] = await conn.query(
          'SELECT id FROM applications WHERE applicant_id = ? AND job_id = ? LIMIT 1',
          [Number(id), Number(jobId)]
        );

        if (existingAppRows.length === 0) {
          const nextAction = nextActionForStage('applied');
          const [appRes] = await conn.query(
            `INSERT INTO applications (applicant_id, job_id, hospital_id, current_stage, next_action, remarks, created_by)
             VALUES (?, ?, ?, 'applied', ?, '', ?)`,
            [Number(id), Number(jobId), Number(job.hospital_id), nextAction, Number(req.user.id)]
          );
          const appId = appRes.insertId;

          await conn.query(
            `INSERT INTO application_stage_history (application_id, old_stage, new_stage, changed_by, notes)
             VALUES (?, '', 'applied', ?, ?)`,
            [Number(appId), Number(req.user.id), 'Bulk Reassigned from Pool']
          );
        }

        await conn.query('UPDATE applicants SET pool_status = 0, candidate_status = \'active\' WHERE id = ?', [Number(id)]);
      }
    }

    await conn.commit();
    conn.release();
    return ok(res, { success: true }, 'Bulk reassigned successfully');
  } catch (err) {
    await conn.rollback().catch(() => {});
    conn.release();
    return fail(res, 500, 'Failed to perform bulk reassignment');
  }
}

async function bulkArchive(req, res) {
  try {
    const { applicant_ids } = req.body || {};
    if (!Array.isArray(applicant_ids) || !applicant_ids.length) {
      return fail(res, 400, 'applicant_ids must be a non-empty array');
    }

    const pool = getPool();
    for (const applicantId of applicant_ids) {
      const id = Number(applicantId);
      if (Number.isInteger(id) && id > 0) {
        await pool.query(
          'UPDATE applicants SET candidate_status = \'hold\', pool_status = 0 WHERE id = ?',
          [id]
        );
      }
    }

    return ok(res, { success: true }, 'Bulk archived successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to perform bulk archiving');
  }
}

module.exports = {
  listPool,
  moveToPool,
  reassignFromPool,
  bulkReassign,
  bulkArchive
};
