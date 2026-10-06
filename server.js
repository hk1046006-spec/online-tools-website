'use strict';

/* ==========================================================================
   ToolBox — online tools website
   Node.js + Express server. File-based storage, no database.
   Run with:  node server.js
   ========================================================================== */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const sharp = require('sharp');
const { rateLimit } = require('express-rate-limit');

const store = require('./lib/store');
const tools = require('./lib/tools');
const templates = require('./lib/templates');
const uploadsLib = require('./lib/uploads');
const FileSessionStore = require('./lib/session-store');

const pagesSite = require('./lib/pages/site');
const pagesTools = require('./lib/pages/tools');
const pagesToolsExtra = require('./lib/pages/tools-extra');
const pagesAdmin = require('./lib/pages/admin');

/* ------------------------------------------------------------------ *
 * Configuration
 * ------------------------------------------------------------------ */

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const SESSION_FILE = path.join(__dirname, 'data', 'sessions.json');
const MESSAGES_FILE = path.join(__dirname, 'data', 'messages.json');

/* ------------------------------------------------------------------ *
 * Bootstrap storage (creates data/ and uploads/ if they are missing)
 * ------------------------------------------------------------------ */

store.bootstrap();

function getSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const file = path.join(__dirname, 'data', 'session-secret.txt');
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch (err) {
    /* file does not exist yet */
  }
  const secret = crypto.randomBytes(48).toString('hex');
  try {
    fs.writeFileSync(file, secret, { mode: 0o600 });
  } catch (err) {
    console.warn('[server] could not persist the session secret; sessions will not survive a restart.');
  }
  return secret;
}

const app = express();
app.disable('x-powered-by');
app.set('etag', 'strong');
// Strict routing keeps "/tools" and "/tools/" as separate URLs, so the
// canonical redirects below can never shadow the real pages.
app.set('strict routing', true);

/* ------------------------------------------------------------------ *
 * Security headers
 * ------------------------------------------------------------------ */

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"], // inline style attributes are used for colour previews
        'img-src': ["'self'", 'data:', 'blob:'],
        // data: is required by the image compressor, which turns the base64
        // image URL returned by /api/image/compress into a Blob for download.
        'connect-src': ["'self'", 'data:'],
        'font-src': ["'self'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'self'", 'https://*.e2b.app'],
        'upgrade-insecure-requests': null,
      },
    },
    // frame-ancestors above replaces X-Frame-Options; keeping both would block
    // legitimate previews without adding protection in modern browsers.
    xFrameOptions: false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

/* ------------------------------------------------------------------ *
 * Sessions
 * ------------------------------------------------------------------ */

app.use(
  session({
    name: 'toolbox.sid',
    secret: getSessionSecret(),
    store: new FileSessionStore(SESSION_FILE),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      // Set to true when the site is served over HTTPS (see README).
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: 8 * 60 * 60 * 1000,
    },
  })
);

/* ------------------------------------------------------------------ *
 * Body parsers, static files
 * ------------------------------------------------------------------ */

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));

/**
 * Uploaded files are served read-only and only with image extensions, so a
 * file that somehow ended up there with a script extension can never be
 * requested, let alone executed.
 */
app.use(
  '/uploads',
  (req, res, next) => {
    const allowed = /\.(jpe?g|png|webp|gif|svg)$/i;
    if (!allowed.test(req.path)) {
      return res.status(404).type('text/plain').send('Not found');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    return next();
  },
  express.static(UPLOAD_DIR, { maxAge: '7d', index: false, dotfiles: 'deny' })
);

/* ------------------------------------------------------------------ *
 * Request helpers
 * ------------------------------------------------------------------ */

function sameOriginOnly(req, res, next) {
  const origin = req.get('origin');
  if (!origin) return next(); // same-origin fetches from some browsers omit it
  try {
    const originHost = new URL(origin).host;
    if (originHost === req.get('host')) return next();
  } catch (err) {
    return res.status(403).json({ success: false, error: 'This request was blocked for security reasons.' });
  }
  return res.status(403).json({ success: false, error: 'Cross-site requests are not allowed.' });
}

function apiLimiter(max, windowMinutes) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler(req, res) {
      res.status(429).json({
        success: false,
        error: 'Too many requests from this address. Please wait a few minutes and try again.',
      });
    },
  });
}

function currentYear() {
  return new Date().getFullYear();
}

/* ------------------------------------------------------------------ *
 * Public pages
 * ------------------------------------------------------------------ */

