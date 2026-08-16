'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/revenueController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.use(authMiddleware);

router.get('/stats', controller.stats);
router.get('/monthly', controller.monthly);
router.get('/pending', controller.pending);

module.exports = router;
