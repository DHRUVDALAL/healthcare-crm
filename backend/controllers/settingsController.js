'use strict';

const path = require('path');
const fs = require('fs');
const SettingsModel = require('../models/settingsModel');
const { ok, fail } = require('../utils/response');

async function getPublicSettings(req, res) {
  try {
    const rows = await SettingsModel.getAll();
    const settings = {};
    rows.forEach(r => {
      settings[r.setting_key] = r.setting_value;
    });

    const publicBranding = {
      system_name: settings.system_name || settings.company_name || 'HealthCRM',
      system_logo: settings.system_logo || null
    };

    return ok(res, publicBranding, 'Public settings loaded');
  } catch (err) {
    return fail(res, 500, 'Failed to load public settings: ' + err.message);
  }
}

async function getSettings(req, res) {
  try {
    const rows = await SettingsModel.getAll();
    const settings = {};
    rows.forEach(r => {
      settings[r.setting_key] = r.setting_value;
    });
    if (!settings.system_name) {
      settings.system_name = settings.company_name || 'HealthCRM';
    }
    return ok(res, { settings }, 'System settings loaded');
  } catch (err) {
    return fail(res, 500, 'Failed to load settings');
  }
}

async function saveSettings(req, res) {
  try {
    const payload = req.body || {};
    // Only admins should save settings
    if (req.user.role !== 'admin') {
      return fail(res, 403, 'Access denied');
    }

    for (const [key, value] of Object.entries(payload)) {
      await SettingsModel.upsert(key, String(value ?? ''));
    }

    // Synchronize company_name if system_name is present
    if (payload.system_name) {
      await SettingsModel.upsert('company_name', String(payload.system_name));
    }

    return ok(res, { updated: true }, 'Settings saved successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to save settings: ' + err.message);
  }
}

async function uploadLogo(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return fail(res, 403, 'Access denied');
    }
    if (!req.file) {
      return fail(res, 400, 'No logo image file uploaded');
    }

    const logoUrl = '/uploads/' + req.file.filename;
    await SettingsModel.upsert('system_logo', logoUrl);

    return ok(res, { system_logo: logoUrl }, 'System logo uploaded successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to upload system logo: ' + err.message);
  }
}

module.exports = {
  getPublicSettings,
  getSettings,
  saveSettings,
  uploadLogo
};
