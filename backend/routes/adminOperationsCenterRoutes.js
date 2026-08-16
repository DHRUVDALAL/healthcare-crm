'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/adminOperationsCenterController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/dashboard-kpis', controller.handleGetDashboardKpis);
router.get('/hospitals/extended', controller.handleGetExtendedHospitals);
router.post('/employees/rbac', controller.handleEmployeeRbac);
router.post('/tasks/bulk', controller.handleBulkTasks);
router.get('/finance/summary', controller.handleGetFinanceSummary);
router.post('/reports/export-center', controller.handleExportReport);
router.get('/calendar/enterprise', controller.handleGetEnterpriseCalendar);
router.get('/audit-logs', controller.handleGetAuditLogs);
router.get('/settings', controller.handleSettings);
router.post('/settings', controller.handleSettings);
router.post('/backup/create', controller.handleCreateBackup);
router.get('/system-health', controller.handleGetSystemHealth);

module.exports = router;
