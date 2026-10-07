'use strict';

/**
 * Admin panel pages.
 *
 * Every page here is rendered only after the session has been verified in
 * server.js — these functions assume an authenticated request.
 */

const store = require('../store');
const { TOOLS } = require('../tools');
const uploads = require('../uploads');
const { escapeHtml: e, icon } = require('../templates');

const SLOTS = [
  { key: 'hero', label: 'Homepage hero image', folder: 'images' },
  { key: 'banner', label: 'Homepage banner section image', folder: 'banners' },
  { key: 'promo', label: 'Privacy / promo section image', folder: 'images' },
  { key: 'about', label: 'About page image', folder: 'images' },
  { key: 'contact', label: 'Contact page image', folder: 'images' },
];

function bytes(size) {
  const n = Number(size) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function truncate(text, length) {
  const value = String(text || '');
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function adminLayout(opts) {
  const settings = store.getSettings();
  const admin = store.getAdmin();
  const nav = [
    { href: '/admin', label: 'Dashboard', key: 'dashboard' },
    { href: '/admin/settings', label: 'Settings', key: 'settings' },
    { href: '/admin/content', label: 'Content', key: 'content' },
    { href: '/admin/images', label: 'Images', key: 'images' },
    { href: '/admin/messages', label: 'Messages', key: 'messages' },
  ];

  const flash = opts.flash
    ? `<div class="alert alert--${e(opts.flash.type || 'info')}" role="status">${e(opts.flash.message)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${e(opts.title)}</title>
  <meta name="robots" content="noindex, nofollow" />
  <meta name="theme-color" content="#2f6fed" />
  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
  <link rel="stylesheet" href="/css/style.css" />
</head>
<body class="admin-body">
  <header class="admin-header">
    <div class="container">
      <div class="admin-header__inner">
        <img class="brand__logo" src="${e(settings.defaultLogo || '/assets/logo.svg')}" alt="${e(settings.siteName)} logo" width="36" height="36" />
        <div>
          <p class="admin-header__title">${e(settings.siteName)} admin</p>
          <span class="badge">Signed in as ${e(admin.username)}</span>
          ${admin.passwordIsDefault ? '<span class="admin-badge">⚠ Default password in use</span>' : ''}
        </div>
        <span class="admin-header__spacer"></span>
        <a class="btn btn--soft btn--sm" href="/" target="_blank" rel="noopener">View site</a>
        <form method="post" action="/admin/logout" style="margin:0">
          <input type="hidden" name="csrf" value="${e(opts.csrfToken)}" />
          <button class="btn btn--soft btn--sm" type="submit">Log out</button>
        </form>
      </div>
      <nav class="admin-nav" aria-label="Admin sections">
        <ul>
          ${nav
            .map(
              (item) =>
                `<li><a href="${item.href}"${item.key === opts.active ? ' aria-current="page"' : ''}>${e(item.label)}</a></li>`
            )
            .join('')}
        </ul>
      </nav>
    </div>
  </header>

  <main class="admin-main">
    <div class="container">
      ${flash}
      ${opts.body}
    </div>
  </main>
</body>
</html>`;
}

/* ------------------------------------------------------------------ *
 * Login
 * ------------------------------------------------------------------ */

function adminLogin(opts = {}) {
  const settings = store.getSettings();
  const admin = store.getAdmin();
  const notice = opts.notice
    ? `<div class="alert alert--${e(opts.notice.type || 'info')}">${e(opts.notice.message)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Admin login — ${e(settings.siteName)}</title>
  <meta name="robots" content="noindex, nofollow" />
  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
  <link rel="stylesheet" href="/css/style.css" />
</head>
<body>
  <main class="admin-login" id="main">
    <div class="admin-login__card">
      <div class="admin-login__brand">
        <img class="brand__logo" src="${e(settings.defaultLogo || '/assets/logo.svg')}" alt="${e(settings.siteName)} logo" width="40" height="40" />
        <div>
          <p class="brand__name" style="margin:0">${e(settings.siteName)}</p>
          <p class="muted" style="margin:0;font-size:0.8rem">Administration panel</p>
        </div>
      </div>

      <h1 style="font-size:1.35rem">Sign in</h1>
      <p class="muted" style="font-size:0.9rem">Enter your administrator credentials to manage content, images and settings.</p>

      ${notice}

      <form method="post" action="/admin/login" novalidate>
        <div class="field">
          <label for="username">Username</label>
          <input type="text" id="username" name="username" autocomplete="username" required maxlength="64" value="${e(opts.username || '')}" autofocus />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" autocomplete="current-password" required />
        </div>
        <button class="btn btn--lg btn--block" type="submit">Log in</button>
      </form>

      <p class="admin-login__hint">Signed in sessions last 8 hours.</p>
      <p class="admin-login__hint"><a href="/">← Back to the website</a></p>
    </div>
  </main>
</body>
</html>
`;
}

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */

function adminDashboard({ csrfToken, flash }) {
  const settings = store.getSettings();
  const content = store.getContent();
  const admin = store.getAdmin();
  const registry = store.listUploads();
  const disk = uploads.uploadsDiskUsage();
  const messages = readMessages();

  const fileCount = Object.keys(registry).reduce((sum, key) => sum + registry[key].length, 0);
  const imagesCount = registry.images.length;
  const unread = messages.filter((m) => !m.read).length;

  const card = (label, value, hint) => `
        <div class="stat">
          <span class="stat__label">${e(label)}</span>
          <span class="stat__value">${e(value)}</span>
          ${hint ? `<span class="muted" style="font-size:0.78rem">${e(hint)}</span>` : ''}
        </div>`;

  const body = `
      <div class="admin-panel-head">
        <h1>Dashboard</h1>
        <div class="btn-row">
          <a class="btn btn--sm" href="/admin/content">Edit content</a>
          <a class="btn btn--soft btn--sm" href="/admin/images">Manage images</a>
        </div>
      </div>

      ${
        admin.passwordIsDefault
          ? `<div class="alert alert--warn" role="status"><span><strong>Security notice:</strong> the default password is still active. Change it on the <a href="/admin/settings#password">Settings page</a> before putting this site online.</span></div>`
          : ''
      }

      <div class="grid grid--three" style="margin:1rem 0">
        ${card('Tools published', String(TOOLS.length), 'All fully functional')}
        ${card('Uploaded files', String(fileCount), `${imagesCount} in the images folder`)}
        ${card('Upload storage used', bytes(disk.bytes), `${disk.files} files on disk`)}
        ${card('Contact messages', String(messages.length), unread ? `${unread} unread` : 'All read')}
        ${card('Site name', settings.siteName, settings.baseUrl || 'baseUrl not set')}
        ${card('Settings updated', settings.updatedAt ? new Date(settings.updatedAt).toLocaleString('en-GB') : 'never', 'data/settings.json')}
      </div>

      <div class="admin-grid admin-grid--sidebar">
        <section class="admin-card">
          <h2>Recent messages</h2>
          ${
            messages.length
              ? `<div class="table-wrap"><table>
                  <thead><tr><th scope="col">Received</th><th scope="col">From</th><th scope="col">Subject</th></tr></thead>
                  <tbody>
                    ${messages
                      .slice(0, 5)
                      .map(
                        (m) => `<tr>
                          <td>${e(new Date(m.receivedAt).toLocaleString('en-GB'))}</td>
                          <td>${e(m.name)}<br /><span class="muted">${e(m.email)}</span></td>
                          <td>${e(truncate(m.subject || m.message, 60))}</td>
                        </tr>`
                      )
                      .join('')}
                  </tbody>
                </table></div>
                <p style="margin-top:1rem"><a href="/admin/messages">Open the message inbox →</a></p>`
              : '<p class="muted">No messages yet. They will appear here as soon as the contact form is used.</p>'
          }
        </section>

        <section class="admin-card">
          <h2>Storage health</h2>
          <dl class="metric-list">
            <div><dt>data/settings.json</dt><dd>${fileExists('settings.json') ? 'OK' : 'missing'}</dd></div>
            <div><dt>data/content.json</dt><dd>${fileExists('content.json') ? 'OK' : 'missing'}</dd></div>
            <div><dt>data/admin.json</dt><dd>${fileExists('admin.json') ? 'OK' : 'missing'}</dd></div>
            <div><dt>data/messages.json</dt><dd>${fileExists('messages.json') ? 'OK' : 'created on first message'}</dd></div>
            <div><dt>uploads/images</dt><dd>${registry.images.length} files</dd></div>
            <div><dt>uploads/thumbnails</dt><dd>${registry.thumbnails.length} files</dd></div>
            <div><dt>uploads/logo</dt><dd>${registry.logo.length} files</dd></div>
            <div><dt>uploads/banners</dt><dd>${registry.banners.length} files</dd></div>
          </dl>
          <h3 style="margin-top:1.25rem">Content image assignments</h3>
          <dl class="metric-list">
            ${SLOTS.map(
              (slot) =>
                `<div><dt>${e(slot.label)}</dt><dd>${content[slot.key] && content[slot.key].imageId ? e(content[slot.key].imageId) : 'default'}</dd></div>`
            ).join('')}
          </dl>
        </section>
      </div>`;
  return adminLayout({ title: 'Dashboard — admin', active: 'dashboard', body, csrfToken, flash });
}

function fileExists(name) {
  const fs = require('fs');
  const path = require('path');
  try {
    return fs.statSync(path.join(store.DATA_DIR, name)).isFile();
  } catch (err) {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

function adminSettings({ csrfToken, flash }) {
  const settings = store.getSettings();
  const admin = store.getAdmin();
  const logo = settings.defaultLogo || '/assets/logo.svg';
  const bannerId = store.getContent().banner && store.getContent().banner.imageId;

  const body = `
      <div class="admin-panel-head">
        <h1>Website settings</h1>
      </div>

      <div class="admin-grid admin-grid--2">
        <section class="admin-card">
          <h2>Site identity</h2>
          <form method="post" action="/admin/settings" >
            <input type="hidden" name="csrf" value="${e(csrfToken)}" />
            <div class="field">
              <label for="siteName">Site name</label>
              <input type="text" id="siteName" name="siteName" value="${e(settings.siteName)}" maxlength="60" required />
              <p class="field__hint">Shown in the header, the footer and page titles.</p>
            </div>
            <div class="field">
              <label for="tagline">Tagline</label>
              <input type="text" id="tagline" name="tagline" value="${e(settings.tagline)}" maxlength="120" />
            </div>
            <div class="field">
              <label for="metaDescription">Default meta description</label>
              <textarea id="metaDescription" name="metaDescription" rows="3" maxlength="320" style="font-family:var(--font);font-size:1rem">${e(settings.metaDescription)}</textarea>
              <p class="field__hint">Used on pages that do not define their own description. Around 155 characters works best in search results.</p>
            </div>
            <div class="field">
              <label for="baseUrl">Canonical base URL</label>
              <input type="url" id="baseUrl" name="baseUrl" value="${e(settings.baseUrl)}" placeholder="https://your-domain.example" />
              <p class="field__hint">Used for canonical tags, Open Graph URLs, robots.txt and sitemap.xml. Leave empty while running locally.</p>
            </div>
            <div class="field">
              <label for="supportEmail">Support email</label>
              <input type="email" id="supportEmail" name="supportEmail" value="${e(settings.supportEmail)}" maxlength="160" />
            </div>
            <div class="field">
              <label for="footerText">Extra footer text</label>
              <input type="text" id="footerText" name="footerText" value="${e(settings.footerText || '')}" maxlength="200" />
            </div>
            <button class="btn" type="submit">Save settings</button>
          </form>
        </section>

        <section class="admin-card">
          <h2>Logo</h2>
          <div class="image-tile" style="max-width:14rem">
            <img class="image-tile__thumb" src="${e(logo)}" alt="Current site logo" />
            <p class="image-tile__meta">${e(logo)}</p>
          </div>
          <form method="post" action="/admin/images/upload" enctype="multipart/form-data" class="upload-form" style="margin-top:1rem">
            <input type="hidden" name="csrf" value="${e(csrfToken)}" />
            <input type="hidden" name="folder" value="logo" />
            <input type="hidden" name="useForSlot" value="logo" />
            <div class="field" style="margin:0">
              <label for="logoFile">Upload a new logo (JPG, PNG or WebP, max 4 MB)</label>
              <input class="file-input" type="file" id="logoFile" name="image" accept="image/jpeg,image/png,image/webp" required />
            </div>
            <button class="btn btn--sm" type="submit">Upload logo</button>
          </form>

          <h2 style="margin-top:2rem">Banner image</h2>
          <p class="muted" style="font-size:0.9rem">
            ${
              bannerId
                ? `Current banner: <code>${e(bannerId)}</code> — edit it in the Content section.`
                : 'No banner image assigned yet; the homepage banner section shows text only.'
            }
          </p>
          <form method="post" action="/admin/images/upload" enctype="multipart/form-data" class="upload-form">
            <input type="hidden" name="csrf" value="${e(csrfToken)}" />
            <input type="hidden" name="folder" value="banners" />
            <input type="hidden" name="useForSlot" value="banner" />
            <div class="field" style="margin:0">
              <label for="bannerFile">Upload a banner image</label>
              <input class="file-input" type="file" id="bannerFile" name="image" accept="image/jpeg,image/png,image/webp" required />
            </div>
            <button class="btn btn--sm" type="submit">Upload banner</button>
          </form>
        </section>
      </div>

      <section class="admin-card" id="password" style="margin-top:1.5rem">
        <h2>Admin account</h2>
        <div class="admin-grid admin-grid--2">
          <form method="post" action="/admin/account">
            <input type="hidden" name="csrf" value="${e(csrfToken)}" />
            <div class="field">
              <label for="adminUsername">Username</label>
              <input type="text" id="adminUsername" name="username" value="${e(admin.username)}" maxlength="64" required />
            </div>
            <div class="field">
              <label for="adminEmail">Admin email</label>
              <input type="email" id="adminEmail" name="email" value="${e(admin.email)}" maxlength="160" />
            </div>
            <button class="btn" type="submit">Update account</button>
          </form>

          <form method="post" action="/admin/password">
            <input type="hidden" name="csrf" value="${e(csrfToken)}" />
            <div class="field">
              <label for="currentPassword">Current password</label>
              <input type="password" id="currentPassword" name="currentPassword" autocomplete="current-password" required />
            </div>
            <div class="field">
              <label for="newPassword">New password</label>
              <input type="password" id="newPassword" name="newPassword" autocomplete="new-password" minlength="8" required />
              <p class="field__hint">At least 8 characters. A long passphrase beats a short complicated password.</p>
            </div>
            <div class="field">
              <label for="confirmPassword">Confirm new password</label>
              <input type="password" id="confirmPassword" name="confirmPassword" autocomplete="new-password" minlength="8" required />
            </div>
            <button class="btn" type="submit">Change password</button>
          </form>
        </div>
        <p class="muted" style="margin-top:1rem;font-size:0.85rem">
          Passwords are stored as a bcrypt hash in <code>data/admin.json</code>. The plain text is never written to disk and cannot be recovered — if it is lost, delete the file to restore the default first-run credentials.
        </p>
      </section>

      <section class="admin-card" style="margin-top:1.5rem">
        <h2>Maintenance</h2>
        <p class="muted" style="font-size:0.9rem">
          All content lives in JSON files, so a backup is a copy of the <code>data/</code> and <code>uploads/</code> folders.
        </p>
        <div class="btn-row">
          <form method="post" action="/admin/content/reset-faq" style="margin:0">
            <input type="hidden" name="csrf" value="${e(csrfToken)}" />
            <button class="btn btn--soft btn--sm" type="submit">Restore default FAQ</button>
          </form>
          <form method="post" action="/admin/content/reset-hero" style="margin:0">
            <input type="hidden" name="csrf" value="${e(csrfToken)}" />
            <button class="btn btn--soft btn--sm" type="submit">Restore default homepage text</button>
          </form>
        </div>
      </section>`;

  return adminLayout({ title: 'Settings — admin', active: 'settings', body, csrfToken, flash });
}

/* ------------------------------------------------------------------ *
 * Content
 * ------------------------------------------------------------------ */

function adminContent({ csrfToken, flash }) {
  const content = store.getContent();
  const hero = content.hero;
  const banner = content.banner;
  const promo = content.promo;
  const about = content.about;
  const contact = content.contact;

  const imageSlot = (slotKey) => {
    const slot = SLOTS.find((s) => s.key === slotKey);
    const imageId = content[slotKey] && content[slotKey].imageId;
    return `
          <div class="field">
            <span class="field__label">${e(slot.label)}</span>
            ${
              imageId
                ? `<div class="image-tile" style="max-width:16rem"><img class="image-tile__thumb" src="/uploads/${e(imageId)}" alt="${e(slot.label)}" /><p class="image-tile__meta">${e(imageId)}</p></div>`
                : '<p class="muted">No image assigned — this section renders as text only.</p>'
            }
            <form method="post" action="/admin/images/upload" enctype="multipart/form-data" style="margin-top:0.75rem">
              <input type="hidden" name="csrf" value="${e(csrfToken)}" />
              <input type="hidden" name="folder" value="${e(slot.folder)}" />
              <input type="hidden" name="useForSlot" value="${e(slotKey)}" />
              <div class="input-group">
                <input class="file-input" type="file" name="image" accept="image/jpeg,image/png,image/webp" required aria-label="Replace ${e(slot.label)}" />
                <button class="btn btn--sm" type="submit">Replace</button>
              </div>
              <p class="field__hint">Uploading replaces the image currently assigned to this slot on every page.</p>
            </form>
            ${
              imageId
                ? `<form method="post" action="/admin/images/clear-slot" style="margin-top:0.5rem">
                    <input type="hidden" name="csrf" value="${e(csrfToken)}" />
                    <input type="hidden" name="slot" value="${e(slotKey)}" />
                    <button class="btn btn--soft btn--sm" type="submit">Remove from this section (keeps the file)</button>
                  </form>`
                : ''
            }
          </div>`;
  };

  const body = `
      <div class="admin-panel-head">
        <h1>Homepage &amp; page content</h1>
        <p class="muted" style="margin:0">Everything on this page is saved to <code>data/content.json</code> and appears on the public site immediately.</p>
      </div>

      <section class="admin-card">
        <h2>Homepage hero</h2>
        <form method="post" action="/admin/content/hero">
          <input type="hidden" name="csrf" value="${e(csrfToken)}" />
          <div class="field">
            <label for="heroEyebrow">Small label above the headline</label>
            <input type="text" id="heroEyebrow" name="eyebrow" value="${e(hero.eyebrow)}" maxlength="80" />
          </div>
          <div class="field">
            <label for="heroHeadline">Main headline (H1)</label>
            <input type="text" id="heroHeadline" name="headline" value="${e(hero.headline)}" maxlength="140" required />
            <p class="field__hint">Keep it under about 60 characters so search engines show it in full.</p>
          </div>
          <div class="field">
            <label for="heroSub">Sub-headline</label>
            <textarea id="heroSub" name="subheadline" rows="3" maxlength="400" style="font-family:var(--font);font-size:1rem">${e(hero.subheadline)}</textarea>
          </div>
          <div class="field-row field-row--2">
            <div class="field">
              <label for="heroPrimaryLabel">Primary button label</label>
              <input type="text" id="heroPrimaryLabel" name="primaryLabel" value="${e(hero.primaryCta.label)}" maxlength="40" />
            </div>
            <div class="field">
              <label for="heroPrimaryHref">Primary button link</label>
              <input type="text" id="heroPrimaryHref" name="primaryHref" value="${e(hero.primaryCta.href)}" maxlength="120" />
            </div>
          </div>
          <div class="field-row field-row--2">
            <div class="field">
              <label for="heroSecondaryLabel">Secondary button label</label>
              <input type="text" id="heroSecondaryLabel" name="secondaryLabel" value="${e(hero.secondaryCta.label)}" maxlength="40" />
            </div>
            <div class="field">
              <label for="heroSecondaryHref">Secondary button link</label>
              <input type="text" id="heroSecondaryHref" name="secondaryHref" value="${e(hero.secondaryCta.href)}" maxlength="120" />
            </div>
          </div>
          <div class="field">
            <label for="heroImageAlt">Hero image alt text</label>
            <input type="text" id="heroImageAlt" name="imageAlt" value="${e(hero.imageAlt || '')}" maxlength="160" />
          </div>
          ${imageSlot('hero')}
          <button class="btn" type="submit">Save hero section</button>
        </form>
      </section>

      <section class="admin-card" style="margin-top:1.5rem">
        <h2>Banner section</h2>
        <form method="post" action="/admin/content/banner">
          <input type="hidden" name="csrf" value="${e(csrfToken)}" />
          <div class="field">
            <label for="bannerTitle">Heading</label>
            <input type="text" id="bannerTitle" name="title" value="${e(banner.title)}" maxlength="140" />
          </div>
          <div class="field">
            <label for="bannerText">Text</label>
            <textarea id="bannerText" name="text" rows="3" maxlength="400" style="font-family:var(--font);font-size:1rem">${e(banner.text)}</textarea>
          </div>
          <div class="field">
            <label for="bannerImageAlt">Image alt text</label>
            <input type="text" id="bannerImageAlt" name="imageAlt" value="${e(banner.imageAlt || '')}" maxlength="160" />
          </div>
          ${imageSlot('banner')}
          <button class="btn" type="submit">Save banner section</button>
        </form>
      </section>

      <section class="admin-card" style="margin-top:1.5rem">
        <h2>Privacy / promo section</h2>
        <form method="post" action="/admin/content/promo">
          <input type="hidden" name="csrf" value="${e(csrfToken)}" />
          <div class="field">
            <label for="promoTitle">Heading</label>
            <input type="text" id="promoTitle" name="title" value="${e(promo.title)}" maxlength="140" />
          </div>
          <div class="field">
            <label for="promoText">Text</label>
            <textarea id="promoText" name="text" rows="4" maxlength="800" style="font-family:var(--font);font-size:1rem">${e(promo.text)}</textarea>
          </div>
          <div class="field">
            <label for="promoBullets">Bullet points — one per line</label>
            <textarea id="promoBullets" name="bullets" rows="4" style="font-family:var(--font);font-size:1rem">${e((promo.bullets || []).join('\n'))}</textarea>
          </div>
          <div class="field">
            <label for="promoImageAlt">Image alt text</label>
            <input type="text" id="promoImageAlt" name="imageAlt" value="${e(promo.imageAlt || '')}" maxlength="160" />
          </div>
          ${imageSlot('promo')}
          <button class="btn" type="submit">Save promo section</button>
        </form>
      </section>

      <section class="admin-card" style="margin-top:1.5rem">
        <h2>About page</h2>
        <form method="post" action="/admin/content/about">
          <input type="hidden" name="csrf" value="${e(csrfToken)}" />
          <div class="field">
            <label for="aboutTitle">Page heading</label>
            <input type="text" id="aboutTitle" name="title" value="${e(about.title)}" maxlength="140" />
          </div>
          <div class="field">
            <label for="aboutLede">Introduction paragraph</label>
            <textarea id="aboutLede" name="lede" rows="2" maxlength="400" style="font-family:var(--font);font-size:1rem">${e(about.lede)}</textarea>
          </div>
          <div class="field">
            <label for="aboutStory">Story — separate paragraphs with a blank line</label>
            <textarea id="aboutStory" name="story" rows="8" maxlength="6000" style="font-family:var(--font);font-size:1rem">${e((about.story || []).join('\n\n'))}</textarea>
          </div>
          <div class="field">
            <label for="aboutPoints">Highlights — one per line as <code>Title | Text</code></label>
            <textarea id="aboutPoints" name="points" rows="4" style="font-family:var(--font);font-size:1rem">${e(
              (about.points || []).map((point) => `${point.title} | ${point.text}`).join('\n')
            )}</textarea>
          </div>
          <div class="field">
            <label for="aboutStats">Statistics strip — one per line as <code>Value | Label</code></label>
            <textarea id="aboutStats" name="stats" rows="4" style="font-family:var(--font);font-size:1rem">${e(
              (about.stats || []).map((stat) => `${stat.value} | ${stat.label}`).join('\n')
            )}</textarea>
            <p class="field__hint">Only add figures you can verify — nothing here is generated automatically.</p>
          </div>
          <div class="field">
            <label for="aboutImageAlt">Image alt text</label>
            <input type="text" id="aboutImageAlt" name="imageAlt" value="${e(about.imageAlt || '')}" maxlength="160" />
          </div>
          ${imageSlot('about')}
          <button class="btn" type="submit">Save about page</button>
        </form>
      </section>

      <section class="admin-card" style="margin-top:1.5rem">
        <h2>Contact page</h2>
        <form method="post" action="/admin/content/contact">
          <input type="hidden" name="csrf" value="${e(csrfToken)}" />
          <div class="field">
            <label for="contactTitle">Page heading</label>
            <input type="text" id="contactTitle" name="title" value="${e(contact.title)}" maxlength="140" />
          </div>
          <div class="field">
            <label for="contactLede">Introduction</label>
            <textarea id="contactLede" name="lede" rows="2" maxlength="400" style="font-family:var(--font);font-size:1rem">${e(contact.lede)}</textarea>
          </div>
          <div class="field">
            <label for="contactEmail">Displayed email address</label>
            <input type="email" id="contactEmail" name="email" value="${e(contact.email)}" maxlength="160" />
          </div>
          <div class="field">
            <label for="contactNote">Note under the email address</label>
            <textarea id="contactNote" name="responseNote" rows="2" maxlength="400" style="font-family:var(--font);font-size:1rem">${e(contact.responseNote)}</textarea>
          </div>
          ${imageSlot('contact')}
          <button class="btn" type="submit">Save contact page</button>
        </form>
      </section>

      <section class="admin-card" style="margin-top:1.5rem">
        <h2>Homepage FAQ</h2>
        <form method="post" action="/admin/content/faq">
          <input type="hidden" name="csrf" value="${e(csrfToken)}" />
          <div class="field">
            <label for="faqJson">FAQ entries as JSON</label>
            <textarea id="faqJson" name="faq" rows="12" spellcheck="false">${e(JSON.stringify(content.faq, null, 2))}</textarea>
            <p class="field__hint">An array of objects with <code>q</code> and <code>a</code>. Invalid JSON is rejected with an error message and the previous version is kept.</p>
          </div>
          <button class="btn" type="submit">Save FAQ</button>
        </form>
      </section>`;

  return adminLayout({ title: 'Content — admin', active: 'content', body, csrfToken, flash });
}

/* ------------------------------------------------------------------ *
 * Image manager
 * ------------------------------------------------------------------ */

function adminImages({ csrfToken, flash }) {
  const registry = store.listUploads();
  const content = store.getContent();
  const usage = require('../uploads').uploadsDiskUsage();

  const usedBy = (name) => {
    const matches = SLOTS.filter((slot) => content[slot.key] && content[slot.key].imageId === name);
    if (store.getSettings().defaultLogo === `/uploads/${name}`) matches.push({ label: 'Site logo' });
    return matches.map((slot) => slot.label);
  };

  const tile = (entry) => {
    const references = usedBy(entry.name);
    return `
          <div class="image-tile">
            <a href="${e(entry.url)}" target="_blank" rel="noopener" title="Open full size">
              <img class="image-tile__thumb" src="/uploads/thumbnails/${e(entry.fileName.replace(/\.[a-z0-9]+$/i, '.jpg'))}" alt="Uploaded image ${e(entry.name)}" loading="lazy" onerror="this.src='${e(entry.url)}'" />
            </a>
            <p class="image-tile__meta">${e(entry.name)}<br />${bytes(entry.size)} • ${e(new Date(entry.modified).toLocaleDateString('en-GB'))}</p>
            ${references.length ? `<p class="badge badge--ok">Used: ${e(references.join(', '))}</p>` : '<p class="badge">Not used on any page</p>'}
            <div class="image-tile__actions">
              <form method="post" action="/admin/images/use" style="margin:0">
                <input type="hidden" name="csrf" value="${e(csrfToken)}" />
                <input type="hidden" name="name" value="${e(entry.name)}" />
                <label class="sr-only" for="slot-${e(entry.name.replace(/[^a-z0-9]/gi, '-'))}">Use this image for</label>
                <select id="slot-${e(entry.name.replace(/[^a-z0-9]/gi, '-'))}" name="slot">
                  ${SLOTS.map((slot) => `<option value="${e(slot.key)}">${e(slot.label)}</option>`).join('')}
                </select>
                <button class="btn btn--soft btn--sm" type="submit">Use for section</button>
              </form>
              <form method="post" action="/admin/images/replace" enctype="multipart/form-data" style="margin:0">
                <input type="hidden" name="csrf" value="${e(csrfToken)}" />
                <input type="hidden" name="folder" value="${e(entry.folder)}" />
                <input type="hidden" name="name" value="${e(entry.fileName)}" />
                <input class="file-input" type="file" name="image" accept="image/jpeg,image/png,image/webp" required aria-label="Replacement file for ${e(entry.name)}" />
                <button class="btn btn--soft btn--sm" type="submit">Replace</button>
              </form>
              <form method="post" action="/admin/images/delete" style="margin:0">
                <input type="hidden" name="csrf" value="${e(csrfToken)}" />
                <input type="hidden" name="folder" value="${e(entry.folder)}" />
                <input type="hidden" name="name" value="${e(entry.fileName)}" />
                <button class="btn btn--danger btn--sm" type="submit" onclick="return confirm('Delete ${e(entry.name)}? Any section using it will fall back to text only.')">Delete</button>
              </form>
            </div>
          </div>`;
  };

  const section = (folder, title, description) => `
        <section class="admin-card" style="margin-top:1.5rem">
          <div class="admin-panel-head">
            <h2>${e(title)}</h2>
            <span class="badge">${registry[folder].length} files</span>
          </div>
          <p class="muted" style="font-size:0.9rem">${e(description)}</p>
          ${
            registry[folder].length
              ? `<div class="image-manager">${registry[folder].map(tile).join('')}</div>`
              : '<p class="muted">Nothing uploaded here yet.</p>'
          }
        </section>`;

  const body = `
      <div class="admin-panel-head">
        <h1>Image manager</h1>
        <span class="badge">${usage.files} files • ${bytes(usage.bytes)}</span>
      </div>

      <section class="admin-card">
        <h2>Upload a new image</h2>
        <p class="muted" style="font-size:0.9rem">
          JPG, PNG or WebP up to 4 MB. Every upload is validated, re-encoded with Sharp, resized to a sensible maximum,
          given a random filename and saved with a matching thumbnail. The original filename is never reused, and
          non-image files are rejected even if they are renamed with an image extension.
        </p>
        <form method="post" action="/admin/images/upload" enctype="multipart/form-data">
          <input type="hidden" name="csrf" value="${e(csrfToken)}" />
          <div class="field-row field-row--2">
            <div class="field">
              <label for="uploadFile">Image file</label>
              <input class="file-input" type="file" id="uploadFile" name="image" accept="image/jpeg,image/png,image/webp" required />
            </div>
            <div class="field">
              <label for="uploadFolder">Save to folder</label>
              <select id="uploadFolder" name="folder">
                <option value="images">images — general content images</option>
                <option value="banners">banners — wide banner images</option>
                <option value="logo">logo — site logo</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label for="uploadSlot">Assign to a content section (optional)</label>
            <select id="uploadSlot" name="useForSlot">
              <option value="">Do not assign — just add to the library</option>
              <option value="hero">Homepage hero</option>
              <option value="banner">Homepage banner section</option>
              <option value="promo">Privacy / promo section</option>
              <option value="about">About page</option>
              <option value="contact">Contact page</option>
              <option value="logo">Site logo</option>
            </select>
          </div>
          <button class="btn" type="submit">Upload image</button>
        </form>
      </section>

      ${section('images', 'Content images', 'General-purpose images. Use “Use for section” to point a homepage or page section at any of them.')}
      ${section('banners', 'Banners', 'Wide images intended for the homepage banner section.')}
      ${section('logo', 'Logos', 'Uploaded logo files. Assign one to the site header with “Use for section”.')}
      ${section('thumbnails', 'Generated thumbnails', 'Created automatically for every upload (400 px wide). They are deleted together with their source image.')}`;

  return adminLayout({ title: 'Images — admin', active: 'images', body, csrfToken, flash });
}

/* ------------------------------------------------------------------ *
 * Messages
 * ------------------------------------------------------------------ */

function readMessages() {
  const fs = require('fs');
  const path = require('path');
  try {
    const raw = fs.readFileSync(path.join(store.DATA_DIR, 'messages.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function adminMessages({ csrfToken, flash }) {
  const messages = readMessages();

  const body = `
      <div class="admin-panel-head">
        <h1>Contact messages</h1>
        <span class="badge">${messages.length} total</span>
      </div>

      <section class="admin-card">
        ${
          messages.length
            ? `<div class="table-wrap"><table>
                <caption class="sr-only">Messages received through the contact form</caption>
                <thead><tr><th scope="col">Received</th><th scope="col">From</th><th scope="col">Subject</th><th scope="col">Message</th><th scope="col">Actions</th></tr></thead>
                <tbody>
                  ${messages
                    .map(
                      (m) => `<tr>
                        <td>${e(new Date(m.receivedAt).toLocaleString('en-GB'))}<br />${m.read ? '<span class="badge badge--ok">read</span>' : '<span class="badge badge--warn">new</span>'}</td>
                        <td>${e(m.name)}<br /><a href="mailto:${e(m.email)}">${e(m.email)}</a></td>
                        <td>${e(m.subject || '—')}</td>
                        <td class="wrap-anywhere">${e(m.message)}</td>
                        <td>
                          <div class="image-tile__actions">
                            ${
                              m.read
                                ? ''
                                : `<form method="post" action="/admin/messages/read" style="margin:0">
                                    <input type="hidden" name="csrf" value="${e(csrfToken)}" />
                                    <input type="hidden" name="id" value="${e(m.id)}" />
                                    <button class="btn btn--soft btn--sm" type="submit">Mark read</button>
                                  </form>`
                            }
                            <form method="post" action="/admin/messages/delete" style="margin:0">
                              <input type="hidden" name="csrf" value="${e(csrfToken)}" />
                              <input type="hidden" name="id" value="${e(m.id)}" />
                              <button class="btn btn--danger btn--sm" type="submit" onclick="return confirm('Delete this message?')">Delete</button>
                            </form>
                          </div>
                        </td>
                      </tr>`
                    )
                    .join('')}
                </tbody>
              </table></div>`
            : '<p class="muted">No messages yet. Anything sent through the <a href="/contact">contact form</a> appears here.</p>'
        }
      </section>`;

  return adminLayout({ title: 'Messages — admin', active: 'messages', body, csrfToken, flash });
}

module.exports = {
  SLOTS,
  adminLogin,
  adminDashboard,
  adminSettings,
  adminContent,
  adminImages,
  adminMessages,
  readMessages,
  bytes,
};
