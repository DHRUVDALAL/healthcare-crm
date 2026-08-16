'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');

router.use(authMiddleware);

router.get('/dashboard', permissionMiddleware('view_dashboard'), controller.dashboard); 
router.get('/my-performance', controller.getMyPerformance);
router.get('/leaderboard', controller.getLeaderboard);

router.use(permissionMiddleware('view_reports'));
router.get('/performance', controller.performance);
router.get('/revenue-summary', controller.revenueSummary);
router.get('/pipeline-funnel', controller.pipelineFunnel);
router.get('/hospital-analytics', controller.hospitalAnalytics);
router.get('/interview-analytics', controller.interviewAnalytics);
router.get('/referral-analytics', controller.referralAnalytics);

module.exports = router;
