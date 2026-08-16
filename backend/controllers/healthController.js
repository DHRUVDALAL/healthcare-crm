'use strict';

const { getPool } = require('../config/db');
const { ok, fail } = require('../utils/response');

async function checkHealth(req, res) {
  const startTime = Date.now();
  const memoryUsage = process.memoryUsage();
  
  let dbStatus = 'healthy';
  let dbResponseTimeMs = 0;

  try {
    const dbStart = Date.now();
    const pool = getPool();
    await pool.query('SELECT 1');
    dbResponseTimeMs = Date.now() - dbStart;
  } catch (err) {
    dbStatus = 'unhealthy';
  }

  const isHealthy = dbStatus === 'healthy';
  const status = isHealthy ? 200 : 503;

  const payload = {
    status: isHealthy ? 'UP' : 'DOWN',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStatus,
      responseTimeMs: dbResponseTimeMs
    },
    memory: {
      heapUsedMb: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMb: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
      rssMb: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100
    },
    totalResponseTimeMs: Date.now() - startTime
  };

  return res.status(status).json({
    success: isHealthy,
    message: isHealthy ? 'System is healthy' : 'System degraded',
    data: payload
  });
}

module.exports = {
  checkHealth
};
