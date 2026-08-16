'use strict';

const { getPool } = require('../config/db');
const { generatePDF } = require('../utils/pdfExportUtil');
const { generateCSV } = require('../utils/csvExportUtil');
const { ok, fail } = require('../utils/response');

async function getReportData(type, filters) {
  const pool = getPool();
  const fromDate = filters.fromDate || null;
  const toDate = filters.toDate || null;
  
  if (type === 'hospitals') {
    const [rows] = await pool.query(`SELECT id, name, city, state, email, commission_percentage, status, onboarding_status FROM hospitals ORDER BY name ASC`);
    return rows;
  }
  
  if (type === 'jobs') {
    const [rows] = await pool.query(`
      SELECT j.id, j.job_title, h.name as hospital, j.department, j.priority_level, j.status, j.filled_count, j.openings_count
      FROM jobs j 
      JOIN hospitals h ON j.hospital_id = h.id 
      ORDER BY j.created_at DESC
    `);
    return rows;
  }

  if (type === 'applicants') {
    const [rows] = await pool.query(`SELECT id, full_name, email, phone, expected_salary, candidate_status, source FROM applicants ORDER BY created_at DESC`);
    return rows;
  }

  if (type === 'revenue') {
    let q = `SELECT invoice_number, invoice_amount, candidate_salary, commission_percentage, payment_status, payment_date FROM invoices WHERE 1=1`;
    const params = [];
    if (filters.status) {
      q += ` AND payment_status = ?`;
      params.push(filters.status);
    }
    if (fromDate) { q += ` AND invoice_date >= ?`; params.push(fromDate); }
    if (toDate) { q += ` AND invoice_date <= ?`; params.push(toDate); }
    q += ` ORDER BY created_at DESC`;
    const [rows] = await pool.query(q, params);
    return rows;
  }

  if (type === 'employee_performance') {
    const [rows] = await pool.query(`SELECT id, full_name, email, role, department, status FROM users`);
    return rows;
  }

  // --- Phase 5 Report Types ---

  if (type === 'pipeline_funnel') {
    let q = `
      SELECT 
        current_stage as stage,
        COUNT(*) as count
      FROM applications
      WHERE 1=1
    `;
    const params = [];
    if (fromDate) { q += ` AND created_at >= ?`; params.push(fromDate); }
    if (toDate) { q += ` AND created_at <= ?`; params.push(toDate + ' 23:59:59'); }
    q += ` GROUP BY current_stage ORDER BY FIELD(current_stage, 'applied','screening','shortlisted','sent_to_hospital','interview_scheduled','interview_completed','offer_released','selected','joined','rejected','moved_to_pool','archived')`;
    const [rows] = await pool.query(q, params);

    // Calculate conversion percentages
    const total = rows.reduce((sum, r) => sum + Number(r.count), 0);
    return rows.map(r => ({
      stage: r.stage,
      count: Number(r.count),
      percentage: total > 0 ? Math.round((Number(r.count) / total) * 10000) / 100 : 0
    }));
  }

  if (type === 'recruiter_productivity') {
    const month = filters.month || new Date().toISOString().slice(0, 7);
    const [rows] = await pool.query(`
      SELECT 
        u.id as recruiter_id,
        u.full_name as recruiter_name,
        u.email,
        COALESCE(sub.submissions, 0) as submissions,
        COALESCE(sel.selections, 0) as selections,
        COALESCE(rev.revenue, 0) as revenue_generated,
        COALESCE(cand.candidates_added, 0) as candidates_added,
        COALESCE(tc.tasks_completed, 0) as tasks_completed
      FROM users u
      LEFT JOIN (
        SELECT created_by, COUNT(*) as submissions
        FROM applications WHERE DATE_FORMAT(created_at, '%Y-%m') = ?
        GROUP BY created_by
      ) sub ON sub.created_by = u.id
      LEFT JOIN (
        SELECT changed_by, COUNT(DISTINCT application_id) as selections
        FROM application_stage_history WHERE new_stage = 'selected' AND DATE_FORMAT(changed_at, '%Y-%m') = ?
        GROUP BY changed_by
      ) sel ON sel.changed_by = u.id
      LEFT JOIN (
        SELECT app.created_by, SUM(inv.invoice_amount) as revenue
        FROM invoices inv
        JOIN applications app ON inv.applicant_id = app.applicant_id AND inv.job_id = app.job_id
        WHERE inv.payment_status = 'paid' AND DATE_FORMAT(inv.payment_received_date, '%Y-%m') = ?
        GROUP BY app.created_by
      ) rev ON rev.created_by = u.id
      LEFT JOIN (
        SELECT created_by, COUNT(*) as candidates_added
        FROM applicants WHERE DATE_FORMAT(created_at, '%Y-%m') = ?
        GROUP BY created_by
      ) cand ON cand.created_by = u.id
      LEFT JOIN (
        SELECT assigned_to, COUNT(*) as tasks_completed
        FROM tasks WHERE status = 'completed' AND DATE_FORMAT(completed_at, '%Y-%m') = ?
        GROUP BY assigned_to
      ) tc ON tc.assigned_to = u.id
      WHERE u.status = 'active'
      ORDER BY selections DESC, revenue_generated DESC
    `, [month, month, month, month, month]);
    return rows;
  }

  if (type === 'hospital_placements') {
    let q = `
      SELECT 
        h.id as hospital_id,
        h.name as hospital_name,
        h.city,
        h.commission_percentage,
        h.onboarding_status,
        COUNT(DISTINCT CASE WHEN ash.new_stage = 'selected' THEN ash.application_id END) as placements,
        COUNT(DISTINCT CASE WHEN ash.new_stage = 'joined' THEN ash.application_id END) as joined,
        COALESCE(SUM(CASE WHEN inv.payment_status = 'paid' THEN inv.invoice_amount END), 0) as revenue_collected,
        COALESCE(SUM(CASE WHEN inv.payment_status IN ('pending','overdue') THEN inv.invoice_amount END), 0) as revenue_pending,
        COUNT(DISTINCT a.id) as total_applications
      FROM hospitals h
      LEFT JOIN jobs j ON j.hospital_id = h.id
      LEFT JOIN applications a ON a.job_id = j.id
      LEFT JOIN application_stage_history ash ON ash.application_id = a.id
      LEFT JOIN invoices inv ON inv.hospital_id = h.id
      WHERE 1=1
    `;
    const params = [];
    if (fromDate) { q += ` AND (ash.changed_at >= ? OR ash.changed_at IS NULL)`; params.push(fromDate); }
    if (toDate) { q += ` AND (ash.changed_at <= ? OR ash.changed_at IS NULL)`; params.push(toDate + ' 23:59:59'); }
    q += ` GROUP BY h.id ORDER BY placements DESC`;
    const [rows] = await pool.query(q, params);
    return rows;
  }

  if (type === 'interview_success') {
    let q = `
      SELECT 
        h.name as hospital_name,
        u.full_name as recruiter_name,
        COUNT(*) as total_interviews,
        SUM(CASE WHEN i.result = 'selected' THEN 1 ELSE 0 END) as selected,
        SUM(CASE WHEN i.result = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN i.result = 'hold' THEN 1 ELSE 0 END) as on_hold,
        SUM(CASE WHEN i.result IS NULL OR i.result = 'pending' THEN 1 ELSE 0 END) as pending,
        ROUND(SUM(CASE WHEN i.result = 'selected' THEN 1 ELSE 0 END) / COUNT(*) * 100, 1) as success_rate
      FROM interviews i
      JOIN hospitals h ON i.hospital_id = h.id
      LEFT JOIN applicants a ON i.applicant_id = a.id
      LEFT JOIN users u ON a.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (fromDate) { q += ` AND i.interview_date >= ?`; params.push(fromDate); }
    if (toDate) { q += ` AND i.interview_date <= ?`; params.push(toDate); }
    if (filters.hospital_id) { q += ` AND h.id = ?`; params.push(filters.hospital_id); }
    q += ` GROUP BY h.id, a.created_by ORDER BY success_rate DESC`;
    const [rows] = await pool.query(q, params);
    return rows;
  }

  if (type === 'referral_analytics' || type === 'referrals') {
    const [rows] = await pool.query(`
      SELECT 
        rr.referrer_name,
        COUNT(*) as total_referrals,
        SUM(CASE WHEN rr.reward_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN rr.reward_status = 'eligible' THEN 1 ELSE 0 END) as eligible,
        SUM(CASE WHEN rr.reward_status = 'rewarded' THEN 1 ELSE 0 END) as rewarded,
        COALESCE(SUM(CASE WHEN rr.reward_status = 'rewarded' THEN rr.reward_amount END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN rr.reward_status = 'eligible' THEN rr.reward_amount END), 0) as total_pending_payout,
        ROUND(SUM(CASE WHEN rr.reward_status IN ('eligible','rewarded') THEN 1 ELSE 0 END) / COUNT(*) * 100, 1) as conversion_rate
      FROM referral_rewards rr
      GROUP BY rr.referrer_name
      ORDER BY total_referrals DESC
    `);
    return rows;
  }

  if (type === 'invoices') {
    const [rows] = await pool.query(`
      SELECT i.invoice_number, h.name as hospital_name, a.full_name as candidate_name, j.job_title,
             i.candidate_salary, i.commission_percentage, i.invoice_amount, i.payment_status, i.invoice_date, i.due_date
      FROM invoices i
      JOIN hospitals h ON i.hospital_id = h.id
      JOIN applicants a ON i.applicant_id = a.id
      JOIN jobs j ON i.job_id = j.id
      ORDER BY i.created_at DESC
    `);
    return rows;
  }

  if (type === 'employees') {
    const [rows] = await pool.query(`SELECT id, full_name, email, role, department, designation, status FROM users ORDER BY full_name ASC`);
    return rows;
  }

  if (type === 'pipeline') {
    const [rows] = await pool.query(`
      SELECT app.id as application_id, a.full_name as candidate_name, j.job_title, h.name as hospital_name, app.current_stage, app.created_at
      FROM applications app
      JOIN applicants a ON app.applicant_id = a.id
      JOIN jobs j ON app.job_id = j.id
      JOIN hospitals h ON j.hospital_id = h.id
      ORDER BY app.created_at DESC
    `);
    return rows;
  }

  if (type === 'attendance') {
    const [rows] = await pool.query(`
      SELECT u.full_name as employee_name, el.log_date, el.status, el.first_login, el.last_logout, el.active_hours
      FROM employee_logs el
      JOIN users u ON el.user_id = u.id
      ORDER BY el.log_date DESC, u.full_name ASC LIMIT 500
    `);
    return rows;
  }

  if (type === 'salary') {
    const [rows] = await pool.query(`
      SELECT u.full_name as employee_name, s.pay_period_month, s.base_salary, s.incentives, s.deductions, s.net_salary, s.status
      FROM salary_slips s
      JOIN users u ON s.employee_id = u.id
      ORDER BY s.pay_period_month DESC LIMIT 500
    `);
    return rows;
  }

  throw new Error('Unsupported report type');
}

async function exportReport(req, res) {
  try {
    const { type, format, filters } = req.body;
    if (!type || !format) return fail(res, 400, 'Type and format required');
    if (!['csv', 'xlsx', 'pdf'].includes(format)) {
      return fail(res, 400, 'Invalid format. Supported formats: csv, xlsx, pdf');
    }

    const data = await getReportData(type, filters || {});
    
    if (!data.length) {
      return fail(res, 404, 'No data found for this report');
    }

    const titleMap = {
      hospitals: 'Hospitals Directory Report',
      jobs: 'Job Openings Status Report',
      applicants: 'Recruitment Applicant Database',
      revenue: 'Staffing Commission Revenue Report',
      employee_performance: 'Staff Performance Summary',
      pipeline_funnel: 'Pipeline Conversion Funnel Report',
      recruiter_productivity: 'Recruiter Productivity Report',
      hospital_placements: 'Hospital Placement & Revenue Report',
      interview_success: 'Interview Success Rate Report',
      referral_analytics: 'Referral Analytics Report',
      referrals: 'Referral Analytics Report',
      invoices: 'Placement Invoices Register',
      employees: 'Employee Roster Directory',
      pipeline: 'Recruitment Pipeline Status Report',
      attendance: 'Employee Daily Attendance Log',
      salary: 'Payroll & Salary Distribution Report'
    };

    const displayTitle = titleMap[type] || 'System Report';

    if (format === 'pdf') {
      const pdfBuffer = await generatePDF(data, displayTitle);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${type}_report_${new Date().toISOString().slice(0,10)}.pdf"`);
      return res.send(pdfBuffer);
    }

    const csvData = generateCSV(data);
    if (format === 'xlsx') {
      res.setHeader('Content-Type', 'application/vnd.ms-excel');
      res.setHeader('Content-Disposition', `attachment; filename="${type}_report_${new Date().toISOString().slice(0,10)}.xls"`);
    } else {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}_report_${new Date().toISOString().slice(0,10)}.csv"`);
    }
    return res.send(csvData);
  } catch (err) {
    return fail(res, 500, err.message || 'Export failed');
  }
}

