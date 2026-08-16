'use strict';

/**
 * Milestone Reward Configuration
 * 
 * Milestones are based on the number of SUCCESSFULLY SELECTED referred candidates.
 * A referrer's milestone is the highest threshold they have reached.
 * 
 * IMPORTANT: Update the reward amounts below with actual business values.
 * These are placeholder/configurable amounts.
 */

const MILESTONES = Object.freeze([
  { threshold: 20,  reward: 5000,   label: '20 Referrals' },
  { threshold: 50,  reward: 15000,  label: '50 Referrals' },
  { threshold: 75,  reward: 25000,  label: '75 Referrals' },
  { threshold: 100, reward: 40000,  label: '100 Referrals' },
  { threshold: 150, reward: 65000,  label: '150 Referrals' },
  { threshold: 200, reward: 100000, label: '200 Referrals' }
]);

/**
 * Get the highest milestone reached for the given successful referral count.
 * Returns null if no milestone reached (count < 20).
 */
function getCurrentMilestone(successCount) {
  let current = null;
  for (const m of MILESTONES) {
    if (successCount >= m.threshold) {
      current = m;
    } else {
      break;
    }
  }
  return current;
}

/**
 * Get the next milestone after the current count.
 * Returns null if all milestones have been reached (count >= 200).
 */
function getNextMilestone(successCount) {
  for (const m of MILESTONES) {
    if (successCount < m.threshold) {
      return m;
    }
  }
  return null;
}

/**
 * Get the reward amount for a specific milestone threshold.
 */
function getRewardForMilestone(threshold) {
  const m = MILESTONES.find((ms) => ms.threshold === threshold);
  return m ? m.reward : 0;
}

/**
 * Calculate full milestone info for a referrer.
 * @param {number} successCount - Number of successfully selected referred candidates.
 * @returns {Object} Milestone information including current, next, progress, reward.
 */
function calculateMilestoneInfo(successCount) {
  const current = getCurrentMilestone(successCount);
  const next = getNextMilestone(successCount);

  return {
    successCount,
    currentMilestone: current ? current.threshold : 0,
    currentMilestoneLabel: current ? current.label : 'No Milestone',
    currentReward: current ? current.reward : 0,
    nextMilestone: next ? next.threshold : null,
    nextMilestoneLabel: next ? next.label : 'All Milestones Reached',
    nextReward: next ? next.reward : null,
    progress: next ? successCount / next.threshold : 1
  };
}

module.exports = {
  MILESTONES,
  getCurrentMilestone,
  getNextMilestone,
  getRewardForMilestone,
  calculateMilestoneInfo
};
