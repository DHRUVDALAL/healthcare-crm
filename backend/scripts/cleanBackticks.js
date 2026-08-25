'use strict';

const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'generateMasterUserManual.js');
let code = fs.readFileSync(targetFile, 'utf8');

const markerStart = 'const htmlContent = `';
const markerEnd = '`;\n\nfs.writeFileSync';

const sPos = code.indexOf(markerStart);
const ePos = code.indexOf(markerEnd);

if (sPos !== -1 && ePos !== -1) {
  const head = code.slice(0, sPos + markerStart.length);
  const tail = code.slice(ePos);
  let body = code.slice(sPos + markerStart.length, ePos);
  
  body = body.replace(/`/g, '');
  
  fs.writeFileSync(targetFile, head + body + tail, 'utf8');
  console.log('✅ Backticks successfully cleaned from generateMasterUserManual.js!');
} else {
  console.error('❌ Could not locate markers in file.');
}
