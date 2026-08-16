'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/invoiceController');
const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');

router.use(authMiddleware);

router.use(permissionMiddleware('manage_invoices'));

router.get('/stats/financial-summary', controller.getFinancialSummary);
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/status/:id', controller.updateStatus);
router.post('/:id/payments', controller.recordPayment);
router.get('/:id/payments', controller.getPayments);
router.post('/:id/duplicate', controller.duplicateInvoice);
router.delete('/:id', controller.remove);
router.get('/download/:id', controller.downloadInvoice);

module.exports = router;
