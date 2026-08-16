'use strict';

const express = require('express');

const auth = require('../middleware/authMiddleware');
const permission = require('../middleware/permissionMiddleware');

const ApplicationController = require('../controllers/applicationController');

const router = express.Router();

router.get('/', auth, permission('view_pipeline'), ApplicationController.list);
router.get('/:id', auth, permission('view_pipeline'), ApplicationController.getById);
router.post('/', auth, permission('update_pipeline_stage'), ApplicationController.create);
router.put('/:id', auth, permission('update_pipeline_stage'), ApplicationController.update);

module.exports = router;
