'use strict';

const express = require('express');

const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');
const jobController = require('../controllers/jobController');

const router = express.Router();

router.get('/', authMiddleware, jobController.list);
router.get('/by-hospital/:hospitalId', authMiddleware, jobController.byHospital);
router.get('/:id', authMiddleware, jobController.getById);

router.post('/', authMiddleware, permissionMiddleware('manage_jobs'), jobController.create);
router.put('/:id', authMiddleware, permissionMiddleware('manage_jobs'), jobController.update);
router.delete('/:id', authMiddleware, permissionMiddleware('manage_jobs'), jobController.remove);
router.patch('/status/:id', authMiddleware, permissionMiddleware('manage_jobs'), jobController.setStatus);

module.exports = router;
