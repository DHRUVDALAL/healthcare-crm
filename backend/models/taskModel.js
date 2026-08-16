'use strict';

const { getPool } = require('../config/db');

class TaskModel {
  static async list({ assignedTo, assignedBy, status, priority, type, limit = 200, offset = 0 } = {}) {
    const pool = getPool();
    const where = [];
    const params = [];

    if (assignedTo) {
      where.push('t.assigned_to = ?');
      params.push(Number(assignedTo));
    }

    if (assignedBy) {
      where.push('t.assigned_by = ?');
      params.push(Number(assignedBy));
    }

    if (status) {
      where.push('t.status = ?');
      params.push(status);
    }

    if (priority) {
      where.push('t.priority = ?');
      params.push(priority);
    }

    if (type) {
      where.push('t.task_type = ?');
      params.push(type);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT t.id, t.title, t.description, t.task_type, t.priority, t.status, t.completion_percentage,
              t.assigned_to, u1.full_name AS assignee_name,
              t.assigned_by, u2.full_name AS assigner_name,
              t.due_date, t.due_time, t.completed_at, t.completion_notes,
              t.review_notes, t.review_rating, t.created_at, t.updated_at
       FROM tasks t
       JOIN users u1 ON t.assigned_to = u1.id
       JOIN users u2 ON t.assigned_by = u2.id
       ${whereSql}
       ORDER BY t.due_date ASC, t.priority DESC, t.id DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    return rows;
  }

  static async getById(id) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT t.id, t.title, t.description, t.task_type, t.priority, t.status, t.completion_percentage,
              t.assigned_to, u1.full_name AS assignee_name,
              t.assigned_by, u2.full_name AS assigner_name,
              t.due_date, t.due_time, t.completed_at, t.completion_notes,
              t.review_notes, t.review_rating, t.created_at, t.updated_at
       FROM tasks t
       JOIN users u1 ON t.assigned_to = u1.id
       JOIN users u2 ON t.assigned_by = u2.id
       WHERE t.id = ?
       LIMIT 1`,
      [Number(id)]
    );
    return rows[0] || null;
  }

  static async create(payload) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO tasks (title, description, task_type, priority, status, completion_percentage, assigned_to, assigned_by, due_date, due_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.title,
        payload.description || null,
        payload.task_type || 'daily',
        payload.priority || 'medium',
        payload.status || 'pending',
        Number(payload.completion_percentage || 0),
        Number(payload.assigned_to),
        Number(payload.assigned_by),
        payload.due_date,
        payload.due_time || null
      ]
    );
    return { id: result.insertId };
  }

  static async update(id, payload) {
    const pool = getPool();
    const [result] = await pool.query(
      `UPDATE tasks
       SET title = ?, description = ?, task_type = ?, priority = ?, status = ?, completion_percentage = ?, assigned_to = ?, due_date = ?, due_time = ?
       WHERE id = ?`,
      [
        payload.title,
        payload.description || null,
        payload.task_type,
        payload.priority,
        payload.status,
        Number(payload.completion_percentage || 0),
        Number(payload.assigned_to),
        payload.due_date,
        payload.due_time || null,
        Number(id)
      ]
    );
    return { affectedRows: result.affectedRows };
  }

  static async updateStatus(id, status, notes, completionPct) {
    const pool = getPool();
    const completedAt = status === 'completed' ? new Date() : null;
    const finalPct = status === 'completed' ? 100 : Number(completionPct ?? 0);

    const [result] = await pool.query(
      `UPDATE tasks
       SET status = ?, completion_percentage = ?, completion_notes = ?, completed_at = ?
       WHERE id = ?`,
      [status, finalPct, notes || null, completedAt, Number(id)]
    );
    return { affectedRows: result.affectedRows };
  }

  static async updateCompletion(id, completionPct) {
    const pool = getPool();
    const pct = Math.min(100, Math.max(0, Number(completionPct || 0)));
    const status = pct === 100 ? 'completed' : undefined;
    
    let query = 'UPDATE tasks SET completion_percentage = ?';
    const params = [pct];
    if (pct === 100) {
      query += ', status = ?, completed_at = ?';
      params.push('completed', new Date());
    }
    query += ' WHERE id = ?';
    params.push(Number(id));

    const [result] = await pool.query(query, params);
    return { affectedRows: result.affectedRows };
  }

  static async reviewTask(id, rating, notes) {
    const pool = getPool();
    const [result] = await pool.query(
      `UPDATE tasks
       SET review_rating = ?, review_notes = ?
       WHERE id = ?`,
      [Number(rating), notes || null, Number(id)]
    );
    return { affectedRows: result.affectedRows };
  }

  static async delete(id) {
    const pool = getPool();
    const [result] = await pool.query('DELETE FROM tasks WHERE id = ?', [Number(id)]);
    return { affectedRows: result.affectedRows };
  }

  static async updateOverdueStatus() {
    const pool = getPool();
    const today = new Date().toISOString().slice(0, 10);
    const [result] = await pool.query(
      `UPDATE tasks
       SET status = 'pending'
       WHERE due_date < ? AND status IN ('pending', 'in_progress')`,
      [today]
    );
    return { affectedRows: result.affectedRows };
  }

  static async getComments(taskId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT tc.*, u.full_name AS user_name, u.role AS user_role
       FROM task_comments tc
       JOIN users u ON tc.user_id = u.id
       WHERE tc.task_id = ?
       ORDER BY tc.created_at ASC`,
      [Number(taskId)]
    );
    return rows;
  }

  static async addComment(taskId, userId, commentText) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO task_comments (task_id, user_id, comment_text)
       VALUES (?, ?, ?)`,
      [Number(taskId), Number(userId), commentText]
    );
    return { id: result.insertId };
  }

  static async deleteComment(commentId) {
    const pool = getPool();
    const [result] = await pool.query(
      'DELETE FROM task_comments WHERE id = ?',
      [Number(commentId)]
    );
    return { affectedRows: result.affectedRows };
  }

  static async getAttachments(taskId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT ta.*, u.full_name AS uploaded_by_name
       FROM task_attachments ta
       JOIN users u ON ta.uploaded_by = u.id
       WHERE ta.task_id = ?
       ORDER BY ta.created_at ASC`,
      [Number(taskId)]
    );
    return rows;
  }

  static async addAttachment(taskId, fileName, filePath, uploadedBy) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO task_attachments (task_id, file_name, file_path, uploaded_by)
       VALUES (?, ?, ?, ?)`,
      [Number(taskId), fileName, filePath, Number(uploadedBy)]
    );
    return { id: result.insertId };
  }

  static async getAttachmentById(id) {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM task_attachments WHERE id = ? LIMIT 1', [Number(id)]);
    return rows[0] || null;
  }

  static async deleteAttachment(id) {
    const pool = getPool();
    const [result] = await pool.query('DELETE FROM task_attachments WHERE id = ?', [Number(id)]);
    return { affectedRows: result.affectedRows };
  }
  static async duplicate(id) {
    const pool = getPool();
    const task = await TaskModel.getById(id);
    if (!task) return null;

    const [result] = await pool.query(
      `INSERT INTO tasks (
        title, description, task_type, priority, status, completion_percentage,
        assigned_to, assigned_by, due_date, due_time
      ) VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?)`,
      [
        `Copy of ${task.title}`, task.description || null, task.task_type,
        task.priority, task.assigned_to, task.assigned_by, task.due_date, task.due_time || null
      ]
    );
    return { id: result.insertId };
  }

  static async archive(id) {
    const pool = getPool();
    const [result] = await pool.query('UPDATE tasks SET is_archived = 1 WHERE id = ?', [Number(id)]);
    return { affectedRows: result.affectedRows };
  }
}

module.exports = TaskModel;
