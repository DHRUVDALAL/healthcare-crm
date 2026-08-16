'use strict';

const { fail } = require('../utils/response');

function roleMiddleware(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return fail(res, 401, 'Unauthorized');
    }

    if (!roles.includes(req.user.role)) {
      return fail(res, 403, 'Forbidden: Insufficient role');
    }

    return next();
  };
}

module.exports = roleMiddleware;
