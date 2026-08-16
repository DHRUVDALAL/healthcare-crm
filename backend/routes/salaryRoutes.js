'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/salaryController');
const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');

router.use(authMiddleware);
router.use(permissionMiddleware('manage_salary'));

router.get('/', controller.list);
router.post('/bulk', controller.bulkGenerate);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.patch('/status/:id', controller.updateStatus);
router.get('/payslip/:id', controller.downloadPayslip);

module.exports = router;
