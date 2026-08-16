'use strict';

const fs = require('fs');
const path = require('path');

const ApplicantModel = require('../models/applicantModel');
const JobModel = require('../models/jobModel');
const CandidateTagModel = require('../models/candidateTagModel');
const CandidateNotesModel = require('../models/candidateNotesModel');
const ResumeHistoryModel = require('../models/resumeHistoryModel');
const ReferralModel = require('../models/referralModel');
const { ok, fail, created } = require('../utils/response');

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');
const RESUMES_ROOT = path.join(UPLOADS_ROOT, 'resumes');

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
  return applicant;
}

function isNonEmptyString(v, maxLen = 5000) {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= maxLen;
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePhone(phone) {
  if (typeof phone !== 'string') return '';
  return phone.replace(/[^0-9+]/g, '').trim();
}

function isValidGender(g) {
  return g === 'male' || g === 'female' || g === 'other';
}

function isValidCandidateStatus(s) {
  return s === 'active' || s === 'hold' || s === 'rejected' || s === 'pool' || s === 'selected';
}

function isValidSource(s) {
  return s === 'call' || s === 'whatsapp' || s === 'portal' || s === 'social_media' || s === 'referral';
}

function isValidReferralRewardStatus(s) {
  return s === 'pending' || s === 'eligible' || s === 'rewarded';
}

function isValidDateString(d) {
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function toNumberOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function safeResumeRelativePathFromFile(file) {
  if (!file || !file.filename) return '';
  return `resumes/${file.filename}`;
}

function resolveResumePath(relativePath) {
  const rel = String(relativePath || '');
  const abs = path.resolve(UPLOADS_ROOT, rel);
  const allowedRoot = path.resolve(RESUMES_ROOT) + path.sep;
  if (!abs.startsWith(allowedRoot)) {
    return null;
  }
  return abs;
}

function deleteResumeIfExists(relativePath) {
  const abs = resolveResumePath(relativePath);
  if (!abs) return;

  fs.promises.unlink(abs).catch(() => {
    // ignore missing
  });
}

async function validateApplicantPayload(body, { requireResumePath } = {}) {
  const payload = {
    full_name: body?.full_name,
    phone: normalizePhone(body?.phone),
    email: String(body?.email || '').toLowerCase().trim(),
    dob: body?.dob,
    gender: body?.gender,
    city: body?.city,
    state: body?.state,
    address: body?.address,
    total_experience: toNumberOrNull(body?.total_experience),
    current_company: body?.current_company,
    current_designation: body?.current_designation,
    current_salary: toNumberOrNull(body?.current_salary),
    expected_salary: toNumberOrNull(body?.expected_salary),
    notice_period: body?.notice_period,
    qualification: body?.qualification,
    skills: body?.skills,
    certifications: body?.certifications,
    preferred_location: body?.preferred_location,
    applied_job_id: toNumberOrNull(body?.applied_job_id),
    source: body?.source,
    referred_by: body?.referred_by,
    referral_contact: body?.referral_contact,
    referral_reward_status: String(body?.referral_reward_status || 'pending').trim().toLowerCase(),
    notes: body?.notes,
    candidate_status: String(body?.candidate_status || 'active').trim().toLowerCase(),
    original_resume_path: body?.original_resume_path,
    assigned_recruiter_id: toNumberOrNull(body?.assigned_recruiter_id),
    available_from: body?.available_from ? String(body.available_from).trim() : null,
    attended_by: toNumberOrNull(body?.attended_by),
    assignment_status: body?.assignment_status || 'Unassigned',
    priority: body?.priority || 'medium',
    preferred_hospital_id: toNumberOrNull(body?.preferred_hospital_id)
  };

  if (!isNonEmptyString(payload.full_name, 140)) return { error: 'Full name is required' };
  if (!isNonEmptyString(payload.phone, 32)) return { error: 'Phone number is required' };
  if (!isValidEmail(payload.email)) return { error: 'Valid email is required' };

  if (!isValidDateString(payload.dob)) return { error: 'Date of birth is required (YYYY-MM-DD)' };
  if (!isValidGender(payload.gender)) return { error: 'Gender must be male, female, or other' };

  if (!isNonEmptyString(payload.city, 80)) return { error: 'Current city is required' };
  if (!isNonEmptyString(payload.state, 80)) return { error: 'Current state is required' };
  if (!isNonEmptyString(payload.address, 500)) return { error: 'Full address is required' };

  if (payload.total_experience === null || payload.total_experience < 0 || payload.total_experience > 60) {
    return { error: 'Total experience (years) is required' };
  }

  if (!isNonEmptyString(payload.current_company, 160)) return { error: 'Current company is required' };
  if (!isNonEmptyString(payload.current_designation, 160)) return { error: 'Current designation is required' };

  if (payload.current_salary === null || payload.current_salary < 0) return { error: 'Current salary is required' };
  if (payload.expected_salary === null || payload.expected_salary < 0) return { error: 'Expected salary is required' };

  payload.current_salary = Number(payload.current_salary);
  payload.expected_salary = Number(payload.expected_salary);
  payload.total_experience = Number(payload.total_experience);

  if (!isNonEmptyString(payload.notice_period, 80)) return { error: 'Notice period is required' };
  if (!isNonEmptyString(payload.qualification, 200)) return { error: 'Highest qualification is required' };
  if (!isNonEmptyString(payload.skills, 1200)) return { error: 'Skills are required' };

  if (payload.certifications != null && payload.certifications !== '' && typeof payload.certifications !== 'string') {
    return { error: 'Certifications must be a string' };
  }

  if (!isNonEmptyString(payload.preferred_location, 120)) return { error: 'Preferred location is required' };

  if (!Number.isInteger(payload.applied_job_id) || payload.applied_job_id <= 0) {
    return { error: 'Applied job is required' };
  }

  if (!isValidSource(payload.source)) return { error: 'Source must be one of: call, whatsapp, portal, social_media, referral' };

  if (payload.referred_by != null && payload.referred_by !== '' && !isNonEmptyString(payload.referred_by, 120)) {
    return { error: 'Referred by must be a valid name' };
  }

  if (payload.referral_contact != null && payload.referral_contact !== '' && !isNonEmptyString(payload.referral_contact, 64)) {
    return { error: 'Referral contact must be a valid value' };
  }

  if (!isValidReferralRewardStatus(payload.referral_reward_status)) {
    return { error: 'Referral reward status must be pending, eligible, or rewarded' };
  }

  if (!isValidCandidateStatus(payload.candidate_status)) {
    return { error: 'Candidate status must be active, hold, rejected, pool, or selected' };
  }

  if (payload.notes != null && payload.notes !== '' && typeof payload.notes !== 'string') {
    return { error: 'Notes must be a string' };
  }

  if (requireResumePath && !isNonEmptyString(payload.original_resume_path, 500)) {
    return { error: 'Resume upload is required' };
  }

  // FK validation
  const job = await JobModel.getById(payload.applied_job_id);
  if (!job) return { error: 'Invalid applied job' };

  return { payload };
}

async function list(req, res) {
  try {
    const { search, skills, jobId, minExperience, status, source, assignment_status, attended_by, preferred_hospital_id } = req.query;

    const queryRecruiter = req.user.role === 'admin' ? '' : req.user.id;
    // Enforce employee ownership restriction
    const queryAttendedBy = req.user.role === 'admin' ? (attended_by || '') : req.user.id;

    const rows = await ApplicantModel.list({
      search: typeof search === 'string' ? search.trim() : '',
      skills: typeof skills === 'string' ? skills.trim() : '',
      jobId: typeof jobId === 'string' && jobId.trim() ? jobId.trim() : '',
      minExperience: typeof minExperience === 'string' && minExperience.trim() ? minExperience.trim() : '',
      status: typeof status === 'string' && status.trim() ? status.trim().toLowerCase() : '',
      source: typeof source === 'string' && source.trim() ? source.trim().toLowerCase() : '',
      assignedRecruiterId: queryRecruiter,
      assignmentStatus: typeof assignment_status === 'string' ? assignment_status.trim() : '',
      attendedBy: queryAttendedBy,
      preferredHospitalId: preferred_hospital_id || ''
    });

    // Prevent leaking original resume paths to non-admin users.
    const isAdmin = req.user && req.user.role === 'admin';
    const userId = req.user ? Number(req.user.id) : 0;
    const sanitized = rows.map((r) => {
      if (!isAdmin && Number(r.created_by) !== userId) {
        return { ...r, original_resume_path: null };
      }
      return r;
    });

    return ok(res, { applicants: sanitized }, 'Applicants');
  } catch (err) {
    return fail(res, 500, 'Failed to load applicants');
  }
}

async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid applicant id');

    const row = await ApplicantModel.getById(id);
    if (!row) return fail(res, 404, 'Applicant not found');

    const isAdmin = req.user && req.user.role === 'admin';
    const isOwner = req.user && Number(req.user.id) === Number(row.created_by);
    const isAssignee = req.user && row.assigned_recruiter_id && Number(req.user.id) === Number(row.assigned_recruiter_id);

    if (!isAdmin && !isOwner && !isAssignee) {
      return fail(res, 403, 'Forbidden: You do not have permission to access this candidate');
    }

    // Hide original resume path for non-admin/non-owner
    if (!isAdmin && !isOwner) {
      row.original_resume_path = null;
    }

    return ok(res, { applicant: row }, 'Applicant');
  } catch (err) {
    return fail(res, 500, 'Failed to load applicant');
  }
}

