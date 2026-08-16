'use strict';

const TaskModel = require('../models/taskModel');
const NotificationService = require('../services/notificationService');
const { ok, fail, created } = require('../utils/response');

function isNonEmptyString(v, maxLen = 2000) {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= maxLen;
}

function isValidTaskType(t) {
  return typeof t === 'string' && t.trim().length > 0;
}

function isValidPriority(p) {
  return p === 'high' || p === 'medium' || p === 'low';
}

function isValidStatus(s) {
  return s === 'pending' || s === 'in_progress' || s === 'completed' || s === 'blocked' || s === 'cancelled';
}

function isValidDate(d) {
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

async function checkTaskAccess(req, task) {
  const isAdmin = req.user.role === 'admin';
  const isAssignee = Number(task.assigned_to) === Number(req.user.id);
  const isAssigner = Number(task.assigned_by) === Number(req.user.id);
  if (!isAdmin && !isAssignee && !isAssigner) {
    throw new Error('Forbidden: Access denied to this task');
  }
}

async function list(req, res) {
  try {
    await TaskModel.updateOverdueStatus().catch(() => {});

    const { status, priority, type, employee_id } = req.query || {};
    const isAdmin = req.user.role === 'admin';

    const filterAssignedTo = isAdmin
      ? (employee_id ? Number(employee_id) : '')
      : req.user.id;

    const tasks = await TaskModel.list({
      assignedTo: filterAssignedTo,
      status: status ? String(status).trim().toLowerCase() : '',
      priority: priority ? String(priority).trim().toLowerCase() : '',
      type: type ? String(type).trim().toLowerCase() : ''
    });

    return ok(res, { tasks }, 'Tasks list');
  } catch (err) {
    return fail(res, 500, 'Failed to load tasks');
  }
}

async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid task ID');

    const task = await TaskModel.getById(id);
    if (!task) return fail(res, 404, 'Task not found');

    try {
      await checkTaskAccess(req, task);
    } catch (err) {
      return fail(res, 403, err.message);
    }

    return ok(res, { task }, 'Task detail');
  } catch (err) {
    return fail(res, 500, 'Failed to load task');
  }
}

async function create(req, res) {
  try {
    const { title, description, task_type, priority, assigned_to, due_date, due_time, completion_percentage } = req.body || {};

    if (!isNonEmptyString(title, 255)) return fail(res, 400, 'Title is required (max 255 chars)');
    if (!isValidTaskType(task_type)) return fail(res, 400, 'Invalid task type');
    if (!isValidPriority(priority)) return fail(res, 400, 'Invalid priority level');
    if (!Number.isInteger(Number(assigned_to)) || Number(assigned_to) <= 0) return fail(res, 400, 'Valid assigned user is required');
    if (!isValidDate(due_date)) return fail(res, 400, 'Due date is required (YYYY-MM-DD)');

    const payload = {
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      task_type: String(task_type).trim(),
      priority,
      status: 'pending',
      completion_percentage: Number(completion_percentage || 0),
      assigned_to: Number(assigned_to),
      assigned_by: Number(req.user.id),
      due_date,
      due_time: due_time ? String(due_time).trim() : null
    };

    const result = await TaskModel.create(payload);
    const createdTask = await TaskModel.getById(result.id);

    NotificationService.onTaskAssigned({ ...payload, id: result.id }).catch(() => {});

    return created(res, { task: createdTask }, 'Task created successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to create task');
  }
}

