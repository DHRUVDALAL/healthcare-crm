'use strict';

const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');
const referrerController = require('../controllers/referrerController');

const router = express.Router();

router.use(authMiddleware);

// Authenticated lists
router.get('/', referrerController.list);
router.get('/:id', referrerController.getById);

// Admin-only updates mapped to manage_referrals permission
router.post('/', permissionMiddleware('manage_referrals'), referrerController.create);
router.put('/:id', permissionMiddleware('manage_referrals'), referrerController.update);
router.delete('/:id', permissionMiddleware('manage_referrals'), referrerController.remove);

module.exports = router;
