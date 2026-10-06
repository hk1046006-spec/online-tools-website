'use strict';

/**
 * One-time seed of the demo content images.
 *
 * The project ships with four realistic photographs (JPG) at the project root.
 * This script processes each one with Sharp exactly the same way an admin
 * upload would be processed — re-encoded, resized, random filename, thumbnail —
 * and then points the matching content sections at the stored files.
 *
 * It is safe to run more than once:
 *   - an image is only regenerated when a section has no image assigned;
 *   - existing admin replacements are never overwritten.
 *
 * Run with:  npm run seed     (or: node scripts/seed-images.js)
 */

const fs = require('fs');
const path = require('path');
const store = require('../lib/store');
const uploads = require('../lib/uploads');

const SEEDS = [
  {
    slot: 'hero',
    folder: 'images',
    source: 'seed-hero.jpg',
    alt: 'A laptop, notebook, pen and a cup of coffee arranged on a wooden desk',
    maxWidth: 1600,
  },
  {
    slot: 'banner',
    folder: 'banners',
    source: 'seed-banner.jpg',
    alt: 'A bright desk with a laptop, a notebook and a mug beside a window',
    maxWidth: 1600,
  },
  {
    slot: 'promo',
    folder: 'images',
    source: 'seed-promo.jpg',
    alt: 'A closed laptop and a white table lamp on a plain desk',
    maxWidth: 1400,
  },
  {
    slot: 'about',
    folder: 'images',
    source: 'seed-about.jpg',
    alt: 'A tidy desk with a laptop, notebook and coffee seen from above',
    maxWidth: 1400,
  },
  {
    slot: 'contact',
    folder: 'images',
    source: 'seed-contact.jpg',
    alt: 'A laptop, a printer and a small plant on a white desk',
    maxWidth: 1400,
  },
];

async function main() {
  store.bootstrap();
  const content = store.getContent();
  const root = path.join(__dirname, '..');

  let seeded = 0;
  let skipped = 0;

  for (const seed of SEEDS) {
    const current = content[seed.slot] || {};
    if (current.imageId) {
      console.log(`· ${seed.slot}: already has ${current.imageId} — leaving it untouched.`);
      skipped += 1;
      continue;
    }

    const sourcePath = path.join(root, seed.source);
    if (!fs.existsSync(sourcePath)) {
      console.log(`· ${seed.slot}: source image ${seed.source} is missing — skipping.`);
      skipped += 1;
      continue;
    }

    const buffer = fs.readFileSync(sourcePath);
    const saved = await uploads.saveImage(buffer, seed.folder, { maxWidth: seed.maxWidth, quality: 82 });

    const patch = {};
    patch[seed.slot] = {
      imageId: saved.name,
      imageAlt: seed.alt,
    };
    store.saveContent(patch);
    seeded += 1;
    console.log(`✓ ${seed.slot}: ${seed.source} → uploads/${saved.name} (${saved.width}×${saved.height}, ${saved.size} bytes)`);
  }

  console.log('');
  console.log(`Seed complete: ${seeded} image(s) added, ${skipped} skipped.`);
  console.log('Admin replacements are stored in data/content.json, so they survive restarts.');
}

main().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exitCode = 1;
});
