'use strict';

const JobModel = require('../models/jobModel');
const ApplicantModel = require('../models/applicantModel');
const ApplicationModel = require('../models/applicationModel');
const InterviewModel = require('../models/interviewModel');
const EmployeeModel = require('../models/employeeModel');
const EmployeeLogModel = require('../models/employeeLogModel');
const LeaveModel = require('../models/leaveModel');
const SalaryModel = require('../models/salaryModel');
const CalendarModel = require('../models/calendarModel');
const RecruiterTargetModel = require('../models/recruiterTargetModel');
const { getPool } = require('../config/db');
const { ok, fail } = require('../utils/response');

async function dashboard(req, res) {
  try {
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
      salaryStats,
      upcomingTasks
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
      SalaryModel.stats(),
      CalendarModel.getUpcoming(req.user.id, req.user.role)
    ]);

    const pool = getPool();
    
    // Total Revenue (all paid invoices ever)
    const [revRows] = await pool.query(`SELECT SUM(invoice_amount) as total FROM invoices WHERE payment_status = 'paid'`);
    const revenueGenerated = Number(revRows[0]?.total || 0);

    // Pending Invoices
    const [pendingInvRows] = await pool.query(`SELECT COUNT(*) as count FROM invoices WHERE payment_status = 'pending'`);
    const pendingInvoices = Number(pendingInvRows[0]?.count || 0);

    // Paid Invoices count
    const [paidInvRows] = await pool.query(`SELECT COUNT(*) as count FROM invoices WHERE payment_status = 'paid'`);
    const paidInvoices = Number(paidInvRows[0]?.count || 0);

    // Pending Referral Rewards
    const [refRows] = await pool.query(`SELECT COUNT(*) as count FROM referral_rewards WHERE reward_status = 'pending'`);
    const pendingReferrals = Number(refRows[0]?.count || 0);

    // Total Hospitals
    const [hospRows] = await pool.query(`SELECT COUNT(*) as count FROM hospitals`);
    const totalHospitals = Number(hospRows[0]?.count || 0);

    return ok(res, {
      totalHospitals,
      activeJobs,
      totalApplicants,
      interviewsScheduled,
      selectedCandidates,
      rejectedCandidates,
      candidatesInPipeline,
      revenueGenerated,
      pendingInvoices,
      paidInvoices,
      pendingReferrals,
      poolCandidates,
      totalEmployees: empStats.totalEmployees,
      presentToday,
      pendingLeaves: leaveStats.pendingLeaves,
      pendingSalaries: salaryStats.pendingSalaries ?? 0,
      upcomingTasksCount: upcomingTasks.length,
      upcomingTasks,
      recentApplicants,
      monthlyProgress: await getMonthlyProgressRaw()
    }, 'Executive dashboard stats');
  } catch (err) {
    return fail(res, 500, 'Failed to load dashboard stats');
  }
}

async function getMonthlyProgressRaw() {
  const pool = getPool();
  const month = new Date().toISOString().slice(0, 7);
  const [projRows] = await pool.query(`SELECT * FROM monthly_projections WHERE month = ?`, [month]);
  const proj = projRows[0];

  if (!proj) return null;

  const [revRows] = await pool.query(`SELECT SUM(invoice_amount) as achieved FROM invoices WHERE payment_status = 'paid' AND DATE_FORMAT(payment_received_date, '%Y-%m') = ?`, [month]);
  const [hireRows] = await pool.query(`SELECT COUNT(*) as achieved FROM application_stage_history WHERE new_stage = 'selected' AND DATE_FORMAT(changed_at, '%Y-%m') = ?`, [month]);

  return {
    month,
    targetRevenue: proj.revenue_target,
    achievedRevenue: Number(revRows[0]?.achieved || 0),
    targetHires: proj.hiring_target,
    achievedHires: Number(hireRows[0]?.achieved || 0)
  };
}

