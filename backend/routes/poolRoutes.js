'use strict';

const express = require('express');

const authMiddleware = require('../middleware/authMiddleware');
const { listPool, moveToPool, reassignFromPool, bulkReassign, bulkArchive } = require('../controllers/poolController');

const router = express.Router();

router.get('/', authMiddleware, listPool);
router.patch('/move/:applicantId', authMiddleware, moveToPool);
router.patch('/reassign/:applicantId', authMiddleware, reassignFromPool);
router.post('/bulk-reassign', authMiddleware, bulkReassign);
router.post('/bulk-archive', authMiddleware, bulkArchive);

module.exports = router;
