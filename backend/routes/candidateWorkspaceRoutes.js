'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/candidateWorkspaceController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/:id', controller.getCandidateWorkspace);
router.post('/:id/status-transition', controller.handleStatusTransition);
router.post('/:id/documents', controller.handleAddDocument);
router.post('/:id/communications', controller.handleLogCommunication);

module.exports = router;
