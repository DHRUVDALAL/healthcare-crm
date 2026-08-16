'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/settingsController');
const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');
const { uploadLogo } = require('../middleware/uploadMiddleware');

// Unauthenticated public route for system branding (login page & headers)
router.get('/public', controller.getPublicSettings);

// Authenticated routes below
router.use(authMiddleware);

router.get('/', controller.getSettings);
router.post('/', permissionMiddleware('manage_settings'), controller.saveSettings);
router.post('/logo', permissionMiddleware('manage_settings'), uploadLogo, controller.uploadLogo);

module.exports = router;
