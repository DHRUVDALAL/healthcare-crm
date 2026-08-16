'use strict';

function ok(res, data, message) {
  return res.status(200).json({
    success: true,
    message: message || 'OK',
    data
  });
}

function created(res, data, message) {
  return res.status(201).json({
    success: true,
    message: message || 'Created',
    data
  });
}

function fail(res, statusCode, message, details) {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {})
  });
}

module.exports = {
  ok,
  created,
  fail
};
