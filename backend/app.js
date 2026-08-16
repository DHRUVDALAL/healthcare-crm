'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { fail } = require('./utils/response');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const hospitalRoutes = require('./routes/hospitalRoutes');
const jobRoutes = require('./routes/jobRoutes');
const applicantRoutes = require('./routes/applicantRoutes');

// Part 4
const matchingRoutes = require('./routes/matchingRoutes');
const poolRoutes = require('./routes/poolRoutes');
const resumeMaskRoutes = require('./routes/resumeMaskRoutes');

// Part 5
const pipelineRoutes = require('./routes/pipelineRoutes');
const interviewRoutes = require('./routes/interviewRoutes');
const applicationRoutes = require('./routes/applicationRoutes');

// Part 6
const invoiceRoutes = require('./routes/invoiceRoutes');
const referralRoutes = require('./routes/referralRoutes');
const referrerRoutes = require('./routes/referrerRoutes');
const revenueRoutes = require('./routes/revenueRoutes');

// Part 7
const employeeRoutes = require('./routes/employeeRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const salaryRoutes = require('./routes/salaryRoutes');
const taskRoutes = require('./routes/taskRoutes');

// Part 8
const calendarRoutes = require('./routes/calendarRoutes');
const projectionRoutes = require('./routes/projectionRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const reportRoutes = require('./routes/reportRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

// Part 9 — Phase 4
const notificationRoutes = require('./routes/notificationRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');
const followUpRoutes = require('./routes/followUpRoutes');

// Admin ERP & Productivity System
const customRoleRoutes = require('./routes/customRoleRoutes');
const hospitalPaymentRoutes = require('./routes/hospitalPaymentRoutes');
const attendanceAdminRoutes = require('./routes/attendanceAdminRoutes');
const healthRoutes = require('./routes/healthRoutes');
const workLogRoutes = require('./routes/workLogRoutes');
const productivityRoutes = require('./routes/productivityRoutes');
const goalRoutes = require('./routes/goalRoutes');
const commandCenterRoutes = require('./routes/commandCenterRoutes');
const adminIntelligenceRoutes = require('./routes/adminIntelligenceRoutes');
const candidateWorkspaceRoutes = require('./routes/candidateWorkspaceRoutes');
const postSubmissionRoutes = require('./routes/postSubmissionRoutes');
const recruiterCommandCenterRoutes = require('./routes/recruiterCommandCenterRoutes');
const adminOperationsCenterRoutes = require('./routes/adminOperationsCenterRoutes');
const productionHardeningRoutes = require('./routes/productionHardeningRoutes');
const clientDemoRoutes = require('./routes/clientDemoRoutes');

const app = express();

app.disable('x-powered-by');

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
  origin: true,
  credentials: false
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/admin-intelligence', adminIntelligenceRoutes);
app.use('/api/candidate-workspace', candidateWorkspaceRoutes);
app.use('/api/post-submission', postSubmissionRoutes);
app.use('/api/recruiter-command-center', recruiterCommandCenterRoutes);
app.use('/api/admin-operations-center', adminOperationsCenterRoutes);
app.use('/api/production-hardening', productionHardeningRoutes);
app.use('/api/client-demo', clientDemoRoutes);

app.use(morgan('dev'));

// Health check endpoint (public)
app.use('/api/health', healthRoutes);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applicants', applicantRoutes);

// Part 4
app.use('/api/matching', matchingRoutes);
app.use('/api/pool', poolRoutes);
app.use('/api/resume', resumeMaskRoutes);

// Part 5
app.use('/api/pipeline', pipelineRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/applications', applicationRoutes);

// Part 6
app.use('/api/invoices', invoiceRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/referrers', referrerRoutes);
app.use('/api/revenue', revenueRoutes);

// Part 7
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/tasks', taskRoutes);

// Part 8
app.use('/api/calendar', calendarRoutes);
app.use('/api/projections', projectionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);

// Part 9 — Phase 4
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/follow-ups', followUpRoutes);

// Admin ERP & Productivity System
app.use('/api/custom-roles', customRoleRoutes);
app.use('/api/hospital-payments', hospitalPaymentRoutes);
app.use('/api/attendance-admin', attendanceAdminRoutes);
app.use('/api/work-logs', workLogRoutes);
app.use('/api/productivity', productivityRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/command-center', commandCenterRoutes);
app.use('/api/admin-intelligence', adminIntelligenceRoutes);

// Static uploads
const uploadsDir = path.join(__dirname, 'uploads');
const rootUploadsDir = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsDir));
app.use('/uploads', express.static(rootUploadsDir));

// Static frontend
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'dashboard.html'));
});

app.get('/hospitals', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'hospitals.html'));
});

app.get('/jobs', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'jobs.html'));
});

app.get('/applicants', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'applicants.html'));
});

app.get('/matching', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'matching.html'));
});

app.get('/pool', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'pool.html'));
});

app.get('/pipeline', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'pipeline.html'));
});

app.get('/interviews', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'interviews.html'));
});

app.get('/invoices', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'invoices.html'));
});

app.get('/referrals', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'referrals.html'));
});

// Part 7 HTML Pages
app.get('/employees', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'employees.html'));
});

app.get('/attendance', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'attendance.html'));
});

app.get('/leaves', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'leaves.html'));
});

app.get('/salary', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'salary.html'));
});

app.get('/tasks', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'tasks.html'));
});

// Part 8 HTML Pages
app.get('/calendar', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'calendar.html'));
});

app.get('/projections', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'projections.html'));
});

app.get('/reports', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'reports.html'));
});

app.get('/performance', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'performance.html'));
});

// Admin ERP Pages
app.get('/roles', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'roles.html'));
});

app.get('/audit-logs', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'audit-logs.html'));
});

app.get('/finance', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'finance.html'));
});

// 404 for API
app.use('/api', (req, res) => fail(res, 404, 'API route not found'));

// Fallback to landing page for unknown routes
app.use((req, res) => {
  res.status(404).sendFile(path.join(frontendDir, 'index.html'));
});

module.exports = app;
