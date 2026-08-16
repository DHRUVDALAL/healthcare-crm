'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/employeeController');
const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');

router.use(authMiddleware);

router.get('/workload', controller.getWorkload);

router.use(permissionMiddleware('manage_employees'));

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.get('/:id/profile', controller.getProfile);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/status/:id', controller.updateStatus);

module.exports = router;
