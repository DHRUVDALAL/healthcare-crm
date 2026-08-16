'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/projectionController');
const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');

router.use(authMiddleware);

router.get('/progress', controller.getProgress); // Accessible by all

router.use(permissionMiddleware('manage_projections'));
router.get('/', controller.list);
router.get('/recruiter', controller.getRecruiterTargets);
router.post('/recruiter', controller.upsertRecruiterTarget);
router.get('/:id', controller.getById);
router.post('/', controller.upsert);

module.exports = router;