async function downloadImportTemplate(req, res) {
  try {
    const type = req.params.type || req.query.type || 'candidates';
    let headers = '';
    let sampleRow = '';

    if (type === 'hospitals') {
      headers = 'name,contact_person,email,phone,address,city,state,commission_percentage,status\n';
      sampleRow = 'City Super Speciality Hospital,Dr. Rajesh Sharma,contact@cityhospital.com,9876543210,100 Health Way,Mumbai,Maharashtra,12.50,active\n';
    } else if (type === 'jobs') {
      headers = 'hospital_id,job_title,department,qualification,experience_required,salary,openings_count,location,shift_timing\n';
      sampleRow = '1,Senior Cardiologist,Cardiology,MD Cardiology,5+ Years,2500000.00,2,Mumbai,Day Shift\n';
    } else {
      headers = 'full_name,phone,email,city,total_experience,current_designation,qualification,skills,current_company,expected_salary,notice_period,preferred_location\n';
      sampleRow = 'Dr. Vikram Seth,9876500112,vikram.seth@hospital.org,Delhi,15.0,Consultant Surgeon,MS Surgery,Surgery,Fortis Hospital,3500000.00,30 Days,Delhi\n';
    }

    const csvContent = headers + sampleRow;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}_import_template.csv"`);
    return res.send(csvContent);
  } catch (err) {
    return fail(res, 500, 'Failed to download import template');
  }
}

