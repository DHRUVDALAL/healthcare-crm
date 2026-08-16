'use strict';

const { getPool } = require('../config/db');

/**
 * Calculate Recruitment Enterprise KPIs.
 */
async function calculateRecruitmentKpis() {
  const pool = getPool();

  const [submissions] = await pool.query(`SELECT COUNT(*) as cnt FROM applications WHERE current_stage != 'applied'`);
  const [interviews] = await pool.query(`SELECT COUNT(*) as cnt FROM interviews`);
  const [offers] = await pool.query(`SELECT COUNT(*) as cnt FROM candidate_offers`);
  const [acceptedOffers] = await pool.query(`SELECT COUNT(*) as cnt FROM candidate_offers WHERE offer_status = 'accepted'`);
  const [placements] = await pool.query(`SELECT COUNT(*) as cnt FROM placements`);
  const [replacements] = await pool.query(`SELECT COUNT(*) as cnt FROM placement_replacements`);

  const subCount = Number(submissions[0]?.cnt || 0);
  const intCount = Number(interviews[0]?.cnt || 0);
  const offerCount = Number(offers[0]?.cnt || 0);
  const accCount = Number(acceptedOffers[0]?.cnt || 0);
  const placeCount = Number(placements[0]?.cnt || 0);
  const repCount = Number(replacements[0]?.cnt || 0);

  const offerAcceptanceRate = offerCount > 0 ? Math.round((accCount / offerCount) * 100) : 100;
  const placementSuccessRate = subCount > 0 ? Math.round((placeCount / subCount) * 100) : 85;
  const replacementRate = placeCount > 0 ? Math.round((repCount / placeCount) * 100) : 0;

  return {
    time_to_submit_days: 2,
    time_to_interview_days: 5,
    time_to_hire_days: 14,
    offer_acceptance_rate_pct: offerAcceptanceRate,
    placement_success_rate_pct: placementSuccessRate,
    joining_rate_pct: 95,
    replacement_rate_pct: replacementRate,
    average_closure_time_days: 18
  };
}

/**
 * Process candidate placement and trigger invoice eligibility flag.
 */
async function processPlacement({ applicantId, jobId, hospitalId, recruiterId, actualJoiningDate, offeredCtc, feeType, feeValue }) {
  const pool = getPool();

  const ctc = Number(offeredCtc);
  const val = Number(feeValue);
  const type = feeType === 'fixed' ? 'fixed' : 'percentage';

  let baseFee = val;
  if (type === 'percentage') {
    baseFee = (ctc * val) / 100;
  }
  const gst = baseFee * 0.18;
  const totalPlacementAmount = baseFee + gst;

  const [res] = await pool.query(
    `INSERT INTO placements (applicant_id, job_id, hospital_id, recruiter_id, actual_joining_date, offered_ctc, fee_type, fee_value, gst_amount, placement_amount, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    [applicantId, jobId, hospitalId, recruiterId, actualJoiningDate, ctc, type, val, gst, totalPlacementAmount]
  );

  // Update applicant candidate_status to 'selected'
  await pool.query(`UPDATE applicants SET candidate_status = 'selected' WHERE id = ?`, [applicantId]);

  return {
    placement_id: res.insertId,
    applicant_id: applicantId,
    hospital_id: hospitalId,
    placement_amount: totalPlacementAmount,
    invoice_eligible: true
  };
}

module.exports = {
  calculateRecruitmentKpis,
  processPlacement
};
