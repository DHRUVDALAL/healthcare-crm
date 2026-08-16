'use strict';

const NotificationModel = require('../models/notificationModel');
const { getPool } = require('../config/db');

/**
 * NotificationService — centralised notification creation.
 * Controllers call these helpers to fire notifications without
 * duplicating creation logic.
 */
const NotificationService = {
  /**
   * Send a notification to a specific user.
   */
  async notify(userId, { title, message, type, entityType, entityId }) {
    try {
      await NotificationModel.create({
        user_id: userId,
        title,
        message,
        notification_type: type,
        entity_type: entityType || null,
        entity_id: entityId || null
      });
    } catch (err) {
      // Notifications are non-critical — log and swallow errors
      console.error('[NotificationService] Failed to create notification:', err.message);
    }
  },

  /**
   * Send a notification to all admin users.
   */
  async notifyAdmins({ title, message, type, entityType, entityId }) {
    try {
      const pool = getPool();
      const [admins] = await pool.query(`SELECT id FROM users WHERE role = 'admin' AND status = 'active'`);
      for (const admin of admins) {
        await this.notify(admin.id, { title, message, type, entityType, entityId });
      }
    } catch (err) {
      console.error('[NotificationService] Failed to notify admins:', err.message);
    }
  },

  // --- Pre-built notification triggers ---

  async onTaskAssigned(task) {
    await this.notify(task.assigned_to, {
      title: 'New Task Assigned',
      message: `You have been assigned a new ${task.task_type} task: "${task.title}"`,
      type: 'task_assigned',
      entityType: 'task',
      entityId: task.id
    });
  },

  async onTaskOverdue(task) {
    await this.notify(task.assigned_to, {
      title: 'Task Overdue',
      message: `Your task "${task.title}" is overdue. Please update it immediately.`,
      type: 'task_overdue',
      entityType: 'task',
      entityId: task.id
    });
  },

  async onPipelineStageChange(application, newStage, recruiterId) {
    if (recruiterId) {
      await this.notify(recruiterId, {
        title: 'Pipeline Stage Updated',
        message: `Application #${application.id} has been moved to stage: ${newStage}`,
        type: 'pipeline_stage_change',
        entityType: 'application',
        entityId: application.id
      });
    }
  },

  async onInterviewScheduled(interview, recruiterId) {
    if (recruiterId) {
      await this.notify(recruiterId, {
        title: 'Interview Scheduled',
        message: `An interview has been scheduled on ${interview.interview_date} for application #${interview.application_id}`,
        type: 'interview_scheduled',
        entityType: 'interview',
        entityId: interview.id
      });
    }
    await this.notifyAdmins({
      title: 'Interview Scheduled',
      message: `Interview #${interview.id} scheduled for ${interview.interview_date}`,
      type: 'interview_scheduled',
      entityType: 'interview',
      entityId: interview.id
    });
  },

  async onLeaveSubmitted(leave, employeeName) {
    await this.notifyAdmins({
      title: 'Leave Request Submitted',
      message: `${employeeName} has submitted a ${leave.leave_type} leave request from ${leave.start_date} to ${leave.end_date}`,
      type: 'leave_submitted',
      entityType: 'leave',
      entityId: leave.id
    });
  },

  async onLeaveStatusChanged(leave, employeeId, status) {
    await this.notify(employeeId, {
      title: `Leave Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: `Your leave request from ${leave.start_date} to ${leave.end_date} has been ${status}`,
      type: 'leave_status_changed',
      entityType: 'leave',
      entityId: leave.id
    });
  },

  async onInvoiceOverdue(invoiceCount) {
    if (invoiceCount > 0) {
      await this.notifyAdmins({
        title: 'Invoices Overdue',
        message: `${invoiceCount} invoice(s) are now overdue. Please follow up on pending payments.`,
        type: 'invoice_overdue',
        entityType: 'invoice',
        entityId: null
      });
    }
  },

  async onCandidateAssigned(applicantId, applicantName, recruiterId) {
    await this.notify(recruiterId, {
      title: 'Candidate Assigned',
      message: `Candidate "${applicantName}" has been assigned to you`,
      type: 'candidate_assigned',
      entityType: 'applicant',
      entityId: applicantId
    });
  }
};

module.exports = NotificationService;