async function update(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid task ID');

    const existing = await TaskModel.getById(id);
    if (!existing) return fail(res, 404, 'Task not found');

    const { title, description, task_type, priority, status, completion_percentage, assigned_to, due_date, due_time } = req.body || {};

    if (!isNonEmptyString(title, 255)) return fail(res, 400, 'Title is required');
    if (!isValidTaskType(task_type)) return fail(res, 400, 'Invalid task type');
    if (!isValidPriority(priority)) return fail(res, 400, 'Invalid priority level');
    if (!isValidStatus(status)) return fail(res, 400, 'Invalid status');
    if (!Number.isInteger(Number(assigned_to)) || Number(assigned_to) <= 0) return fail(res, 400, 'Valid assigned user is required');
    if (!isValidDate(due_date)) return fail(res, 400, 'Due date is required');

    const payload = {
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      task_type: String(task_type).trim(),
      priority,
      status,
      completion_percentage: Number(completion_percentage || 0),
      assigned_to: Number(assigned_to),
      due_date,
      due_time: due_time ? String(due_time).trim() : null
    };

    await TaskModel.update(id, payload);
    const updated = await TaskModel.getById(id);
    return ok(res, { task: updated }, 'Task updated successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to update task');
  }
}

async function updateStatus(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid task ID');

    const task = await TaskModel.getById(id);
    if (!task) return fail(res, 404, 'Task not found');

    try {
      await checkTaskAccess(req, task);
    } catch (err) {
      return fail(res, 403, err.message);
    }

    const { status, completion_notes, completion_percentage } = req.body || {};
    if (!isValidStatus(status)) return fail(res, 400, 'Invalid status');

    await TaskModel.updateStatus(id, status, completion_notes, completion_percentage);
    const updated = await TaskModel.getById(id);
    return ok(res, { task: updated }, 'Task progress updated');
  } catch (err) {
    return fail(res, 500, 'Failed to update task progress');
  }
}

async function reviewTask(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid task ID');

    const task = await TaskModel.getById(id);
    if (!task) return fail(res, 404, 'Task not found');

    const { review_rating, review_notes } = req.body || {};
    const rating = Number(review_rating);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return fail(res, 400, 'Review rating must be an integer between 1 and 5');
    }

    await TaskModel.reviewTask(id, rating, review_notes);
    const updated = await TaskModel.getById(id);
    return ok(res, { task: updated }, 'Task review submitted successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to submit task review');
  }
}

async function remove(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid task ID');

    const result = await TaskModel.delete(id);
    if (!result.affectedRows) return fail(res, 404, 'Task not found');

    return ok(res, { deleted: true }, 'Task deleted successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to delete task');
  }
}

async function updateCompletion(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid task ID');

    const task = await TaskModel.getById(id);
    if (!task) return fail(res, 404, 'Task not found');

    try {
      await checkTaskAccess(req, task);
    } catch (err) {
      return fail(res, 403, err.message);
    }

    const completionPercentage = Number(req.body.completion_percentage);
    if (isNaN(completionPercentage) || completionPercentage < 0 || completionPercentage > 100) {
      return fail(res, 400, 'Completion percentage must be a number between 0 and 100');
    }

    await TaskModel.updateCompletion(id, completionPercentage);
    const updated = await TaskModel.getById(id);
    return ok(res, { task: updated }, 'Completion percentage updated');
  } catch (err) {
    return fail(res, 500, 'Failed to update completion percentage');
  }
}

async function getComments(req, res) {
  try {
    const id = Number(req.params.id);
    const task = await TaskModel.getById(id);
    if (!task) return fail(res, 404, 'Task not found');

    try {
      await checkTaskAccess(req, task);
    } catch (err) {
      return fail(res, 403, err.message);
    }

    const comments = await TaskModel.getComments(id);
    return ok(res, { comments }, 'Task comments loaded');
  } catch (err) {
    return fail(res, 500, 'Failed to load task comments');
  }
}

async function addComment(req, res) {
  try {
    const id = Number(req.params.id);
    const task = await TaskModel.getById(id);
    if (!task) return fail(res, 404, 'Task not found');

    try {
      await checkTaskAccess(req, task);
    } catch (err) {
      return fail(res, 403, err.message);
    }

    const { comment_text } = req.body || {};
    if (!isNonEmptyString(comment_text, 1000)) {
      return fail(res, 400, 'Comment text is required');
    }

    const result = await TaskModel.addComment(id, req.user.id, comment_text.trim());
    return created(res, { id: result.id }, 'Comment added');
  } catch (err) {
    return fail(res, 500, 'Failed to add comment');
  }
}

