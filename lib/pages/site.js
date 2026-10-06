'use strict';

/**
 * Home, About, Contact and 404 pages.
 *
 * All text and images come from data/content.json and data/settings.json, so
 * everything here can be edited from the admin panel.
 */

const fs = require('fs');
const path = require('path');
const store = require('../store');
const t = require('../templates');
const { TOOLS } = require('../tools');
const { escapeHtml: e, icon, adSlot, breadcrumbs, toolGrid, relatedToolsBlock, faqBlock, layout } = t;

/* ------------------------------------------------------------------ *
 * Image resolution
 * ------------------------------------------------------------------ */

/**
 * Turn a stored image id ("images/hero.jpg") into a public URL.
 * Returns '' when the id is empty or the file no longer exists, so the
 * templates can fall back to a text-only layout instead of a broken image.
 */
function imageUrl(imageId) {
  if (!imageId || typeof imageId !== 'string') return '';
  const clean = imageId.replace(/^\/+/, '');
  if (!/^(images|thumbnails|logo|banners)\/[A-Za-z0-9._-]+$/.test(clean)) return '';
  const abs = path.join(store.UPLOAD_DIR, clean);
  try {
    if (!fs.statSync(abs).isFile()) return '';
  } catch (err) {
    return '';
  }
  return `/uploads/${clean}`;
}

function thumbUrl(imageId) {
  if (!imageId) return '';
  const name = imageId.split('/').pop();
  return imageUrl(`thumbnails/${name}`) || imageUrl(imageId);
}

/* ------------------------------------------------------------------ *
 * Home page
 * ------------------------------------------------------------------ */

function heroSection(content) {
  const hero = content.hero;
  const img = imageUrl(hero.imageId);
  const alt = hero.imageAlt || 'A laptop, notebook and coffee cup on a wooden desk';

  const figure = img
    ? `
          <figure class="hero__figure">
            <img src="${t.attr(img)}" alt="${t.attr(alt)}" width="1200" height="750" fetchpriority="high" decoding="async" />
            <figcaption>Everything on this page works — no mock-ups, no placeholders.</figcaption>
          </figure>`
    : '';

  return `
      <section class="hero" aria-labelledby="hero-heading">
        <div class="container hero__inner">
          <div class="hero__copy">
            <p class="hero__eyebrow">${icon('bolt', 'icon')} ${e(hero.eyebrow || '')}</p>
            <h1 id="hero-heading">${e(hero.headline)}</h1>
            <p class="hero__lede">${e(hero.subheadline)}</p>
            <div class="hero__actions">
              <a class="btn btn--lg" href="${t.attr(hero.primaryCta.href)}">${e(hero.primaryCta.label)}</a>
              <a class="btn btn--ghost btn--lg" href="${t.attr(hero.secondaryCta.href)}">${e(hero.secondaryCta.label)}</a>
            </div>
            <ul class="hero__trust">
              <li>${icon('check', 'icon')} No sign-up</li>
              <li>${icon('check', 'icon')} Runs in your browser</li>
              <li>${icon('check', 'icon')} Free with no limits</li>
            </ul>
          </div>
          <div class="hero__media">${figure}</div>
        </div>
      </section>`;
}

function statsBanner(content) {
  const stats = (content.about && content.about.stats) || [];
  if (!stats.length) return '';
  return `
      <section class="section section--tight" aria-label="At a glance">
        <div class="container">
          <ul class="stat-banner">
            ${stats
              .map(
                (stat) =>
                  `<li><strong>${e(stat.value)}</strong><span>${e(stat.label)}</span></li>`
              )
              .join('\n            ')}
          </ul>
        </div>
      </section>`;
}

function bannerSection(content) {
  const banner = content.banner;
  if (!banner || !banner.title) return '';
  const img = imageUrl(banner.imageId);
  return `
      <section class="section section--alt" aria-labelledby="banner-heading">
        <div class="container grid grid--two" style="align-items:center">
          <div>
            <h2 id="banner-heading">${e(banner.title)}</h2>
            <p class="section__lede">${e(banner.text)}</p>
            <a class="btn" href="#tools">Open a tool</a>
          </div>
          ${
            img
              ? `<img src="${t.attr(img)}" alt="${t.attr(banner.imageAlt || 'A tidy desk with a notebook and a cup of coffee')}" width="1200" height="800" loading="lazy" decoding="async" style="border-radius:var(--radius-lg);border:1px solid var(--border);box-shadow:var(--shadow)" />`
              : ''
          }
        </div>
      </section>`;
}

