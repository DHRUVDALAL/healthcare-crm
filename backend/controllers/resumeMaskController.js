'use strict';

const fs = require('fs');
const path = require('path');

const ApplicantModel = require('../models/applicantModel');
const { ok, fail } = require('../utils/response');
const { maskPdfToFile } = require('../utils/pdfMaskingUtil');

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');
const RESUMES_ROOT = path.join(UPLOADS_ROOT, 'resumes');

function resolveResumePath(relativePath) {
  const rel = String(relativePath || '');
  const abs = path.resolve(UPLOADS_ROOT, rel);
  const allowedRoot = path.resolve(RESUMES_ROOT) + path.sep;
  if (!abs.startsWith(allowedRoot)) return null;
  return abs;
}

function canAccessOriginal(reqUser, applicant) {
  if (!reqUser || !applicant) return false;
  if (reqUser.role === 'admin') return true;
  return Number(applicant.created_by) === Number(reqUser.id);
}

async function maskResume(req, res) {
  try {
    const applicantId = Number(req.params.applicantId);
    if (!Number.isInteger(applicantId) || applicantId <= 0) return fail(res, 400, 'Invalid applicant id');

    const applicant = await ApplicantModel.getById(applicantId);
    if (!applicant) return fail(res, 404, 'Applicant not found');

    if (!canAccessOriginal(req.user, applicant)) {
      return fail(res, 403, 'Not allowed to mask this applicant resume');
    }

    if (!applicant.original_resume_path) return fail(res, 404, 'Original resume not found');

    // If a prior masked resume exists, remove it first (re-mask support)
    if (applicant.masked_resume_path) {
      await ApplicantModel.deleteMaskedFileIfExists(applicant.masked_resume_path);
    }

    const result = await maskPdfToFile({
      originalResumeRelPath: applicant.original_resume_path,
      applicant: {
        full_name: applicant.full_name,
        email: applicant.email,
        phone: applicant.phone
      }
    });

    await ApplicantModel.setMaskedResumePath(applicantId, result.masked_resume_path);

    const updated = await ApplicantModel.getById(applicantId);
    return ok(res, {
      applicant: updated,
      masked_resume_path: result.masked_resume_path,
      redactions: result.redactions
    }, 'Masked resume created');
  } catch (err) {
    return fail(res, 500, 'Failed to mask resume');
  }
}

async function streamPdf(res, absPath, { filename, disposition }) {
  await fs.promises.access(absPath, fs.constants.R_OK);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);

  return fs.createReadStream(absPath).pipe(res);
}

async function viewOriginal(req, res) {
  try {
    const applicantId = Number(req.params.applicantId);
    if (!Number.isInteger(applicantId) || applicantId <= 0) return fail(res, 400, 'Invalid applicant id');

    const applicant = await ApplicantModel.getById(applicantId);
    if (!applicant) return fail(res, 404, 'Applicant not found');

    if (!canAccessOriginal(req.user, applicant)) {
      return fail(res, 403, 'Not allowed to view original resume');
    }

    if (!applicant.original_resume_path) return fail(res, 404, 'Original resume not found');

    const abs = resolveResumePath(applicant.original_resume_path);
    if (!abs) return fail(res, 404, 'Original resume not found');

    return streamPdf(res, abs, { filename: `resume_original_${applicantId}.pdf`, disposition: 'inline' });
  } catch (err) {
    return fail(res, 404, 'Original resume not found');
  }
}

async function viewMasked(req, res) {
  try {
    const applicantId = Number(req.params.applicantId);
    if (!Number.isInteger(applicantId) || applicantId <= 0) return fail(res, 400, 'Invalid applicant id');

    const applicant = await ApplicantModel.getById(applicantId);
    if (!applicant) return fail(res, 404, 'Applicant not found');

    if (!applicant.masked_resume_path) return fail(res, 404, 'Masked resume not found');

    const abs = resolveResumePath(applicant.masked_resume_path);
    if (!abs) return fail(res, 404, 'Masked resume not found');

    return streamPdf(res, abs, { filename: `resume_masked_${applicantId}.pdf`, disposition: 'inline' });
  } catch (err) {
    return fail(res, 404, 'Masked resume not found');
  }
}

async function downloadMasked(req, res) {
  try {
    const applicantId = Number(req.params.applicantId);
    if (!Number.isInteger(applicantId) || applicantId <= 0) return fail(res, 400, 'Invalid applicant id');

    const applicant = await ApplicantModel.getById(applicantId);
    if (!applicant) return fail(res, 404, 'Applicant not found');

    if (!applicant.masked_resume_path) return fail(res, 404, 'Masked resume not found');

    const abs = resolveResumePath(applicant.masked_resume_path);
    if (!abs) return fail(res, 404, 'Masked resume not found');

    return streamPdf(res, abs, { filename: `resume_masked_${applicantId}.pdf`, disposition: 'attachment' });
  } catch (err) {
    return fail(res, 404, 'Masked resume not found');
  }
}

module.exports = {
  maskResume,
  viewOriginal,
  viewMasked,
  downloadMasked
};