async function createApplicant(req, res) {
  try {
    const resumeRelPath = req.file ? safeResumeRelativePathFromFile(req.file) : '';

    const { payload, error } = await validateApplicantPayload({
      ...req.body,
      original_resume_path: resumeRelPath
    }, { requireResumePath: false });

    if (error) {
      if (resumeRelPath) deleteResumeIfExists(resumeRelPath);
      return fail(res, 400, error);
    }

    payload.created_by = req.user.id;
    if (req.user.role === 'employee') {
      payload.assigned_recruiter_id = req.user.id;
      payload.attended_by = req.user.id;
      payload.assignment_status = 'Assigned';
    }
    payload.pool_status = payload.candidate_status === 'pool' ? 1 : 0;
    payload.matching_score = null;
    payload.masked_resume_path = null;

    const result = await ApplicantModel.create(payload);
    if (payload.original_resume_path) {
      await ResumeHistoryModel.add(result.id, payload.original_resume_path, 'original', req.user.id);
    }
    const createdRow = await ApplicantModel.getById(result.id);
    if (createdRow) {
      await ReferralModel.syncReferralFromApplicant(createdRow);
    }

    return created(res, { applicant: createdRow }, 'Applicant created');
  } catch (err) {
    if (req.file) {
      deleteResumeIfExists(safeResumeRelativePathFromFile(req.file));
    }
    return fail(res, 500, 'Failed to create applicant');
  }
}

