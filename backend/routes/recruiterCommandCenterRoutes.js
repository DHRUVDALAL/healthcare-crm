'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/recruiterCommandCenterController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/work-center', controller.handleGetWorkCenter);
router.get('/work-queue', controller.handleGetWorkQueue);
router.get('/my-candidates', controller.handleGetMyCandidates);
router.post('/quick-action', controller.handleQuickAction);
router.post('/notes', controller.handleCreateNote);
router.post('/offline-sync', controller.handleOfflineSync);
router.get('/leaderboard', controller.handleGetLeaderboard);
router.get('/self-profile', controller.handleGetSelfProfile);

module.exports = router;
