'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

const { uploadAvatar } = require('../middleware/uploadMiddleware');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'Too many login attempts. Please try again shortly.' }
});

router.post('/login', loginLimiter, authController.login);
router.get('/profile', authMiddleware, authController.profile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.patch('/password', authMiddleware, authController.updatePassword);
router.post('/photo', authMiddleware, uploadAvatar, authController.updatePhoto);
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