async function updateApplicant(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid applicant id');

    const existing = await ApplicantModel.getById(id);
    if (!existing) return fail(res, 404, 'Applicant not found');

    const newResumeRelPath = req.file ? safeResumeRelativePathFromFile(req.file) : '';
    const resumePathToUse = newResumeRelPath || existing.original_resume_path;

    try {
      await checkCandidateOwnership(req, id);
    } catch (err) {
      if (newResumeRelPath) deleteResumeIfExists(newResumeRelPath);
      return fail(res, err.status || 500, err.message);
    }

    const { payload, error } = await validateApplicantPayload({
      ...req.body,
      original_resume_path: resumePathToUse
    }, { requireResumePath: false });

    if (error) {
      if (newResumeRelPath) deleteResumeIfExists(newResumeRelPath);
      return fail(res, 400, error);
    }

    payload.pool_status = payload.candidate_status === 'pool' ? 1 : 0;
    payload.matching_score = existing.matching_score == null ? null : Number(existing.matching_score);
    payload.masked_resume_path = null;

    await ApplicantModel.update(id, payload);
    if (newResumeRelPath) {
      await ResumeHistoryModel.add(id, newResumeRelPath, 'original', req.user.id);
    }

    // if resume replaced, remove old files after successful update
    if (newResumeRelPath && existing.original_resume_path && existing.original_resume_path !== newResumeRelPath) {
      deleteResumeIfExists(existing.original_resume_path);
    }

    const updatedRow = await ApplicantModel.getById(id);
    if (updatedRow) {
      await ReferralModel.syncReferralFromApplicant(updatedRow);
    }
    return ok(res, { applicant: updatedRow }, 'Applicant updated');
  } catch (err) {
    if (req.file) {
      deleteResumeIfExists(safeResumeRelativePathFromFile(req.file));
    }
    return fail(res, 500, 'Failed to update applicant');
  }
}

async function removeApplicant(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid applicant id');

    const existing = await ApplicantModel.getById(id);
    if (!existing) return fail(res, 404, 'Applicant not found');

    const result = await ApplicantModel.remove(id);
    if (!result.affectedRows) return fail(res, 404, 'Applicant not found');

    if (existing.original_resume_path) {
      deleteResumeIfExists(existing.original_resume_path);
    }

    return ok(res, { deleted: true }, 'Applicant deleted');
  } catch (err) {
    return fail(res, 500, 'Failed to delete applicant');
  }
}

async function setCandidateStatus(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid applicant id');

    const { candidate_status } = req.body || {};
    const status = String(candidate_status || '').toLowerCase().trim();
    if (!isValidCandidateStatus(status)) return fail(res, 400, 'Candidate status must be active, hold, rejected, pool, or selected');

    const existing = await ApplicantModel.getById(id);
    if (!existing) return fail(res, 404, 'Applicant not found');

    await ApplicantModel.setStatus(id, status);
    await ApplicantModel.setPoolStatus(id, status === 'pool' ? 1 : 0);
    const updated = await ApplicantModel.getById(id);

    return ok(res, { applicant: updated }, 'Candidate status updated');
  } catch (err) {
    return fail(res, 500, 'Failed to update candidate status');
  }
}

