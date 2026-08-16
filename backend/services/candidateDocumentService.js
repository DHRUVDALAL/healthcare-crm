'use strict';

const { getPool } = require('../config/db');

/**
 * Add or update candidate document record.
 */
async function addDocument({ applicantId, documentType, filePath, fileName, userId }) {
  const pool = getPool();
  const docType = documentType || 'Resume';
  
  const [existing] = await pool.query(
    `SELECT version FROM candidate_documents WHERE applicant_id = ? AND document_type = ? ORDER BY version DESC LIMIT 1`,
    [applicantId, docType]
  );
  const version = (existing[0]?.version || 0) + 1;

  const [res] = await pool.query(
    `INSERT INTO candidate_documents (applicant_id, document_type, file_path, file_name, version, verification_status, uploaded_by)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    [applicantId, docType, filePath || 'uploads/doc.pdf', fileName || 'Document.pdf', version, userId]
  );

  return { id: res.insertId, applicant_id: applicantId, document_type: docType, version };
}

/**
 * Verify candidate document status.
 */
async function updateVerificationStatus({ documentId, status }) {
  const pool = getPool();
  await pool.query(`UPDATE candidate_documents SET verification_status = ? WHERE id = ?`, [status, documentId]);
  return { id: documentId, status };
}

/**
 * Get Candidate Documents
 */
async function getCandidateDocuments(applicantId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT d.*, u.full_name as uploaded_by_name
     FROM candidate_documents d
     JOIN users u ON d.uploaded_by = u.id
     WHERE d.applicant_id = ?
     ORDER BY d.created_at DESC`,
    [applicantId]
  );
  return rows;
}

module.exports = {
  addDocument,
  updateVerificationStatus,
  getCandidateDocuments
};