function promoSection(content) {
  const promo = content.promo;
  if (!promo || !promo.title) return '';
  const img = imageUrl(promo.imageId);
  const bullets = (promo.bullets || [])
    .map((b) => `<li>${icon('check', 'icon')} ${e(b)}</li>`)
    .join('\n              ');

  return `
      <section class="section" aria-labelledby="privacy-heading">
        <div class="container grid grid--two" style="align-items:center">
          <div>
            <h2 id="privacy-heading">${e(promo.title)}</h2>
            <p class="section__lede">${e(promo.text)}</p>
            <ul class="hero__trust" style="flex-direction:column;gap:0.5rem">
              ${bullets}
            </ul>
          </div>
          ${
            img
              ? `<img src="${t.attr(img)}" alt="${t.attr(promo.imageAlt || 'A laptop and a lamp on a bright desk')}" width="1200" height="800" loading="lazy" decoding="async" style="border-radius:var(--radius-lg);border:1px solid var(--border);box-shadow:var(--shadow)" />`
              : `<div class="card">
                  <h3>How the split works</h3>
                  <p class="muted">Input for the password generator, word counter, JSON formatter, colour picker, unit converter, age calculator, URL encoder and text case converter is processed by JavaScript in your browser. Only image compression and QR rendering need a server round-trip.</p>
                </div>`
          }
        </div>
      </section>`;
}

function featuresSection(content) {
  const points = (content.about && content.about.points) || [];
  if (!points.length) return '';
  return `
      <section class="section section--alt" aria-labelledby="why-heading">
        <div class="container">
          <h2 id="why-heading">Why this site is different</h2>
          <p class="section__lede">Short version: the tools work, the pages load fast, and nothing you type is collected.</p>
          <div class="grid grid--three">
            ${points
              .map(
                (point) => `
            <div class="feature">
              <span class="feature__icon" aria-hidden="true">${icon('shield', 'icon')}</span>
              <div>
                <h3>${e(point.title)}</h3>
                <p>${e(point.text)}</p>
              </div>
            </div>`
              )
              .join('')}
          </div>
        </div>
      </section>`;
}

function homePage() {
  const content = store.getContent();

  const body = `
    ${heroSection(content)}
    <div class="container">
      <!-- AD SLOT: IN-CONTENT -->
      ${adSlot('IN-CONTENT')}
      <!-- /AD SLOT: IN-CONTENT -->
    </div>

    <section class="section" id="tools" aria-labelledby="tools-heading">
      <div class="container">
        <h2 id="tools-heading">All ten tools</h2>
        <p class="section__lede">
          Pick the tool you need — each one opens in a single page with the tool at the top, so you never scroll past
          advertising to reach the thing you came for.
        </p>
        ${toolGrid()}
      </div>
    </section>

    ${statsBanner(content)}
    ${bannerSection(content)}
    ${promoSection(content)}
    ${featuresSection(content)}

    <div class="container">
      ${faqBlock(content.faq, 'home-faq')}
    </div>

    ${relatedToolsBlock('', 'Start with one of these')}`;

  return layout({
    title: 'ToolBox — 10 Free Online Tools for Everyday Tasks',
    description:
      'Ten free online tools that actually work: compress images, generate QR codes and strong passwords, count words, format JSON, convert colours, units and ages.',
    canonicalPath: '/',
    body,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Free online tools',
        itemListElement: TOOLS.map((tool, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: tool.name,
          url: t.absolute(tool.url),
        })),
      },
    ],
  });
}

/* ------------------------------------------------------------------ *
 * About
 * ------------------------------------------------------------------ */

