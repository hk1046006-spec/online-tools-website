'use strict';

/**
 * Factory reset — restores the site to its first-run state.
 *
 * Deletes data/settings.json, data/content.json, data/admin.json,
 * data/messages.json, the stored sessions and every uploaded image, then
 * re-creates the default files and re-seeds the demo photographs.
 *
 * Usage:
 *   npm run reset -- --yes        (the --yes flag is required)
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const FOLDERS = ['images', 'thumbnails', 'logo', 'banners'];

if (!process.argv.includes('--yes')) {
  console.log('');
  console.log('This would delete every uploaded image, all saved content, the admin');
  console.log('account and the stored sessions, then restore the defaults.');
  console.log('');
  console.log('Run it again with --yes to confirm:');
  console.log('  npm run reset -- --yes');
  console.log('');
  process.exit(0);
}

console.log('\nResetting ToolBox to its first-run state…\n');

/* Remove stored data files (they are recreated automatically). */
let removed = 0;
for (const file of fs.readdirSync(DATA_DIR)) {
  const full = path.join(DATA_DIR, file);
  if (!fs.statSync(full).isFile()) continue;
  fs.unlinkSync(full);
  removed += 1;
  console.log(`· removed data/${file}`);
}

/* Remove uploaded images. */
let images = 0;
for (const folder of FOLDERS) {
  const dir = path.join(UPLOAD_DIR, folder);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith('.')) continue;
    fs.unlinkSync(path.join(dir, file));
    images += 1;
  }
}
console.log(`· removed ${images} uploaded file(s)`);
console.log(`· removed ${removed} data file(s)`);

/* Recreate the defaults + seed images. */
const store = require('../lib/store');
store.bootstrap();
console.log('· default data files recreated');

execFileSync(process.execPath, [path.join(__dirname, 'seed-images.js')], { cwd: ROOT, stdio: 'inherit' });

console.log('');
console.log('Reset complete. Default admin credentials: admin / admin123');
console.log('Start the site again with:  node server.js');
console.log('');