async function byJob(req, res) {
  try {
    const jobId = Number(req.params.jobId);
    if (!Number.isInteger(jobId) || jobId <= 0) return fail(res, 400, 'Invalid job id');

    const rows = await ApplicantModel.listByJob(jobId);
    return ok(res, { applicants: rows }, 'Applicants by job');
  } catch (err) {
    return fail(res, 500, 'Failed to load applicants');
  }
}

async function viewResume(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid applicant id');

    const a = await ApplicantModel.getById(id);
    if (!a) return fail(res, 404, 'Applicant not found');
    if (!a.original_resume_path) return fail(res, 404, 'Resume not found');

    const isAdmin = req.user && req.user.role === 'admin';
    const isOwner = req.user && Number(req.user.id) === Number(a.created_by);
    if (!isAdmin && !isOwner) {
      return fail(res, 403, 'Not allowed to view original resume');
    }

    const abs = resolveResumePath(a.original_resume_path);
    if (!abs) return fail(res, 404, 'Resume not found');

    await fs.promises.access(abs, fs.constants.R_OK);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="resume_${a.id}.pdf"`);

    return fs.createReadStream(abs).pipe(res);
  } catch (err) {
    return fail(res, 404, 'Resume not found');
  }
}

async function downloadResume(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid applicant id');

    const a = await ApplicantModel.getById(id);
    if (!a) return fail(res, 404, 'Applicant not found');
    if (!a.original_resume_path) return fail(res, 404, 'Resume not found');

    const isAdmin = req.user && req.user.role === 'admin';
    const isOwner = req.user && Number(req.user.id) === Number(a.created_by);
    if (!isAdmin && !isOwner) {
      return fail(res, 403, 'Not allowed to download original resume');
    }

    const abs = resolveResumePath(a.original_resume_path);
    if (!abs) return fail(res, 404, 'Resume not found');

    await fs.promises.access(abs, fs.constants.R_OK);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="resume_${a.id}.pdf"`);

    return fs.createReadStream(abs).pipe(res);
  } catch (err) {
    return fail(res, 404, 'Resume not found');
  }
}

async function assignRecruiter(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid applicant id');

    const { recruiter_id, reason } = req.body || {};
    const recruiterId = recruiter_id === null || recruiter_id === '' ? null : Number(recruiter_id);

    const existing = await ApplicantModel.getById(id);
    if (!existing) return fail(res, 404, 'Applicant not found');

    await ApplicantModel.assignRecruiter(id, recruiterId, req.user.id, reason);

    const updated = await ApplicantModel.getById(id);

    // Fire assignment notification
    if (recruiterId) {
      const NotificationService = require('../services/notificationService');
      await NotificationService.onCandidateAssigned(updated.id, updated.full_name, recruiterId);
    }

    return ok(res, { applicant: updated }, 'Recruiter assigned successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to assign recruiter');
  }
}

async function bulkAssignRecruiter(req, res) {
  try {
    const { applicant_ids, recruiter_id, reason } = req.body || {};
    if (!Array.isArray(applicant_ids) || !applicant_ids.length) {
      return fail(res, 400, 'applicant_ids must be a non-empty array');
    }
    const recruiterId = recruiter_id === null || recruiter_id === '' ? null : Number(recruiter_id);

    const NotificationService = require('../services/notificationService');
    const updatedApplicants = [];

    for (const applicantId of applicant_ids) {
      const id = Number(applicantId);
      if (Number.isInteger(id) && id > 0) {
        const existing = await ApplicantModel.getById(id);
        if (existing) {
          await ApplicantModel.assignRecruiter(id, recruiterId, req.user.id, reason);
          const updated = await ApplicantModel.getById(id);
          updatedApplicants.push(updated);

          if (recruiterId) {
            await NotificationService.onCandidateAssigned(updated.id, updated.full_name, recruiterId);
          }
        }
      }
    }

    return ok(res, { applicants: updatedApplicants }, 'Recruiters assigned successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to perform bulk assignment');
  }
}

async function getAssignmentHistory(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid applicant id');

    try {
      await checkCandidateOwnership(req, id);
    } catch (err) {
      return fail(res, err.status || 500, err.message);
    }

    const pool = require('../config/db').getPool();
    const [rows] = await pool.query(
      `SELECT h.*, 
              u_prev.full_name AS prev_employee_name,
              u_new.full_name AS new_employee_name,
              u_by.full_name AS assigned_by_name
       FROM assignment_history h
       LEFT JOIN users u_prev ON h.prev_employee_id = u_prev.id
       LEFT JOIN users u_new ON h.new_employee_id = u_new.id
       LEFT JOIN users u_by ON h.assigned_by = u_by.id
       WHERE h.applicant_id = ?
       ORDER BY h.created_at DESC`,
      [id]
    );

    return ok(res, { history: rows }, 'Candidate assignment history');
  } catch (err) {
    return fail(res, 500, 'Failed to load assignment history');
  }
}

