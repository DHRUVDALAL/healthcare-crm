'use strict';

const jwt = require('jsonwebtoken');
const { fail } = require('../utils/response');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return fail(res, 401, 'Unauthorized: Missing token');
  }

  const token = authHeader.substring('Bearer '.length);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.sub,
      role: decoded.role
    };
    return next();
  } catch (err) {
    return fail(res, 401, 'Unauthorized: Invalid or expired token');
  }
}

module.exports = authMiddleware;