async function performance(req, res) {
  try {
    const pool = getPool();
    const month = req.query.month || new Date().toISOString().slice(0, 7);

    // 1. Fetch all active employees / recruiters
    const [recruiters] = await pool.query(
      `SELECT id, full_name, email, role, status FROM users WHERE status = 'active'`
    );

    // 2. Fetch targets for this month
    const targets = await RecruiterTargetModel.getTargets(month);
    const targetMap = new Map(targets.map(t => [Number(t.recruiter_id), t]));

    // 3. Fetch submissions achievements (applications created by recruiter in this month)
    const [subs] = await pool.query(
      `SELECT created_by, COUNT(*) as count FROM applications WHERE DATE_FORMAT(created_at, '%Y-%m') = ? GROUP BY created_by`,
      [month]
    );
    const subMap = new Map(subs.map(s => [Number(s.created_by), Number(s.count)]));

    // 4. Fetch selections achievements (hires count changed by recruiter in this month)
    const [selections] = await pool.query(
      `SELECT changed_by, COUNT(DISTINCT application_id) as count 
       FROM application_stage_history 
       WHERE new_stage = 'selected' AND DATE_FORMAT(changed_at, '%Y-%m') = ? 
       GROUP BY changed_by`,
      [month]
    );
    const selMap = new Map(selections.map(s => [Number(s.changed_by), Number(s.count)]));

    // 5. Fetch revenue achievements (sum of paid invoices placed by recruiter, i.e., applicant created_by)
    const [rev] = await pool.query(
      `SELECT app.created_by, SUM(inv.invoice_amount) as total 
       FROM invoices inv 
       JOIN applications app ON inv.applicant_id = app.applicant_id AND inv.job_id = app.job_id 
       WHERE inv.payment_status = 'paid' AND DATE_FORMAT(inv.payment_received_date, '%Y-%m') = ? 
       GROUP BY app.created_by`,
      [month]
    );
    const revMap = new Map(rev.map(r => [Number(r.created_by), Number(r.total || 0)]));

    // 6. Fetch candidates added count
    const [added] = await pool.query(
      `SELECT created_by, COUNT(*) as count FROM applicants WHERE DATE_FORMAT(created_at, '%Y-%m') = ? GROUP BY created_by`,
      [month]
    );
    const addedMap = new Map(added.map(a => [Number(a.created_by), Number(a.count)]));

    // 7. Fetch tasks completed count
    const [tasksCompleted] = await pool.query(
      `SELECT assigned_to, COUNT(*) as count FROM tasks WHERE status = 'completed' AND DATE_FORMAT(completed_at, '%Y-%m') = ? GROUP BY assigned_to`,
      [month]
    );
    const taskMap = new Map(tasksCompleted.map(t => [Number(t.assigned_to), Number(t.count)]));

    // Assemble individual recruiter metrics
    const list = recruiters.map(r => {
      const target = targetMap.get(r.id) || { submissions_target: 0, selections_target: 0, revenue_target: 0.00 };
      const subCount = subMap.get(r.id) || 0;
      const selCount = selMap.get(r.id) || 0;
      const revTotal = revMap.get(r.id) || 0;
      const addCount = addedMap.get(r.id) || 0;
      const taskCount = taskMap.get(r.id) || 0;

      return {
        recruiter_id: r.id,
        recruiter_name: r.full_name,
        email: r.email,
        role: r.role,
        submissions_target: Number(target.submissions_target),
        submissions_achieved: subCount,
        selections_target: Number(target.selections_target),
        selections_achieved: selCount,
        revenue_target: Number(target.revenue_target),
        revenue_achieved: revTotal,
        candidates_added: addCount,
        tasks_completed: taskCount
      };
    });

    // Leaderboard sorted by selections_achieved descending, then revenue_achieved descending
    const leaderboard = [...list].sort((a, b) => {
      if (b.selections_achieved !== a.selections_achieved) {
        return b.selections_achieved - a.selections_achieved;
      }
      return b.revenue_achieved - a.revenue_achieved;
    });

    return ok(res, { month, recruiters: list, leaderboard }, 'Recruiter performance statistics');
  } catch (err) {
    return fail(res, 500, 'Failed to load recruiter performance stats');
  }
}