app.get('/', (req, res) => {
  res.type('html').send(pagesSite.homePage());
});

// Canonical trailing-slash redirects for the static public pages.
app.get('/tools/', (req, res) => res.redirect(301, '/tools'));
app.get('/about/', (req, res) => res.redirect(301, '/about'));
app.get('/contact/', (req, res) => res.redirect(301, '/contact'));

app.get('/tools', (req, res) => {
  res.type('html').send(pagesToolsExtra.toolsIndex());
});

app.get('/about', (req, res) => {
  res.type('html').send(pagesSite.aboutPage());
});

app.get('/contact', (req, res) => {
  res.type('html').send(pagesSite.contactPage());
});

/* ---- tool pages -------------------------------------------------- */

const TOOL_RENDERERS = {
  'image-compressor': pagesTools.imageCompressor,
  'qr-code-generator': pagesTools.qrGenerator,
  'password-generator': pagesTools.passwordGenerator,
  'word-counter': pagesTools.wordCounter,
  'json-formatter': pagesTools.jsonFormatter,
  'color-picker': pagesToolsExtra.colorPicker,
  'unit-converter': pagesToolsExtra.unitConverter,
  'age-calculator': pagesToolsExtra.ageCalculator,
  'url-encoder': pagesToolsExtra.urlEncoder,
  'text-case-converter': pagesToolsExtra.textCaseConverter,
};

tools.TOOLS.forEach((tool) => {
  const render = TOOL_RENDERERS[tool.slug];
  if (typeof render !== 'function') {
    throw new Error(`No renderer registered for the tool “${tool.slug}”.`);
  }
  app.get(tool.url, (req, res) => {
    res.type('html').send(render());
  });
  // A trailing slash redirects to the canonical URL so every page has exactly
  // one address (better for search engines and for relative links).
  app.get(`${tool.url}/`, (req, res) => res.redirect(301, tool.url));
});

/* ---- robots.txt and sitemap.xml ---------------------------------- */

function siteBaseUrl(req) {
  const configured = (store.getSettings().baseUrl || '').replace(/\/+$/, '');
  if (configured) return configured;
  return `${req.protocol}://${req.get('host')}`;
}

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /admin/',
      'Disallow: /uploads/thumbnails/',
      '',
      `Sitemap: ${siteBaseUrl(req)}/sitemap.xml`,
      '',
    ].join('\n')
  );
});