async function processBulkImport(req, res) {
  try {
    const { type, records } = req.body || {};
    if (!type || !Array.isArray(records) || !records.length) {
      return fail(res, 400, 'Invalid import request. Must provide type and array of records.');
    }

    const pool = getPool();
    const userId = req.user ? req.user.id : 1;
    let imported = 0;

    if (type === 'candidates' || type === 'applicants') {
      for (const r of records) {
        if (!r.full_name) continue;
        const email = r.email || `candidate_${Date.now()}_${Math.floor(Math.random()*1000)}@imported.crm`;
        const phone = r.phone || '9876543210';
        await pool.query(
          `INSERT INTO applicants (full_name, phone, email, dob, gender, city, state, address, total_experience, current_company, current_designation, current_salary, expected_salary, notice_period, qualification, skills, preferred_location, source, candidate_status, original_resume_path, created_by)
           VALUES (?, ?, ?, '1990-01-01', 'other', ?, 'Maharashtra', 'Address', ?, ?, ?, 0.00, ?, ?, ?, ?, ?, 'portal', 'active', '/resumes/imported.pdf', ?)`,
          [
            r.full_name,
            phone,
            email,
            r.city || 'Mumbai',
            Number(r.total_experience || 1.0),
            r.current_company || 'Independent',
            r.current_designation || 'Specialist',
            Number(r.expected_salary || 0.00),
            r.notice_period || '30 Days',
            r.qualification || 'MBBS',
            r.skills || 'Clinical',
            r.preferred_location || r.city || 'Mumbai',
            userId
          ]
        );
        imported++;
      }
    } else if (type === 'hospitals') {
      for (const r of records) {
        if (!r.name) continue;
        const email = r.email || `hosp_${Date.now()}_${Math.floor(Math.random()*1000)}@imported.crm`;
        await pool.query(
          `INSERT INTO hospitals (name, contact_person, email, phone, address, city, state, commission_percentage, agreement_start_date, agreement_end_date, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR), 'active')`,
          [
            r.name,
            r.contact_person || 'HR Director',
            email,
            r.phone || '9876500000',
            r.address || 'Hospital Road',
            r.city || 'Mumbai',
            r.state || 'Maharashtra',
            Number(r.commission_percentage || 10.00)
          ]
        );
        imported++;
      }
    } else if (type === 'jobs') {
      for (const r of records) {
        if (!r.job_title) continue;
        const hospId = Number(r.hospital_id || 1);
        await pool.query(
          `INSERT INTO jobs (hospital_id, job_title, department, qualification, experience_required, salary, openings_count, location, shift_timing, job_description, required_skills, joining_timeline, created_by, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Job requisition created via Excel import', 'Healthcare', 'Immediate', ?, 'open')`,
          [
            hospId,
            r.job_title,
            r.department || 'General Medicine',
            r.qualification || 'MD / DNB',
            r.experience_required || '2+ Years',
            Number(r.salary || 1000000.00),
            Number(r.openings_count || 1),
            r.location || 'Mumbai',
            r.shift_timing || 'Day Shift',
            userId
          ]
        );
        imported++;
      }
    }

    return ok(res, { imported_count: imported }, `Successfully imported ${imported} records`);
  } catch (err) {
    console.error('Bulk import error:', err);
    return fail(res, 500, 'Failed to process bulk import: ' + err.message);
  }
}

module.exports = {
  exportReport,
  getReportData,
  downloadImportTemplate,
  processBulkImport
};
