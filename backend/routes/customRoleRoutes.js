'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/customRoleController');
const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');

router.use(authMiddleware);
router.use(permissionMiddleware('manage_employees'));

router.get('/permissions', controller.getAllPermissions);
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/permissions', controller.setPermissions);
router.post('/:id/clone', controller.cloneRole);

module.exports = router;
