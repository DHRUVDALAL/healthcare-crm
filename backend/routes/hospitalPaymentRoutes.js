'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/hospitalPaymentController');
const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');

router.use(authMiddleware);

router.get('/finance-summary', permissionMiddleware('view_reports'), controller.financeSummary);
router.get('/', permissionMiddleware('manage_invoices'), controller.list);
router.get('/:id', permissionMiddleware('manage_invoices'), controller.getById);
router.post('/', permissionMiddleware('manage_invoices'), controller.create);
router.put('/:id', permissionMiddleware('manage_invoices'), controller.update);
router.patch('/status/:id', permissionMiddleware('manage_invoices'), controller.updateStatus);
router.delete('/:id', permissionMiddleware('manage_invoices'), controller.remove);

module.exports = router;