async function revenueSummary(req, res) {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT DATE_FORMAT(payment_date, '%Y-%m') as month, SUM(invoice_amount) as total
      FROM invoices 
      WHERE payment_status = 'paid' 
      GROUP BY month 
      ORDER BY month DESC 
      LIMIT 12
    `);
    return ok(res, { history: rows }, 'Revenue history');
  } catch (err) {
    return fail(res, 500, 'Failed to load revenue summary');
  }
}

async function pipelineFunnel(req, res) {
  try {
    const pool = getPool();
    const fromDate = req.query.fromDate || null;
    const toDate = req.query.toDate || null;

    let q = `
      SELECT current_stage as stage, COUNT(*) as count
      FROM applications WHERE 1=1
    `;
    const params = [];
    if (fromDate) { q += ` AND created_at >= ?`; params.push(fromDate); }
    if (toDate) { q += ` AND created_at <= ?`; params.push(toDate + ' 23:59:59'); }
    q += ` GROUP BY current_stage ORDER BY FIELD(current_stage, 'applied','screening','shortlisted','sent_to_hospital','interview_scheduled','interview_completed','offer_released','selected','joined','rejected','moved_to_pool','archived')`;

    const [rows] = await pool.query(q, params);
    const total = rows.reduce((sum, r) => sum + Number(r.count), 0);

    const funnel = rows.map(r => ({
      stage: r.stage,
      count: Number(r.count),
      percentage: total > 0 ? Math.round((Number(r.count) / total) * 10000) / 100 : 0
    }));

    return ok(res, { total, funnel }, 'Pipeline funnel analytics');
  } catch (err) {
    return fail(res, 500, 'Failed to load pipeline funnel');
  }
}

async function hospitalAnalytics(req, res) {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT 
        h.id, h.name, h.city, h.onboarding_status,
        COUNT(DISTINCT j.id) as total_jobs,
        COALESCE(SUM(j.filled_count), 0) as total_placements,
        COALESCE(inv_agg.total_revenue, 0) as total_revenue,
        COALESCE(inv_agg.pending_revenue, 0) as pending_revenue,
        COALESCE(inv_agg.invoice_count, 0) as invoice_count
      FROM hospitals h
      LEFT JOIN jobs j ON j.hospital_id = h.id
      LEFT JOIN (
        SELECT hospital_id,
          SUM(CASE WHEN payment_status = 'paid' THEN invoice_amount ELSE 0 END) as total_revenue,
          SUM(CASE WHEN payment_status IN ('pending','overdue') THEN invoice_amount ELSE 0 END) as pending_revenue,
          COUNT(*) as invoice_count
        FROM invoices GROUP BY hospital_id
      ) inv_agg ON inv_agg.hospital_id = h.id
      GROUP BY h.id
      ORDER BY total_placements DESC
    `);

    return ok(res, { hospitals: rows }, 'Hospital analytics');
  } catch (err) {
    return fail(res, 500, 'Failed to load hospital analytics');
  }
}

