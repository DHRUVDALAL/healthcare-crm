'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/goalController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', controller.listGoals);
router.post('/', controller.createGoal);
router.put('/:id', controller.updateGoal);

module.exports = router;
