'use strict';

const ReferralModel = require('../models/referralModel');
const { calculateMilestoneInfo } = require('../utils/milestoneConfig');
const { ok, fail } = require('../utils/response');

async function list(req, res) {
  try {
    const { search, status } = req.query;
    const rows = await ReferralModel.list({
      search: typeof search === 'string' ? search.trim() : '',
      status: typeof status === 'string' ? status.trim() : ''
    });
    return ok(res, { referrals: rows }, 'Referral rewards');
  } catch (err) {
    return fail(res, 500, 'Failed to load referral rewards');
  }
}

async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid referral id');

    const row = await ReferralModel.getById(id);
    if (!row) return fail(res, 404, 'Referral reward not found');

    return ok(res, { referral: row }, 'Referral reward details');
  } catch (err) {
    return fail(res, 500, 'Failed to load referral reward');
  }
}

async function updateStatus(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid referral id');

    const status = String(req.body?.status || '').trim();
    if (!['pending', 'eligible', 'rewarded'].includes(status)) {
      return fail(res, 400, 'Invalid status');
    }

    const row = await ReferralModel.getById(id);
    if (!row) return fail(res, 404, 'Referral reward not found');

    const paidDate = status === 'rewarded' ? new Date().toISOString().slice(0, 10) : null;
    await ReferralModel.updateStatus(id, status, paidDate);

    return ok(res, { updated: true, status, paidDate }, 'Referral status updated');
  } catch (err) {
    return fail(res, 500, 'Failed to update referral status');
  }
}

async function markPaid(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid referral id');

    const row = await ReferralModel.getById(id);
    if (!row) return fail(res, 404, 'Referral reward not found');

    if (row.reward_status !== 'eligible') {
      return fail(res, 400, 'Referral reward must be eligible to be marked as paid');
    }

    const paidDate = new Date().toISOString().slice(0, 10);
    await ReferralModel.updateStatus(id, 'rewarded', paidDate);

    return ok(res, { updated: true, status: 'rewarded', paidDate }, 'Referral marked as paid');
  } catch (err) {
    return fail(res, 500, 'Failed to mark referral as paid');
  }
}

/**
 * List referral rewards grouped by referrer with milestone calculations.
 * Each row represents a unique referrer with their aggregated stats.
 */
async function listGrouped(req, res) {
  try {
    const { search } = req.query;

    const rows = await ReferralModel.listGroupedByReferrer({
      search: typeof search === 'string' ? search.trim() : ''
    });

    // Enrich each referrer row with milestone info
    const enriched = rows.map((row) => {
      const successCount = Number(row.successful_count || 0);
      const milestone = calculateMilestoneInfo(successCount);

      // Determine a display status for filtering
      let milestoneStatus = 'no_milestone';
      if (successCount >= 20) {
        if (Number(row.rewarded_count) > 0 && Number(row.rewarded_count) >= successCount) {
          milestoneStatus = 'rewarded';
        } else {
          milestoneStatus = 'milestone_reached';
        }
      }

      return {
        referrer_name: row.referrer_name,
        referrer_contact: row.referrer_contact || '',
        total_referred: Number(row.total_referred),
        successful_count: successCount,
        pending_count: Number(row.pending_count || 0),
        rewarded_count: Number(row.rewarded_count || 0),
        milestone_status: milestoneStatus,
        current_milestone: milestone.currentMilestone,
        current_milestone_label: milestone.currentMilestoneLabel,
        current_reward: milestone.currentReward,
        next_milestone: milestone.nextMilestone,
        next_milestone_label: milestone.nextMilestoneLabel,
        next_reward: milestone.nextReward,
        progress: milestone.progress,
        first_referral_at: row.first_referral_at,
        last_updated_at: row.last_updated_at
      };
    });

    // Apply milestone status filter if provided
    const milestoneStatusFilter = typeof req.query.milestoneStatus === 'string' ? req.query.milestoneStatus.trim() : '';
    const filtered = milestoneStatusFilter
      ? enriched.filter((r) => r.milestone_status === milestoneStatusFilter)
      : enriched;

    return ok(res, { referrers: filtered }, 'Grouped referral rewards');
  } catch (err) {
    console.error('listGrouped error:', err);
    return fail(res, 500, 'Failed to load grouped referral rewards');
  }
}

/**
 * Get full detail for a specific referrer including all their referred candidates.
 */
async function getReferrerDetail(req, res) {
  try {
    const referrerName = typeof req.query.referrer_name === 'string' ? req.query.referrer_name.trim() : '';
    const referrerContact = typeof req.query.referrer_contact === 'string' ? req.query.referrer_contact.trim() : '';

    if (!referrerName) {
      return fail(res, 400, 'referrer_name is required');
    }

    const candidates = await ReferralModel.getReferrerCandidates(referrerName, referrerContact);

    // Calculate milestone for this referrer
    const successCount = candidates.filter(
      (c) => c.reward_status === 'eligible' || c.reward_status === 'rewarded'
    ).length;

    const milestone = calculateMilestoneInfo(successCount);

    return ok(res, {
      referrer_name: referrerName,
      referrer_contact: referrerContact,
      total_referred: candidates.length,
      successful_count: successCount,
      milestone,
      candidates
    }, 'Referrer detail');
  } catch (err) {
    return fail(res, 500, 'Failed to load referrer detail');
  }
}

module.exports = {
  list,
  getById,
  updateStatus,
  markPaid,
  listGrouped,
  getReferrerDetail
};
