'use strict';

const express = require('express');

const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');
const { optionalUploadResume, optionalUploadDocuments } = require('../middleware/uploadMiddleware');
const applicantController = require('../controllers/applicantController');

const router = express.Router();

router.get('/', authMiddleware, applicantController.list);

router.get('/job/:jobId', authMiddleware, applicantController.byJob);
router.get('/view/:id', authMiddleware, applicantController.viewResume);
router.get('/download/:id', authMiddleware, applicantController.downloadResume);
router.get('/:id/export-pdf', authMiddleware, applicantController.exportCandidatePdf);

// Assignment history & bulk assignment
router.post('/bulk-assign', authMiddleware, permissionMiddleware('assign_recruiter'), applicantController.bulkAssignRecruiter);
router.get('/:id/assignment-history', authMiddleware, applicantController.getAssignmentHistory);

// Excel Bulk Import Engine
router.get('/import/template', authMiddleware, applicantController.downloadImportTemplate);
router.post('/import/preview', authMiddleware, permissionMiddleware('manage_applicants'), applicantController.previewExcelImport);
router.post('/import/process', authMiddleware, permissionMiddleware('manage_applicants'), applicantController.processExcelImport);

// Candidate documents upload & download
router.post('/:id/documents', authMiddleware, permissionMiddleware('manage_applicants'), optionalUploadDocuments, applicantController.uploadDocuments);
router.get('/:id/documents', authMiddleware, applicantController.getDocuments);
router.delete('/documents/:docId', authMiddleware, permissionMiddleware('manage_applicants'), applicantController.deleteDocument);
router.get('/documents/:docId/view', authMiddleware, applicantController.viewDocument);
router.get('/documents/:docId/download', authMiddleware, applicantController.downloadDocument);

router.get('/:id', authMiddleware, applicantController.getById);

router.post('/', authMiddleware, permissionMiddleware('manage_applicants'), optionalUploadResume, applicantController.createApplicant);
router.put('/:id', authMiddleware, permissionMiddleware('manage_applicants'), optionalUploadResume, applicantController.updateApplicant);
router.patch('/status/:id', authMiddleware, permissionMiddleware('manage_applicants'), applicantController.setCandidateStatus);

router.get('/:id/tags', authMiddleware, applicantController.getTags);
router.post('/:id/tags', authMiddleware, permissionMiddleware('manage_applicants'), applicantController.addTag);
router.delete('/:id/tags/:tag', authMiddleware, permissionMiddleware('manage_applicants'), applicantController.removeTag);

router.get('/:id/notes', authMiddleware, applicantController.getNotes);
router.post('/:id/notes', authMiddleware, permissionMiddleware('manage_applicants'), applicantController.addNote);
router.delete('/notes/:noteId', authMiddleware, permissionMiddleware('manage_applicants'), applicantController.removeNote);

router.get('/:id/resume-history', authMiddleware, applicantController.getResumeHistory);
router.get('/:id/timeline', authMiddleware, applicantController.getTimeline);
router.get('/:id/submission-package', authMiddleware, applicantController.getSubmissionPackage);

// Admin-only operations mapped to specific permissions
router.post('/:id/assign', authMiddleware, permissionMiddleware('assign_recruiter'), applicantController.assignRecruiter);
router.delete('/:id', authMiddleware, permissionMiddleware('delete_applicants'), applicantController.removeApplicant);

module.exports = router;
