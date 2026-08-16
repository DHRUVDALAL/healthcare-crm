'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/referralController');
const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');

router.use(authMiddleware);

// Grouped referrer view with milestone calculations
router.get('/grouped', controller.listGrouped);

// Referrer detail (all referred candidates for one referrer)
router.get('/referrer-detail', controller.getReferrerDetail);

// Existing endpoints
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.patch('/status/:id', permissionMiddleware('manage_referrals'), controller.updateStatus);
router.patch('/reward-paid/:id', permissionMiddleware('manage_referrals'), controller.markPaid);

module.exports = router;