function aboutPage() {
  const content = store.getContent();
  const about = content.about;
  const img = imageUrl(about.imageId);
  const story = (about.story || []).map((paragraph) => `<p>${e(paragraph)}</p>`).join('\n          ');

  const body = `
    <div class="container">
      ${breadcrumbs([{ label: 'Home', href: '/' }, { label: 'About' }])}
      <header class="tool-header">
        <h1>${e(about.title)}</h1>
        <p class="tool-header__lede">${e(about.lede)}</p>
      </header>

      <div class="grid grid--two" style="align-items:start">
        <div class="prose">
          ${story}
        </div>
        ${
          img
            ? `<img src="${t.attr(img)}" alt="${t.attr(about.imageAlt || 'A bright desk with a laptop, notebook and a cup of coffee')}" width="1200" height="800" loading="lazy" decoding="async" style="border-radius:var(--radius-lg);border:1px solid var(--border);box-shadow:var(--shadow)" />`
            : ''
        }
      </div>

      ${adSlot('IN-CONTENT')}

      <section class="section section--tight" aria-labelledby="principles-heading">
        <h2 id="principles-heading">How this site is built</h2>
        <div class="grid grid--three">
          ${(about.points || [])
            .map(
              (point) => `
          <div class="feature">
            <span class="feature__icon" aria-hidden="true">${icon('check', 'icon')}</span>
            <div>
              <h3>${e(point.title)}</h3>
              <p>${e(point.text)}</p>
            </div>
          </div>`
            )
            .join('')}
        </div>
      </section>

      <section class="section section--tight" aria-labelledby="stack-heading">
        <h2 id="stack-heading">The technology, honestly</h2>
        <div class="prose">
          <p>
            The server is Node.js with Express. The browser-facing code is plain HTML, CSS and JavaScript — no front-end
            framework, no build step, no tracking scripts. Content is stored in JSON files under <code>data/</code> and
            uploaded images live in <code>uploads/</code>, which means the whole site can be backed up by copying two
            folders.
          </p>
          <p>
            Images are processed with Sharp: uploads are re-encoded, thumbnailed and stored under a random filename, with
            MIME type and file content both validated so that a renamed executable can never be stored or served.
          </p>
          <p>
            The admin panel is protected by session-based authentication with a bcrypt password hash. You can change the
            logo, banner and content images, edit the site name, tagline and homepage copy, and manage uploaded files.
          </p>
        </div>
        <ul class="stat-banner" style="margin-top:1.5rem">
          ${(about.stats || [])
            .map((stat) => `<li><strong>${e(stat.value)}</strong><span>${e(stat.label)}</span></li>`)
            .join('')}
        </ul>
      </section>

      <section class="section section--tight" aria-labelledby="cta-heading">
        <h2 id="cta-heading">Get in touch</h2>
        <p class="section__lede">
          Suggestions, bug reports and questions are all welcome — the contact form reaches the same inbox the site owner
          reads.
        </p>
        <div class="btn-row">
          <a class="btn" href="/contact">Contact us</a>
          <a class="btn btn--ghost" href="/tools">Browse all tools</a>
        </div>
      </section>
    </div>

    ${relatedToolsBlock('', 'Tools you might need')}`;

  return layout({
    title: `About ${store.getSettings().siteName} — Free Browser-Based Tools`,
    description:
      'What this tools website does, how it is built, and how it handles your data. Plain HTML, CSS and JavaScript on Express with file-based storage.',
    canonicalPath: '/about',
    body,
  });
}

/* ------------------------------------------------------------------ *
 * Contact
 * ------------------------------------------------------------------ */

