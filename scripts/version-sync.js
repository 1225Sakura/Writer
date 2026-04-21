/**
 * Version Sync Script
 * Synchronizes version number across all project modules.
 * Source of truth: electron/package.json
 */
const fs = require('fs');
const path = require('path');

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error('Usage: node version-sync.js <version> (e.g., 1.0.0)');
  process.exit(1);
}

function updateFile(filePath, description, updateFn) {
  try {
    updateFn(filePath);
    console.log(`  ${description.padEnd(30)} ${version}`);
  } catch (err) {
    console.error(`  FAILED ${description}: ${err.message}`);
    process.exit(1);
  }
}

console.log(`Syncing version ${version}...`);

// 1. Electron package.json (source of truth)
updateFile('electron/package.json', 'Electron package.json', (p) => {
  const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
});

// 2. Frontend package.json
updateFile('src/frontend/package.json', 'Frontend package.json', (p) => {
  const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
});

// 3. Backend config.py
updateFile('src/backend/config.py', 'Backend config.py', (p) => {
  let content = fs.readFileSync(p, 'utf8');
  content = content.replace(/app_version: str = "[^"]*"/, `app_version: str = "${version}"`);
  fs.writeFileSync(p, content);
});

// 4. VERSION file (for shell scripts / CI)
updateFile('VERSION', 'VERSION file', (p) => {
  fs.writeFileSync(p, version + '\n');
});

// 5. Backend __init__.py
updateFile('src/backend/__init__.py', 'Backend __init__.py', (p) => {
  let content = fs.readFileSync(p, 'utf8');
  // Replace or append __version__
  if (content.includes('__version__')) {
    content = content.replace(/__version__ = "[^"]*"/, `__version__ = "${version}"`);
  } else {
    content = content.trimEnd() + `\n\n__version__ = "${version}"\n`;
  }
  fs.writeFileSync(p, content);
});

console.log('Version sync complete.');
