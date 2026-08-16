'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/productionHardeningController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/global-search', controller.handleGlobalSearch);
router.post('/import/bulk-excel', controller.handleBulkExcelImport);
router.get('/import/template/:type', controller.handleGetImportTemplate);
router.post('/pdf/generate', controller.handleGeneratePdf);
router.get('/logs/system', controller.handleGetSystemLogs);

module.exports = router;
