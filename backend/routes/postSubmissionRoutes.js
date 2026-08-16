'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/postSubmissionController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/hospitals/review', controller.handleHospitalReview);
router.post('/interviews/schedule', controller.handleScheduleInterview);
router.post('/interviews/feedback', controller.handleInterviewFeedback);
router.post('/offers', controller.handleOffer);
router.post('/pre-joining', controller.handlePreJoiningChecklist);
router.post('/joining', controller.handleCandidateJoining);
router.post('/placements/replacement', controller.handleReplacementRequest);
router.get('/analytics/kpis', controller.handleGetAnalyticsKpis);

module.exports = router;
