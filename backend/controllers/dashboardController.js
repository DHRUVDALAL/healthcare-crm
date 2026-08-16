'use strict';

const JobModel = require('../models/jobModel');
const ApplicantModel = require('../models/applicantModel');
const ApplicationModel = require('../models/applicationModel');
const InterviewModel = require('../models/interviewModel');
const EmployeeModel = require('../models/employeeModel');
const EmployeeLogModel = require('../models/employeeLogModel');
const LeaveModel = require('../models/leaveModel');
const SalaryModel = require('../models/salaryModel');
const { getPool } = require('../config/db');
const { ok, fail } = require('../utils/response');

async function stats(req, res) {
  try {
    const pool = getPool();

    const [
      activeJobs,
      totalApplicants,
      poolCandidates,
      shortlistedCandidates,
      candidatesInPipeline,
      selectedCandidates,
      rejectedCandidates,
      interviewsScheduled,
      recentApplicants,
      empStats,
      presentToday,
      leaveStats,
      salaryStats
    ] = await Promise.all([
      JobModel.countActiveJobs(),
      ApplicantModel.countTotalApplicants(),
      ApplicantModel.countPoolCandidates(),
      ApplicantModel.countShortlistedCandidates(),
      ApplicationModel.countInPipeline(),
      ApplicationModel.countByStage('selected'),
      ApplicationModel.countByStage('rejected'),
      InterviewModel.countScheduled(),
      ApplicantModel.listRecentApplicants(5),
      EmployeeModel.stats(),
      EmployeeLogModel.getPresentTodayCount(),
      LeaveModel.stats(),
      SalaryModel.stats()
    ]);

    // Revenue KPIs
    const [revRows] = await pool.query("SELECT SUM(invoice_amount) as total FROM invoices WHERE payment_status = 'paid'");
    const revenueGenerated = Number(revRows[0]?.total || 0);

    const [pendingInvRows] = await pool.query("SELECT COUNT(*) as count, COALESCE(SUM(invoice_amount),0) as amount FROM invoices WHERE payment_status = 'pending'");
    const pendingInvoices = Number(pendingInvRows[0]?.count || 0);
    const outstandingAmount = Number(pendingInvRows[0]?.amount || 0);

    const [overdueInvRows] = await pool.query("SELECT COUNT(*) as count, COALESCE(SUM(invoice_amount),0) as amount FROM invoices WHERE payment_status = 'overdue'");
    const overdueInvoices = Number(overdueInvRows[0]?.count || 0);
    const overdueAmount = Number(overdueInvRows[0]?.amount || 0);

    // Hospital KPIs
    const [hospRows] = await pool.query("SELECT COUNT(*) as total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active, SUM(CASE WHEN status='inactive' THEN 1 ELSE 0 END) as inactive FROM hospitals");
    const totalHospitals = Number(hospRows[0]?.total || 0);
    const activeHospitals = Number(hospRows[0]?.active || 0);
    const inactiveHospitals = Number(hospRows[0]?.inactive || 0);

    // Jobs KPIs
    const [jobRows] = await pool.query("SELECT COUNT(*) as total, SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) as open, SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) as closed FROM jobs");
    const totalJobs = Number(jobRows[0]?.total || 0);
    const openJobs = Number(jobRows[0]?.open || 0);
    const closedJobs = Number(jobRows[0]?.closed || 0);

    // Applicant KPIs
    const [appRows] = await pool.query("SELECT COUNT(*) as total, SUM(CASE WHEN candidate_status='active' THEN 1 ELSE 0 END) as active, SUM(CASE WHEN candidate_status='rejected' THEN 1 ELSE 0 END) as rejected FROM applicants");
    const activeCandidates = Number(appRows[0]?.active || 0);

    // Offers & Placements
    const [offerRows] = await pool.query("SELECT COUNT(DISTINCT application_id) as count FROM application_stage_history WHERE new_stage = 'offer_released' AND DATE_FORMAT(changed_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')");
    const offersReleased = Number(offerRows[0]?.count || 0);

    const [placementRows] = await pool.query("SELECT COUNT(DISTINCT application_id) as count FROM application_stage_history WHERE new_stage = 'selected' AND DATE_FORMAT(changed_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')");
    const placements = Number(placementRows[0]?.count || 0);

    // Employee KPIs
    const [empActiveRows] = await pool.query("SELECT COUNT(*) as total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active FROM users WHERE role IN ('employee','admin')");
    const totalEmployees = Number(empActiveRows[0]?.total || 0);
    const activeEmployees = Number(empActiveRows[0]?.active || 0);

    const [onlineRows] = await pool.query("SELECT COUNT(DISTINCT user_id) as count FROM employee_logs WHERE logout_time IS NULL AND DATE(login_time) = CURDATE()");
    const employeesOnline = Number(onlineRows[0]?.count || 0);

    const [attendanceTodayRows] = await pool.query("SELECT COUNT(DISTINCT user_id) as count FROM employee_logs WHERE DATE(login_time) = CURDATE()");
    const attendanceToday = Number(attendanceTodayRows[0]?.count || 0);

    const [leavesTodayRows] = await pool.query("SELECT COUNT(*) as count FROM leaves WHERE leave_status = 'approved' AND CURDATE() BETWEEN start_date AND end_date");
    const leavesToday = Number(leavesTodayRows[0]?.count || 0);

    // Top Performers (this month)
    const [topPerformers] = await pool.query(`
      SELECT u.id, u.full_name,
        COUNT(DISTINCT CASE WHEN ash.new_stage = 'selected' THEN ash.application_id END) as placements
      FROM users u
      LEFT JOIN application_stage_history ash ON u.id = ash.changed_by AND ash.new_stage = 'selected' AND DATE_FORMAT(ash.changed_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')
      WHERE u.status = 'active' AND u.role IN ('employee', 'admin')
      GROUP BY u.id ORDER BY placements DESC LIMIT 5
    `);

    // Monthly Revenue per Hospital
    const [revenuePerHospital] = await pool.query(`
      SELECT h.name, SUM(inv.invoice_amount) as revenue
      FROM invoices inv JOIN hospitals h ON inv.hospital_id = h.id
      WHERE inv.payment_status = 'paid' AND DATE_FORMAT(inv.payment_received_date, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')
      GROUP BY h.id ORDER BY revenue DESC LIMIT 5
    `);

    // Monthly Revenue per Recruiter
    const [revenuePerRecruiter] = await pool.query(`
      SELECT u.full_name, SUM(inv.invoice_amount) as revenue
      FROM invoices inv
      JOIN applications app ON inv.applicant_id = app.applicant_id AND inv.job_id = app.job_id
      JOIN users u ON app.created_by = u.id
      WHERE inv.payment_status = 'paid' AND DATE_FORMAT(inv.payment_received_date, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')
      GROUP BY u.id ORDER BY revenue DESC LIMIT 5
    `);

    // Charts data - Monthly Placements (last 6 months)
    const [monthlyPlacements] = await pool.query(`
      SELECT DATE_FORMAT(changed_at, '%Y-%m') as month, COUNT(DISTINCT application_id) as count
      FROM application_stage_history WHERE new_stage = 'selected'
      AND changed_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month ORDER BY month
    `);

    // Revenue Trend (last 6 months)
    const [revenueTrend] = await pool.query(`
      SELECT DATE_FORMAT(payment_received_date, '%Y-%m') as month, SUM(invoice_amount) as revenue
      FROM invoices WHERE payment_status = 'paid'
      AND payment_received_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month ORDER BY month
    `);

    // Recruitment Funnel
    const [funnel] = await pool.query(`
      SELECT current_stage, COUNT(*) as count FROM applications
      GROUP BY current_stage ORDER BY FIELD(current_stage, 'applied','assigned','resume_review','matched','hospital_submission','interview_scheduled','interview_completed','offer_released','selected','joined','rejected','returned_to_pool','archived')
    `);

    // Hospital Growth (last 6 months)
    const [hospitalGrowth] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
      FROM hospitals WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month ORDER BY month
    `);

    // Referral Growth
    const [referralGrowth] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
      FROM referral_rewards WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month ORDER BY month
    `);

    // Pending Tasks
    const [pendingTasks] = await pool.query("SELECT COUNT(*) as count FROM tasks WHERE status != 'completed'");
    const pendingTasksCount = Number(pendingTasks[0]?.count || 0);

    // Upcoming Interviews
    const [upcomingInterviews] = await pool.query("SELECT COUNT(*) as count FROM interviews WHERE interview_date >= CURDATE() AND status = 'scheduled'");
    const upcomingInterviewsCount = Number(upcomingInterviews[0]?.count || 0);

    return ok(res, {
      recruitment: {
        totalHospitals, activeHospitals, inactiveHospitals,
        totalJobs, openJobs, closedJobs,
        totalApplicants, activeCandidates, poolCandidates, candidatesInPipeline,
        interviewsScheduled, offersReleased, placements, rejectedCandidates
      },
      employees: {
        totalEmployees, activeEmployees, employeesOnline,
        attendanceToday, leavesToday, topPerformers
      },
      finance: {
        revenueGenerated, pendingInvoices, outstandingAmount,
        overdueInvoices, overdueAmount, pendingSalaries: salaryStats.pendingSalaries || 0,
        revenuePerHospital, revenuePerRecruiter
      },
      productivity: {
        pendingTasks: pendingTasksCount, upcomingInterviews: upcomingInterviewsCount,
        pendingLeaves: leaveStats.pendingLeaves || 0
      },
      charts: {
        monthlyPlacements, revenueTrend, funnel, hospitalGrowth, referralGrowth
      },
      recentApplicants
    }, 'Executive dashboard stats');
  } catch (err) {
    return fail(res, 500, 'Failed to load dashboard stats');
  }
}

module.exports = {
  stats
};
