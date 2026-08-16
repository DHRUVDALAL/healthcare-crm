'use strict';

const InvoiceModel = require('../models/invoiceModel');
const ReferralModel = require('../models/referralModel');
const ApplicantModel = require('../models/applicantModel');
const JobModel = require('../models/jobModel');
const HospitalModel = require('../models/hospitalModel');
const { getPool } = require('../config/db');

/**
 * Generate invoice when candidate is selected
 */
async function generateInvoiceAndReferral(applicantId, jobId, hospitalId, conn) {
  const applicant = await ApplicantModel.getById(applicantId, conn);
  const job = await JobModel.getById(jobId, conn);
  const hospital = await HospitalModel.getById(hospitalId, conn);

  if (!applicant || !job || !hospital) return false;

  // Calculate invoice
  const salary = Number(applicant.expected_salary || job.salary || 0);
  const commission = Number(hospital.commission_percentage || 0);
  const amount = (salary * commission) / 100;

  // Generate unique invoice number
  const prefix = 'INV';
  const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  const invoiceNumber = `${prefix}-${dateStr}-${applicantId}-${rand}`;

  // Due date: 30 days from now
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(today.getDate() + 30);

  const invoiceData = {
    invoice_number: invoiceNumber,
    hospital_id: hospitalId,
    applicant_id: applicantId,
    job_id: jobId,
    candidate_salary: salary,
    commission_percentage: commission,
    invoice_amount: amount,
    invoice_date: today.toISOString().slice(0, 10),
    due_date: dueDate.toISOString().slice(0, 10),
    payment_status: 'pending',
    notes: 'Auto-generated upon candidate selection'
  };

  await InvoiceModel.create(invoiceData, conn);

  // Handle referral tracking
  // If referral, check if an entry exists, if not create one and mark eligible
  if (applicant.source === 'referral' || (applicant.referred_by && applicant.referred_by.trim() !== '')) {
    const existingRef = await ReferralModel.getByApplicantId(applicantId, conn);
    if (!existingRef) {
      await ReferralModel.create({
        applicant_id: applicantId,
        referrer_name: applicant.referred_by || 'Unknown',
        referrer_contact: applicant.referral_contact || '',
        reward_amount: 5000, // Configurable base amount, set to 5000 as default
        reward_status: 'eligible',
        notes: 'Candidate selected, reward is now eligible'
      }, conn);
    } else if (existingRef.reward_status === 'pending') {
      await ReferralModel.updateStatus(existingRef.id, 'eligible', null, conn);
    }
  }

  return true;
}

module.exports = {
  generateInvoiceAndReferral
};
