'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/productivityController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/live-monitoring', controller.getLiveMonitoring);
router.get('/leaderboard', controller.getSmartLeaderboard);
router.get('/report-card/:id', controller.getEmployeeReportCard);

module.exports = router;