app.get('/sitemap.xml', (req, res) => {
  const base = siteBaseUrl(req);
  const lastmod = (store.getSettings().updatedAt || new Date().toISOString()).slice(0, 10);

  const urls = [
    { loc: '/', priority: '1.0', changefreq: 'weekly' },
    { loc: '/tools', priority: '0.9', changefreq: 'weekly' },
    ...tools.TOOLS.map((tool) => ({ loc: tool.url, priority: '0.9', changefreq: 'monthly' })),
    { loc: '/about', priority: '0.5', changefreq: 'yearly' },
    { loc: '/contact', priority: '0.5', changefreq: 'yearly' },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${base}${url.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;
  res.type('application/xml').send(xml);
});

/* ---- static assets (CSS, JS, images, robots.txt fallbacks) --------
   Registered after the page routes so that a folder such as /tools can never
   shadow a real page with a directory redirect. */
app.use(
  express.static(PUBLIC_DIR, {
    maxAge: '1h',
    redirect: false,
    setHeaders(res, filePath) {
      if (/\.html$/.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
    },
  })
);

/* ------------------------------------------------------------------ *
 * Public APIs
 * ------------------------------------------------------------------ */

/* ---- QR code generation ---- */

app.post('/api/qr/generate', apiLimiter(90, 15), sameOriginOnly, async (req, res) => {
  try {
    const body = req.body || {};
    const text = typeof body.text === 'string' ? body.text : '';
    const size = Math.min(1024, Math.max(128, Number(body.size) || 320));
    const level = ['L', 'M', 'Q', 'H'].includes(String(body.level)) ? String(body.level) : 'M';

    if (!text.trim()) {
      return res.status(400).json({ success: false, error: 'Please enter some text or a URL before generating a QR code.' });
    }
    if (text.length > 2000) {
      return res.status(400).json({
        success: false,
        error: `That content is ${text.length} characters long. The limit for reliable scanning is 2000 characters.`,
      });
    }

    const buffer = await QRCode.toBuffer(text, {
      type: 'png',
      errorCorrectionLevel: level,
      width: size,
      margin: 2,
      color: { dark: '#000000ff', light: '#ffffffff' },
    });

    return res.json({
      success: true,
      dataUrl: `data:image/png;base64,${buffer.toString('base64')}`,
      text,
      size,
      level,
      bytes: buffer.length,
    });
  } catch (err) {
    console.error('[api/qr/generate]', err.message);
    return res.status(500).json({ success: false, error: 'The QR code could not be generated. Please try again.' });
  }
});

/* ---- Image compression ---- */

const compressUpload = uploadsLib.makeUploader(uploadsLib.COMPRESS_MAX_BYTES);

app.post(
  '/api/image/compress',
  apiLimiter(40, 15),
  sameOriginOnly,
  (req, res, next) => {
    compressUpload.single('image')(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          error: 'That image is larger than the 4 MB limit. Please choose a smaller file.',
        });
      }
      if (err.code === 'UNSUPPORTED_TYPE') {
        return res.status(415).json({ success: false, error: err.message });
      }
      return res.status(400).json({ success: false, error: 'The upload could not be processed.' });
    });
  },
  async (req, res) => {
    try {
      if (!req.file || !req.file.buffer || !req.file.buffer.length) {
        return res.status(400).json({ success: false, error: 'No image was received. Please choose a JPG or PNG file.' });
      }

      const quality = Number(req.body.quality) || 75;
      const format = ['auto', 'jpeg', 'png', 'webp'].includes(String(req.body.format)) ? String(req.body.format) : 'auto';
      const maxWidth = Math.max(0, Math.min(6000, Number(req.body.maxWidth) || 0));

      // Re-read the file with Sharp: this rejects anything that only pretends
      // to be an image (wrong magic bytes, renamed executables, corrupt data).
      let metadata;
      try {
        metadata = await sharp(req.file.buffer, { failOn: 'error' }).metadata();
      } catch (err) {
        return res.status(415).json({
          success: false,
          error: 'That file is not a valid JPEG or PNG image. Only real JPG and PNG files can be compressed.',
        });
      }
      if (!metadata || !['jpeg', 'png'].includes(metadata.format)) {
        return res.status(415).json({
          success: false,
          error: `Only JPG and PNG images are supported. The file you uploaded is ${metadata ? metadata.format : 'not a recognisable image'}.`,
        });
      }

      const targetFormat = format === 'auto' ? metadata.format : format;
      const result = await uploadsLib.processImage(req.file.buffer, {
        maxWidth,
        quality,
        forceFormat: targetFormat,
      });

      const originalSize = req.file.size;
      const compressedSize = result.size;
      const reductionPercent = originalSize > 0 ? ((originalSize - compressedSize) / originalSize) * 100 : 0;
      const extension = uploadsLib.extensionFor(result.format);
      const baseName = (req.file.originalname || 'image').replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 40) || 'image';

      return res.json({
        success: true,
        dataUrl: `data:image/${result.format === 'jpeg' ? 'jpeg' : result.format};base64,${result.buffer.toString('base64')}`,
        fileName: `${baseName}-compressed${extension}`,
        originalSize,
        compressedSize,
        reductionPercent,
        width: result.width,
        height: result.height,
        format: result.format,
        originalFormat: result.originalFormat,
        quality: Math.round(quality),
      });
    } catch (err) {
      console.error('[api/image/compress]', err.message);
      const friendly = err.code === 'INVALID_IMAGE' || err.code === 'UNSUPPORTED_TYPE' || err.code === 'PROCESS_FAILED';
      return res.status(friendly ? 415 : 500).json({
        success: false,
        error: friendly ? err.message : 'The image could not be compressed. Please try again.',
      });
    }
  }
);

/* ---- Contact form ---- */

