'use strict';

const express = require('express');

const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');
const hospitalController = require('../controllers/hospitalController');

const router = express.Router();

router.get('/', authMiddleware, hospitalController.list);
router.get('/:id', authMiddleware, hospitalController.getById);

router.post('/', authMiddleware, permissionMiddleware('manage_hospitals'), hospitalController.create);
router.put('/:id', authMiddleware, permissionMiddleware('manage_hospitals'), hospitalController.update);
router.delete('/:id', authMiddleware, permissionMiddleware('manage_hospitals'), hospitalController.remove);
router.patch('/status/:id', authMiddleware, permissionMiddleware('manage_hospitals'), hospitalController.setStatus);

module.exports = router;
