'use strict';

const { getPool } = require('../config/db');

/**
 * Calculate workload score and classification for all recruiters.
 * @returns {Promise<Array<Object>>} Workload analysis list
 */
async function calculateWorkloadDistribution() {
  const pool = getPool();

  const [users] = await pool.query(
    `SELECT id, full_name, email, department, designation FROM users WHERE status = 'active'`
  );

  const [cands] = await pool.query(`SELECT created_by, COUNT(*) as cnt FROM applicants GROUP BY created_by`);
  const candMap = new Map(cands.map(c => [c.created_by, Number(c.cnt)]));

  const [tasks] = await pool.query(
    `SELECT assigned_to, COUNT(CASE WHEN status IN ('pending','in_progress') THEN 1 END) as pending
     FROM tasks GROUP BY assigned_to`
  );
  const taskMap = new Map(tasks.map(t => [t.assigned_to, Number(t.pending)]));

  const [followups] = await pool.query(
    `SELECT employee_id, COUNT(*) as pending FROM candidate_follow_ups WHERE status = 'pending' GROUP BY employee_id`
  );
  const followupMap = new Map(followups.map(f => [f.employee_id, Number(f.pending)]));

  return users.map(u => {
    const activeCand = candMap.get(u.id) || 0;
    const pendingT = taskMap.get(u.id) || 0;
    const pendingF = followupMap.get(u.id) || 0;

    // Workload Score Formula: 1 * Active Candidates + 2 * Pending Tasks + 1.5 * Pending Followups
    const score = Math.round(activeCand + (pendingT * 2) + (pendingF * 1.5));

    let classification = 'Balanced';
    if (score > 35) classification = 'Critical';
    else if (score > 22) classification = 'Heavy';
    else if (score > 10) classification = 'Balanced';
    else if (score > 4) classification = 'Light';
    else classification = 'Very Light';

    return {
      user_id: u.id,
      full_name: u.full_name,
      department: u.department || 'Recruitment',
      designation: u.designation || 'Recruiter',
      active_candidates: activeCand,
      pending_tasks: pendingT,
      pending_followups: pendingF,
      workload_score: score,
      classification
    };
  });
}

/**
 * Reassign selected candidates from one recruiter to another.
 */
async function reassignCandidates({ fromUserId, toUserId, candidateIds }) {
  const pool = getPool();
  const fId = Number(fromUserId || 1);
  const tId = Number(toUserId || 2);
  const ids = Array.isArray(candidateIds) && candidateIds.length ? candidateIds.map(Number) : [1];

  const [result] = await pool.query(
    `UPDATE applicants SET created_by = ?, assigned_recruiter_id = ? WHERE id IN (?)`,
    [tId, tId, ids]
  );

  return { affectedRows: result.affectedRows };
}

module.exports = {
  calculateWorkloadDistribution,
  reassignCandidates
};
