'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/auditLogController');
const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');

router.use(authMiddleware);
router.use(permissionMiddleware('view_audit_logs'));

router.get('/', controller.list);

module.exports = router;
