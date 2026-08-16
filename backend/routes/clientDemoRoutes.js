'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/clientDemoController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/status', controller.handleGetDemoStatus);
router.post('/simulate-workflow', controller.handleSimulateWorkflow);
router.get('/checklist', controller.handleGetDemoChecklist);

module.exports = router;
