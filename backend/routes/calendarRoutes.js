'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/calendarController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', controller.list);
router.get('/today', controller.getToday);
router.get('/upcoming', controller.getUpcoming);
router.get('/events', controller.getEvents);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/status/:id', controller.updateStatus);
router.delete('/:id', controller.delete);

module.exports = router;
