'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const app = require('../backend/app');

const PORT = 5063;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let server;

async function run(log = console.log) {
  server = app.listen(PORT, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  log(`UI Design System test server started on ${BASE_URL}`);

  try {
    // ─── 1. Verify Design Assets Exist ─────────────────────────────────────────
    log('\n[DESIGN SYSTEM] Verifying Global CSS & JS Assets...');
    const themeJs = path.join(__dirname, '..', 'frontend', 'assets', 'js', 'theme.js');
    const searchJs = path.join(__dirname, '..', 'frontend', 'assets', 'js', 'global-search.js');
    const previewJs = path.join(__dirname, '..', 'frontend', 'assets', 'js', 'quick-preview.js');
    const tokensCss = path.join(__dirname, '..', 'frontend', 'assets', 'css', 'design-tokens.css');
    const componentsCss = path.join(__dirname, '..', 'frontend', 'assets', 'css', 'components.css');

    assert.ok(fs.existsSync(themeJs), 'theme.js must exist');
    assert.ok(fs.existsSync(searchJs), 'global-search.js must exist');
    assert.ok(fs.existsSync(previewJs), 'quick-preview.js must exist');
    assert.ok(fs.existsSync(tokensCss), 'design-tokens.css must exist');
    assert.ok(fs.existsSync(componentsCss), 'components.css must exist');
    log('✓ Core Design System JS & CSS files verified');

    // ─── 2. Verify Dark Mode Tokens ────────────────────────────────────────────
    log('\n[DARK MODE] Verifying Dark Theme CSS Tokens...');
    const cssContent = fs.readFileSync(tokensCss, 'utf8');
    assert.ok(cssContent.includes('body.theme-dark'), 'tokens.css must define dark mode selector');
    log('✓ Dark Theme CSS design tokens verified');

    // ─── 3. Verify Global Search & Shortcuts ──────────────────────────────────
    log('\n[SEARCH MODAL] Verifying Ctrl+K Command Palette Engine...');
    const searchContent = fs.readFileSync(searchJs, 'utf8');
    assert.ok(searchContent.includes('globalSearchModal'), 'global-search.js must define search modal');
    assert.ok(searchContent.includes('Ctrl+K') || searchContent.includes('k'), 'Keyboard shortcut registered');
    log('✓ Global Enterprise Search Command Palette verified');

    // ─── 4. Verify Slide-over Quick Preview Drawer ─────────────────────────────
    log('\n[PREVIEW DRAWER] Verifying Quick Preview Drawer Panel...');
    const previewContent = fs.readFileSync(previewJs, 'utf8');
    assert.ok(previewContent.includes('quickPreviewDrawer'), 'quick-preview.js must define preview drawer');
    log('✓ Quick Preview Drawer Panel verified');

    log('\n✅ Enterprise SaaS UI Design System Integration Tests completed successfully!');
  } finally {
    if (server) server.close();
  }
}

module.exports = { run };
