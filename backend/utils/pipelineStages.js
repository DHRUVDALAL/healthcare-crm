'use strict';

const STAGES = Object.freeze({
  APPLIED: 'applied',
  ASSIGNED: 'assigned',
  SCREENING: 'screening',
  RESUME_REVIEW: 'resume_review',
  SHORTLISTED: 'shortlisted',
  MATCHED: 'matched',
  SENT_TO_HOSPITAL: 'sent_to_hospital',
  HOSPITAL_SUBMISSION: 'hospital_submission',
  INTERVIEW_SCHEDULED: 'interview_scheduled',
  INTERVIEW_COMPLETED: 'interview_completed',
  OFFER_RELEASED: 'offer_released',
  SELECTED: 'selected',
  JOINED: 'joined',
  REJECTED: 'rejected',
  MOVED_TO_POOL: 'moved_to_pool',
  RETURNED_TO_POOL: 'returned_to_pool',
  ARCHIVED: 'archived'
});

const STAGE_ORDER = Object.freeze([
  STAGES.APPLIED,
  STAGES.ASSIGNED,
  STAGES.SCREENING,
  STAGES.RESUME_REVIEW,
  STAGES.SHORTLISTED,
  STAGES.MATCHED,
  STAGES.SENT_TO_HOSPITAL,
  STAGES.HOSPITAL_SUBMISSION,
  STAGES.INTERVIEW_SCHEDULED,
  STAGES.INTERVIEW_COMPLETED,
  STAGES.OFFER_RELEASED,
  STAGES.SELECTED,
  STAGES.JOINED,
  STAGES.REJECTED,
  STAGES.MOVED_TO_POOL,
  STAGES.RETURNED_TO_POOL,
  STAGES.ARCHIVED
]);

const STAGE_LABELS = Object.freeze({
  [STAGES.APPLIED]: 'Applied',
  [STAGES.ASSIGNED]: 'Assigned',
  [STAGES.SCREENING]: 'Screening',
  [STAGES.RESUME_REVIEW]: 'Resume Review',
  [STAGES.SHORTLISTED]: 'Shortlisted',
  [STAGES.MATCHED]: 'Matched',
  [STAGES.SENT_TO_HOSPITAL]: 'Sent to Hospital',
  [STAGES.HOSPITAL_SUBMISSION]: 'Hospital Submission',
  [STAGES.INTERVIEW_SCHEDULED]: 'Interview Scheduled',
  [STAGES.INTERVIEW_COMPLETED]: 'Interview Completed',
  [STAGES.OFFER_RELEASED]: 'Offer Released',
  [STAGES.SELECTED]: 'Selected',
  [STAGES.JOINED]: 'Joined',
  [STAGES.REJECTED]: 'Rejected',
  [STAGES.MOVED_TO_POOL]: 'Moved to Pool',
  [STAGES.RETURNED_TO_POOL]: 'Returned to Pool',
  [STAGES.ARCHIVED]: 'Archived'
});

const INTERVIEW_RESULTS = Object.freeze({
  PENDING: 'pending',
  SELECTED: 'selected',
  REJECTED: 'rejected',
  HOLD: 'hold'
});

const INTERVIEW_MODES = Object.freeze({
  ONLINE: 'online',
  OFFLINE: 'offline',
  TELEPHONIC: 'telephonic'
});

const INTERVIEW_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed'
});

function normalizeStage(stage) {
  if (!stage || typeof stage !== 'string') return 'applied';
  const s = stage.trim().toLowerCase();
  return s;
}

function isValidStage(stage) {
  if (typeof stage !== 'string') return false;
  const s = stage.trim().toLowerCase();
  return STAGE_ORDER.includes(s);
}

function canTransition(oldStage, newStage) {
  return isValidStage(oldStage) && isValidStage(newStage);
}

function applicantStatusForStage(stage) {
  const s = String(stage || '').trim().toLowerCase();
  switch (s) {
    case 'applied':
    case 'assigned':
    case 'screening':
    case 'resume_review':
    case 'shortlisted':
    case 'matched':
      return 'active';
    case 'sent_to_hospital':
    case 'hospital_submission':
    case 'interview_scheduled':
    case 'interview_completed':
    case 'offer_released':
      return 'hold';
    case 'selected':
    case 'joined':
      return 'selected';
    case 'rejected':
      return 'rejected';
    case 'moved_to_pool':
    case 'returned_to_pool':
      return 'pool';
    case 'archived':
      return 'hold';
    default:
      return 'active';
  }
}

function nextActionForStage(stage) {
  const s = String(stage || '').trim().toLowerCase();
  switch (s) {
    case 'applied':
      return 'Assign Recruiter';
    case 'assigned':
      return 'Review Resume';
    case 'screening':
    case 'resume_review':
      return 'Match Jobs';
    case 'shortlisted':
    case 'matched':
      return 'Submit to Hospital';
    case 'sent_to_hospital':
    case 'hospital_submission':
      return 'Schedule Interview';
    case 'interview_scheduled':
      return 'Await Interview Completion';
    case 'interview_completed':
      return 'Release Offer';
    case 'offer_released':
      return 'Confirm Selection';
    case 'selected':
      return 'Confirm Joining';
    case 'joined':
      return 'Archive Placed Candidate';
    case 'rejected':
      return 'Move to Pool / Archive';
    case 'moved_to_pool':
    case 'returned_to_pool':
      return 'Awaiting Assignment';
    case 'archived':
      return 'Candidate Archived';
    default:
      return 'Follow up with Candidate';
  }
}

module.exports = {
  STAGES,
  STAGE_ORDER,
  STAGE_LABELS,
  INTERVIEW_RESULTS,
  INTERVIEW_MODES,
  INTERVIEW_STATUS,
  isValidStage,
  canTransition,
  normalizeStage,
  applicantStatusForStage,
  nextActionForStage
};
