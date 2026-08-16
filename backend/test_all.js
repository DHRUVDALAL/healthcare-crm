'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const testFiles = [
  'test_phase1.js',
  'test_phase2.js',
  'test_phase3.js',
  'test_phase4.js',
  'test_phase5.js',
  'test_phase6.js'
];

const scratchDir = '/Users/dhruv/.gemini/antigravity-ide/brain/57d26fe6-9672-4e3a-bbb6-12be17d356a5/scratch';
const backendDir = __dirname;

console.log('=== Running HealthCRM Comprehensive Test Suite ===\n');

for (const file of testFiles) {
  const srcPath = path.join(scratchDir, file);
  const destPath = path.join(backendDir, file);

  console.log(`--------------------------------------------------`);
  console.log(`Starting execution: ${file}`);
  console.log(`--------------------------------------------------`);

  try {
    // Copy the test file to backend directory so relative requires work
    fs.copyFileSync(srcPath, destPath);

    // Execute
    execSync(`node "${destPath}"`, {
      cwd: backendDir,
      env: process.env,
      stdio: 'inherit'
    });

    console.log(`\n✓ ${file} passed successfully!\n`);
  } catch (err) {
    console.error(`\n❌ Execution failed on test: ${file}`);
    // Attempt cleanup
    try { fs.unlinkSync(destPath); } catch (e) {}
    process.exit(1);
  } finally {
    // Clean up copied file
    try {
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
    } catch (e) {}
  }
}

console.log('======================================================');
console.log('ALL PHASES COMPLETED AND VERIFIED SUCCESSFULLY! 🎉');
console.log('======================================================');