// TAGS
async function getTags(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid applicant id');

    try {
      await checkCandidateOwnership(req, id);
    } catch (err) {
      return fail(res, err.status || 500, err.message);
    }

    const tags = await CandidateTagModel.list(id);
    return ok(res, { tags }, 'Candidate tags');
  } catch (err) {
    return fail(res, 500, 'Failed to load tags');
  }
}

async function addTag(req, res) {
  try {
    const id = Number(req.params.id);
    const { tag } = req.body || {};
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid applicant id');
    if (typeof tag !== 'string' || !tag.trim()) return fail(res, 400, 'Tag is required');

    try {
      await checkCandidateOwnership(req, id);
    } catch (err) {
      return fail(res, err.status || 500, err.message);
    }

    await CandidateTagModel.add(id, tag);
    const tags = await CandidateTagModel.list(id);
    return ok(res, { tags }, 'Tag added successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to add tag');
  }
}

async function removeTag(req, res) {
  try {
    const id = Number(req.params.id);
    const { tag } = req.params;
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid applicant id');
    if (typeof tag !== 'string' || !tag.trim()) return fail(res, 400, 'Tag is required');

    try {
      await checkCandidateOwnership(req, id);
    } catch (err) {
      return fail(res, err.status || 500, err.message);
    }

    await CandidateTagModel.remove(id, tag);
    const tags = await CandidateTagModel.list(id);
    return ok(res, { tags }, 'Tag removed successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to remove tag');
  }
}

// NOTES
async function getNotes(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid applicant id');

    try {
      await checkCandidateOwnership(req, id);
    } catch (err) {
      return fail(res, err.status || 500, err.message);
    }

    const notes = await CandidateNotesModel.list(id);
    return ok(res, { notes }, 'Candidate notes');
  } catch (err) {
    return fail(res, 500, 'Failed to load notes');
  }
}

async function addNote(req, res) {
  try {
    const id = Number(req.params.id);
    const { note_text } = req.body || {};
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid applicant id');
    if (typeof note_text !== 'string' || !note_text.trim()) return fail(res, 400, 'Note text is required');

    try {
      await checkCandidateOwnership(req, id);
    } catch (err) {
      return fail(res, err.status || 500, err.message);
    }

    await CandidateNotesModel.create(id, req.user.id, note_text);
    const notes = await CandidateNotesModel.list(id);
    return ok(res, { notes }, 'Note added successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to add note');
  }
}

async function removeNote(req, res) {
  try {
    const noteId = Number(req.params.noteId);
    if (!Number.isInteger(noteId) || noteId <= 0) return fail(res, 400, 'Invalid note id');

    const pool = require('../config/db').getPool();
    const [noteRows] = await pool.query('SELECT applicant_id FROM candidate_notes WHERE id = ?', [noteId]);
    if (!noteRows.length) return fail(res, 404, 'Note not found');

    try {
      await checkCandidateOwnership(req, noteRows[0].applicant_id);
    } catch (err) {
      return fail(res, err.status || 500, err.message);
    }

    await CandidateNotesModel.delete(noteId);
    return ok(res, { deleted: true }, 'Note removed successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to remove note');
  }
}

// RESUME HISTORY
async function getResumeHistory(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid applicant id');
    const history = await ResumeHistoryModel.list(id);
    return ok(res, { history }, 'Resume history');
  } catch (err) {
    return fail(res, 500, 'Failed to load resume history');
  }
}

