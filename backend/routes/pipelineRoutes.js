'use strict';

const express = require('express');

const auth = require('../middleware/authMiddleware');
const permission = require('../middleware/permissionMiddleware');

const PipelineController = require('../controllers/pipelineController');

const router = express.Router();

router.get('/', auth, permission('view_pipeline'), PipelineController.list);
router.get('/history/:id', auth, permission('view_pipeline'), PipelineController.history);
router.get('/:id', auth, permission('view_pipeline'), PipelineController.getById);

router.patch('/status/:id', auth, permission('update_pipeline_stage'), PipelineController.updateStatus);
router.post('/send/:applicantId', auth, permission('update_pipeline_stage'), PipelineController.sendCandidate);
router.post('/', auth, permission('update_pipeline_stage'), PipelineController.createApplication);
router.put('/:id', auth, permission('update_pipeline_stage'), PipelineController.updateApplication);

module.exports = router;
