'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/leaveController');
const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');

router.use(authMiddleware);

router.get('/', controller.list);
router.get('/balance', controller.getBalance);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.patch('/status/:id', permissionMiddleware('approve_leaves'), controller.updateStatus);

module.exports = router;