// TIMELINE
async function getTimeline(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid applicant id');

    const applicant = await ApplicantModel.getById(id);
    if (!applicant) return fail(res, 404, 'Applicant not found');

    const pool = require('../config/db').getPool();

    // 1. Get Application Stage Histories
    const [stages] = await pool.query(
      `SELECT h.new_stage AS title, h.notes AS description, u.full_name AS user, h.changed_at AS event_time, 'stage' AS type
       FROM application_stage_history h
       JOIN applications app ON h.application_id = app.id
       JOIN users u ON h.changed_by = u.id
       WHERE app.applicant_id = ?`,
      [id]
    );

    // 2. Get Interviews
    const [interviews] = await pool.query(
      `SELECT CONCAT('Interview Scheduled: ', interview_mode, ' (Round ', interview_round, ')') AS title, 
              CONCAT('Interview with ', COALESCE(interviewer_name, 'hospital'), ' on ', interview_date, ' at ', interview_time, '. Status: ', status, ', Result: ', result) AS description, 
              'System' AS user, created_at AS event_time, 'interview' AS type
       FROM interviews
       WHERE applicant_id = ?`,
      [id]
    );

    // 3. Get Notes
    const [notes] = await pool.query(
      `SELECT 'Note Added' AS title, note_text AS description, u.full_name AS user, n.created_at AS event_time, 'note' AS type
       FROM candidate_notes n
       JOIN users u ON n.author_id = u.id
       WHERE n.applicant_id = ?`,
      [id]
    );

    // 4. Creation event
    const creationEvent = {
      title: 'Candidate Created',
      description: 'Candidate profile entered into CRM.',
      user: applicant.created_by_name || 'System',
      event_time: applicant.created_at,
      type: 'creation'
    };

    const timeline = [
      creationEvent,
      ...stages,
      ...interviews,
      ...notes
    ];

    // Sort by event_time descending. If times match, creation is oldest/last.
    timeline.sort((a, b) => {
      const diff = new Date(b.event_time) - new Date(a.event_time);
      if (diff !== 0) return diff;
      if (a.type === 'creation') return 1;
      if (b.type === 'creation') return -1;
      return 0;
    });

    return ok(res, { timeline }, 'Candidate activity timeline');
  } catch (err) {
    return fail(res, 500, 'Failed to load timeline');
  }
}

const DOCS_ROOT = path.join(__dirname, '..', 'uploads', 'documents');

async function uploadDocuments(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid applicant id');

    try {
      await checkCandidateOwnership(req, id);
    } catch (err) {
      return fail(res, err.status || 500, err.message);
    }

    const applicant = await ApplicantModel.getById(id);
    if (!applicant) return fail(res, 404, 'Applicant not found');

    if (!req.files || !req.files.length) {
      return fail(res, 400, 'No documents uploaded');
    }

    const saved = [];
    for (const file of req.files) {
      const doc = await ApplicantModel.addDocument(id, file.originalname, `documents/${file.filename}`, req.user.id);
      saved.push({ id: doc.id, file_name: file.originalname });
    }

    return ok(res, { documents: saved }, 'Documents uploaded successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to upload documents');
  }
}

async function getDocuments(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid applicant id');

    try {
      await checkCandidateOwnership(req, id);
    } catch (err) {
      return fail(res, err.status || 500, err.message);
    }

    const docs = await ApplicantModel.listDocuments(id);
    return ok(res, { documents: docs }, 'Candidate documents');
  } catch (err) {
    return fail(res, 500, 'Failed to load documents');
  }
}

function resolveDocPath(relativePath) {
  const rel = String(relativePath || '');
  const abs = path.resolve(UPLOADS_ROOT, rel);
  const allowedRoot = path.resolve(DOCS_ROOT) + path.sep;
  if (!abs.startsWith(allowedRoot)) return null;
  return abs;
}

async function deleteDocument(req, res) {
  try {
    const docId = Number(req.params.docId);
    if (!Number.isInteger(docId) || docId <= 0) return fail(res, 400, 'Invalid document id');

    const doc = await ApplicantModel.getDocumentById(docId);
    if (!doc) return fail(res, 404, 'Document not found');

    const applicant = await ApplicantModel.getById(doc.applicant_id);
    const isAdmin = req.user && req.user.role === 'admin';
    const isOwner = req.user && Number(req.user.id) === Number(applicant.created_by);
    const isAssignee = req.user && applicant.assigned_recruiter_id && Number(req.user.id) === Number(applicant.assigned_recruiter_id);

    if (!isAdmin && !isOwner && !isAssignee) {
      return fail(res, 403, 'Forbidden: You do not have permission to delete this file');
    }

    await ApplicantModel.deleteDocument(docId);
    const abs = resolveDocPath(doc.file_path);
    if (abs) {
      await fs.promises.unlink(abs).catch(() => {});
    }

    return ok(res, { deleted: true }, 'Document deleted successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to delete document');
  }
}

async function viewDocument(req, res) {
  try {
    const docId = Number(req.params.docId);
    if (!Number.isInteger(docId) || docId <= 0) return fail(res, 400, 'Invalid document id');

    const doc = await ApplicantModel.getDocumentById(docId);
    if (!doc) return fail(res, 404, 'Document not found');

    try {
      await checkCandidateOwnership(req, doc.applicant_id);
    } catch (err) {
      return fail(res, err.status || 500, err.message);
    }

    const abs = resolveDocPath(doc.file_path);
    if (!abs) return fail(res, 404, 'Document file not found');

    await fs.promises.access(abs, fs.constants.R_OK);

    const ext = path.extname(doc.file_name).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.txt') contentType = 'text/plain';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.file_name}"`);
    return fs.createReadStream(abs).pipe(res);
  } catch (err) {
    return fail(res, 404, 'Document not found');
  }
}