async function deleteComment(req, res) {
  try {
    const commentId = Number(req.params.commentId);
    // Any user can delete their own comment, or admin can delete any comment.
    // For simplicity, we just delete if the user is comment creator or admin.
    const pool = require('../config/db').getPool();
    const [rows] = await pool.query('SELECT user_id FROM task_comments WHERE id = ?', [commentId]);
    if (!rows.length) return fail(res, 404, 'Comment not found');

    if (req.user.role !== 'admin' && Number(rows[0].user_id) !== Number(req.user.id)) {
      return fail(res, 403, 'Forbidden: You cannot delete this comment');
    }

    await TaskModel.deleteComment(commentId);
    return ok(res, { deleted: true }, 'Comment deleted');
  } catch (err) {
    return fail(res, 500, 'Failed to delete comment');
  }
}

async function getAttachments(req, res) {
  try {
    const id = Number(req.params.id);
    const task = await TaskModel.getById(id);
    if (!task) return fail(res, 404, 'Task not found');

    try {
      await checkTaskAccess(req, task);
    } catch (err) {
      return fail(res, 403, err.message);
    }

    const attachments = await TaskModel.getAttachments(id);
    return ok(res, { attachments }, 'Task attachments loaded');
  } catch (err) {
    return fail(res, 500, 'Failed to load task attachments');
  }
}

async function addAttachment(req, res) {
  try {
    const id = Number(req.params.id);
    const task = await TaskModel.getById(id);
    if (!task) return fail(res, 404, 'Task not found');

    try {
      await checkTaskAccess(req, task);
    } catch (err) {
      return fail(res, 403, err.message);
    }

    if (!req.files || !req.files.length) {
      return fail(res, 400, 'No files uploaded');
    }

    for (const f of req.files) {
      const relativePath = `uploads/tasks/${f.filename}`;
      await TaskModel.addAttachment(id, f.originalname, relativePath, req.user.id);
    }

    return created(res, { uploaded: true }, 'Attachments added successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to add attachment');
  }
}

async function deleteAttachment(req, res) {
  try {
    const attachmentId = Number(req.params.attachmentId);
    const attachment = await TaskModel.getAttachmentById(attachmentId);
    if (!attachment) return fail(res, 404, 'Attachment not found');

    if (req.user.role !== 'admin' && Number(attachment.uploaded_by) !== Number(req.user.id)) {
      return fail(res, 403, 'Forbidden: You cannot delete this attachment');
    }

    // Unlink file
    const fs = require('fs');
    const path = require('path');
    const fullPath = path.join(__dirname, '..', attachment.file_path);
    if (fs.existsSync(fullPath)) {
      try { fs.unlinkSync(fullPath); } catch (e) {}
    }

    await TaskModel.deleteAttachment(attachmentId);
    return ok(res, { deleted: true }, 'Attachment deleted');
  } catch (err) {
    return fail(res, 500, 'Failed to delete attachment');
  }
}

async function duplicateTask(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid task id');

    const result = await TaskModel.duplicate(id);
    if (!result) return fail(res, 404, 'Task not found');

    return ok(res, { id: result.id }, 'Task duplicated successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to duplicate task: ' + err.message);
  }
}

async function archiveTask(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid task id');

    await TaskModel.archive(id);
    return ok(res, { archived: true }, 'Task archived successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to archive task: ' + err.message);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  updateStatus,
  updateCompletion,
  reviewTask,
  remove,
  getComments,
  addComment,
  deleteComment,
  getAttachments,
  addAttachment,
  deleteAttachment,
  duplicateTask,
  archiveTask
};
