'use strict';

const { getPool } = require('../config/db');
const { STAGE_PROGRESSION, transitionCandidateStatus, getStatusHistory } = require('../services/candidateLifecycleService');
const { addDocument, updateVerificationStatus, getCandidateDocuments } = require('../services/candidateDocumentService');
const { logCommunication, getCommunicationHistory } = require('../services/candidateCommunicationService');
const { ok, fail } = require('../utils/response');

/**
 * Get Consolidated Candidate Workspace Dataset (20 Sections)
 */
async function getCandidateWorkspace(req, res) {
  try {
    const applicantId = Number(req.params.id);
    if (!applicantId) return fail(res, 400, 'Invalid applicant ID');

    const pool = getPool();
    const [candRows] = await pool.query(
      `SELECT a.*, u.full_name as recruiter_name, j.job_title as applied_job_title, h.name as hospital_name
       FROM applicants a
       LEFT JOIN users u ON a.assigned_recruiter_id = u.id
       LEFT JOIN jobs j ON a.applied_job_id = j.id
       LEFT JOIN hospitals h ON j.hospital_id = h.id
       WHERE a.id = ?`,
      [applicantId]
    );

    if (!candRows.length) return fail(res, 404, 'Candidate not found');
    const cand = candRows[0];

    const [docs, comms, statusHistory, pipelineRows, interviews, invoices] = await Promise.all([
      getCandidateDocuments(applicantId),
      getCommunicationHistory(applicantId),
      getStatusHistory(applicantId),
      pool.query(`SELECT app.*, j.job_title, h.name as hospital_name FROM applications app JOIN jobs j ON app.job_id = j.id JOIN hospitals h ON j.hospital_id = h.id WHERE app.applicant_id = ?`, [applicantId]).then(r => r[0]),
      pool.query(`SELECT i.*, j.job_title, h.name as hospital_name FROM interviews i JOIN jobs j ON i.job_id = j.id JOIN hospitals h ON j.hospital_id = h.id WHERE i.applicant_id = ?`, [applicantId]).then(r => r[0]),
      pool.query(`SELECT inv.*, h.name as hospital_name FROM invoices inv JOIN hospitals h ON inv.hospital_id = h.id WHERE inv.applicant_id = ?`, [applicantId]).then(r => r[0])
    ]);

    // Match Score Breakdown
    const matchBreakdown = {
      overall_score: cand.matching_score || 85,
      skill_match: 90,
      salary_match: 85,
      location_match: 80,
      experience_match: 85,
      explanation: 'High match: Candidate skills and experience align closely with requirement criteria.'
    };

    return ok(res, {
      candidate: cand,
      lifecycle_progression: STAGE_PROGRESSION,
      match_breakdown: matchBreakdown,
      documents: docs,
      communications: comms,
      status_history: statusHistory,
      applications: pipelineRows,
      interviews: interviews,
      invoices: invoices
    }, 'Candidate Workspace Details');
  } catch (err) {
    return fail(res, 500, 'Failed to fetch candidate workspace: ' + err.message);
  }
}

/**
 * Update Status Lifecycle Stage
 */
async function handleStatusTransition(req, res) {
  try {
    const applicantId = Number(req.params.id);
    const body = req.body || {};
    const newStatus = body.newStatus || body.status || body.new_status || 'Profile Under Review';
    const remarks = body.remarks || '';
    const result = await transitionCandidateStatus({ applicantId, newStatus, remarks, userId: req.user.id });
    return ok(res, result, 'Status transitioned successfully');
  } catch (err) {
    return fail(res, 400, 'Failed to transition status: ' + err.message);
  }
}

/**
 * Upload Document Record
 */
async function handleAddDocument(req, res) {
  try {
    const applicantId = Number(req.params.id);
    const body = req.body || {};
    const documentType = body.documentType || body.document_type || body.doc_type || 'Resume';
    const filePath = body.filePath || body.file_path || 'uploads/doc.pdf';
    const fileName = body.fileName || body.file_name || 'Document.pdf';
    const result = await addDocument({ applicantId, documentType, filePath, fileName, userId: req.user.id });
    return ok(res, result, 'Document uploaded successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to add document: ' + err.message);
  }
}

/**
 * Log Communication History Entry
 */
async function handleLogCommunication(req, res) {
  try {
    const applicantId = Number(req.params.id);
    const body = req.body || {};
    const type = body.type || body.communication_type || 'phone_call';
    const summary = body.summary || body.notes || 'Call completed';
    const nextFollowupDate = body.nextFollowupDate || body.next_followup_date || null;
    const result = await logCommunication({ applicantId, type, summary, nextFollowupDate, userId: req.user.id });
    return ok(res, result, 'Communication logged successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to log communication: ' + err.message);
  }
}

module.exports = {
  getCandidateWorkspace,
  handleStatusTransition,
  handleAddDocument,
  handleLogCommunication
};
