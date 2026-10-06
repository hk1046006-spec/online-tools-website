#!/usr/bin/env node
/**
 * ToolBox — static layout / horizontal-overflow audit
 *
 * A headless browser with a real layout engine is not available in every
 * environment (no Chromium/Firefox in many CI containers), so this script
 * checks the rendered HTML and the stylesheet for the patterns that actually
 * cause sideways scrolling on phones:
 *
 *   · tables that are not inside a horizontally scrollable wrapper
 *   · fixed pixel widths wider than a 360 px viewport
 *   · wide elements without a max-width guard
 *   · long unbreakable strings that are not inside a scrolling <pre>
 *   · missing viewport meta tag
 *   · stylesheets without the overflow guards
 *
 * It is a static analysis, not a substitute for testing on a device — the
 * README says so plainly.
 *
 *   node tests/layout-audit.js [baseUrl]
 */

const MOBILE_WIDTH = 360;

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    failures.push(`${name}: ${detail || 'failed'}`);
    console.log(`  FAIL  ${name} — ${detail || 'failed'}`);
  }
}

const PAGES = [
  '/',
  '/tools',
  '/about',
  '/contact',
  '/tools/image-compressor',
  '/tools/qr-code-generator',
  '/tools/password-generator',
  '/tools/word-counter',
  '/tools/json-formatter',
  '/tools/color-picker',
  '/tools/unit-converter',
  '/tools/age-calculator',
  '/tools/url-encoder',
  '/tools/text-case-converter',
];

async function main() {
  const BASE = process.argv[2] || 'http://localhost:3000';
  console.log(`\nToolBox layout audit → ${BASE} (assumed narrowest viewport ${MOBILE_WIDTH}px)\n`);

  /* ---------- stylesheet ---------- */
  const css = await (await fetch(`${BASE}/css/style.css`)).text();
  check('stylesheet: global border-box reset', css.includes('box-sizing: border-box'));
  check('stylesheet: flex/grid children cannot force overflow', /min-width:\s*0/.test(css));
  check('stylesheet: document-level overflow guard', /body\s*{[^}]*overflow-x:\s*hidden/s.test(css));
  check('stylesheet: images are capped', /img,[\s\S]{0,120}max-width:\s*100%/.test(css));
  check('stylesheet: tables scroll only inside their wrapper', /\.table-wrap\s*{[^}]*overflow-x:\s*auto/s.test(css));
  check('stylesheet: long words wrap', /overflow-wrap:\s*(anywhere|break-word)/.test(css));
  check('stylesheet: responsive breakpoints present', ['480px', '768px', '1024px'].every((w) => css.includes(`min-width: ${w}`)));
  check('stylesheet: touch targets defined', css.includes('--tap: 44px'));
  check('stylesheet: no 100vw widths (a classic overflow source)', !/width:\s*100vw/.test(css));
  // Media-query breakpoints are not element constraints, so they are excluded.
  const cssWithoutMedia = css.replace(/@media[^{]*\{[\s\S]*?\n\}/g, '');
  const hardWidths = [...cssWithoutMedia.matchAll(/min-width:\s*(\d+)px/g)].map((m) => Number(m[1]));
  check(
    'stylesheet: no element min-width exceeds the mobile viewport',
    hardWidths.every((w) => w <= MOBILE_WIDTH),
    hardWidths.length ? `${hardWidths.length} px min-widths, largest ${Math.max(...hardWidths)}px` : 'none found'
  );

  /* ---------- pages ---------- */
  for (const url of PAGES) {
    const html = await (await fetch(`${BASE}${url}`)).text();

    check(
      `${url}: has a responsive viewport meta tag`,
      /<meta name="viewport" content="width=device-width, initial-scale=1"/.test(html)
    );

    // Every table must sit inside a scrollable wrapper.
    const tables = html.match(/<table[\s>]/g) || [];
    const wrappers = html.match(/class="table-wrap"/g) || [];
    check(
      `${url}: all ${tables.length} tables are wrapped for horizontal scrolling`,
      wrappers.length >= tables.length,
      `${tables.length} tables, ${wrappers.length} wrappers`
    );

    // Inline fixed widths must fit the narrowest supported screen.
    const inlineWidths = [...html.matchAll(/style="[^"]*width:\s*(\d+)px/g)].map((m) => Number(m[1]));
    const tooWide = inlineWidths.filter((w) => w > MOBILE_WIDTH - 40);
    check(
      `${url}: no inline fixed width exceeds the mobile viewport`,
      tooWide.length === 0,
      tooWide.length ? `found ${tooWide.join(', ')}px` : `${inlineWidths.length} inline widths checked`
    );

    // <pre> blocks scroll internally, so long strings inside them are safe.
    const preCount = (html.match(/<pre/g) || []).length;

    // Only rendered text can cause overflow, so scripts, styles and tags are
    // stripped first; <pre> blocks are excluded because they scroll internally.
    const renderedText = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<pre[\s\S]*?<\/pre>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;|&#\d+;/gi, ' ');
    const riskyTokens = (renderedText.match(/[A-Za-z0-9%&?=_\-./#]{60,}/g) || []).filter(
      (token) => !token.startsWith('data:')
    );
    check(
      `${url}: no unbreakable 60+ character strings in rendered text`,
      riskyTokens.length === 0,
      riskyTokens.length ? `${riskyTokens.length} found, e.g. ${riskyTokens[0].slice(0, 30)}…` : `${preCount} <pre> blocks excluded`
    );

    // Images: the global `img { max-width: 100% }` rule caps every image, so the
    // remaining risks are an inline fixed width and missing alt text.
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    const wideInline = imgs.filter((tag) => {
      const match = tag.match(/style="[^"]*width:\s*(\d+)px/);
      return match && Number(match[1]) > MOBILE_WIDTH;
    });
    const missingAlt = imgs.filter((tag) => !/\salt="/.test(tag));
    check(
      `${url}: ${imgs.length} images have no over-wide inline width`,
      wideInline.length === 0,
      wideInline.length ? wideInline[0].slice(0, 60) : ''
    );
    check(
      `${url}: ${imgs.length} images all have alt text`,
      missingAlt.length === 0,
      missingAlt.length ? missingAlt[0].slice(0, 60) : ''
    );
  }

  /* ---------- ad slots ---------- */
  const home = await (await fetch(`${BASE}/`)).text();
  check('ad slots: marked with comments', /<!-- AD SLOT: HEADER -->/.test(home) && /<!-- AD SLOT: IN-CONTENT -->/.test(home));
  check('ad slots: contain no advertising markup', !/googlesyndication|doubleclick|adsbygoogle/i.test(home));
  check('ad slots: labelled for screen readers', /aria-label="[^"]*advertisement area"/i.test(home));

  console.log('\n──────────────────────────────────────────────');
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failed) {
    console.log('\n  Failures:');
    failures.forEach((f) => console.log(`   · ${f}`));
  }
  console.log('');
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error('Layout audit crashed:', error.message);
  process.exit(1);
});
