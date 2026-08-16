'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/adminIntelligenceController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/command-center', controller.getAdminCommandCenter);
router.post('/rebalance-workload', controller.handleRebalanceWorkload);
router.get('/executive-summary', controller.getExecutiveSummary);

module.exports = router;
