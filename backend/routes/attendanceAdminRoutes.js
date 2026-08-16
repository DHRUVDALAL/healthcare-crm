'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/attendanceAdminController');
const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');

router.use(authMiddleware);
router.use(permissionMiddleware('manage_attendance'));

router.get('/daily', controller.getDailyAttendance);
router.get('/monthly', controller.getMonthlySummary);
router.get('/analytics', controller.getAttendanceAnalytics);

module.exports = router;