async function downloadDocument(req, res) {
  try {
    const docId = Number(req.params.docId);
    if (!Number.isInteger(docId) || docId <= 0) return fail(res, 400, 'Invalid document id');

    const doc = await ApplicantModel.getDocumentById(docId);
    if (!doc) return fail(res, 404, 'Document not found');

    try {
      await checkCandidateOwnership(req, doc.applicant_id);
    } catch (err) {
      return fail(res, err.status || 500, err.message);
    }

    const abs = resolveDocPath(doc.file_path);
    if (!abs) return fail(res, 404, 'Document file not found');

    await fs.promises.access(abs, fs.constants.R_OK);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.file_name}"`);
    return fs.createReadStream(abs).pipe(res);
  } catch (err) {
    return fail(res, 404, 'Document not found');
  }
}

async function getSubmissionPackage(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid applicant id');

    const applicant = await ApplicantModel.getById(id);
    if (!applicant) return fail(res, 404, 'Candidate not found');

    try {
      await checkCandidateOwnership(req, id);
    } catch (err) {
      return fail(res, err.status || 500, err.message);
    }

    const { generateSubmissionPackagePDF } = require('../utils/submissionPackageUtil');
    const pdfBuffer = await generateSubmissionPackagePDF(applicant, {
      remarks: req.query.remarks || applicant.notes,
      matching_score: applicant.matching_score || 88
    });

    const candidateCode = `CAN-${String(id).padStart(5, '0')}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="submission_package_${candidateCode}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    return fail(res, 500, 'Failed to generate submission package');
  }
}

async function downloadImportTemplate(req, res) {
  try {
    const { generateTemplateCSV } = require('../utils/excelImportUtil');
    const csvContent = generateTemplateCSV();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="candidate_import_template.csv"');
    return res.send(csvContent);
  } catch (err) {
    return fail(res, 500, 'Failed to download import template');
  }
}

async function previewExcelImport(req, res) {
  try {
    const { parseRawContent, validateImportRows } = require('../utils/excelImportUtil');
    let rawContent = req.body ? req.body.fileContent : null;

    if (!rawContent && req.file && req.file.buffer) {
      rawContent = req.file.buffer.toString('utf-8');
    }

    if (!rawContent && req.file && req.file.path) {
      const fs = require('fs');
      rawContent = fs.readFileSync(req.file.path, 'utf-8');
    }

    if (!rawContent) {
      return fail(res, 400, 'No file content uploaded');
    }

    const rows = parseRawContent(rawContent);
    if (!rows.length) {
      return fail(res, 400, 'Import file is empty or invalid format');
    }

    const summary = await validateImportRows(rows);
    return ok(res, summary, 'Excel import validation preview');
  } catch (err) {
    return fail(res, 500, 'Failed to parse import preview: ' + err.message);
  }
}

async function processExcelImport(req, res) {
  try {
    const { processBulkImport } = require('../utils/excelImportUtil');
    const records = req.body ? req.body.records : null;

    if (!Array.isArray(records) || !records.length) {
      return fail(res, 400, 'No valid records provided for import');
    }

    const userId = req.user ? req.user.id : 1;
    const report = await processBulkImport(records, userId);
    return ok(res, report, 'Bulk import completed successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to process bulk import: ' + err.message);
  }
}

async function exportCandidatePdf(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid applicant id');

    const applicant = await ApplicantModel.getById(id);
    if (!applicant) return fail(res, 404, 'Applicant not found');

    const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const { width, height } = page.getSize();
    let y = height - 40;

    page.drawRectangle({
      x: 0,
      y: height - 70,
      width,
      height: 70,
      color: rgb(0.08, 0.22, 0.45)
    });

    page.drawText('HEALTHCRM RECRUITMENT ENTERPRISE', {
      x: 40,
      y: height - 35,
      size: 15,
      font: boldFont,
      color: rgb(1, 1, 1)
    });

    page.drawText('VERIFIED EXECUTIVE CANDIDATE DOSSIER', {
      x: 40,
      y: height - 55,
      size: 10,
      font,
      color: rgb(0.85, 0.9, 1)
    });

    y = height - 100;

    const candidateCode = `CAN-${String(applicant.id || 1000).padStart(5, '0')}`;
    page.drawText(String(applicant.full_name || 'Candidate Profile').toUpperCase(), {
      x: 40,
      y,
      size: 18,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.2)
    });

    page.drawText(`Ref Code: ${candidateCode}  |  Status: ${String(applicant.candidate_status || 'Active').toUpperCase()}`, {
      x: 330,
      y: y + 2,
      size: 10,
      font: boldFont,
      color: rgb(0.1, 0.5, 0.3)
    });

    y -= 25;
    page.drawText(`${applicant.current_designation || 'Healthcare Professional'}  -  ${applicant.total_experience || 0} Years Experience`, {
      x: 40,
      y,
      size: 12,
      font,
      color: rgb(0.3, 0.3, 0.4)
    });

    y -= 20;
    page.drawLine({
      start: { x: 40, y },
      end: { x: width - 40, y },
      thickness: 1.5,
      color: rgb(0.8, 0.85, 0.9)
    });

    y -= 30;

    page.drawText('PROFESSIONAL PROFILE & QUALIFICATIONS', {
      x: 40,
      y,
      size: 12,
      font: boldFont,
      color: rgb(0.08, 0.22, 0.45)
    });
    y -= 20;

    const details = [
      ['Qualification', applicant.qualification || 'N/A'],
      ['Key Skills', applicant.skills || 'N/A'],
      ['Current Company', applicant.current_company || 'N/A'],
      ['Current CTC', applicant.current_salary ? `INR ${Number(applicant.current_salary).toLocaleString('en-IN')}` : 'N/A'],
      ['Expected CTC', applicant.expected_salary ? `INR ${Number(applicant.expected_salary).toLocaleString('en-IN')}` : 'N/A'],
      ['Notice Period', applicant.notice_period || 'N/A'],
      ['Location / State', `${applicant.city || 'N/A'}, ${applicant.state || ''}`],
      ['Preferred Location', applicant.preferred_location || 'N/A'],
      ['Sourcing Source', String(applicant.source || 'Portal').toUpperCase()]
    ];

    details.forEach(([lbl, val]) => {
      page.drawRectangle({
        x: 40,
        y: y - 4,
        width: 140,
        height: 18,
        color: rgb(0.95, 0.96, 0.98)
      });
      page.drawText(lbl, { x: 45, y, size: 9, font: boldFont, color: rgb(0.2, 0.2, 0.3) });
      page.drawText(String(val).slice(0, 55), { x: 190, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 24;
    });

    y -= 15;

    page.drawRectangle({
      x: 40,
      y: y - 45,
      width: width - 80,
      height: 55,
      color: rgb(0.98, 0.94, 0.94),
      borderColor: rgb(0.85, 0.3, 0.3),
      borderWidth: 1
    });

    page.drawText('PRIVACY & CONFIDENTIALITY PROTECTED', {
      x: 55,
      y: y - 10,
      size: 10,
      font: boldFont,
      color: rgb(0.7, 0.1, 0.1)
    });

    page.drawText('Phone Number : [REDACTED FOR PRIVACY - CONFIDENTIAL]', {
      x: 55,
      y: y - 25,
      size: 9,
      font: boldFont,
      color: rgb(0.4, 0.4, 0.4)
    });

    page.drawText('Email Address : [REDACTED FOR PRIVACY - CONFIDENTIAL]', {
      x: 55,
      y: y - 38,
      size: 9,
      font: boldFont,
      color: rgb(0.4, 0.4, 0.4)
    });

    y -= 75;

    if (applicant.notes) {
      page.drawText('RECRUITER REMARKS & ASSESSMENT', {
        x: 40,
        y,
        size: 11,
        font: boldFont,
        color: rgb(0.08, 0.22, 0.45)
      });
      y -= 18;
      page.drawText(String(applicant.notes).slice(0, 180), {
        x: 40,
        y,
        size: 9,
        font,
        color: rgb(0.3, 0.3, 0.3)
      });
      y -= 30;
    }

    page.drawLine({
      start: { x: 40, y: 40 },
      end: { x: width - 40, y: 40 },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.85)
    });

    page.drawText('HealthCRM Enterprise Recruitment System  |  Confidential Profile Document', {
      x: 40,
      y: 25,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5)
    });

    page.drawText(`Generated: ${new Date().toISOString().slice(0, 10)}`, {
      x: 440,
      y: 25,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5)
    });

    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    const safeName = String(applicant.full_name || 'Candidate').replace(/[^a-zA-Z0-9]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Candidate_Profile_${safeName}_${applicant.id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Failed to export candidate PDF:', err);
    return fail(res, 500, 'Failed to export candidate PDF: ' + err.message);
  }
}

module.exports = {
  list,
  getById,
  createApplicant,
  updateApplicant,
  removeApplicant,
  setCandidateStatus,
  byJob,
  viewResume,
  downloadResume,
  assignRecruiter,
  getTags,
  addTag,
  removeTag,
  getNotes,
  addNote,
  removeNote,
  getResumeHistory,
  getTimeline,
  uploadDocuments,
  getDocuments,
  deleteDocument,
  viewDocument,
  downloadDocument,
  bulkAssignRecruiter,
  getAssignmentHistory,
  getSubmissionPackage,
  downloadImportTemplate,
  previewExcelImport,
  processExcelImport,
  exportCandidatePdf
};
