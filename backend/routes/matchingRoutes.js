'use strict';

const express = require('express');

const authMiddleware = require('../middleware/authMiddleware');
const { getMatchesForJob, calculateMatches, sendCandidate } = require('../controllers/matchingController');

const router = express.Router();

router.get('/job/:jobId', authMiddleware, getMatchesForJob);
router.post('/calculate/:jobId', authMiddleware, calculateMatches);
router.post('/send/:applicantId', authMiddleware, sendCandidate);

module.exports = router;