async function interviewAnalytics(req, res) {
  try {
    const pool = getPool();
    const fromDate = req.query.fromDate || null;
    const toDate = req.query.toDate || null;

    let q = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN result = 'selected' THEN 1 ELSE 0 END) as selected,
        SUM(CASE WHEN result = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN result = 'hold' THEN 1 ELSE 0 END) as on_hold,
        SUM(CASE WHEN result IS NULL OR result = 'pending' THEN 1 ELSE 0 END) as pending
      FROM interviews WHERE 1=1
    `;
    const params = [];
    if (fromDate) { q += ` AND interview_date >= ?`; params.push(fromDate); }
    if (toDate) { q += ` AND interview_date <= ?`; params.push(toDate); }

    const [rows] = await pool.query(q, params);
    const summary = rows[0] || { total: 0, selected: 0, rejected: 0, on_hold: 0, pending: 0 };
    const successRate = Number(summary.total) > 0
      ? Math.round((Number(summary.selected) / Number(summary.total)) * 10000) / 100
      : 0;

    // Monthly trend
    let trendQ = `
      SELECT DATE_FORMAT(interview_date, '%Y-%m') as month,
        COUNT(*) as total,
        SUM(CASE WHEN result = 'selected' THEN 1 ELSE 0 END) as selected
      FROM interviews WHERE interview_date IS NOT NULL
      GROUP BY month ORDER BY month DESC LIMIT 12
    `;
    const [trend] = await pool.query(trendQ);

    return ok(res, { summary: { ...summary, successRate }, trend }, 'Interview analytics');
  } catch (err) {
    return fail(res, 500, 'Failed to load interview analytics');
  }
}

async function referralAnalytics(req, res) {
  try {
    const pool = getPool();

    // Top referrers
    const [topReferrers] = await pool.query(`
      SELECT 
        rr.referrer_name,
        COUNT(*) as total_referrals,
        SUM(CASE WHEN rr.reward_status IN ('eligible','rewarded') THEN 1 ELSE 0 END) as successful,
        COALESCE(SUM(CASE WHEN rr.reward_status = 'rewarded' THEN rr.reward_amount END), 0) as total_paid,
        ROUND(SUM(CASE WHEN rr.reward_status IN ('eligible','rewarded') THEN 1 ELSE 0 END) / COUNT(*) * 100, 1) as conversion_rate
      FROM referral_rewards rr
      GROUP BY rr.referrer_name
      ORDER BY successful DESC
      LIMIT 20
    `);

    // Summary totals
    const [summary] = await pool.query(`
      SELECT
        COUNT(*) as total_referrals,
        COUNT(DISTINCT referrer_name) as unique_referrers,
        SUM(CASE WHEN reward_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN reward_status = 'eligible' THEN 1 ELSE 0 END) as eligible,
        SUM(CASE WHEN reward_status = 'rewarded' THEN 1 ELSE 0 END) as rewarded,
        COALESCE(SUM(CASE WHEN reward_status = 'rewarded' THEN reward_amount END), 0) as total_rewards_paid,
        COALESCE(SUM(CASE WHEN reward_status = 'eligible' THEN reward_amount END), 0) as total_rewards_pending
      FROM referral_rewards
    `);

    return ok(res, {
      summary: summary[0] || {},
      topReferrers
    }, 'Referral analytics');
  } catch (err) {
    return fail(res, 500, 'Failed to load referral analytics');
  }
}

async function getMyPerformance(req, res) {
  try {
    const pool = getPool();
    const userId = req.user.id;
    const month = new Date().toISOString().slice(0, 7);

    // 1. Fetch Today's Summary
    const [[{ assigned_count }]] = await pool.query('SELECT COUNT(*) as assigned_count FROM applicants WHERE attended_by = ?', [userId]);
    const [[{ followups_count }]] = await pool.query("SELECT COUNT(*) as followups_count FROM candidate_follow_ups WHERE employee_id = ? AND status = 'pending'", [userId]);
    const [[{ interviews_count }]] = await pool.query(`
      SELECT COUNT(*) as interviews_count 
      FROM interviews i 
      JOIN applicants a ON i.applicant_id = a.id 
      WHERE a.attended_by = ? AND i.interview_date = CURDATE()
    `, [userId]);
    const [[{ tasks_count }]] = await pool.query("SELECT COUNT(*) as tasks_count FROM tasks WHERE assigned_to = ? AND due_date = CURDATE() AND status != 'completed'", [userId]);
    const [[{ new_assignments_count }]] = await pool.query("SELECT COUNT(*) as new_assignments_count FROM applicants WHERE attended_by = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)", [userId]);
    const [[{ notifications_count }]] = await pool.query('SELECT COUNT(*) as notifications_count FROM notifications WHERE user_id = ? AND is_read = 0', [userId]);

    const todaySummary = {
      assignedCandidates: assigned_count,
      pendingFollowups: followups_count,
      todayInterviews: interviews_count,
      tasksDueToday: tasks_count,
      newAssignments: new_assignments_count,
      unreadNotifications: notifications_count
    };

    // 2. Fetch monthly target from DB or default
    const [targets] = await pool.query('SELECT * FROM recruiter_targets WHERE recruiter_id = ? AND month = ? LIMIT 1', [userId, month]);
    const monthlyTarget = targets[0] || { submissions_target: 20, selections_target: 8, revenue_target: 20000 };

    const weeklyTarget = {
      submissions_target: 5,
      selections_target: 2,
      revenue_target: 5000
    };

    const quarterlyTarget = {
      submissions_target: 60,
      selections_target: 24,
      revenue_target: 60000
    };

    // 3. Submissions achievements
    const [[{ sub_week }]] = await pool.query("SELECT COUNT(*) as count FROM applications WHERE created_by = ? AND YEARWEEK(created_at, 1) = YEARWEEK(NOW(), 1)", [userId]);
    const [[{ sub_month }]] = await pool.query("SELECT COUNT(*) as count FROM applications WHERE created_by = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?", [userId, month]);
    const [[{ sub_quarter }]] = await pool.query("SELECT COUNT(*) as count FROM applications WHERE created_by = ? AND QUARTER(created_at) = QUARTER(NOW()) AND YEAR(created_at) = YEAR(NOW())", [userId]);

    // 4. Selections achievements
    const [[{ sel_week }]] = await pool.query(`
      SELECT COUNT(DISTINCT application_id) as count 
      FROM application_stage_history 
      WHERE new_stage = 'selected' AND changed_by = ? AND YEARWEEK(changed_at, 1) = YEARWEEK(NOW(), 1)
    `, [userId]);
    const [[{ sel_month }]] = await pool.query(`
      SELECT COUNT(DISTINCT application_id) as count 
      FROM application_stage_history 
      WHERE new_stage = 'selected' AND changed_by = ? AND DATE_FORMAT(changed_at, '%Y-%m') = ?
    `, [userId, month]);
    const [[{ sel_quarter }]] = await pool.query(`
      SELECT COUNT(DISTINCT application_id) as count 
      FROM application_stage_history 
      WHERE new_stage = 'selected' AND changed_by = ? AND QUARTER(changed_at) = QUARTER(NOW()) AND YEAR(changed_at) = YEAR(NOW())
    `, [userId]);

    // 5. Revenue achievements
    const [[{ rev_week }]] = await pool.query(`
      SELECT SUM(inv.invoice_amount) as total 
      FROM invoices inv 
      JOIN applications app ON inv.applicant_id = app.applicant_id AND inv.job_id = app.job_id 
      WHERE inv.payment_status = 'paid' AND app.created_by = ? AND YEARWEEK(inv.payment_received_date, 1) = YEARWEEK(NOW(), 1)
    `, [userId]);
    const [[{ rev_month }]] = await pool.query(`
      SELECT SUM(inv.invoice_amount) as total 
      FROM invoices inv 
      JOIN applications app ON inv.applicant_id = app.applicant_id AND inv.job_id = app.job_id 
      WHERE inv.payment_status = 'paid' AND app.created_by = ? AND DATE_FORMAT(inv.payment_received_date, '%Y-%m') = ?
    `, [userId, month]);
    const [[{ rev_quarter }]] = await pool.query(`
      SELECT SUM(inv.invoice_amount) as total 
      FROM invoices inv 
      JOIN applications app ON inv.applicant_id = app.applicant_id AND inv.job_id = app.job_id 
      WHERE inv.payment_status = 'paid' AND app.created_by = ? AND QUARTER(inv.payment_received_date) = QUARTER(NOW()) AND YEAR(inv.payment_received_date) = YEAR(NOW())
    `, [userId]);

    // Assemble Performance Stats
    const stats = {
      weekly: {
        submissions: { target: weeklyTarget.submissions_target, achieved: sub_week, pct: Math.min(100, Math.round((sub_week / weeklyTarget.submissions_target) * 100)) },
        selections: { target: weeklyTarget.selections_target, achieved: sel_week, pct: Math.min(100, Math.round((sel_week / weeklyTarget.selections_target) * 100)) },
        revenue: { target: weeklyTarget.revenue_target, achieved: rev_week || 0, pct: Math.min(100, Math.round(((rev_week || 0) / weeklyTarget.revenue_target) * 100)) }
      },
      monthly: {
        submissions: { target: Number(monthlyTarget.submissions_target), achieved: sub_month, pct: Math.min(100, Math.round((sub_month / Number(monthlyTarget.submissions_target)) * 100)) },
        selections: { target: Number(monthlyTarget.selections_target), achieved: sel_month, pct: Math.min(100, Math.round((sel_month / Number(monthlyTarget.selections_target)) * 100)) },
        revenue: { target: Number(monthlyTarget.revenue_target), achieved: rev_month || 0, pct: Math.min(100, Math.round(((rev_month || 0) / Number(monthlyTarget.revenue_target)) * 100)) }
      },
      quarterly: {
        submissions: { target: quarterlyTarget.submissions_target, achieved: sub_quarter, pct: Math.min(100, Math.round((sub_quarter / quarterlyTarget.submissions_target) * 100)) },
        selections: { target: quarterlyTarget.selections_target, achieved: sel_quarter, pct: Math.min(100, Math.round((sel_quarter / quarterlyTarget.selections_target) * 100)) },
        revenue: { target: quarterlyTarget.revenue_target, achieved: rev_quarter || 0, pct: Math.min(100, Math.round(((rev_quarter || 0) / quarterlyTarget.revenue_target) * 100)) }
      }
    };

    // Calculate Leaderboard position
    const [recruiters] = await pool.query("SELECT id FROM users WHERE status = 'active'");
    const rankList = [];
    for (const r of recruiters) {
      const [[{ rSel }]] = await pool.query(`
        SELECT COUNT(DISTINCT application_id) as count 
        FROM application_stage_history 
        WHERE new_stage = 'selected' AND changed_by = ? AND DATE_FORMAT(changed_at, '%Y-%m') = ?
      `, [r.id, month]);
      const [[{ rRev }]] = await pool.query(`
        SELECT SUM(inv.invoice_amount) as total 
        FROM invoices inv 
        JOIN applications app ON inv.applicant_id = app.applicant_id AND inv.job_id = app.job_id 
        WHERE inv.payment_status = 'paid' AND app.created_by = ? AND DATE_FORMAT(inv.payment_received_date, '%Y-%m') = ?
      `, [r.id, month]);

      rankList.push({
        id: r.id,
        selections: rSel || 0,
        revenue: rRev || 0
      });
    }

    rankList.sort((a, b) => {
      if (b.selections !== a.selections) return b.selections - a.selections;
      return b.revenue - a.revenue;
    });

    const myRankIndex = rankList.findIndex(x => Number(x.id) === Number(userId));
    stats.leaderboardPosition = myRankIndex !== -1 ? myRankIndex + 1 : rankList.length + 1;

    return ok(res, { todaySummary, stats }, 'My performance statistics loaded');
  } catch (err) {
    return fail(res, 500, 'Failed to load my performance: ' + err.message);
  }
}

async function getLeaderboard(req, res) {
  try {
    const pool = getPool();
    const month = new Date().toISOString().slice(0, 7);

    const [recruiters] = await pool.query("SELECT id, full_name, email FROM users WHERE status = 'active'");
    const list = [];
    for (const r of recruiters) {
      const [[{ rSel }]] = await pool.query(`
        SELECT COUNT(DISTINCT application_id) as count 
        FROM application_stage_history 
        WHERE new_stage = 'selected' AND changed_by = ? AND DATE_FORMAT(changed_at, '%Y-%m') = ?
      `, [r.id, month]);
      const [[{ rRev }]] = await pool.query(`
        SELECT SUM(inv.invoice_amount) as total 
        FROM invoices inv 
        JOIN applications app ON inv.applicant_id = app.applicant_id AND inv.job_id = app.job_id 
        WHERE inv.payment_status = 'paid' AND app.created_by = ? AND DATE_FORMAT(inv.payment_received_date, '%Y-%m') = ?
      `, [r.id, month]);

      list.push({
        id: r.id,
        full_name: r.full_name,
        email: r.email,
        selections: rSel || 0,
        revenue: rRev || 0
      });
    }

    list.sort((a, b) => {
      if (b.selections !== a.selections) return b.selections - a.selections;
      return b.revenue - a.revenue;
    });

    return ok(res, { leaderboard: list }, 'Recruiter leaderboard loaded');
  } catch (err) {
    return fail(res, 500, 'Failed to load leaderboard');
  }
}

module.exports = {
  dashboard,
  performance,
  revenueSummary,
  pipelineFunnel,
  hospitalAnalytics,
  interviewAnalytics,
  referralAnalytics,
  getMyPerformance,
  getLeaderboard
};
