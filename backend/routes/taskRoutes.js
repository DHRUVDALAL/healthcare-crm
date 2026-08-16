'use strict';

const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');
const taskController = require('../controllers/taskController');

const router = express.Router();

const { optionalUploadTaskAttachments } = require('../middleware/uploadMiddleware');

// Authenticated routes
router.get('/', authMiddleware, taskController.list);
router.get('/:id', authMiddleware, taskController.getById);
router.patch('/:id/status', authMiddleware, taskController.updateStatus);
router.patch('/:id/completion', authMiddleware, taskController.updateCompletion);
router.post('/:id/duplicate', authMiddleware, taskController.duplicateTask);
router.patch('/:id/archive', authMiddleware, taskController.archiveTask);

// Task comments
router.get('/:id/comments', authMiddleware, taskController.getComments);
router.post('/:id/comments', authMiddleware, taskController.addComment);
router.delete('/comments/:commentId', authMiddleware, taskController.deleteComment);

// Task attachments
router.get('/:id/attachments', authMiddleware, taskController.getAttachments);
router.post('/:id/attachments', authMiddleware, optionalUploadTaskAttachments, taskController.addAttachment);
router.delete('/attachments/:attachmentId', authMiddleware, taskController.deleteAttachment);

// Admin-only routes mapped to manage_tasks permission
router.post('/', authMiddleware, permissionMiddleware('manage_tasks'), taskController.create);
router.put('/:id', authMiddleware, permissionMiddleware('manage_tasks'), taskController.update);
router.patch('/:id/review', authMiddleware, permissionMiddleware('manage_tasks'), taskController.reviewTask);
router.delete('/:id', authMiddleware, permissionMiddleware('manage_tasks'), taskController.remove);

module.exports = router;
