'use strict';

/**
 * Tiny file-based JSON store.
 *
 * - Creates data/ files (and upload directories) automatically when missing.
 * - Writes atomically (tmp file + rename) so a crash can never leave a
 *   half-written file behind.
 * - Never throws on a missing/corrupt file: the defaults are used and the file
 *   is rewritten, so the site cannot crash because of bad data.
 *
 * No database is used anywhere in this project.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const UPLOAD_SUBDIRS = ['images', 'thumbnails', 'logo', 'banners'];
const PUBLIC_DIR = path.join(ROOT, 'public');

const FILES = {
  settings: path.join(DATA_DIR, 'settings.json'),
  content: path.join(DATA_DIR, 'content.json'),
  admin: path.join(DATA_DIR, 'admin.json'),
};

/* ------------------------------------------------------------------ *
 * Defaults
 * ------------------------------------------------------------------ */

const DEFAULT_SETTINGS = {
  siteName: 'ToolBox',
  tagline: 'Free online tools that get the job done',
  metaDescription:
    'Free, fast and private online tools: compress images, generate QR codes and passwords, count words, format JSON, convert units and more. No sign-up, no limits.',
  baseUrl: '',
  supportEmail: 'support@example.com',
  footerText: '',
  defaultLogo: '/assets/logo.svg',
  social: { github: '', x: '' },
  updatedAt: null,
};

const DEFAULT_CONTENT = {
  hero: {
    eyebrow: '10 free tools, no sign-up',
    headline: 'Free Online Tools That Get the Job Done',
    subheadline:
      'Compress images, create QR codes, generate strong passwords, count words, format JSON, convert units and more. Every tool runs instantly — most of them right inside your browser.',
    imageId: null,
    primaryCta: { label: 'Browse all tools', href: '#tools' },
    secondaryCta: { label: 'Read about the project', href: '/about' },
  },
  banner: {
    title: 'Everyday utilities in one clean, fast place',
    text: 'No accounts, no watermarks, no upload limits hidden behind a paywall. Pick a tool, get your result and move on.',
    imageId: null,
  },
  promo: {
    title: 'Private by design',
    text: 'Password generation, word counting, JSON formatting, colour conversion, unit conversion, age calculation, URL encoding and text casing all happen inside your browser. Nothing is sent to this server. Only the image compressor and the QR generator need the server — and files you upload there are deleted immediately after processing.',
    imageId: null,
    bullets: [
      'Your text never leaves your device in the browser-only tools',
      'Uploaded images are processed in memory and never stored',
      'No tracking scripts, no third-party analytics',
    ],
  },
  faq: [
    {
      q: 'Are these tools really free?',
      a: 'Yes. Every tool on this site is free to use with no account, no credit card and no daily limit.',
    },
    {
      q: 'Do you store the files I upload?',
      a: 'No. Images sent to the image compressor are processed in memory and the temporary file is deleted as soon as the response is sent.',
    },
    {
      q: 'Does it work on mobile?',
      a: 'The whole site is mobile-first and tested from 360px wide phone screens up to large desktop displays.',
    },
    {
      q: 'Can I use the results commercially?',
      a: 'Yes. The tools only transform data you own, so the output is yours to use however you like.',
    },
  ],
  about: {
    title: 'About ToolBox',
    lede: 'A small, carefully built set of everyday utilities that work on any device and respect your privacy.',
    story: [
      'ToolBox started from a simple annoyance: most "free online tool" websites bury a single useful feature under adverts, pop-ups, forced sign-ups and long waits, and many of them quietly keep a copy of whatever you upload.',
      'This site takes the opposite approach. Each of the ten tools does one job well, loads in a fraction of a second and tells you plainly what it does. Eight of the ten tools run entirely in your browser, which means the text and numbers you type never travel over the network at all.',
      'The codebase is deliberately small: Node.js and Express on the server, plain HTML, CSS and JavaScript in the browser, and a handful of JSON files for content. That keeps the site fast, easy to audit and simple to extend with new tools later.',
    ],
    imageId: null,
    points: [
      {
        title: 'Actually functional',
        text: 'Every button, form and download on this site does real work. Nothing here is a mock-up.',
      },
      {
        title: 'Lightweight by default',
        text: 'No front-end framework, no tracking scripts and no unnecessary network requests. Pages are a handful of kilobytes.',
      },
      {
        title: 'Honest about limits',
        text: 'Upload limits, supported formats and error messages are stated up front instead of failing silently.',
      },
    ],
    stats: [
      { value: '10', label: 'working tools' },
      { value: '8', label: 'run fully in your browser' },
      { value: '0', label: 'tracking scripts' },
    ],
  },
  contact: {
    title: 'Contact',
    lede: 'Found a bug, spotted a wrong conversion, or want to suggest a new tool? Send a message using the form below.',
    email: 'support@example.com',
    responseNote:
      'Messages are stored on this server and shown in the admin panel. Expect a reply within a couple of working days.',
    imageId: null,
  },
};

/** Seeded admin account (replaced automatically on first login). */
const SEED_ADMIN = {
  username: 'admin',
  password: 'admin123',
  email: 'support@example.com',
};

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

/** Deep merge that keeps unknown keys from the file and fills missing ones. */
function deepMerge(base, override) {
  if (Array.isArray(base)) {
    return Array.isArray(override) ? override : base;
  }
  if (base && typeof base === 'object') {
    const out = {};
    const keys = new Set([
      ...Object.keys(base),
      ...(override && typeof override === 'object' ? Object.keys(override) : []),
    ]);
    for (const key of keys) {
      out[key] = deepMerge(base[key], override ? override[key] : undefined);
    }
    return out;
  }
  return override === undefined || override === null ? base : override;
}

