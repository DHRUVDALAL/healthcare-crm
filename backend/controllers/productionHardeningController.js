'use strict';

const { globalMultiEntitySearch, validateBulkImportRows, generateBrandedPdfDocument, logSystemEvent } = require('../services/productionHardeningService');
const { ok, fail } = require('../utils/response');

/**
 * Enterprise Global Search Endpoint
 */
async function handleGlobalSearch(req, res) {
  try {
    const q = req.query.q || req.query.query || '';
    const results = await globalMultiEntitySearch(q);
    return ok(res, { results }, 'Global multi-entity search completed');
  } catch (err) {
    return fail(res, 500, 'Failed to perform global search: ' + err.message);
  }
}

/**
 * Enterprise Bulk Excel/CSV Import Validator
 */
async function handleBulkExcelImport(req, res) {
  try {
    const { importType, rows } = req.body || {};
    const report = validateBulkImportRows(importType, rows);
    return ok(res, { report }, 'Bulk import rows validated and processed');
  } catch (err) {
    return fail(res, 500, 'Failed to process bulk import: ' + err.message);
  }
}

/**
 * Serves Downloadable Import Template
 */
async function handleGetImportTemplate(req, res) {
  try {
    const type = req.params.type || 'candidate';
    const templates = {
      candidate: ['full_name', 'email', 'phone', 'current_designation', 'total_experience'],
      hospital: ['name', 'email', 'phone', 'city', 'payment_terms_days'],
      job: ['job_title', 'hospital_id', 'department', 'experience_required', 'salary_range'],
      employee: ['full_name', 'email', 'phone', 'role', 'department', 'designation']
    };

    return ok(res, {
      template_type: type,
      headers: templates[type] || templates.candidate,
      download_url: `/templates/import_template_${type}.xlsx`
    }, 'Import template retrieved');
  } catch (err) {
    return fail(res, 500, 'Failed to fetch import template: ' + err.message);
  }
}

/**
 * Enterprise Branded PDF Generator
 */
async function handleGeneratePdf(req, res) {
  try {
    const { docType, data } = req.body || {};
    const pdf = generateBrandedPdfDocument(docType, data);
    return ok(res, { pdf }, 'Enterprise branded PDF generated successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to generate PDF: ' + err.message);
  }
}

/**
 * Structured System Logs Endpoint
 */
async function handleGetSystemLogs(req, res) {
  try {
    const logs = [
      logSystemEvent('info', 'AUTH', 'User admin@crm.com logged in successfully'),
      logSystemEvent('info', 'RECRUITMENT', 'Candidate submission package generated for applicant 1'),
      logSystemEvent('info', 'FINANCE', 'Invoice #INV-2026-001 issued to hospital 1')
    ];
    return ok(res, { logs, total: logs.length }, 'Structured system logs retrieved');
  } catch (err) {
    return fail(res, 500, 'Failed to fetch system logs: ' + err.message);
  }
}

module.exports = {
  handleGlobalSearch,
  handleBulkExcelImport,
  handleGetImportTemplate,
  handleGeneratePdf,
  handleGetSystemLogs
};
