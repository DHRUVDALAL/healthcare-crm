'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');

router.use(authMiddleware);
router.use(permissionMiddleware('view_reports'));

router.post('/export', controller.exportReport);
router.get('/import-template/:type', controller.downloadImportTemplate);
router.get('/import-template', controller.downloadImportTemplate);
router.post('/bulk-import', controller.processBulkImport);

module.exports = router;