function readJson(file, fallback) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim()) return { data: deepMerge(fallback, null), existed: false };
    return { data: deepMerge(fallback, JSON.parse(raw)), existed: true };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`[store] ${path.basename(file)} could not be read (${err.message}); using defaults.`);
    }
    return { data: deepMerge(fallback, null), existed: false };
  }
}

function writeJson(file, data) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

function randomFileName(ext) {
  const stamp = Date.now().toString(36);
  const rand = crypto.randomBytes(6).toString('hex');
  return `${stamp}-${rand}${ext}`;
}

/* ------------------------------------------------------------------ *
 * Bootstrap
 * ------------------------------------------------------------------ */

let settings = null;
let content = null;
let admin = null;

function bootstrap() {
  ensureDir(DATA_DIR);
  ensureDir(UPLOAD_DIR);
  for (const sub of UPLOAD_SUBDIRS) ensureDir(path.join(UPLOAD_DIR, sub));
  ensureDir(PUBLIC_DIR);

  const s = readJson(FILES.settings, DEFAULT_SETTINGS);
  settings = s.data;
  if (!s.existed) writeJson(FILES.settings, settings);

  const c = readJson(FILES.content, DEFAULT_CONTENT);
  content = c.data;
  if (!c.existed) writeJson(FILES.content, content);

  const a = readJson(FILES.admin, {});
  admin = {
    username: typeof a.data.username === 'string' && a.data.username ? a.data.username : SEED_ADMIN.username,
    email: typeof a.data.email === 'string' && a.data.email ? a.data.email : SEED_ADMIN.email,
    passwordHash: typeof a.data.passwordHash === 'string' ? a.data.passwordHash : '',
    passwordIsDefault: a.data.passwordIsDefault !== false,
    createdAt: a.data.createdAt || new Date().toISOString(),
    updatedAt: a.data.updatedAt || null,
  };

  // Seed credentials when no usable hash exists yet. The seed password is
  // re-hashed on first successful login and marked as changed, so the plain
  // seed text is never trusted again.
  if (!admin.passwordHash) {
    const hash = require('bcryptjs').hashSync(SEED_ADMIN.password, 10);
    admin.passwordHash = hash;
    admin.passwordIsDefault = true;
  }
  if (!a.existed || !a.data.passwordHash) writeJson(FILES.admin, admin);

  return { settings, content, admin };
}

/* ------------------------------------------------------------------ *
 * Accessors
 * ------------------------------------------------------------------ */

function getSettings() {
  if (!settings) bootstrap();
  return settings;
}

function getContent() {
  if (!content) bootstrap();
  return content;
}

function getAdmin() {
  if (!admin) bootstrap();
  return admin;
}

function saveSettings(patch) {
  settings = deepMerge(getSettings(), patch);
  settings.updatedAt = new Date().toISOString();
  writeJson(FILES.settings, settings);
  return settings;
}

function replaceContent(next) {
  content = deepMerge(DEFAULT_CONTENT, next);
  writeJson(FILES.content, content);
  return content;
}

function saveContent(patch) {
  content = deepMerge(getContent(), patch);
  writeJson(FILES.content, content);
  return content;
}

function saveAdmin(patch) {
  admin = { ...getAdmin(), ...patch, updatedAt: new Date().toISOString() };
  writeJson(FILES.admin, admin);
  return admin;
}

/* ------------------------------------------------------------------ *
 * Upload registry helpers
 * ------------------------------------------------------------------ */

function listUploads() {
  const out = { images: [], thumbnails: [], logo: [], banners: [] };
  for (const sub of UPLOAD_SUBDIRS) {
    const dir = path.join(UPLOAD_DIR, sub);
    let names = [];
    try {
      names = fs.readdirSync(dir);
    } catch (err) {
      names = [];
    }
    out[sub] = names
      .filter((n) => !n.startsWith('.'))
      .map((n) => {
        const abs = path.join(dir, n);
        let stat = { size: 0, mtimeMs: Date.now() };
        try {
          stat = fs.statSync(abs);
        } catch (err) {
          /* ignore */
        }
        return {
          // `name` is always the folder-qualified path used in data/content.json
          // (e.g. "images/abc123.jpg"); `fileName` is the bare file name used by
          // the replace/delete forms.
          name: `${sub}/${n}`,
          fileName: n,
          folder: sub,
          url: `/uploads/${sub}/${n}`,
          size: stat.size,
          modified: new Date(stat.mtimeMs).toISOString(),
        };
      })
      .sort((a, b) => (a.modified < b.modified ? 1 : -1));
  }
  return out;
}

function uploadPath(folder, name) {
  if (!UPLOAD_SUBDIRS.includes(folder)) return null;
  if (!/^[A-Za-z0-9._-]+$/.test(name || '')) return null;
  return path.join(UPLOAD_DIR, folder, name);
}

module.exports = {
  ROOT,
  DATA_DIR,
  UPLOAD_DIR,
  UPLOAD_SUBDIRS,
  PUBLIC_DIR,
  FILES,
  DEFAULT_SETTINGS,
  DEFAULT_CONTENT,
  bootstrap,
  deepMerge,
  randomFileName,
  getSettings,
  getContent,
  getAdmin,
  saveSettings,
  saveContent,
  replaceContent,
  saveAdmin,
  listUploads,
  uploadPath,
};
