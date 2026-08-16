'use strict';

const assert = require('assert');
const app = require('../backend/app');
const { getPool } = require('../backend/config/db');

const PORT = 5053;
const BASE_URL = `http://localhost:${PORT}`;

async function run(log) {
  const server = app.listen(PORT);
  await new Promise((resolve) => server.once('listening', resolve));
  log(`Security check server listening on ${BASE_URL}`);

  const pool = getPool();

  try {
    // 1. Check Helmet Security Headers
    const rootRes = await fetch(`${BASE_URL}/`);
    const headers = rootRes.headers;
    
    // Helmet disables X-Powered-By, sets Content-Security-Policy, X-Content-Type-Options, etc.
    const xPoweredBy = headers.get('x-powered-by');
    assert(!xPoweredBy, 'Helmet should disable x-powered-by header to prevent server fingerprinting');
    log('✓ Security: Server fingerprinting disabled (no x-powered-by)');

    const xContentTypeOptions = headers.get('x-content-type-options');
    assert.strictEqual(xContentTypeOptions, 'nosniff', 'x-content-type-options header must be nosniff');
    log('✓ Security: MIME sniffing protection enabled (nosniff)');

    // 2. Check Database Password Storage
    const [userRows] = await pool.query('SELECT password FROM users LIMIT 5');
    for (const r of userRows) {
      assert(r.password.startsWith('$2b$') || r.password.startsWith('$2a$'), 'All passwords in database must be hashed using strong Bcrypt');
    }
    log(`✓ Security: Database storage check: verified ${userRows.length} password hashes are strongly encrypted with Bcrypt`);

    // 3. Probing for SQL injection on endpoints
    // Attempt querying /api/jobs with a bad query parameter
    const sqliRes = await fetch(`${BASE_URL}/api/jobs?search='+OR+1%3D1--`);
    // Expected response should be 401 Unauthorized (since it requires token) or if open, a safe empty list.
    // If it throws a 500 error due to database syntax exception, then SQL Injection exists!
    assert.notStrictEqual(sqliRes.status, 500, 'Endpoint should not crash with a database syntax error on malicious SQL characters');
    log('✓ Security: SQL injection input validation test passed');

  } finally {
    server.close();
    log('Security check server stopped.');
  }
}

module.exports = { run };
