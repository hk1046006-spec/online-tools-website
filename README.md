# ToolBox — Online Tools Website

A complete, production-ready online utilities website built with **Node.js + Express** and plain
**HTML, CSS and vanilla JavaScript** in the browser. Ten tools, a working admin panel, file-based
storage (no database), SEO-ready pages and no fake functionality anywhere.

Everything described below works and is covered by the automated test suites in `tests/`.

---

## Table of contents

1. [Project overview](#1-project-overview)
2. [Features](#2-features)
3. [Technology stack](#3-technology-stack)
4. [Installation](#4-installation)
5. [How to open the site](#5-how-to-open-the-site)
6. [Admin login](#6-admin-login)
7. [File structure](#7-file-structure)
8. [The ten tools](#8-the-ten-tools)
9. [API reference](#9-api-reference)
10. [Image upload rules](#10-image-upload-rules)
11. [How to change the port](#11-how-to-change-the-port)
12. [Content and data files](#12-content-and-data-files)
13. [Testing](#13-testing)
14. [SEO](#14-seo)
15. [Responsive design and horizontal overflow](#15-responsive-design-and-horizontal-overflow)
16. [Security notes](#16-security-notes)
17. [Deployment notes](#17-deployment-notes)
18. [Troubleshooting](#18-troubleshooting)
19. [Adding a new tool](#19-adding-a-new-tool)
20. [Licence](#20-licence)

---

## 1. Project overview

ToolBox is a multi-tool utility website designed for search traffic, mobile users and future
expansion. Each tool does one job properly:

* **Eight tools run entirely in the browser** — passwords, word counting, JSON formatting, colour
  conversion, unit conversion, age calculation, URL encoding and text casing. Nothing you type is
  transmitted to the server.
* **Two tools use the server** — the image compressor and the QR code generator. Uploads are
  processed in memory and are never stored permanently.
* **A real admin panel** lets the site owner change the logo, banner, content images, homepage copy,
  site settings, admin password and read/delete contact messages. Changes are written to JSON files
  and survive a restart.

No database is used. Content lives in `data/*.json`, uploaded images in `uploads/`.

---

## 2. Features

**Public site**

* Home page with hero, tool grid (all ten tools), banner, promo section, FAQ and statistics strip
* Ten fully working tool pages, each with breadcrumb, H1, intro, the tool itself near the top,
  result area, "How to use", explanatory content, FAQ and related tools
* About page and a Contact page with a working form (messages are stored and shown in the admin panel)
* Dark / light theme toggle with the choice remembered in `localStorage`
* Mobile hamburger menu with Escape-key support and outside-click closing
* Clearly marked, **empty** advertisement slots (`HEADER`, `SIDEBAR`, `IN-CONTENT`, `FOOTER`)
* 404 page that lists all ten tools instead of a dead end

**Admin panel**

* Session-based login with bcrypt password hashing and CSRF tokens on every form
* Dashboard with tool count, file count, disk usage, message count and storage health
* Site settings: name, tagline, meta description, canonical base URL, support email, footer text
* Logo and banner upload (replace and remove)
* Content editor for the hero, banner, promo, about, contact pages and the homepage FAQ
* Image manager: upload, view, replace, delete, and assign any image to any content section
* Automatic thumbnail generation for every upload
* Message inbox: read, mark as read, delete
* "Restore defaults" actions for the homepage text and FAQ

---

## 3. Technology stack

| Layer     | Used                                                                       |
| --------- | -------------------------------------------------------------------------- |
| Server    | Node.js, Express 4                                                         |
| Images    | `sharp` (compression, resizing, thumbnails, content validation)            |
| QR codes  | `qrcode` (server-rendered PNG, returned as a data URL)                     |
| Uploads   | `multer` (memory storage, MIME allow-list, size limits)                    |
| Sessions  | `express-session` with a small file-backed store (sessions survive restart)|
| Security  | `helmet`, `express-rate-limit`, `bcryptjs`, `crypto` (CSRF + random names)  |
| Front end | HTML5, CSS3, vanilla JavaScript — no framework, no build step              |
| Storage   | JSON files and the `uploads/` folder — **no database**                      |

Required packages from the brief (`express`, `sharp`, `qrcode`, `multer`, `express-session`,
`helmet`, `crypto`) are all used. `bcryptjs` is used instead of `bcrypt` because it is pure
JavaScript: it installs without a compiler, which matters on Termux and in minimal containers.
`express-rate-limit` is included because login and upload endpoints need brute-force protection.
There are no other runtime dependencies.

---

## 4. Installation

Requires **Node.js 16 or newer** (tested on Node 20).

```bash
# 1. install dependencies
npm install

# 2. start the site
node server.js
```

That is all. On first start the project creates, if they are missing:

* `data/settings.json`, `data/content.json`, `data/admin.json`
* `data/session-secret.txt` (random session secret, created once)
* `uploads/images`, `uploads/thumbnails`, `uploads/logo`, `uploads/banners`

The five demo photographs in the project root are **not** copied automatically. To install them as
content images (recommended, and already done in the shipped ZIP):

```bash
npm run seed
```

`npm run seed` only touches sections that have no image assigned, so it never overwrites an image
you uploaded yourself.

### Termux

```bash
pkg install nodejs-lts
cd online-tools-website
npm install
node server.js
```

Termux installs `sharp` from its prebuilt ARM binaries; if the install ever fails, run
`pkg install sharp` followed by `npm install` again.

---

## 5. How to open the site

| What            | URL                                     |
| --------------- | --------------------------------------- |
| Home page       | http://localhost:3000                   |
| All tools       | http://localhost:3000/tools             |
| Image compressor| http://localhost:3000/tools/image-compressor |
| QR generator    | http://localhost:3000/tools/qr-code-generator |
| Password gen.   | http://localhost:3000/tools/password-generator |
| Word counter    | http://localhost:3000/tools/word-counter |
| JSON formatter  | http://localhost:3000/tools/json-formatter |
| Colour picker   | http://localhost:3000/tools/color-picker |
| Unit converter  | http://localhost:3000/tools/unit-converter |
| Age calculator  | http://localhost:3000/tools/age-calculator |
| URL encoder     | http://localhost:3000/tools/url-encoder |
| Text case       | http://localhost:3000/tools/text-case-converter |
| About / Contact | http://localhost:3000/about · `/contact` |
| Admin panel     | http://localhost:3000/admin             |
| robots.txt      | http://localhost:3000/robots.txt        |
| sitemap.xml     | http://localhost:3000/sitemap.xml       |

---

## 6. Admin login

Open **http://localhost:3000/admin** and sign in with the default credentials:

```
username: admin
password: admin123
```

The default password is stored only as a bcrypt hash — the characters above exist in this README,
not in the code, and the server never compares against a plain-text value.

**Change it immediately**: *Admin → Settings → Admin account → Change password*. A warning banner
stays visible in the admin header until the password is changed.

If you forget the password, delete `data/admin.json` and restart — the defaults above are restored.
Sessions last 8 hours and are stored in `data/sessions.json`, so signing in survives a restart.

---

## 7. File structure

```
online-tools-website/
├── server.js                  Express app: routes, APIs, admin, error handling
├── package.json
├── README.md
├── .gitignore
├── seed-hero.jpg … seed-contact.jpg   demo photographs used by `npm run seed`
│
├── data/                      JSON storage (created/rewritten automatically)
│   ├── settings.json          site name, tagline, logo, base URL, support email
│   ├── content.json           hero, banner, promo, about, contact, FAQ, image ids
│   ├── admin.json             admin username + bcrypt password hash
│   ├── messages.json          contact form messages
│   ├── sessions.json          file-backed session store
│   └── session-secret.txt     generated random session secret
│
├── uploads/                   uploaded images only (never scripts)
│   ├── images/                content images
│   ├── thumbnails/            400 px thumbnails, generated for every upload
│   ├── logo/                  site logos
│   └── banners/               banner images
│
├── public/                    everything served to the browser
│   ├── css/style.css          single stylesheet (design tokens, layout, breakpoints)
│   ├── js/main.js             navigation, theme, toasts, clipboard helpers
│   ├── js/tools/*.js          one script per tool (vanilla JS, no dependencies)
│   ├── js/contact.js          contact form validation and submission
│   ├── assets/logo.svg        default logo
│   ├── assets/favicon.svg     favicon
│   ├── robots.txt             static fallback copy (Express serves a dynamic version)
│   └── sitemap.xml            static fallback copy (Express serves a dynamic version)
│
├── lib/                       server-side modules
│   ├── store.js               JSON store: defaults, atomic writes, upload registry
│   ├── tools.js               the single tool catalogue (drives nav, cards, sitemap, JSON-LD)
│   ├── templates.js           HTML layout, header, footer, cards, FAQ, ad slots
│   ├── uploads.js             multer + sharp pipeline, validation, thumbnails
│   ├── session-store.js       file-backed express-session store
│   └── pages/
│       ├── site.js            home, about, contact, 404
│       ├── tools.js           tools 1–5 + shared tool-page shell
│       ├── tools-extra.js     tools 6–10 + /tools index
│       └── admin.js           login, dashboard, settings, content, images, messages
│
├── scripts/
│   ├── seed-images.js         installs the demo photographs into uploads/
│   └── reset-data.js          factory reset (`npm run reset -- --yes`)
│
└── tests/
    ├── e2e.js                 52 HTTP/API/admin/upload tests (`npm test`)
    ├── browser.js             21 DOM tests that drive the real page scripts (`npm run test:browser`)
    └── layout-audit.js        97 static layout/overflow/SEO checks (`npm run test:layout`)
```

### A note on the admin HTML files

The brief suggested `admin/login.html`, `admin/dashboard.html` and so on. This project renders
those pages on the server instead (`lib/pages/admin.js`) — the HTML is never present as a public
file, so nobody can fetch an admin template or bypass the login by opening a static page. The URLs
(`/admin`, `/admin/settings`, `/admin/content`, `/admin/images`, `/admin/messages`,
`/admin/login`) behave exactly as a static-file version would.

---

## 8. The ten tools

| # | Tool | Runs in | Notes |
|---|------|---------|-------|
| 1 | Image Compressor | Server (Sharp) | JPG/PNG up to 10 MB, quality slider, optional max width, optional WebP output, before/after sizes, download |
| 2 | QR Code Generator | Server (`qrcode`) | Any text or URL up to 2000 characters, 256–1024 px, four error-correction levels, PNG download |
| 3 | Password Generator | Browser | Length 4–128, four character groups, look-alike exclusion, entropy meter, recent list, copy |
| 4 | Word Counter | Browser | Words, characters, characters without spaces, sentences, paragraphs, lines, reading and speaking time, top repeated words |
| 5 | JSON Formatter & Validator | Browser | Format, minify, validate-only, sort keys, 2/4/tab indentation, line + column error reporting, structure summary, download |
| 6 | Colour Picker & Converter | Browser | HEX/RGB/HSL, short-HEX support, presets, contrast check against white and black, copy per format |
| 7 | Unit Converter | Browser | Length (mm, cm, m, km, in, ft, yd, mi), weight (mg, g, kg, oz, lb), temperature (°C, °F, K), swap, common-values table |
| 8 | Age Calculator | Browser | Exact years/months/days, totals in months, weeks, days, hours, minutes, weekday born, star sign, next birthday, future dates rejected |
| 9 | URL Encoder / Decoder | Browser | `encodeURIComponent` and `encodeURI` modes, decoding, escape-sequence breakdown, query parameter listing, malformed-input errors |
| 10 | Text Case Converter | Browser | UPPERCASE, lowercase, Title Case, Sentence case, tOGGLE cASE — line breaks preserved |

Every tool page also supports deep links, for example:

* `/tools/qr-code-generator?text=https://example.com&generate=1`
* `/tools/unit-converter?category=weight&from=kg&to=lb&value=70`
* `/tools/age-calculator?dob=1990-05-17&asof=2026-10-05`
* `/tools/url-encoder?text=hello%20world&action=decode`
* `/tools/color-picker?hex=ff0000`

---

## 9. API reference

| Method | Endpoint               | Purpose | Limits |
| ------ | ---------------------- | ------- | ------ |
| POST   | `/api/qr/generate`     | `{ text, size, level }` → `{ dataUrl, … }` | 2000 characters, 90 requests / 15 min |
| POST   | `/api/image/compress`  | multipart `image` + `quality`, `format`, `maxWidth` → `{ dataUrl, originalSize, compressedSize, reductionPercent, … }` | JPEG/PNG only, 10 MB, 40 requests / 15 min |
| POST   | `/api/contact`         | `{ name, email, subject, message }` → `{ success }` | 6 requests / hour |

All three reject cross-site requests (Origin check), validate their input server-side and return
JSON errors with a `success: false` flag. They never return a stack trace.

---

## 10. Image upload rules

**Public image compressor**

* Accepted: `image/jpeg`, `image/png` (and nothing else)
* Maximum size: 10 MB
* Validated twice: the declared MIME type, then the real file content with Sharp
* Files chosen in the browser are checked before upload as well, so a `.exe`, `.zip`, `.pdf`, `.js`,
  `.php`, `.html` or `.txt` file is rejected with a specific message
* Nothing is written to `uploads/` — the buffer is processed in memory and discarded

**Admin content images**

* Accepted: JPG/JPEG, PNG, WebP
* Maximum size: 5 MB
* On upload: MIME check → Sharp decode → auto-orient → resize to a sane maximum (2400 px for images
  and banners, 512 px for logos) → re-encode (JPEG mozjpeg, PNG level 9, WebP q82) → random
  filename (`<base36 timestamp>-<12 hex chars>.<ext>`) → 400 px thumbnail written to
  `uploads/thumbnails/`
* The uploaded filename is **never** trusted or reused
* Replacing an image keeps existing references intact: any content section pointing at the old file
  is automatically updated to the new one
* Deleting an image clears the references and removes the thumbnail
* Uploaded files are served read-only, and only when the request ends in
  `.jpg/.jpeg/.png/.webp/.gif/.svg`, so a script with an image extension cannot even be requested

---

## 11. How to change the port

```bash
node server.js                  # uses port 3000
PORT=8080 node server.js        # different port
HOST=127.0.0.1 node server.js   # bind to localhost only
```

On Windows PowerShell:

```powershell
$env:PORT=8080; node server.js
```

Other environment variables:

| Variable         | Purpose |
| ---------------- | ------- |
| `PORT`           | Port to listen on (default `3000`) |
| `HOST`           | Interface to bind (default `0.0.0.0`, so phones on the same network can reach it) |
| `SESSION_SECRET` | Override the generated session secret (recommended in production) |
| `COOKIE_SECURE`  | Set to `true` when serving over HTTPS so the session cookie is `Secure` |

---

## 12. Content and data files

| File | What it holds | Edited from |
| ---- | ------------- | ----------- |
| `data/settings.json` | Site name, tagline, meta description, base URL, support email, footer text, logo path, last-updated timestamp | Admin → Settings |
| `data/content.json` | Hero, banner, promo, about, contact content, homepage FAQ, image ids and alt text | Admin → Content |
| `data/admin.json` | Admin username, email, bcrypt password hash, `passwordIsDefault` flag | Admin → Settings |
| `data/messages.json` | Contact messages (newest 500 kept) | Admin → Messages |
| `data/sessions.json` | Session data, pruned automatically | — |
| `data/session-secret.txt` | Random session secret (mode 600) | — |

Writes are atomic (temporary file + rename), so an interrupted write cannot corrupt a data file. If a
file is missing or unparseable the defaults are used and the file is rewritten — the site never
crashes because of bad data. **A backup is a copy of `data/` and `uploads/`.**

Factory reset:

```bash
npm run reset -- --yes     # deletes data and uploads, restores defaults, re-seeds images
```

---

## 13. Testing

Two suites run against a live server, plus a static audit.

```bash
node server.js            # terminal 1

# terminal 2
npm test                  # 52 HTTP / API / admin / upload tests
npm run test:layout       # 97 static layout, overflow, SEO and ad-slot checks
npm run test:browser      # 21 DOM tests that drive the real page scripts (needs jsdom)
```

For the browser suite, install jsdom once — it is deliberately **not** a dependency of the site:

```bash
npm install --no-save jsdom
```

What the suites cover:

* **e2e (`npm test`)** — page status codes and SEO tags, the ten tool pages, robots.txt and
  sitemap.xml, image compression (real PNG and JPEG generated in the test), quality/size
  relationship, resizing, rejection of `.exe`, of a script renamed to `.jpg`, of an oversized file and
  of an empty upload, QR generation and payload integrity, password-generator source guarantees
  (CSPRNG, no `Math.random`, empty-alphabet guard), JSON error line/column reporting, HEX/RGB/HSL
  maths, 9 length/weight and 11 temperature conversions, 9 calendar age cases, empty-input guards in
  all ten scripts, responsive CSS rules, the full admin login/logout flow, CSRF rejection, image
  upload/replace/delete/assign, contact message flow, security headers and persistence of data files.
* **browser (`npm run test:browser`)** — loads the real pages into a DOM and simulates the user:
  menu open/close/Escape, theme toggle, all internal links, compressor slider and empty submit,
  `.exe` drop rejection, QR generation against the live API, password length/options/edge cases,
  word counts, JSON format/minify/sort/indent, colour conversion and validation, all unit conversions
  and swap, age calculation and future-date rejection, URL encode/decode round-trip, all five text
  cases with line-break checks, plus label/H1/alt-text accessibility checks.
* **layout audit (`npm run test:layout`)** — viewport meta tags, every table inside a scrollable
  wrapper, inline widths, unbreakable strings in rendered text, image guards and alt text, the CSS
  overflow rules, breakpoints and touch-target token, and the ad slots (marked, empty, labelled).

### Honest scope note

The in-browser suite runs on **jsdom**, which has **no layout engine**, so it cannot measure pixel
widths. Horizontal-overflow protection is therefore verified by static analysis of the rendered HTML
and the stylesheet (the audit above) rather than by measuring `scrollWidth` in a real browser, and no
physical touch-device testing was performed — that is not possible in this environment. Where you see
"verified" for layout, it means "checked structurally and by rule", not "measured on a phone". To
measure it yourself, open DevTools → Console on any page:

```js
console.log(document.documentElement.scrollWidth, window.innerWidth);
// the first number must never exceed the second
```

Test it at 360, 375, 390, 414, 480, 768, 1024, 1366 and 1920 px wide.

---

## 14. SEO

* Unique `<title>` and `<meta name="description">` on every page (asserted by the test suite)
* Exactly one H1 per page, semantic `header`/`main`/`section`/`article`/`nav`/`footer` structure
* Canonical URL on every page, built from the admin-configured base URL when set, otherwise from the
  request host
* Open Graph and Twitter card tags
* JSON-LD structured data: `WebSite`, `WebApplication` and `FAQPage` per tool, `BreadcrumbList`,
  `ItemList` on the home page, `CollectionPage` on `/tools`
* `robots.txt` (allows everything except `/admin` and `/uploads/thumbnails/`) and a dynamic
  `sitemap.xml` generated from the tool catalogue. Both are generated by Express so the `Sitemap:`
  line always matches the domain you configure; the files under `public/` are clearly labelled
  fallback copies for the case where you host `public/` on a static server instead of running Node.
* SEO-friendly URLs: `/tools/image-compressor`, `/tools/qr-code-generator`, and so on
* No keyword stuffing — the explanatory text on each tool page is genuine documentation

**Set the canonical base URL** in Admin → Settings before going live, otherwise canonical and
Open Graph URLs will use whatever hostname the visitor requested.

---

## 15. Responsive design and horizontal overflow

* Mobile-first CSS with breakpoints at **480 px, 768 px, 1024 px** (plus an optional 1366 px rule)
* Layout with CSS Grid and Flexbox, `rem`/`%`/`max-width`/`min-width: 0` throughout
* All buttons, links and inputs are at least **44 px** tall where practical (`--tap` token)
* `box-sizing: border-box` globally, `overflow-wrap` on text, `overflow-x: hidden` on `html`/`body`
  as a final guard
* The actual overflow sources are handled directly: every `<table>` sits inside a `.table-wrap` that
  scrolls on its own, long JSON/URL output lives in `<pre>` blocks with `overflow-x: auto`, colour
  codes use `overflow-wrap: anywhere`, and images are capped by a global `img { max-width: 100% }`
* Mobile navigation: hamburger button (44 × 44 px) with an animated slide-down panel, Escape and
  outside-click closing, and an automatic reset when the desktop layout takes over at 1024 px

---

## 16. Security notes

| Area | Implementation |
| ---- | -------------- |
| Security headers | `helmet`: CSP (`default-src 'self'`, `object-src 'none'`, `frame-ancestors` restricted), `nosniff`, referrer policy, HSTS |
| Sessions | HttpOnly, SameSite=Lax cookies, 8-hour lifetime, rolling expiry, regenerate on login, file-backed store |
| Passwords | bcrypt, cost 12; password change requires the current password and confirmation |
| CSRF | Random per-session token embedded in every admin form and verified on POST |
| Brute force | Login limited to 12 attempts / 15 min per IP; uploads, QR and contact are also rate-limited |
| Uploads | MIME allow-list, Sharp content validation, 5 MB (admin) / 10 MB (public) limits, random filenames, image-only serving, no execution |
| Injection | No `eval`, no `new Function`, no SQL (no database), no shelling out; JSON parsed with `JSON.parse` and validated; output HTML-escaped |
| XSS | All dynamic values are escaped server-side; uploaded SVGs are only ever referenced as `<img>` |
| Errors | Stack traces go to the server log; visitors and API clients get a friendly generic message |
| Admin isolation | Every `/admin` route except the login page requires a valid session; the panel is `noindex, nofollow` |
| Path traversal | Upload folder names come from a fixed list and filenames are validated against `^[A-Za-z0-9._-]+$` |

**Before going live:** change the admin password, set the canonical base URL, run behind HTTPS with
`COOKIE_SECURE=true`, set a fixed `SESSION_SECRET`, and back up `data/` and `uploads/` regularly.

---

## 17. Deployment notes

Any host that runs Node.js works (a small VPS, Render, Railway, Fly.io, a Raspberry Pi, or Termux).

```bash
git clone <your repo> && cd online-tools-website
npm install --omit=dev
npm run seed                 # optional: install the demo images
SESSION_SECRET="$(openssl rand -hex 32)" COOKIE_SECURE=true PORT=3000 node server.js
```

* Keep the process alive with `pm2 start server.js --name toolbox` or a systemd unit.
* Put Nginx, Caddy or Cloudflare in front for TLS and to serve `uploads/` and `public/` directly.
* If you use a reverse proxy, forward the original `Host` header (the sitemap falls back to it) or set
  the canonical base URL in the admin panel.
* The application is stateless apart from `data/` and `uploads/`, so it can be moved by copying those
  two folders. Persist them across deploys.

---

## 18. Troubleshooting

| Symptom | Cause and fix |
| ------- | ------------- |
| `Error: Cannot find module 'express'` | Run `npm install` inside the project folder. |
| `EADDRINUSE: address already in use :3000` | Another process is on port 3000. Use `PORT=3001 node server.js` or stop the other process. |
| `sharp` fails to install | Node version too old (needs 16+), or the platform has no prebuilt binary. On Termux: `pkg install sharp && npm install`. |
| Login always fails | Credentials are case-sensitive for the password. If the password is lost, delete `data/admin.json`, restart and use `admin` / `admin123`. |
| “That image is larger than the 10 MB limit” | The compressor limit is 10 MB; the admin uploader limit is 5 MB. Resize the file first. |
| Upload rejected as “not a valid image” | The file is not really a JPEG/PNG/WebP (renaming does not change the content) or it is corrupt. |
| Uploaded images not displayed | Check that `uploads/` exists and is writable; the admin dashboard’s *Storage health* panel shows which folders are missing. |
| Changes disappear after a restart | A hosting platform with an ephemeral filesystem is wiping `data/`. Mount a persistent volume there. |
| Blank page after editing a JSON file | A data file was hand-edited into invalid JSON. Delete the affected file — the defaults are recreated on restart. |
| Contact form says “Too many requests” | The rate limit is 6 messages per hour per IP; wait or restart the server. |
| Thumbnail missing in the image manager | The thumbnail failed to generate; the original image is untouched and still served. Re-upload the file. |

---

## 19. Adding a new tool

1. Add an entry to `lib/tools.js` (slug, URL, name, descriptions, icon, keywords). This
   automatically adds it to the navigation, the home page grid, the footer, related-tools blocks,
   the sitemap and the structured data.
2. Create `lib/pages/…` renderer for the page and register it in `TOOL_RENDERERS` in `server.js`.
3. Add `public/js/tools/<slug>.js` for the browser behaviour — `ToolBox.toast()`,
   `ToolBox.copyText()`, `ToolBox.showAlert()`, `ToolBox.downloadBlob()` and `ToolBox.qsa()` are
   already available from `main.js`, which the layout includes.
4. Add the page URL to the test lists in `tests/e2e.js`, `tests/browser.js` and
   `tests/layout-audit.js`.

---

## 20. Licence

MIT. The ten tools, the admin panel and the documentation are provided as-is; test on your own
hardware before relying on the site in production.
