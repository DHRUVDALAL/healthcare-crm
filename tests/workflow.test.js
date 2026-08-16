'use strict';

const assert = require('assert');
const app = require('../backend/app');
const { getPool } = require('../backend/config/db');

const PORT = 5052;
const BASE_URL = `http://localhost:${PORT}`;

async function run(log) {
  const server = app.listen(PORT);
  await new Promise((resolve) => server.once('listening', resolve));
  log(`Workflow test server started on ${BASE_URL}`);

  const pool = getPool();

  try {
    // 1. Get Admin authentication token
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@crm.com', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    const adminToken = loginData.data.token;
    assert(adminToken, 'Admin token should be retrieved');

    // Clean up any existing tests data to make the workflow test idempotent
    const [oldHosp] = await pool.query('SELECT id FROM hospitals WHERE email = ?', ['workflow_hospital@crm.com']);
    if (oldHosp.length > 0) {
      const oldHospId = oldHosp[0].id;
      const [oldJobs] = await pool.query('SELECT id FROM jobs WHERE hospital_id = ?', [oldHospId]);
      const oldJobIds = oldJobs.map(j => j.id);
      if (oldJobIds.length > 0) {
        await pool.query('DELETE FROM interviews WHERE job_id IN (?)', [oldJobIds]);
        await pool.query('DELETE FROM candidate_matches WHERE job_id IN (?)', [oldJobIds]);
        
        const [oldApps] = await pool.query('SELECT id FROM applications WHERE job_id IN (?)', [oldJobIds]);
        const oldAppIds = oldApps.map(a => a.id);
        if (oldAppIds.length > 0) {
          await pool.query('DELETE FROM application_stage_history WHERE application_id IN (?)', [oldAppIds]);
          await pool.query('DELETE FROM applications WHERE id IN (?)', [oldAppIds]);
        }
        
        await pool.query('DELETE FROM applicants WHERE applied_job_id IN (?)', [oldJobIds]);
        await pool.query('DELETE FROM jobs WHERE hospital_id = ?', [oldHospId]);
      }
      await pool.query('DELETE FROM hospitals WHERE id = ?', [oldHospId]);
    }
    await pool.query('DELETE FROM applicants WHERE email = ?', ['workflow_candidate@crm.com']);

    // 2. Create Hospital
    const hospRes = await fetch(`${BASE_URL}/api/hospitals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Workflow Hospital Inc',
        contact_person: 'Super Lead Recruiter',
        phone: '123-456-7890',
        email: 'workflow_hospital@crm.com',
        address: '100 Staffing Ave',
        city: 'Sacramento',
        state: 'CA',
        commission_percentage: 15.0,
        agreement_start_date: '2026-07-01',
        agreement_end_date: '2027-07-01',
        notes: 'Verification test onboarding notes',
        status: 'active'
      })
    });
    assert.strictEqual(hospRes.status, 201, 'Hospital creation status should be 201');
    const hospData = await hospRes.json();
    const hospitalId = hospData.data.hospital.id;
    log(`✓ Onboarded Hospital: "${hospData.data.hospital.name}" (ID: ${hospitalId})`);

    // 3. Create Job opening associated with Hospital
    const jobRes = await fetch(`${BASE_URL}/api/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        hospital_id: hospitalId,
        job_title: 'ER Nurse Specialist',
        department: 'Emergency Care',
        qualification: 'Registered Nurse (RN) license',
        experience_required: '2+ years',
        salary: 82000.0,
        openings_count: 3,
        location: 'Sacramento, CA',
        shift_timing: 'Rotating 12h',
        job_description: 'Fast paced ICU/ER nurse tasks',
        required_skills: 'ICU, Trauma, ACLS',
        joining_timeline: '30 days',
        priority_level: 'high',
        status: 'open'
      })
    });
    assert.strictEqual(jobRes.status, 201, 'Job creation status should be 201');
    const jobData = await jobRes.json();
    const jobId = jobData.data.job.id;
    log(`✓ Created Job opening: "${jobData.data.job.job_title}" (ID: ${jobId})`);

    // 4. Create Applicant for Job opening
    const appRes = await fetch(`${BASE_URL}/api/applicants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        full_name: 'Workflow Applicant Test',
        phone: '+1-916-555-0122',
        email: 'workflow_candidate@crm.com',
        dob: '1992-05-14',
        gender: 'female',
        city: 'Sacramento',
        state: 'CA',
        address: '500 Sutter Way',
        total_experience: '3.5',
        current_company: 'Mercy General Hospital',
        current_designation: 'Staff Nurse',
        current_salary: '72000.00',
        expected_salary: '82000.00',
        notice_period: '30 days',
        qualification: 'B.S. Nursing',
        skills: 'ICU, ACLS, CPR',
        certifications: 'RN, BLS, ACLS',
        preferred_location: 'Sacramento',
        applied_job_id: jobId,
        source: 'whatsapp',
        referral_reward_status: 'pending',
        notes: 'Pre-screened via automated testing',
        candidate_status: 'active',
        original_resume_path: 'uploads/resumes/mock_workflow_resume.pdf'
      })
    });
    assert.strictEqual(appRes.status, 201, 'Applicant creation status should be 201');
    const appData = await appRes.json();
    const applicantId = appData.data.applicant.id;
    log(`✓ Registered Candidate: "${appData.data.applicant.full_name}" (ID: ${applicantId})`);

    // 5. Match candidate checks
    const matchRes = await fetch(`${BASE_URL}/api/matching/job/${jobId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(matchRes.status, 200, 'Matching status should be 200');
    log('✓ Programmatic matching scores calculated successfully');

    // 6. Recruitment Pipeline: Create application transition record
    const pipelineRes = await fetch(`${BASE_URL}/api/pipeline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        applicant_id: applicantId,
        job_id: jobId,
        current_stage: 'applied',
        remarks: 'E2E workflow test setup application'
      })
    });
    assert.strictEqual(pipelineRes.status, 201, 'Pipeline application creation status should be 201');
    const pipelineData = await pipelineRes.json();
    const applicationId = pipelineData.data.id;
    assert(applicationId, 'Application ID should be returned');
    log(`✓ Pipeline: initial status registered as "applied" for application ID: ${applicationId}`);

    // Update application stage to assigned
    const stageRes = await fetch(`${BASE_URL}/api/pipeline/status/${applicationId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        new_stage: 'assigned',
        notes: 'Candidate assignment validation note'
      })
    });
    assert.strictEqual(stageRes.status, 200, 'Transition update status should be 200');
    log('✓ Pipeline stage transition: "applied" -> "assigned" verified');

    // 7. Schedule Interview
    const interviewRes = await fetch(`${BASE_URL}/api/interviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        applicant_id: applicantId,
        job_id: jobId,
        hospital_id: hospitalId,
        interview_date: '2026-08-01',
        interview_time: '14:30',
        interview_mode: 'online',
        interview_round: 1,
        interviewer_name: 'Dr. John QA Interviewer',
        meeting_details: 'https://zoom.us/test-j-meeting'
      })
    });
    assert.strictEqual(interviewRes.status, 201, 'Interview scheduling should return 201');
    const intData = await interviewRes.json();
    const interviewId = intData.data.id;
    log(`✓ Scheduled Interview (ID: ${interviewId})`);

    // Submit feedback and complete interview
    const feedbackRes = await fetch(`${BASE_URL}/api/interviews/feedback/${interviewId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        feedback: 'Excellent technical skills and ACLS guidelines matching.',
        result: 'selected',
        status: 'completed'
      })
    });
    assert.strictEqual(feedbackRes.status, 200, 'Feedback submission should be 200');
    log('✓ Interview completed, feedback recorded and result marked "selected"');

    // 8. Candidate Activity Timeline & Notes timeline checks
    // Verify timeline endpoints return the creation, stage transitions and interview events
    const timelineRes = await fetch(`${BASE_URL}/api/applicants/${applicantId}/timeline`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const timelineData = await timelineRes.json();
    const events = timelineData.data.timeline || [];
    
    // Checks that Creation, stage change, interview scheduled, and note (if any) log exists
    assert(events.some(e => e.type === 'creation'), 'Timeline must include creation event');
    assert(events.some(e => e.type === 'stage' && e.title === 'assigned'), 'Timeline must contain transition event to assigned');
    assert(events.some(e => e.type === 'interview'), 'Timeline must contain interview scheduled event');
    log(`✓ Candidate Activity Timeline: Verified logging of ${events.length} chronological events`);

    // Verify adding a candidate note from details tab
    const notePostRes = await fetch(`${BASE_URL}/api/applicants/${applicantId}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ note_text: 'Recruiter noted candidate is available immediately.' })
    });
    assert.strictEqual(notePostRes.status, 200, 'Adding candidate note should be 200');
    log('✓ Append-only Notes: Successfully added candidate note');

    // 9. Clean up tests data
    await pool.query('DELETE FROM interviews WHERE applicant_id = ?', [applicantId]);
    await pool.query('DELETE FROM application_stage_history WHERE application_id = ?', [applicationId]);
    await pool.query('DELETE FROM candidate_notes WHERE applicant_id = ?', [applicantId]);
    await pool.query('DELETE FROM applications WHERE applicant_id = ?', [applicantId]);
    await pool.query('DELETE FROM applicants WHERE id = ?', [applicantId]);
    await pool.query('DELETE FROM jobs WHERE id = ?', [jobId]);
    await pool.query('DELETE FROM hospitals WHERE id = ?', [hospitalId]);
    log('✓ E2E Workflow Test clean up completed successfully');

  } finally {
    server.close();
    log('Workflow test server stopped.');
  }
}

module.exports = { run };
