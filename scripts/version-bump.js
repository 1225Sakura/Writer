/**
 * Version Bump Script
 * Bumps version in electron/package.json and syncs everywhere.
 * Usage: node version-bump.js [patch|minor|major]
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const type = process.argv[2] || 'patch';
if (!['patch', 'minor', 'major'].includes(type)) {
  console.error('Usage: node version-bump.js [patch|minor|major]');
  process.exit(1);
}

const pkgPath = path.join('electron', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

let [major, minor, patch] = pkg.version.split('.').map(Number);

if (type === 'patch') {
  patch += 1;
} else if (type === 'minor') {
  minor += 1;
  patch = 0;
} else if (type === 'major') {
  major += 1;
  minor = 0;
  patch = 0;
}

const newVersion = `${major}.${minor}.${patch}`;
pkg.version = newVersion;

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Bumped: ${pkg.version} -> ${newVersion}`);

// Auto-sync to all modules
const syncScript = path.join(__dirname, 'version-sync.js');
try {
  execSync(`node "${syncScript}" ${newVersion}`, { stdio: 'inherit' });
} catch (err) {
  console.error('Sync failed.');
  process.exit(1);
}
