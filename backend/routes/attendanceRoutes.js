'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/attendanceController');
const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');

router.use(authMiddleware);

router.post('/login', controller.logLogin);
router.patch('/logout', controller.logLogout);

router.get('/', permissionMiddleware('manage_attendance'), controller.list);

module.exports = router;
