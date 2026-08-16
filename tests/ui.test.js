'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

async function run(log) {
  log('Starting UI Integrity and Layout Tests...');

  const pagesDir = path.join(__dirname, '..', 'frontend', 'pages');
  const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));

  log(`Discovered ${files.length} pages under frontend/pages/`);

  for (const file of files) {
    const filePath = path.join(pagesDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // 1. Structure sanity checks
    assert(content.includes('<html') || content.includes('<HTML'), `${file} missing <html> tag`);
    assert(content.includes('api.js'), `${file} missing api.js script reference`);
    assert(content.includes('auth.js'), `${file} missing auth.js script reference`);
    log(`✓ Base scripts verified on page "${file}"`);

    const hasSidebar = content.includes('class="sidebar"') || content.includes('class=\'sidebar\'') || content.includes('<aside');

    if (hasSidebar) {
      assert(content.includes('sidebar.js'), `${file} missing sidebar.js script reference`);
      assert(content.includes('id="userName"'), `${file} missing placeholder ID "userName"`);
      assert(content.includes('id="userRole"'), `${file} missing placeholder ID "userRole"`);
      log(`✓ Sidebar components verified on page "${file}"`);

      // 4. Logout anchor element validation
      const hasLogoutAction = content.includes('data-logout') || content.includes('id="logoutBtn"');
      assert(hasLogoutAction, `${file} missing logout binding trigger`);
      log(`✓ Logout bindings verified on page "${file}"`);
    }

    // 3. Duplicate IDs check
    const idMatches = content.match(/id="([^"]+)"/g) || [];
    const ids = idMatches.map(m => m.slice(4, -1));
    const seenIds = new Set();
    const duplicateIds = [];
    for (const id of ids) {
      if (seenIds.has(id)) {
        duplicateIds.push(id);
      }
      seenIds.add(id);
    }
    assert.strictEqual(duplicateIds.length, 0, `Page "${file}" contains duplicate IDs: ${duplicateIds.join(', ')}`);
    log(`✓ Element IDs uniqueness check passed on page "${file}"`);
  }

  log('All UI integrity, script structures, and layout consistency tests PASSED.');
}

module.exports = { run };
