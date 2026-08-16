'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');
const EmployeeLogModel = require('../models/employeeLogModel');
const { ok, fail } = require('../utils/response');

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    if (!isValidEmail(email)) {
      return fail(res, 400, 'Invalid email');
    }
    if (typeof password !== 'string' || password.length < 1) {
      return fail(res, 400, 'Password is required');
    }

    const user = await UserModel.findByEmail(email.toLowerCase());
    if (!user) {
      return fail(res, 401, 'Invalid credentials');
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return fail(res, 401, 'Invalid credentials');
    }

    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // Log login.
    await EmployeeLogModel.logLogin(user.id);

    return ok(res, {
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role
      }
    }, 'Login successful');
  } catch (err) {
    return fail(res, 500, 'Login failed');
  }
}

async function profile(req, res) {
  try {
    const user = await UserModel.findById(req.user.id);
    if (!user) {
      return fail(res, 404, 'User not found');
    }

    return ok(res, { user }, 'Profile loaded');
  } catch (err) {
    return fail(res, 500, 'Failed to load profile');
  }
}

async function logout(req, res) {
  try {
    await EmployeeLogModel.logLogout(req.user.id);
    return ok(res, { loggedOut: true }, 'Logged out');
  } catch (err) {
    return fail(res, 500, 'Logout failed');
  }
}

async function updateProfile(req, res) {
  try {
    const { full_name, email, phone, emergency_contact, address, theme, notification_preferences } = req.body || {};

    const currentUser = await UserModel.findById(req.user.id);
    if (!currentUser) return fail(res, 404, 'User not found');

    const targetName = full_name ? String(full_name).trim() : currentUser.full_name;
    const targetEmail = email ? String(email).trim().toLowerCase() : currentUser.email;

    if (!isValidEmail(targetEmail)) {
      return fail(res, 400, 'Invalid email address');
    }

    const payload = {
      full_name: targetName,
      email: targetEmail,
      phone: phone !== undefined ? phone : currentUser.phone,
      emergency_contact: emergency_contact !== undefined ? emergency_contact : currentUser.emergency_contact,
      address: address !== undefined ? address : currentUser.address,
      theme: theme || currentUser.theme || 'light',
      notification_preferences: notification_preferences ? JSON.stringify(notification_preferences) : currentUser.notification_preferences
    };

    await UserModel.updateProfile(req.user.id, payload);
    const updatedUser = await UserModel.findById(req.user.id);

    return ok(res, { user: updatedUser }, 'Profile updated successfully');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 400, 'Email already exists');
    return fail(res, 500, 'Failed to update profile');
  }
}

async function updatePassword(req, res) {
  try {
    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) {
      return fail(res, 400, 'Current password and new password are required');
    }

    const pool = require('../config/db').getPool();
    const [rows] = await pool.query('SELECT password FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    if (!rows.length) return fail(res, 404, 'User not found');

    const match = await bcrypt.compare(current_password, rows[0].password);
    if (!match) {
      return fail(res, 401, 'Invalid current password');
    }

    // Validate password policy
    const SettingsModel = require('../models/settingsModel');
    const settingsRows = await SettingsModel.getAll();
    const settings = {};
    settingsRows.forEach(r => {
      settings[r.setting_key] = r.setting_value;
    });

    const minLength = Number(settings.password_min_length || 8);
    const requireSpecial = settings.password_require_special === 'true';

    if (new_password.length < minLength) {
      return fail(res, 400, `Password must be at least ${minLength} characters long`);
    }

    if (requireSpecial) {
      const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
      if (!specialCharRegex.test(new_password)) {
        return fail(res, 400, 'Password must contain at least one special character');
      }
    }

    await UserModel.updatePassword(req.user.id, new_password);
    return ok(res, { updated: true }, 'Password updated successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to update password: ' + err.message);
  }
}

async function updatePhoto(req, res) {
  try {
    if (!req.file) {
      return fail(res, 400, 'No photo file uploaded');
    }

    const photoPath = `uploads/avatars/${req.file.filename}`;
    await UserModel.updatePhoto(req.user.id, photoPath);

    return ok(res, { photo_path: photoPath }, 'Profile photo updated successfully');
  } catch (err) {
    return fail(res, 500, 'Failed to upload photo: ' + err.message);
  }
}

module.exports = {
  login,
  profile,
  logout,
  updateProfile,
  updatePassword,
  updatePhoto
};
