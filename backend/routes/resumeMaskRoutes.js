'use strict';

const express = require('express');

const authMiddleware = require('../middleware/authMiddleware');
const { maskResume, viewOriginal, viewMasked, downloadMasked } = require('../controllers/resumeMaskController');

const router = express.Router();

router.post('/mask/:applicantId', authMiddleware, maskResume);
router.get('/original/:applicantId', authMiddleware, viewOriginal);
router.get('/masked/:applicantId', authMiddleware, viewMasked);
router.get('/download-masked/:applicantId', authMiddleware, downloadMasked);

module.exports = router;
