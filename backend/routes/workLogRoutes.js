'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/workLogController');
const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');

router.use(authMiddleware);

router.get('/today', controller.getTodayLog);
router.put('/today', controller.updateTodayLog);
router.get('/', controller.listWorkLogs);
router.patch('/:id/review', controller.reviewWorkLog);

module.exports = router;
