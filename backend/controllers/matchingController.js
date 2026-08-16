'use strict';

const JobModel = require('../models/jobModel');
const ApplicantModel = require('../models/applicantModel');
const CandidateMatchModel = require('../models/candidateMatchModel');
const { ok, fail } = require('../utils/response');

function tokenizeList(v) {
  return String(v || '')
    .split(/[,\n]/g)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((s) => s.replace(/\s+/g, ' '));
}

function normalizeText(v) {
  return String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseMinExperience(expRequired) {
  const txt = normalizeText(expRequired);
  const nums = txt.match(/\d+(?:\.\d+)?/g);
  if (!nums || !nums.length) return 0;
  return Math.max(0, Number(nums[0]) || 0);
}

function computeMatch(job, applicant) {
  const requiredSkills = tokenizeList(job.required_skills);
  const applicantSkills = tokenizeList(applicant.skills);

  const reqSet = new Set(requiredSkills);
  const appSet = new Set(applicantSkills);

  const matchingSkills = requiredSkills.filter(s => appSet.has(s));
  const missingSkills = requiredSkills.filter(s => !appSet.has(s));

  let overlap = matchingSkills.length;

  const minExp = parseMinExperience(job.experience_required);
  const appExp = Number(applicant.total_experience || 0);
  const expDiffNum = appExp - minExp;
  const experienceDiff = (expDiffNum >= 0 ? '+' : '') + expDiffNum.toFixed(1) + ' yrs';

  const roleTxt = normalizeText(job.job_title);
  const desigTxt = normalizeText(applicant.current_designation);

  const jobLoc = normalizeText(job.location);
  const prefLoc = normalizeText(applicant.preferred_location);

  const jobQual = normalizeText(job.qualification);
  const appQual = normalizeText(applicant.qualification);

  const weights = {
    skills: 50,
    experience: 20,
    location: 10,
    qualification: 10,
    role: 10
  };

  const skillsRatio = requiredSkills.length ? (overlap / requiredSkills.length) : 0;
  const skillsScore = Math.round(weights.skills * Math.min(1, Math.max(0, skillsRatio)));

  const expRatio = minExp > 0 ? Math.min(1, Math.max(0, appExp / minExp)) : 1;
  const expScore = Math.round(weights.experience * expRatio);

  const locScore = (jobLoc && prefLoc && (prefLoc.includes(jobLoc) || jobLoc.includes(prefLoc))) ? weights.location : 0;

  const qualScore = (jobQual && appQual && (appQual.includes(jobQual) || jobQual.includes(appQual))) ? weights.qualification : 0;

  const roleScore = (roleTxt && desigTxt && (desigTxt.includes(roleTxt) || roleTxt.includes(desigTxt))) ? weights.role : 0;

  const score = Math.max(0, Math.min(100, skillsScore + expScore + locScore + qualScore + roleScore));

  let recommendation = 'Not Recommended';
  if (score >= 80) recommendation = 'Highly Recommended';
  else if (score >= 60) recommendation = 'Recommended';
  else if (score >= 40) recommendation = 'Potential Match';

  const notes = [];
  notes.push(`Rec: ${recommendation}`);
  notes.push(`Skills: ${overlap}/${requiredSkills.length}`);
  notes.push(`Exp Diff: ${experienceDiff}`);
  if (locScore) notes.push('Location matched');
  if (qualScore) notes.push('Qualification matched');
  if (roleScore) notes.push('Role matched');

  return {
    score,
    matching_skills: matchingSkills,
    missing_skills: missingSkills,
    experience_diff: experienceDiff,
    recommendation,
    notes: notes.join(' • ')
  };
}

async function getMatchesForJob(req, res) {
  try {
    const jobId = Number(req.params.jobId);
    if (!Number.isInteger(jobId) || jobId <= 0) return fail(res, 400, 'Invalid job id');

    const job = await JobModel.getById(jobId);
    if (!job) return fail(res, 404, 'Job not found');

    const matches = await CandidateMatchModel.listLatestByJob(jobId, { limit: 200 });

    const enriched = matches.map(m => {
      const details = computeMatch(job, m);
      return {
        ...m,
        match_score: details.score,
        matching_skills: details.matching_skills,
        missing_skills: details.missing_skills,
        experience_diff: details.experience_diff,
        recommendation: details.recommendation,
        match_notes: details.notes
      };
    });

    return ok(res, { job, matches: enriched }, 'Matches');
  } catch (err) {
    return fail(res, 500, 'Failed to load matches');
  }
}

async function calculateMatches(req, res) {
  try {
    const jobId = Number(req.params.jobId);
    if (!Number.isInteger(jobId) || jobId <= 0) return fail(res, 400, 'Invalid job id');

    const job = await JobModel.getById(jobId);
    if (!job) return fail(res, 404, 'Job not found');

    const applicants = await ApplicantModel.listAllForMatching();

    const results = [];
    for (const a of applicants) {
      if (String(a.candidate_status) === 'rejected') continue;

      const details = computeMatch(job, a);
      await CandidateMatchModel.insertMatch({
        applicant_id: a.id,
        job_id: jobId,
        match_score: details.score,
        match_notes: details.notes
      });

      await ApplicantModel.setMatchingScore(a.id, details.score).catch(() => {});

      results.push({
        applicant_id: a.id,
        full_name: a.full_name,
        total_experience: a.total_experience,
        preferred_location: a.preferred_location,
        qualification: a.qualification,
        skills: a.skills,
        candidate_status: a.candidate_status,
        pool_status: a.pool_status,
        match_score: details.score,
        matching_skills: details.matching_skills,
        missing_skills: details.missing_skills,
        experience_diff: details.experience_diff,
        recommendation: details.recommendation,
        match_notes: details.notes,
        masked_resume_path: a.masked_resume_path
      });
    }

    results.sort((x, y) => (y.match_score - x.match_score) || (y.applicant_id - x.applicant_id));

    return ok(res, { job, matches: results }, 'Match calculated');
  } catch (err) {
    return fail(res, 500, 'Failed to calculate matches');
  }
}

async function sendCandidate(req, res) {
  try {
    const applicantId = Number(req.params.applicantId);
    if (!Number.isInteger(applicantId) || applicantId <= 0) return fail(res, 400, 'Invalid applicant id');

    const applicant = await ApplicantModel.getById(applicantId);
    if (!applicant) return fail(res, 404, 'Applicant not found');

    if (!applicant.masked_resume_path) {
      return fail(res, 400, 'Masked resume is required before sending to hospital');
    }

    // This is a Part 4 structure-only action; pipeline module comes later.
    return ok(res, { sent: true }, 'Candidate marked as sent (pipeline comes in later phase)');
  } catch (err) {
    return fail(res, 500, 'Failed to send candidate');
  }
}

module.exports = {
  getMatchesForJob,
  calculateMatches,
  sendCandidate
};
