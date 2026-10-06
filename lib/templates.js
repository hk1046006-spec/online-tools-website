'use strict';

/**
 * Server-side HTML rendering helpers.
 *
 * Pages are rendered on the server so every visitor (and every crawler) gets
 * complete HTML with a unique title, meta description, canonical URL, Open
 * Graph tags and JSON-LD structured data. The interactive part of each tool is
 * plain vanilla JavaScript loaded from /js/tools/<slug>.js.
 */

const { TOOLS, getTool, relatedTools } = require('./tools');
const store = require('./store');

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function attr(value) {
  return escapeHtml(value);
}

function jsonScript(obj) {
  // `<` is escaped so a "</script>" inside data can never break out of the tag.
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

function absolute(pathname) {
  const base = (store.getSettings().baseUrl || '').replace(/\/+$/, '');
  return `${base}${pathname}`;
}

/* ------------------------------------------------------------------ *
 * Inline SVG icon set (no external requests, no icon font)
 * ------------------------------------------------------------------ */

const ICONS = {
  logo: '<svg viewBox="0 0 32 32" role="img" aria-hidden="true" focusable="false"><rect x="2" y="2" width="28" height="28" rx="8" fill="currentColor"/><path d="M11.2 22.4 8 12h2.6l1.9 7.1L14.7 12h2.4l2.2 7.1L21.1 12H24l-3.4 10.4h-2.5l-2.2-6.9-2.2 6.9z" fill="#fff"/></svg>',
  compress:
    '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M4 4h7v2H6v5H4V4zm9 0h7v7h-2V6h-5V4zM4 13h2v5h5v2H4v-7zm14 0h2v7h-7v-2h5v-5zM9 11h6v2H9v-2z" fill="currentColor"/></svg>',
  qr: '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h3v3h-3v-3zm-5 0h3v3h-3v-3zm0 5h3v3h-3v-3zm5 0h3v3h-3v-3z" fill="currentColor"/></svg>',
  key: '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M14 3a7 7 0 0 0-6.7 9H3v4h2v2h4v-3h1.3A7 7 0 1 0 14 3zm2.5 6.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" fill="currentColor"/></svg>',
  text: '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M4 5h16v3h-1.5V6.5h-5V18h2v1.5h-7V18h2V6.5h-5V8H4V5z" fill="currentColor"/></svg>',
  code: '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M8.7 6.3 3 12l5.7 5.7 1.4-1.4L5.8 12l4.3-4.3-1.4-1.4zm6.6 0-1.4 1.4L18.2 12l-4.3 4.3 1.4 1.4L21 12l-5.7-5.7z" fill="currentColor"/></svg>',
  palette:
    '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M12 3a9 9 0 0 0 0 18c1.4 0 2.2-.9 2.2-2 0-.6-.2-1-.5-1.4-.3-.3-.4-.7-.4-1.1 0-.8.7-1.5 1.6-1.5H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7zm-4.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm2.5-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm4 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3.5 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" fill="currentColor"/></svg>',
  ruler:
    '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M2 9.5 9.5 2 22 14.5 14.5 22 2 9.5zm4.2.7 1.4-1.4 1.4 1.4-1.4 1.4-1.4-1.4zm2.8-2.8 1.4-1.4L11.8 7.4 10.4 8.8 9 7.4zm2.8-2.8 1.4-1.4 1.4 1.4L13.2 6 11.8 4.6z" fill="currentColor"/></svg>',
  calendar:
    '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M7 2h2v2h6V2h2v2h3a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3V2zM5 9v10h14V9H5zm2 2h4v4H7v-4z" fill="currentColor"/></svg>',
  link: '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M10.6 13.4a1 1 0 0 1 0-1.4l1.4-1.4a1 1 0 1 1 1.4 1.4l-1.4 1.4a1 1 0 0 1-1.4 0zm-3.2 3.2a4 4 0 0 1 0-5.7l3-3a4 4 0 0 1 5.7 5.7l-1 1-1.4-1.4 1-1a2 2 0 1 0-2.9-2.9l-3 3A2 2 0 0 0 11.7 15l-1 1a4 4 0 0 1-3.3-1.4zm9.2-9.1 1-1a4 4 0 0 1 0 5.7l-3 3a4 4 0 0 1-5.7-5.7l1-1 1.4 1.4-1 1a2 2 0 1 0 2.9 2.9l3-3a2 2 0 0 0-2.9-2.9l-1.4-1.4z" fill="currentColor"/></svg>',
  case: '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M3 18 7.5 6h2.3L14.3 18h-2.4l-1-2.8H6.3L5.3 18H3zm4-4.8h3.6L8.8 8.6 7 13.2zM15.5 18V6H20a3 3 0 0 1 .6 5.9A3.2 3.2 0 0 1 20 18h-4.5zm2.1-1.9h2.2a1.4 1.4 0 0 0 0-2.8h-2.2v2.8zm0-4.6h1.9a1.2 1.2 0 0 0 0-2.4h-1.9v2.4z" fill="currentColor"/></svg>',
  shield:
    '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M12 2 4 5v6.5c0 4.6 3.2 9.1 8 10.5 4.8-1.4 8-5.9 8-10.5V5l-8-3zm-1 13-3-3 1.4-1.4L11 12.2l4.6-4.6L17 9l-6 6z" fill="currentColor"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor"/></svg>',
  privacy:
    '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M17 9V7a5 5 0 0 0-10 0v2H5v12h14V9h-2zM9 7a3 3 0 0 1 6 0v2H9V7zm4 9.7V19h-2v-2.3a2 2 0 1 1 2 0z" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M9.6 17 4 11.4l1.4-1.4 4.2 4.2 9-9L20 6.6 9.6 17z" fill="currentColor"/></svg>',
  copy: '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M8 3h9a2 2 0 0 1 2 2v12h-2V5H8V3zm-3 4h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm0 2v12h9V9H5z" fill="currentColor"/></svg>',
  download:
    '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M11 3h2v9l3.5-3.5 1.4 1.4L12 15.8l-5.9-5.9 1.4-1.4L11 12V3zM4 19h16v2H4v-2z" fill="currentColor"/></svg>',
  swap: '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M7 4l-4 4 4 4V9h9V7H7V4zm10 8v3H8v2h9v3l4-4-4-4z" fill="currentColor"/></svg>',
  trash:
    '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M9 3h6l1 2h4v2H4V5h4l1-2zM6 9h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 9zm3 2v9h2v-9H9zm4 0v9h2v-9h-2z" fill="currentColor"/></svg>',
};

function icon(name, className = 'icon') {
  const svg = ICONS[name] || ICONS.bolt;
  return svg.replace('<svg ', `<svg class="${className}" `);
}

/* ------------------------------------------------------------------ *
 * Reusable blocks
 * ------------------------------------------------------------------ */

/** Clearly marked, empty advertisement region. Never contains fake adverts. */
function adSlot(where) {
  const label = {
    HEADER: 'Header advertisement area',
    SIDEBAR: 'Sidebar advertisement area',
    'IN-CONTENT': 'In-content advertisement area',
    FOOTER: 'Footer advertisement area',
  }[where] || 'Advertisement area';

  return `
      <!-- AD SLOT: ${where} -->
      <aside class="ad-slot ad-slot--${where.toLowerCase()}" aria-label="${escapeHtml(label)}" data-ad-slot="${where}">
        <span class="ad-slot__label">Advertisement</span>
        <span class="ad-slot__size">${where === 'SIDEBAR' ? '300 &times; 250' : 'Responsive'}</span>
      </aside>
      <!-- /AD SLOT: ${where} -->`;
}

function breadcrumbs(items) {
  if (!items || !items.length) return '';
  const list = items
    .map((item, i) => {
      const last = i === items.length - 1;
      const inner = last
        ? `<span aria-current="page">${escapeHtml(item.label)}</span>`
        : `<a href="${attr(item.href)}">${escapeHtml(item.label)}</a>`;
      return `<li>${inner}${last ? '' : '<span class="crumb__sep" aria-hidden="true">/</span>'}</li>`;
    })
    .join('');
  return `<nav class="breadcrumb" aria-label="Breadcrumb"><ol>${list}</ol></nav>`;
}

function toolCard(tool) {
  return `
        <article class="card tool-card">
          <span class="tool-card__icon" aria-hidden="true">${icon(tool.icon, 'icon tool-card__glyph')}</span>
          <h3 class="tool-card__title"><a href="/tools/${attr(tool.slug)}">${escapeHtml(tool.name)}</a></h3>
          <p class="tool-card__text">${escapeHtml(tool.short)}</p>
          <a class="btn btn--ghost tool-card__cta" href="/tools/${attr(tool.slug)}">Open tool<span class="sr-only">: ${escapeHtml(tool.name)}</span></a>
        </article>`;
}

function toolGrid() {
  return `<div class="grid grid--tools">${TOOLS.map(toolCard).join('')}</div>`;
}

function relatedToolsBlock(slug, heading = 'Related tools') {
  const list = relatedTools(slug, 3);
  return `
      <section class="section section--tight" aria-labelledby="related-heading">
        <h2 id="related-heading">${escapeHtml(heading)}</h2>
        <p class="section__lede">Other utilities that often come in handy at the same time.</p>
        <div class="grid grid--tools">${list.map(toolCard).join('')}</div>
      </section>`;
}

function faqBlock(items, id = 'faq') {
  if (!items || !items.length) return '';
  const rows = items
    .map(
      (item) => `
          <details class="faq__item">
            <summary><h3>${escapeHtml(item.q)}</h3></summary>
            <div class="faq__answer"><p>${escapeHtml(item.a)}</p></div>
          </details>`
    )
    .join('');
  return `
      <section class="section section--tight" aria-labelledby="${attr(id)}-heading">
        <h2 id="${attr(id)}-heading">Frequently asked questions</h2>
        <div class="faq">${rows}</div>
      </section>`;
}

function howToUse(steps, heading = 'How to use this tool') {
  if (!steps || !steps.length) return '';
  const list = steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('');
  return `
      <section class="section section--tight" aria-labelledby="howto-heading">
        <h2 id="howto-heading">${escapeHtml(heading)}</h2>
        <ol class="steps">${list}</ol>
      </section>`;
}

function alertBox(type, message, id) {
  if (!message) return '';
  return `<div class="alert alert--${attr(type)}"${id ? ` id="${attr(id)}"` : ''} role="status">${escapeHtml(message)}</div>`;
}

/* ------------------------------------------------------------------ *
 * Header / footer
 * ------------------------------------------------------------------ */

function navigation(currentPath) {
  const links = [
    { href: '/', label: 'Home' },
    { href: '/tools', label: 'All tools', dropdown: true },
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ];

  const isActive = (href) => {
    if (href === '/') return currentPath === '/';
    if (href === '/tools') return currentPath.startsWith('/tools');
    return currentPath === href || currentPath.startsWith(`${href}/`);
  };

  const items = links
    .map((link) => {
      if (!link.dropdown) {
        return `<li><a class="nav__link${isActive(link.href) ? ' is-active' : ''}" href="${attr(link.href)}"${isActive(link.href) ? ' aria-current="page"' : ''}>${escapeHtml(link.label)}</a></li>`;
      }
      const sub = TOOLS.map(
        (t) =>
          `<li><a href="/tools/${attr(t.slug)}"><span class="nav__sub-icon" aria-hidden="true">${icon(t.icon, 'icon nav__sub-glyph')}</span><span><strong>${escapeHtml(t.name)}</strong><small>${escapeHtml(t.short)}</small></span></a></li>`
      ).join('');
      return `<li class="nav__has-menu"><a class="nav__link${isActive(link.href) ? ' is-active' : ''}" href="${attr(link.href)}">${escapeHtml(link.label)}<span class="nav__caret" aria-hidden="true">▾</span></a><ul class="nav__submenu">${sub}</ul></li>`;
    })
    .join('');

  return items;
}

function header(currentPath, settings, content) {
  const logoUrl = settings.defaultLogo || '/assets/logo.svg';
  const siteName = settings.siteName || 'ToolBox';

  return `
    <a class="skip-link" href="#main">Skip to main content</a>
    <header class="site-header" id="top">
      <div class="container site-header__inner">
        <a class="brand" href="/" aria-label="${attr(siteName)} home">
          <img class="brand__logo" src="${attr(logoUrl)}" alt="${attr(siteName)} logo" width="40" height="40" decoding="async" />
          <span class="brand__text">
            <span class="brand__name">${escapeHtml(siteName)}</span>
            <span class="brand__tagline">${escapeHtml(settings.tagline || '')}</span>
          </span>
        </a>

        <button class="nav-toggle" type="button" id="navToggle" aria-expanded="false" aria-controls="primaryNav" aria-label="Open main menu">
          <span class="nav-toggle__bars" aria-hidden="true"><span></span><span></span><span></span></span>
        </button>

        <nav class="nav" id="primaryNav" aria-label="Main">
          <ul class="nav__list">${navigation(currentPath)}</ul>
        </nav>

        <button class="theme-toggle" type="button" id="themeToggle" aria-pressed="false" aria-label="Switch to dark theme" title="Switch theme">
          <span class="theme-toggle__sun" aria-hidden="true">☀</span>
          <span class="theme-toggle__moon" aria-hidden="true">☾</span>
        </button>
      </div>
    </header>
${adSlot('HEADER')}
<!-- AD SLOT: HEADER -->`;
}

function footer(settings, content) {
  const year = new Date().getFullYear();
  const toolLinks = TOOLS.map((t) => `<li><a href="/tools/${attr(t.slug)}">${escapeHtml(t.name)}</a></li>`).join('');
  const footerText = settings.footerText
    ? `<p class="site-footer__note">${escapeHtml(settings.footerText)}</p>`
    : '';
  const email = (content && content.contact && content.contact.email) || settings.supportEmail || '';

  return `
    <footer class="site-footer">
      <div class="container site-footer__inner">
        <div class="site-footer__col site-footer__col--brand">
          <p class="site-footer__brand">${escapeHtml(settings.siteName || 'ToolBox')}</p>
          <p class="site-footer__text">${escapeHtml(settings.tagline || '')}</p>
          ${email ? `<p class="site-footer__text">Email: <a href="mailto:${attr(email)}">${escapeHtml(email)}</a></p>` : ''}
          ${footerText}
        </div>
        <nav class="site-footer__col" aria-label="All tools">
          <h2 class="site-footer__heading">Tools</h2>
          <ul class="site-footer__links">${toolLinks}</ul>
        </nav>
        <nav class="site-footer__col" aria-label="Website">
          <h2 class="site-footer__heading">Website</h2>
          <ul class="site-footer__links">
            <li><a href="/">Home</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/contact">Contact</a></li>
            <li><a href="/sitemap.xml">Sitemap</a></li>
            <li><a href="/admin">Admin</a></li>
          </ul>
        </nav>
      </div>
      <div class="container site-footer__bottom">
        <p>&copy; ${year} ${escapeHtml(settings.siteName || 'ToolBox')}. All rights reserved.</p>
        <p>Built with Node.js &amp; Express. No tracking, no cookies for advertising.</p>
      </div>
    </footer>
${adSlot('FOOTER')}
    <a class="to-top" href="#top" aria-label="Back to top">↑</a>`;
}

/* ------------------------------------------------------------------ *
 * Layout
 * ------------------------------------------------------------------ */

/**
 * @param {object} opts
 * @param {string} opts.title       Full <title> (unique per page)
 * @param {string} opts.description Unique meta description
 * @param {string} opts.body        Main content HTML
 * @param {string} opts.canonicalPath Path used for canonical + OG url
 * @param {string} [opts.pageScript] Path of the tool script, if any
 * @param {string} [opts.bodyClass]
 * @param {object[]} [opts.jsonLd]  Extra structured data blocks
 * @param {string} [opts.ogImage]   Absolute or root-relative social image
 */
function layout(opts) {
  const settings = store.getSettings();
  const content = store.getContent();
  const canonical = absolute(opts.canonicalPath);
  const ogImage = opts.ogImage ? (opts.ogImage.startsWith('http') ? opts.ogImage : absolute(opts.ogImage)) : '';
  const siteName = settings.siteName || 'ToolBox';

  const structured = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: siteName,
      url: absolute('/'),
      description: settings.metaDescription,
      inLanguage: 'en',
    },
    ...(opts.jsonLd || []),
  ];

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.title)}</title>
  <meta name="description" content="${attr(opts.description)}" />
  <link rel="canonical" href="${attr(canonical)}" />
  <meta name="robots" content="${opts.noindex ? 'noindex, nofollow' : 'index, follow'}" />
  <meta name="theme-color" content="#2f6fed" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${attr(siteName)}" />
  <meta property="og:title" content="${attr(opts.title)}" />
  <meta property="og:description" content="${attr(opts.description)}" />
  <meta property="og:url" content="${attr(canonical)}" />
  ${ogImage ? `<meta property="og:image" content="${attr(ogImage)}" />` : ''}
  <meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}" />
  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
  <link rel="apple-touch-icon" href="/assets/favicon.svg" />
  <link rel="stylesheet" href="/css/style.css" />
  ${structured.map(jsonScript).join('\n  ')}
</head>
<body class="${attr(opts.bodyClass || '')}">
${header(opts.canonicalPath, settings, content)}
    <main id="main" class="site-main">
${opts.body}
    </main>
${footer(settings, content)}
    <script src="/js/main.js" defer></script>
${opts.pageScript ? `    <script src="${attr(opts.pageScript)}" defer></script>` : ''}
</body>
</html>
`;
}

module.exports = {
  escapeHtml,
  attr,
  icon,
  adSlot,
  breadcrumbs,
  toolCard,
  toolGrid,
  relatedToolsBlock,
  faqBlock,
  howToUse,
  alertBox,
  layout,
  jsonScript,
  absolute,
};
