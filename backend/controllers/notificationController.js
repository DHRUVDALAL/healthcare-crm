'use strict';

const NotificationModel = require('../models/notificationModel');
const { ok, fail } = require('../utils/response');

async function list(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const notifications = await NotificationModel.list(req.user.id, { limit, offset });
    const unreadCount = await NotificationModel.unreadCount(req.user.id);
    return ok(res, { notifications, unreadCount }, 'Notifications');
  } catch (err) {
    return fail(res, 500, 'Failed to load notifications');
  }
}

async function unreadCount(req, res) {
  try {
    const count = await NotificationModel.unreadCount(req.user.id);
    return ok(res, { unreadCount: count }, 'Unread count');
  } catch (err) {
    return fail(res, 500, 'Failed to get unread count');
  }
}

async function markRead(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid notification ID');

    const affected = await NotificationModel.markRead(id, req.user.id);
    if (!affected) return fail(res, 404, 'Notification not found');

    return ok(res, { marked: true }, 'Notification marked as read');
  } catch (err) {
    return fail(res, 500, 'Failed to mark notification');
  }
}

async function markAllRead(req, res) {
  try {
    const affected = await NotificationModel.markAllRead(req.user.id);
    return ok(res, { marked: affected }, 'All notifications marked as read');
  } catch (err) {
    return fail(res, 500, 'Failed to mark all notifications');
  }
}

async function remove(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'Invalid notification ID');

    const affected = await NotificationModel.delete(id, req.user.id);
    if (!affected) return fail(res, 404, 'Notification not found');

    return ok(res, { deleted: true }, 'Notification deleted');
  } catch (err) {
    return fail(res, 500, 'Failed to delete notification');
  }
}

module.exports = {
  list,
  unreadCount,
  markRead,
  markAllRead,
  remove
};