function readMessages() {
  try {
    const raw = fs.readFileSync(MESSAGES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function writeMessages(list) {
  try {
    const tmp = `${MESSAGES_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(list, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, MESSAGES_FILE);
  } catch (err) {
    console.warn(`[contact] cannot persist message (read-only filesystem): ${err.message}`);
  }
}

app.post('/api/contact', apiLimiter(6, 60), sameOriginOnly, (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const subject = String(body.subject || '').trim();
    const message = String(body.message || '').trim();

    if (name.length < 2) {
      return res.status(400).json({ success: false, error: 'Please enter your name (at least 2 characters).' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address so we can reply.' });
    }
    if (!message) {
      return res.status(400).json({ success: false, error: 'Please write a message before sending.' });
    }
    if (name.length > 80 || email.length > 160 || subject.length > 120 || message.length > 4000) {
      return res.status(400).json({ success: false, error: 'One of the fields is too long. Please shorten it and try again.' });
    }

    const list = readMessages();
    list.unshift({
      id: crypto.randomBytes(8).toString('hex'),
      name,
      email,
      subject: subject || '(no subject)',
      message,
      receivedAt: new Date().toISOString(),
      read: false,
    });
    writeMessages(list.slice(0, 500)); // keep the newest 500

    return res.json({ success: true, message: 'Message received. Thank you!' });
  } catch (err) {
    console.error('[api/contact]', err.message);
    return res.status(500).json({ success: false, error: 'Your message could not be saved. Please try again.' });
  }
});

/* ------------------------------------------------------------------ *
 * Admin panel
 * ------------------------------------------------------------------ */

const ADMIN_MAX_AGE = 8 * 60 * 60 * 1000;

function ensureCsrf(req) {
  if (!req.session) return '';
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  return req.session.csrf;
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function flash(req, type, message) {
  req.session.flash = { type, message };
}

function takeFlash(req) {
  const value = req.session.flash || null;
  delete req.session.flash;
  return value;
}

function requireAuth(req, res, next) {
  if (req.session && req.session.admin === true) return next();
  return res.redirect('/admin/login');
}

/** CSRF protection for every admin form post. */
function requireCsrf(req, res, next) {
  if (req.path === '/admin/login') return next();
  const token = req.body && req.body.csrf;
  if (!token || !req.session.csrf || !safeEqual(token, req.session.csrf)) {
    return res.status(403).type('html').send(
      pagesAdmin.adminLogin({
        notice: { type: 'error', message: 'Your session expired or the form was submitted from another site. Please sign in again.' },
      })
    );
  }
  return next();
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler(req, res) {
    res.status(429).type('html').send(
      pagesAdmin.adminLogin({
        notice: {
          type: 'error',
          message: 'Too many sign-in attempts from this address. Please wait 15 minutes before trying again.',
        },
      })
    );
  },
});

/* ---- login / logout ---- */

app.get('/admin', requireAuth, (req, res) => {
  res.type('html').send(
    pagesAdmin.adminDashboard({ csrfToken: ensureCsrf(req), flash: takeFlash(req) })
  );
});

app.get('/admin/login', (req, res) => {
  if (req.session && req.session.admin === true) return res.redirect('/admin');
  res.type('html').send(pagesAdmin.adminLogin({ notice: takeFlash(req) }));
});

app.post('/admin/login', loginLimiter, (req, res) => {
  const admin = store.getAdmin();
  const username = String((req.body && req.body.username) || '').trim();
  const password = String((req.body && req.body.password) || '');

  const usernameOk = safeEqual(username.toLowerCase(), admin.username.toLowerCase());
  let passwordOk = false;
  try {
    passwordOk = bcrypt.compareSync(password, admin.passwordHash || '');
  } catch (err) {
    passwordOk = false;
  }

  if (!usernameOk || !passwordOk) {
    return res.status(401).type('html').send(
      pagesAdmin.adminLogin({
        username,
        notice: { type: 'error', message: 'Incorrect username or password. Please try again.' },
      })
    );
  }

  // The shipped seed password is accepted once, then the account is flagged so
  // the admin is reminded to change it.
  if (admin.passwordIsDefault && password === 'admin123') {
    store.saveAdmin({ passwordIsDefault: true });
  }

  req.session.regenerate((err) => {
    if (err) {
      console.error('[admin/login]', err.message);
      return res.status(500).type('html').send(
        pagesAdmin.adminLogin({ notice: { type: 'error', message: 'Sign-in failed because the session could not be created. Please try again.' } })
      );
    }
    req.session.admin = true;
    req.session.adminUsername = admin.username;
    req.session.csrf = crypto.randomBytes(24).toString('hex');
    req.session.cookie.maxAge = ADMIN_MAX_AGE;
    flash(req, 'success', 'Signed in successfully.');
    return res.redirect('/admin');
  });
});

app.post('/admin/logout', (req, res) => {
  const token = req.body && req.body.csrf;
  if (!token || !req.session.csrf || !safeEqual(token, req.session.csrf)) {
    return res.redirect('/admin');
  }
  req.session.destroy(() => {
    res.clearCookie('toolbox.sid');
    res.redirect('/admin/login');
  });
});

/* ---- settings ---- */

function settingsPage(req, res) {
  res.type('html').send(pagesAdmin.adminSettings({ csrfToken: ensureCsrf(req), flash: takeFlash(req) }));
}

app.get('/admin/settings', requireAuth, settingsPage);

app.post('/admin/settings', requireAuth, requireCsrf, (req, res) => {
  const body = req.body || {};
  const siteName = String(body.siteName || '').trim().slice(0, 60) || 'ToolBox';
  const tagline = String(body.tagline || '').trim().slice(0, 120);
  const metaDescription = String(body.metaDescription || '').trim().slice(0, 320);
  const baseUrlRaw = String(body.baseUrl || '').trim().replace(/\/+$/, '');
  const supportEmail = String(body.supportEmail || '').trim().slice(0, 160);
  const footerText = String(body.footerText || '').trim().slice(0, 200);

  if (baseUrlRaw && !/^https?:\/\/[^\s]+$/i.test(baseUrlRaw)) {
    flash(req, 'error', 'The canonical base URL must start with http:// or https:// — the previous value was kept.');
    return res.redirect('/admin/settings');
  }
  if (supportEmail && !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(supportEmail)) {
    flash(req, 'error', 'That support email address is not valid — the previous value was kept.');
    return res.redirect('/admin/settings');
  }

  store.saveSettings({ siteName, tagline, metaDescription, baseUrl: baseUrlRaw, supportEmail, footerText });
  flash(req, 'success', 'Website settings saved.');
  return res.redirect('/admin/settings');
});

app.post('/admin/account', requireAuth, requireCsrf, (req, res) => {
  const body = req.body || {};
  const username = String(body.username || '').trim().slice(0, 64);
  const email = String(body.email || '').trim().slice(0, 160);

  if (username.length < 3) {
    flash(req, 'error', 'The username must be at least 3 characters long.');
    return res.redirect('/admin/settings');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) {
    flash(req, 'error', 'That admin email address is not valid.');
    return res.redirect('/admin/settings');
  }

  store.saveAdmin({ username, email });
  flash(req, 'success', `Admin account updated. Next time, sign in as “${username}”.`);
  return res.redirect('/admin/settings');
});

app.post('/admin/password', requireAuth, requireCsrf, (req, res) => {
  const body = req.body || {};
  const current = String(body.currentPassword || '');
  const next = String(body.newPassword || '');
  const confirm = String(body.confirmPassword || '');
  const admin = store.getAdmin();

  let currentOk = false;
  try {
    currentOk = bcrypt.compareSync(current, admin.passwordHash || '');
  } catch (err) {
    currentOk = false;
  }

  if (!currentOk) {
    flash(req, 'error', 'The current password is incorrect, so the password was not changed.');
    return res.redirect('/admin/settings');
  }
  if (next.length < 8) {
    flash(req, 'error', 'The new password must be at least 8 characters long.');
    return res.redirect('/admin/settings');
  }
  if (next !== confirm) {
    flash(req, 'error', 'The new password and the confirmation do not match.');
    return res.redirect('/admin/settings');
  }
  if (next === current) {
    flash(req, 'error', 'The new password must be different from the current one.');
    return res.redirect('/admin/settings');
  }

  const hash = bcrypt.hashSync(next, 12);
  store.saveAdmin({ passwordHash: hash, passwordIsDefault: false });
  flash(req, 'success', 'Password changed. Use the new password the next time you sign in.');
  return res.redirect('/admin/settings');
});

/* ---- content ---- */

app.get('/admin/content', requireAuth, (req, res) => {
  res.type('html').send(pagesAdmin.adminContent({ csrfToken: ensureCsrf(req), flash: takeFlash(req) }));
});

function parseLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parsePairs(text, separator = '|') {
  return parseLines(text)
    .map((line) => {
      const index = line.indexOf(separator);
      if (index === -1) return null;
      const left = line.slice(0, index).trim();
      const right = line.slice(index + 1).trim();
      if (!left) return null;
      return { left, right };
    })
    .filter(Boolean);
}

app.post('/admin/content/hero', requireAuth, requireCsrf, (req, res) => {
  const body = req.body || {};
  const headline = String(body.headline || '').trim().slice(0, 140);
  if (!headline) {
    flash(req, 'error', 'The hero headline cannot be empty.');
    return res.redirect('/admin/content');
  }
  store.saveContent({
    hero: {
      eyebrow: String(body.eyebrow || '').trim().slice(0, 80),
      headline,
      subheadline: String(body.subheadline || '').trim().slice(0, 400),
      imageAlt: String(body.imageAlt || '').trim().slice(0, 160),
      primaryCta: {
        label: String(body.primaryLabel || 'Browse all tools').trim().slice(0, 40),
        href: String(body.primaryHref || '#tools').trim().slice(0, 120),
      },
      secondaryCta: {
        label: String(body.secondaryLabel || 'Learn more').trim().slice(0, 40),
        href: String(body.secondaryHref || '/about').trim().slice(0, 120),
      },
    },
  });
  flash(req, 'success', 'Hero section saved.');
  return res.redirect('/admin/content');
});

app.post('/admin/content/banner', requireAuth, requireCsrf, (req, res) => {
  const body = req.body || {};
  store.saveContent({
    banner: {
      title: String(body.title || '').trim().slice(0, 140),
      text: String(body.text || '').trim().slice(0, 400),
      imageAlt: String(body.imageAlt || '').trim().slice(0, 160),
    },
  });
  flash(req, 'success', 'Banner section saved.');
  return res.redirect('/admin/content');
});

app.post('/admin/content/promo', requireAuth, requireCsrf, (req, res) => {
  const body = req.body || {};
  store.saveContent({
    promo: {
      title: String(body.title || '').trim().slice(0, 140),
      text: String(body.text || '').trim().slice(0, 800),
      bullets: parseLines(body.bullets).slice(0, 8).map((line) => line.slice(0, 200)),
      imageAlt: String(body.imageAlt || '').trim().slice(0, 160),
    },
  });
  flash(req, 'success', 'Promo section saved.');
  return res.redirect('/admin/content');
});

app.post('/admin/content/about', requireAuth, requireCsrf, (req, res) => {
  const body = req.body || {};
  const story = String(body.story || '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .slice(0, 12);
  const points = parsePairs(body.points)
    .slice(0, 6)
    .map((pair) => ({ title: pair.left.slice(0, 80), text: pair.right.slice(0, 300) }));
  const stats = parsePairs(body.stats)
    .slice(0, 6)
    .map((pair) => ({ value: pair.left.slice(0, 12), label: pair.right.slice(0, 60) }));

  store.saveContent({
    about: {
      title: String(body.title || 'About').trim().slice(0, 140),
      lede: String(body.lede || '').trim().slice(0, 400),
      story,
      points,
      stats,
      imageAlt: String(body.imageAlt || '').trim().slice(0, 160),
    },
  });
  flash(req, 'success', 'About page content saved.');
  return res.redirect('/admin/content');
});

app.post('/admin/content/contact', requireAuth, requireCsrf, (req, res) => {
  const body = req.body || {};
  const email = String(body.email || '').trim().slice(0, 160);
  if (email && !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) {
    flash(req, 'error', 'The contact email address is not valid — the previous value was kept.');
    return res.redirect('/admin/content');
  }
  store.saveContent({
    contact: {
      title: String(body.title || 'Contact').trim().slice(0, 140),
      lede: String(body.lede || '').trim().slice(0, 400),
      email,
      responseNote: String(body.responseNote || '').trim().slice(0, 400),
    },
  });
  flash(req, 'success', 'Contact page content saved.');
  return res.redirect('/admin/content');
});

app.post('/admin/content/faq', requireAuth, requireCsrf, (req, res) => {
  const raw = String((req.body && req.body.faq) || '').trim();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    flash(req, 'error', `The FAQ was not saved because the JSON is invalid: ${err.message}`);
    return res.redirect('/admin/content');
  }
  if (!Array.isArray(parsed)) {
    flash(req, 'error', 'The FAQ must be a JSON array of objects with “q” and “a” fields.');
    return res.redirect('/admin/content');
  }
  const clean = parsed
    .filter((item) => item && typeof item.q === 'string' && typeof item.a === 'string' && item.q.trim() && item.a.trim())
    .slice(0, 12)
    .map((item) => ({ q: item.q.trim().slice(0, 200), a: item.a.trim().slice(0, 1200) }));

  if (!clean.length) {
    flash(req, 'error', 'No usable FAQ entries were found — each item needs a non-empty “q” and “a”.');
    return res.redirect('/admin/content');
  }
  store.saveContent({ faq: clean });
  flash(req, 'success', `FAQ saved with ${clean.length} entries.`);
  return res.redirect('/admin/content');
});

app.post('/admin/content/reset-faq', requireAuth, requireCsrf, (req, res) => {
  store.saveContent({ faq: store.DEFAULT_CONTENT.faq });
  flash(req, 'success', 'Default FAQ restored.');
  return res.redirect('/admin/settings');
});

app.post('/admin/content/reset-hero', requireAuth, requireCsrf, (req, res) => {
  store.saveContent({ hero: store.DEFAULT_CONTENT.hero });
  flash(req, 'success', 'Default homepage hero text restored.');
  return res.redirect('/admin/settings');
});

/* ---- image manager ---- */

const contentUpload = uploadsLib.makeUploader(uploadsLib.CONTENT_MAX_BYTES);

function handleUpload(req, res, next) {
  contentUpload.single('image')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      flash(req, 'error', 'That image is larger than the 4 MB limit. Please compress it first or upload a smaller file.');
      return res.redirect(req.get('referer') && req.get('referer').includes('/admin') ? req.get('referer').split('?')[0] : '/admin/images');
    }
    if (err.code === 'UNSUPPORTED_TYPE') {
      flash(req, 'error', err.message);
      return res.redirect('/admin/images');
    }
    flash(req, 'error', 'The upload failed. Please try again.');
    return res.redirect('/admin/images');
  });
}

/** Point a content section at an image, or clear it. */
function assignSlot(slotKey, imageId) {
  if (slotKey === 'logo') {
    const settings = store.saveSettings({ defaultLogo: imageId ? `/uploads/${imageId}` : '/assets/logo.svg' });
    return settings.defaultLogo;
  }
  const slots = pagesAdmin.SLOTS.map((slot) => slot.key);
  if (!slots.includes(slotKey)) return null;
  const patch = {};
  patch[slotKey] = { imageId };
  store.saveContent(patch);
  return imageId;
}

/** Keep content references in step when an image file is replaced or removed. */
function rewriteReferences(oldName, newName) {
  const content = store.getContent();
  const patch = {};
  pagesAdmin.SLOTS.forEach((slot) => {
    if (content[slot.key] && content[slot.key].imageId === oldName) {
      patch[slot.key] = { imageId: newName };
    }
  });
  if (Object.keys(patch).length) store.saveContent(patch);
  if (store.getSettings().defaultLogo === `/uploads/${oldName}`) {
    store.saveSettings({ defaultLogo: newName ? `/uploads/${newName}` : '/assets/logo.svg' });
  }
}

app.get('/admin/images', requireAuth, (req, res) => {
  res.type('html').send(pagesAdmin.adminImages({ csrfToken: ensureCsrf(req), flash: takeFlash(req) }));
});

app.post('/admin/images/upload', requireAuth, handleUpload, requireCsrf, async (req, res) => {
  const folder = ['images', 'banners', 'logo'].includes(String(req.body.folder)) ? String(req.body.folder) : 'images';
  try {
    const saved = await uploadsLib.saveImage(req.file.buffer, folder, {
      maxWidth: folder === 'logo' ? 512 : 2400,
    });
    const slot = String(req.body.useForSlot || '');
    if (slot) assignSlot(slot, saved.name);
    flash(req, 'success', `Image uploaded as ${saved.name} (${saved.width}×${saved.height}, thumbnail generated)${slot ? ' and assigned to the selected section' : ''}.`);
  } catch (err) {
    flash(req, 'error', err.message || 'The image could not be processed.');
  }
  return res.redirect(req.body.useForSlot ? '/admin/content' : '/admin/images');
});

app.post('/admin/images/replace', requireAuth, handleUpload, requireCsrf, async (req, res) => {
  const folder = String(req.body.folder || '');
  const name = path.basename(String(req.body.name || ''));
  const old = store.uploadPath(folder, name);
  if (!old) {
    flash(req, 'error', 'That image could not be found.');
    return res.redirect('/admin/images');
  }
  let previousName = '';
  try {
    previousName = path.relative(store.UPLOAD_DIR, old).split(path.sep).join('/');
  } catch (err) {
    previousName = '';
  }
  try {
    const saved = await uploadsLib.saveImage(req.file.buffer, folder, { maxWidth: folder === 'logo' ? 512 : 2400 });
    uploadsLib.deleteImage(folder, name);
    if (previousName && previousName !== saved.name) rewriteReferences(previousName, saved.name);
    flash(req, 'success', `${previousName || name} was replaced with a new optimised image (${saved.width}×${saved.height}).`);
  } catch (err) {
    flash(req, 'error', err.message || 'The replacement failed; the original image was left untouched.');
  }
  return res.redirect('/admin/images');
});

app.post('/admin/images/delete', requireAuth, requireCsrf, (req, res) => {
  const folder = String(req.body.folder || '');
  const name = path.basename(String(req.body.name || ''));
  const relative = `${folder}/${name}`;
  const removed = uploadsLib.deleteImage(folder, name);
  if (removed) {
    rewriteReferences(relative, null);
    flash(req, 'success', `${relative} was deleted.`);
  } else {
    flash(req, 'error', 'That file could not be deleted — it may already be gone.');
  }
  return res.redirect('/admin/images');
});

app.post('/admin/images/use', requireAuth, requireCsrf, (req, res) => {
  const name = String(req.body.name || '').replace(/^\/+/, '');
  const slot = String(req.body.slot || '');
  if (!store.uploadPath(name.split('/')[0], name.split('/').slice(1).join('/'))) {
    flash(req, 'error', 'That image could not be found.');
    return res.redirect('/admin/images');
  }
  const applied = assignSlot(slot, name);
  if (applied === null) {
    flash(req, 'error', 'Unknown content section.');
  } else {
    flash(req, 'success', `${name} is now used for: ${slot === 'logo' ? 'the site logo' : slot}.`);
  }
  return res.redirect('/admin/images');
});

app.post('/admin/images/clear-slot', requireAuth, requireCsrf, (req, res) => {
  const slot = String(req.body.slot || '');
  const applied = assignSlot(slot, null);
  if (applied === null) {
    flash(req, 'error', 'Unknown content section.');
  } else {
    flash(req, 'success', 'That section no longer uses a custom image. The file was kept in the library.');
  }
  return res.redirect('/admin/content');
});

/* ---- messages ---- */

app.get('/admin/messages', requireAuth, (req, res) => {
  res.type('html').send(pagesAdmin.adminMessages({ csrfToken: ensureCsrf(req), flash: takeFlash(req) }));
});

app.post('/admin/messages/read', requireAuth, requireCsrf, (req, res) => {
  const id = String(req.body.id || '');
  const list = readMessages().map((message) => (message.id === id ? { ...message, read: true } : message));
  writeMessages(list);
  flash(req, 'success', 'Message marked as read.');
  return res.redirect('/admin/messages');
});

app.post('/admin/messages/delete', requireAuth, requireCsrf, (req, res) => {
  const id = String(req.body.id || '');
  const list = readMessages().filter((message) => message.id !== id);
  writeMessages(list);
  flash(req, 'success', 'Message deleted.');
  return res.redirect('/admin/messages');
});

/* ------------------------------------------------------------------ *
 * 404 and error handling
 * ------------------------------------------------------------------ */

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'Unknown API endpoint.' });
  }
  return res.status(404).type('html').send(pagesSite.notFoundPage(req.path));
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    console.error('[error]', err.stack || err.message);
  } else {
    console.warn('[warn]', err.message);
  }
  if (req.path.startsWith('/api/')) {
    return res.status(status >= 500 ? 500 : status).json({
      success: false,
      error:
        status === 400
          ? 'The request could not be understood. Please check the data and try again.'
          : 'Something went wrong on the server. Please try again.',
    });
  }
  // Never leak a stack trace to a visitor.
  return res
    .status(status >= 500 ? 500 : status)
    .type('html')
    .send(pagesSite.notFoundPage(status === 404 ? req.path : 'the requested page'));
});

/* ------------------------------------------------------------------ *
 * Start
 * ------------------------------------------------------------------ */

if (require.main === module) {
  const server = app.listen(PORT, HOST, () => {
    const settings = store.getSettings();
    const admin = store.getAdmin();
    console.log('');
    console.log(`  ${settings.siteName} is running`);
    console.log(`  → http://localhost:${PORT}`);
    console.log(`  → Admin panel: http://localhost:${PORT}/admin`);
    if (admin.passwordIsDefault) {
      console.log('  ! Default admin credentials are active (admin / admin123).');
      console.log('    Change them on the Settings page after your first sign-in.');
    }
    console.log(`  Data: ${store.DATA_DIR}`);
    console.log(`  Uploads: ${store.UPLOAD_DIR}`);
    console.log(`  Tools loaded: ${tools.TOOLS.length}`);
    console.log(`  Started: ${new Date().toISOString()} (year ${currentYear()})`);
    console.log('');
  });

  const shutdown = (signal) => {
    console.log(`\n[server] ${signal} received — closing gracefully.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = app;
