'use strict';

const CustomRoleModel = require('../models/customRoleModel');
const { ok, fail } = require('../utils/response');

async function list(req, res) {
  try {
    const roles = await CustomRoleModel.list();
    return ok(res, { roles }, 'Custom roles');
  } catch (err) {
    return fail(res, 500, 'Failed to load roles');
  }
}

async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return fail(res, 400, 'Invalid role id');
    const role = await CustomRoleModel.getById(id);
    if (!role) return fail(res, 404, 'Role not found');
    const permissions = await CustomRoleModel.getPermissions(id);
    return ok(res, { role, permissions }, 'Role details');
  } catch (err) {
    return fail(res, 500, 'Failed to load role');
  }
}

async function create(req, res) {
  try {
    const { role_name, display_name, description } = req.body;
    if (!role_name || !display_name) return fail(res, 400, 'Role name and display name are required');
    const slug = role_name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const { id } = await CustomRoleModel.create({
      role_name: slug,
      display_name,
      description,
      created_by: req.user.id
    });
    return ok(res, { id }, 'Role created');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 400, 'Role name already exists');
    return fail(res, 500, 'Failed to create role');
  }
}

async function update(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return fail(res, 400, 'Invalid role id');
    const role = await CustomRoleModel.getById(id);
    if (!role) return fail(res, 404, 'Role not found');
    await CustomRoleModel.update(id, req.body);
    return ok(res, { updated: true }, 'Role updated');
  } catch (err) {
    return fail(res, 500, 'Failed to update role');
  }
}

async function remove(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return fail(res, 400, 'Invalid role id');
    const role = await CustomRoleModel.getById(id);
    if (!role) return fail(res, 404, 'Role not found');
    if (role.is_system) return fail(res, 400, 'Cannot delete system roles');
    await CustomRoleModel.delete(id);
    return ok(res, { deleted: true }, 'Role deleted');
  } catch (err) {
    return fail(res, 500, 'Failed to delete role');
  }
}

async function setPermissions(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return fail(res, 400, 'Invalid role id');
    const role = await CustomRoleModel.getById(id);
    if (!role) return fail(res, 404, 'Role not found');
    const { permission_ids } = req.body;
    if (!Array.isArray(permission_ids)) return fail(res, 400, 'permission_ids must be an array');
    await CustomRoleModel.setPermissions(id, permission_ids);
    return ok(res, { updated: true }, 'Permissions updated');
  } catch (err) {
    return fail(res, 500, 'Failed to update permissions');
  }
}

async function getAllPermissions(req, res) {
  try {
    const perms = await CustomRoleModel.getAllPermissions();
    return ok(res, { permissions: perms }, 'All permissions');
  } catch (err) {
    return fail(res, 500, 'Failed to load permissions');
  }
}

async function cloneRole(req, res) {
  try {
    const id = Number(req.params.id);
    const { role_name, display_name } = req.body;
    if (!id || !role_name || !display_name) return fail(res, 400, 'Source role id, new name and display name are required');
    const { id: newId } = await CustomRoleModel.cloneRole(id, role_name, display_name, req.user.id);
    return ok(res, { id: newId }, 'Role cloned');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 400, 'Role name already exists');
    return fail(res, 500, 'Failed to clone role');
  }
}

module.exports = { list, getById, create, update, remove, setPermissions, getAllPermissions, cloneRole };
