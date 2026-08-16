'use strict';

const express = require('express');

const auth = require('../middleware/authMiddleware');
const permission = require('../middleware/permissionMiddleware');

const InterviewController = require('../controllers/interviewController');

const router = express.Router();

router.get('/', auth, permission('view_interviews'), InterviewController.list);
router.get('/:id', auth, permission('view_interviews'), InterviewController.getById);

router.post('/', auth, permission('manage_interviews'), InterviewController.createInterview);
router.put('/:id', auth, permission('manage_interviews'), InterviewController.updateInterview);
router.delete('/:id', auth, permission('manage_interviews'), InterviewController.removeInterview);

router.patch('/result/:id', auth, permission('record_feedback'), InterviewController.updateResult);
router.patch('/feedback/:id', auth, permission('record_feedback'), InterviewController.updateFeedback);

module.exports = router;
