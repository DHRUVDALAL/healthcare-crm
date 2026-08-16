'use strict';

const { simulateEndToEndAgencyWorkflow, getClientDemoReadinessStatus } = require('../services/clientDemoService');
const { ok, fail } = require('../utils/response');

/**
 * Serves Client Demo Readiness Status & Agency Health
 */
async function handleGetDemoStatus(req, res) {
  try {
    const status = await getClientDemoReadinessStatus();
    return ok(res, { status }, 'Client Demo readiness status retrieved');
  } catch (err) {
    return fail(res, 500, 'Failed to fetch demo status: ' + err.message);
  }
}

/**
 * Executes End-to-End Agency Recruitment Workflow Simulation
 */
async function handleSimulateWorkflow(req, res) {
  try {
    const result = await simulateEndToEndAgencyWorkflow(req.user.id);
    return ok(res, { result }, 'End-to-End agency recruitment workflow simulation executed successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to simulate agency workflow: ' + err.message);
  }
}

/**
 * Serves Client Demo Readiness Checklist
 */
async function handleGetDemoChecklist(req, res) {
  try {
    const status = await getClientDemoReadinessStatus();
    return ok(res, { checklist: status.client_demo_checklist }, 'Client demo readiness checklist retrieved');
  } catch (err) {
    return fail(res, 500, 'Failed to fetch demo checklist: ' + err.message);
  }
}

module.exports = {
  handleGetDemoStatus,
  handleSimulateWorkflow,
  handleGetDemoChecklist
};
