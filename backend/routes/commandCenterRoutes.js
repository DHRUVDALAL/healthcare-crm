'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/commandCenterController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/dashboard-data', controller.getDashboardData);

module.exports = router;