function contactPage() {
  const content = store.getContent();
  const contact = content.contact;
  const img = imageUrl(contact.imageId) || thumbUrl(content.hero.imageId);
  const email = contact.email || store.getSettings().supportEmail;

  const body = `
    <div class="container">
      ${breadcrumbs([{ label: 'Home', href: '/' }, { label: 'Contact' }])}
      <header class="tool-header">
        <h1>${e(contact.title)}</h1>
        <p class="tool-header__lede">${e(contact.lede)}</p>
      </header>

      <div class="grid grid--two" style="align-items:start">
        <section class="tool-panel" aria-labelledby="contact-form-heading">
          <h2 id="contact-form-heading">Send a message</h2>
          <form id="contactForm" novalidate>
            <div class="field">
              <label for="contactName">Your name</label>
              <input type="text" id="contactName" name="name" autocomplete="name" required maxlength="80" />
            </div>
            <div class="field">
              <label for="contactEmail">Email address</label>
              <input type="email" id="contactEmail" name="email" autocomplete="email" required maxlength="160" />
              <p class="field__hint">Used only to reply to you.</p>
            </div>
            <div class="field">
              <label for="contactSubject">Subject</label>
              <input type="text" id="contactSubject" name="subject" maxlength="120" />
            </div>
            <div class="field">
              <label for="contactMessage">Message</label>
              <textarea id="contactMessage" name="message" rows="6" required maxlength="4000" style="font-family:var(--font);font-size:1rem"></textarea>
              <p class="field__hint"><span id="contactCount">0</span> / 4000 characters</p>
            </div>
            <div class="btn-row">
              <button class="btn btn--lg" type="submit" id="contactSubmit">Send message</button>
              <button class="btn btn--soft" type="reset" id="contactReset">Clear form</button>
            </div>
            <div class="alert" id="contactAlert" hidden></div>
          </form>
        </section>

        <aside class="tool-panel">
          <h2>Other ways to reach us</h2>
          <p>Prefer email? Write to <a href="mailto:${t.attr(email)}">${e(email)}</a>.</p>
          <p class="muted">${e(contact.responseNote)}</p>
          ${
            img
              ? `<img src="${t.attr(img)}" alt="A tidy workspace with a computer and coffee" width="1200" height="800" loading="lazy" decoding="async" style="border-radius:var(--radius);border:1px solid var(--border);margin-top:1rem" />`
              : ''
          }
          ${adSlot('SIDEBAR')}
        </aside>
      </div>

      ${adSlot('IN-CONTENT')}

      <section class="section section--tight" aria-labelledby="contact-faq-heading">
        <h2 id="contact-faq-heading">Before you write</h2>
        <div class="faq">
          <details class="faq__item">
            <summary><h3>Something is not working in a tool</h3></summary>
            <div class="faq__answer"><p>Tell us which tool, which browser and what you expected to happen — and, if it is the image compressor, roughly how large the file was. That is usually enough to reproduce the problem.</p></div>
          </details>
          <details class="faq__item">
            <summary><h3>Can you add a new tool?</h3></summary>
            <div class="faq__answer"><p>Yes, suggestions are welcome. Describe the task you are trying to complete rather than the tool name, and we can usually find the simplest way to do it.</p></div>
          </details>
          <details class="faq__item">
            <summary><h3>Do you accept advertising?</h3></summary>
            <div class="faq__answer"><p>Advertisements are reserved as clearly marked empty slots on this site and are never inserted between a tool and its result. Any future advertising will respect that rule.</p></div>
          </details>
        </div>
      </section>
    </div>

    ${relatedToolsBlock('', 'Tools you can try right now')}`;

  return layout({
    title: `Contact ${store.getSettings().siteName} — Questions, Bugs & Suggestions`,
    description:
      'Contact the team behind this free tools website. Report a bug, suggest a new tool or ask a question using the form — or send an email.',
    canonicalPath: '/contact',
    body,
    pageScript: '/js/contact.js',
  });
}

/* ------------------------------------------------------------------ *
 * 404
 * ------------------------------------------------------------------ */

function notFoundPage(requestedPath) {
  const body = `
    <div class="container">
      ${breadcrumbs([{ label: 'Home', href: '/' }, { label: 'Page not found' }])}
      <header class="tool-header">
        <h1>Page not found</h1>
        <p class="tool-header__lede">
          The page <code class="wrap-anywhere">${e(requestedPath)}</code> does not exist. It may have been moved, or the
          address may contain a typo.
        </p>
      </header>
      <div class="btn-row" style="margin-bottom:2rem">
        <a class="btn" href="/">Go to the homepage</a>
        <a class="btn btn--ghost" href="/tools">See all ten tools</a>
      </div>
      ${toolGrid()}
    </div>`;

  return layout({
    title: 'Page not found (404) — ToolBox',
    description: 'That page does not exist. Browse the ten free online tools available on this site instead.',
    canonicalPath: '/404',
    body,
    noindex: true,
  });
}

module.exports = {
  homePage,
  aboutPage,
  contactPage,
  notFoundPage,
  imageUrl,
  thumbUrl,
};
