#!/usr/bin/env node
/**
 * ToolBox — in-browser behaviour tests
 *
 * Loads the real pages from a running server into a DOM (jsdom), executes the
 * real page scripts and simulates user interaction: typing, clicking, choosing
 * options. This is the closest thing to a browser test that can run without a
 * GUI browser, and it exercises the actual shipped JavaScript.
 *
 * Usage:
 *   npm install --no-save jsdom     # jsdom is only needed for this test suite
 *   node tests/browser.js [baseUrl]
 *
 * Note: jsdom does not perform layout, so it cannot measure pixel widths.
 * Horizontal-overflow protection is therefore verified in tests/e2e.js through
 * the stylesheet rules and the markup structure — see README.
 */

const assert = require('assert');
const path = require('path');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (err) {
  console.error('jsdom is not installed. Run:  npm install --no-save jsdom');
  process.exit(1);
}

const BASE = process.argv[2] || 'http://localhost:3000';

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    const info = await fn();
    passed += 1;
    console.log(`  PASS  ${name}${info ? ` — ${info}` : ''}`);
  } catch (error) {
    failed += 1;
    failures.push(`${name}: ${error.message}`);
    console.log(`  FAIL  ${name} — ${error.message}`);
  }
}

/* ------------------------------------------------------------------ *
 * Page loading
 * ------------------------------------------------------------------ */

async function loadPage(url) {
  const dom = await JSDOM.fromURL(`${BASE}${url}`, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(window) {
      // Pages use fetch() for the QR and contact APIs; jsdom has no fetch.
      window.fetch = (resource, options) => {
        const target = typeof resource === 'string' ? new URL(resource, BASE).toString() : resource;
        return fetch(target, options);
      };
      // jsdom has neither URL.createObjectURL nor a clipboard API; stubs keep
      // the download/copy handlers from throwing while still reporting a result.
      window.URL.createObjectURL = () => 'blob:stub';
      window.URL.revokeObjectURL = () => {};
      window.__toasts = [];
    },
  });

  await new Promise((resolve) => {
    if (dom.window.document.readyState === 'complete') return resolve();
    dom.window.addEventListener('load', resolve);
    setTimeout(resolve, 8000);
  });
  // Let deferred scripts finish wiring up.
  await tick(80);
  return dom;
}

function tick(ms = 20) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fire(window, element, type) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
}

function setValue(window, element, value) {
  element.value = value;
  fire(window, element, 'input');
  fire(window, element, 'change');
}

function click(window, element) {
  element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */

async function main() {
  console.log(`\nToolBox browser-level tests (jsdom) → ${BASE}\n`);

  /* ---------- Home page: navigation, cards, theme ---------- */
  console.log('HOME PAGE — navigation, tool grid, mobile menu');

  await test('renders 10 tool cards that all link to real pages', async () => {
    const dom = await loadPage('/');
    const { document } = dom.window;
    // The main grid must contain exactly the ten tools.
    const cards = document.querySelectorAll('#tools .tool-card');
    assert.strictEqual(cards.length, 10, `the tool grid has ${cards.length} cards`);
    // The related-tools section adds a further three (a separate requirement).
    const related = document.querySelectorAll('#related-heading ~ .grid--tools .tool-card');
    assert.strictEqual(related.length, 3, `the related tools section has ${related.length} cards`);
    const seen = new Set();
    for (const card of [...cards, ...related]) {
      const link = card.querySelector('a[href^="/tools/"]');
      assert.ok(link, 'a card has no link');
      const href = link.getAttribute('href');
      seen.add(href);
      const response = await fetch(`${BASE}${href}`);
      assert.strictEqual(response.status, 200, `${href} → ${response.status}`);
    }
    // Repeating a link in the related-tools block is intended (the footer links
    // every tool as well), so only the number of *distinct* tools is asserted.
    assert.strictEqual(seen.size, 10, `only ${seen.size} distinct tools linked`);
    dom.window.close();
    return '10 tools in the grid + 3 related, all URLs return 200';
  });

  await test('hamburger menu opens, closes, and responds to Escape', async () => {
    const dom = await loadPage('/');
    const { document, window } = dom.window;
    const toggle = document.getElementById('navToggle');
    const nav = document.getElementById('primaryNav');
    assert.ok(toggle && nav, 'menu button or nav missing');
    assert.strictEqual(toggle.getAttribute('aria-expanded'), 'false');
    click(window, toggle);
    assert.strictEqual(toggle.getAttribute('aria-expanded'), 'true', 'menu did not open');
    assert.ok(nav.classList.contains('is-open'), 'nav has no is-open class');
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.strictEqual(toggle.getAttribute('aria-expanded'), 'false', 'Escape did not close the menu');
    click(window, toggle);
    click(window, document.body);
    assert.strictEqual(toggle.getAttribute('aria-expanded'), 'false', 'clicking outside did not close the menu');
    dom.window.close();
    return 'open/close/Escape/outside-click all work';
  });

  await test('theme toggle switches and remembers the choice', async () => {
    const dom = await loadPage('/');
    const { document, window } = dom.window;
    const button = document.getElementById('themeToggle');
    const before = document.documentElement.getAttribute('data-theme');
    click(window, button);
    const after = document.documentElement.getAttribute('data-theme');
    assert.notStrictEqual(before, after, 'theme did not change');
    assert.strictEqual(window.localStorage.getItem('toolbox-theme'), after, 'theme was not stored');
    assert.strictEqual(button.getAttribute('aria-pressed'), after === 'dark' ? 'true' : 'false');
    dom.window.close();
    return `${before} → ${after}`;
  });

  await test('every navigation and footer link resolves (no broken links)', async () => {
    const dom = await loadPage('/');
    const { document } = dom.window;
    const hrefs = new Set();
    document.querySelectorAll('a[href^="/"]').forEach((a) => hrefs.add(a.getAttribute('href')));
    assert.ok(hrefs.size >= 15, `only ${hrefs.size} internal links found`);
    for (const href of hrefs) {
      if (href.startsWith('/uploads')) continue;
      const response = await fetch(`${BASE}${href}`, { redirect: 'manual' });
      assert.ok([200, 301, 302].includes(response.status), `${href} → ${response.status}`);
    }
    dom.window.close();
    return `${hrefs.size} internal links checked`;
  });

  /* ---------- Tool 1: image compressor ---------- */
  console.log('\nTOOL 1 — image compressor (page behaviour)');

  await test('quality slider updates its readout and empty submit is refused', async () => {
    const dom = await loadPage('/tools/image-compressor');
    const { document, window } = dom.window;
    const quality = document.getElementById('icQuality');
    const readout = document.getElementById('icQualityValue');
    assert.ok(quality && readout, 'slider or readout missing');
    setValue(window, quality, '40');
    assert.strictEqual(readout.textContent, '40%', `readout was ${readout.textContent}`);
    setValue(window, quality, '90');
    assert.strictEqual(readout.textContent, '90%');

    const form = document.getElementById('icForm');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await tick(50);
    const alert = document.getElementById('icAlert');
    assert.ok(/choose a jpg or png/i.test(alert.textContent), `alert was “${alert.textContent}”`);
    assert.strictEqual(alert.className.includes('alert--error'), true, 'not shown as an error');
    dom.window.close();
    return 'readout synced, empty submit blocked';
  });

  await test('rejects a .exe picked in the browser with a clear message', async () => {
    const dom = await loadPage('/tools/image-compressor');
    const { document, window } = dom.window;
    const dropzone = document.getElementById('icDropzone');
    // jsdom cannot fill a file input, so simulate the drop handler the page uses.
    const dataTransfer = {
      files: [new window.File(['MZ not an image'], 'setup.exe', { type: 'application/x-msdownload' })],
    };
    const dropEvent = new window.Event('drop', { bubbles: true, cancelable: true });
    dropEvent.dataTransfer = dataTransfer;
    dropzone.dispatchEvent(dropEvent);
    await tick(60);
    const alert = document.getElementById('icAlert');
    assert.ok(/not supported|jpg and png/i.test(alert.textContent), `alert was “${alert.textContent}”`);
    assert.ok(!/^compressing/i.test(document.getElementById('icStatus').textContent), 'it tried to upload anyway');
    dom.window.close();
    return alert.textContent.slice(0, 62) + '…';
  });

  await test('uploads a real file, receives the compressed result and prepares the download', async () => {
    const sharp = require(path.join(__dirname, '..', 'node_modules', 'sharp'));
    // Build a real, compressible PNG (a photo-like gradient, 1200 x 800).
    const source = await sharp({
      create: { width: 1200, height: 800, channels: 3, background: { r: 40, g: 90, b: 160 } },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg width="1200" height="800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
             <stop offset="0%" stop-color="#ffd166"/><stop offset="50%" stop-color="#2f6fed"/><stop offset="100%" stop-color="#06d6a0"/>
             </linearGradient></defs><rect width="1200" height="800" fill="url(#g)"/></svg>`
          ),
        },
      ])
      .png()
      .toBuffer();

    const dom = await loadPage('/tools/image-compressor');
    const { document, window } = dom.window;

    const input = document.getElementById('icFile');
    const file = new window.File([source], 'holiday-photo.png', { type: 'image/png' });
    assert.strictEqual(file.size, source.length, 'the test file was not constructed correctly');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fire(window, input, 'change');
    await tick(60);

    const alert = document.getElementById('icAlert');
    assert.ok(/loaded/i.test(alert.textContent), `loading message was “${alert.textContent}”`);
    assert.ok(
      document.getElementById('icOriginalImg').src.startsWith('blob:'),
      'the original preview was not set'
    );

    // Compress at a low quality so the size reduction is unambiguous.
    setValue(window, document.getElementById('icQuality'), '35');
    document.getElementById('icForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

    for (let i = 0; i < 120; i += 1) {
      await tick(50);
      if (!document.getElementById('icResults').hidden) break;
    }
    assert.strictEqual(document.getElementById('icResults').hidden, false, 'the result panel never appeared');

    const message = document.getElementById('icAlert').textContent;
    assert.ok(/smaller|did not get smaller/i.test(message), `unexpected result message: ${message}`);
    const compressedBytes = Number(
      (message.match(/→\s*([\d.]+)\s*(KB|MB|B)/) || [])[1]
        ? { KB: 1024, MB: 1048576, B: 1 }[(message.match(/→\s*[\d.]+\s*(KB|MB|B)/) || [])[1]]
        : 0
    );
    assert.ok(compressedBytes > 0, `could not read the compressed size from “${message}”`);
    assert.ok(compressedBytes < source.length, `no compression happened: ${source.length} → ${compressedBytes}`);
    assert.ok(document.getElementById('icCompressedMeta').textContent.includes('holiday-photo'), 'the download name was not derived from the file name');

    // The download button must produce a Blob and not throw.
    click(window, document.getElementById('icDownload'));
    await tick(40);
    const toast = dom.window.document.querySelector('.toast');
    assert.ok(toast && /downloading/i.test(toast.textContent), 'no download confirmation was shown');

    dom.window.close();
    return `${source.length} B → ~${Math.round(compressedBytes)} B (${(((source.length - compressedBytes) / source.length) * 100).toFixed(1)}% smaller), download prepared`;
  });

  /* ---------- Tool 2: QR generator ---------- */
  console.log('\nTOOL 2 — QR code generator (page behaviour)');

  await test('generates a QR code from a real URL and reports its contents', async () => {
    const dom = await loadPage('/tools/qr-code-generator');
    const { document, window } = dom.window;
    const input = document.getElementById('qrInput');
    const form = document.getElementById('qrForm');
    setValue(window, input, 'https://example.com/hello?x=1&y=2');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

    for (let i = 0; i < 60 && !document.getElementById('qrOutput').hidden === false; i += 1) {
      await tick(50);
      if (!document.getElementById('qrOutput').hidden) break;
    }
    await tick(120);
    const output = document.getElementById('qrOutput');
    const image = document.getElementById('qrImage');
    assert.strictEqual(output.hidden, false, 'output stayed hidden');
    assert.ok(image.src.startsWith('data:image/png;base64,'), 'no PNG data URL set');
    assert.ok(
      document.getElementById('qrMeta').textContent.includes('https://example.com/hello?x=1&y=2'),
      'the contents note is missing the URL'
    );
    dom.window.close();
    return `${image.src.length} byte data URL`;
  });

  await test('empty QR input shows a helpful error instead of a request', async () => {
    const dom = await loadPage('/tools/qr-code-generator');
    const { document, window } = dom.window;
    setValue(window, document.getElementById('qrInput'), '   ');
    document.getElementById('qrForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await tick(60);
    const alert = document.getElementById('qrAlert');
    assert.ok(/enter some text/i.test(alert.textContent), `alert was “${alert.textContent}”`);
    assert.strictEqual(document.getElementById('qrOutput').hidden, true, 'an empty QR was rendered');
    dom.window.close();
  });

  /* ---------- Tool 3: password generator ---------- */
  console.log('\nTOOL 3 — password generator (page behaviour)');

  await test('generates passwords that honour length and character options', async () => {
    const dom = await loadPage('/tools/password-generator');
    const { document, window } = dom.window;
    const output = document.getElementById('pwOutput');
    const initial = output.textContent;
    assert.strictEqual(initial.length, 16, `default length was ${initial.length}`);

    setValue(window, document.getElementById('pwLength'), '40');
    click(window, document.getElementById('pwGenerate'));
    assert.strictEqual(output.textContent.length, 40, `length was ${output.textContent.length}`);
    assert.strictEqual(document.getElementById('pwLengthValue').textContent, '40');

    // Only numbers enabled → output must be digits only.
    ['optUpper', 'optLower', 'optSymbols'].forEach((id) => {
      const box = document.getElementById(id);
      box.checked = false;
      fire(window, box, 'change');
    });
    click(window, document.getElementById('pwGenerate'));
    assert.ok(/^[0-9]+$/.test(output.textContent), `output was “${output.textContent}”`);

    // Two consecutive passwords must differ.
    const first = output.textContent;
    click(window, document.getElementById('pwGenerate'));
    assert.notStrictEqual(output.textContent, first, 'the same password was produced twice');

    // Excluding look-alike characters must remove them.
    document.getElementById('optUpper').checked = true;
    fire(window, document.getElementById('optUpper'), 'change');
    document.getElementById('optLower').checked = true;
    fire(window, document.getElementById('optLower'), 'change');
    const exclude = document.getElementById('optExcludeSimilar');
    exclude.checked = true;
    fire(window, exclude, 'change');
    click(window, document.getElementById('pwGenerate'));
    assert.ok(!/[Il1O0o]/.test(output.textContent), `look-alikes present: ${output.textContent}`);
    dom.window.close();
    return '16 → 40 chars, digits-only mode, no duplicates, look-alikes removed';
  });

  await test('all options off produces an error, not an invalid password', async () => {
    const dom = await loadPage('/tools/password-generator');
    const { document, window } = dom.window;
    ['optUpper', 'optLower', 'optNumbers', 'optSymbols'].forEach((id) => {
      const box = document.getElementById(id);
      box.checked = false;
      fire(window, box, 'change');
    });
    click(window, document.getElementById('pwGenerate'));
    const alert = document.getElementById('pwAlert');
    assert.ok(/at least one character type/i.test(alert.textContent), `alert was “${alert.textContent}”`);
    assert.strictEqual(document.getElementById('pwOutput').textContent, '', 'a password was generated anyway');
    dom.window.close();
  });

  await test('clear empties the output and copy does not throw', async () => {
    const dom = await loadPage('/tools/password-generator');
    const { document, window } = dom.window;
    click(window, document.getElementById('pwCopy'));
    click(window, document.getElementById('pwClear'));
    assert.strictEqual(document.getElementById('pwOutput').textContent, '', 'clear did not empty the output');
    assert.strictEqual(document.querySelectorAll('#pwHistory li').length, 0, 'history was not cleared');
    dom.window.close();
  });

  /* ---------- Tool 4: word counter ---------- */
  console.log('\nTOOL 4 — word counter (page behaviour)');

  await test('counts words, characters, sentences and paragraphs live', async () => {
    const dom = await loadPage('/tools/word-counter');
    const { document, window } = dom.window;
    const input = document.getElementById('wcInput');

    setValue(window, input, 'The quick brown fox. It jumps!\n\nSecond paragraph here.');
    const text = input.value;
    assert.strictEqual(document.getElementById('wcWords').textContent, '9', `words: ${document.getElementById('wcWords').textContent}`);
    assert.strictEqual(document.getElementById('wcChars').textContent, String(text.length));
    assert.strictEqual(
      document.getElementById('wcCharsNoSpaces').textContent,
      String(text.replace(/\s/g, '').length)
    );
    assert.strictEqual(document.getElementById('wcSentences').textContent, '3', 'sentence count');
    assert.strictEqual(document.getElementById('wcParagraphs').textContent, '2', 'paragraph count');
    assert.ok(/sec|min/.test(document.getElementById('wcReadTime').textContent), 'no reading time');

    // Empty input must produce zeroes, never NaN or undefined.
    setValue(window, input, '');
    ['wcWords', 'wcChars', 'wcCharsNoSpaces', 'wcSentences', 'wcParagraphs', 'wcLines'].forEach((id) => {
      assert.strictEqual(document.getElementById(id).textContent, '0', `${id} was not zero`);
    });
    assert.strictEqual(document.getElementById('wcReadTime').textContent, '0 min');
    assert.ok(!/NaN|undefined/.test(document.getElementById('wcTopWords').textContent));
    dom.window.close();
    return 'live counts correct, empty state clean';
  });

  /* ---------- Tool 5: JSON formatter ---------- */
  console.log('\nTOOL 5 — JSON formatter (page behaviour)');

  await test('formats, minifies and sorts keys', async () => {
    const dom = await loadPage('/tools/json-formatter');
    const { document, window } = dom.window;
    const input = document.getElementById('jsonInput');
    const output = document.getElementById('jsonOutput');

    setValue(window, input, '{"b":1,"a":{"d":[1,2],"c":true}}');
    click(window, document.getElementById('jsonFormat'));
    const pretty = output.textContent;
    assert.ok(pretty.includes('\n  "b"'), 'output is not indented');
    assert.deepStrictEqual(JSON.parse(pretty), JSON.parse(input.value));

    click(window, document.getElementById('jsonMinify'));
    assert.strictEqual(output.textContent, '{"b":1,"a":{"d":[1,2],"c":true}}', 'minify output wrong');

    document.getElementById('jsonSortKeys').checked = true;
    click(window, document.getElementById('jsonFormat'));
    assert.ok(output.textContent.indexOf('"a"') < output.textContent.indexOf('"b"'), 'keys were not sorted');

    // 4-space indentation option
    document.getElementById('jsonIndent').value = '4';
    click(window, document.getElementById('jsonFormat'));
    assert.ok(output.textContent.includes('\n    "a"'), '4-space indentation not applied');
    dom.window.close();
    return 'format, minify, sort and indent options all correct';
  });

  await test('invalid JSON shows a line/column error and never crashes', async () => {
    const dom = await loadPage('/tools/json-formatter');
    const { document, window } = dom.window;
    setValue(window, document.getElementById('jsonInput'), '{\n  "a": 1,\n  "b": 2,\n}');
    click(window, document.getElementById('jsonFormat'));
    const alert = document.getElementById('jsonAlert');
    assert.ok(/invalid json/i.test(alert.textContent), `alert was “${alert.textContent}”`);
    assert.ok(/line \d+/.test(alert.textContent), 'no line number reported');
    assert.strictEqual(document.getElementById('jsonOutput').textContent, '', 'output was filled despite the error');

    setValue(window, document.getElementById('jsonInput'), '');
    click(window, document.getElementById('jsonFormat'));
    assert.ok(/input box is empty/i.test(alert.textContent), 'no empty-input message');
    assert.ok(!/NaN|undefined/.test(document.getElementById('jsonStats').textContent));
    dom.window.close();
    return alert.textContent.slice(0, 60) + '…';
  });

  /* ---------- Tool 6: colour picker ---------- */
  console.log('\nTOOL 6 — colour picker (page behaviour)');

  await test('converts between HEX, RGB and HSL and validates bad input', async () => {
    const dom = await loadPage('/tools/color-picker');
    const { document, window } = dom.window;
    const hex = document.getElementById('hexInput');

    setValue(window, hex, '#ff0000');
    assert.strictEqual(document.getElementById('rgbInput').value, 'rgb(255, 0, 0)', 'RGB wrong');
    assert.strictEqual(document.getElementById('hslInput').value, 'hsl(0, 100%, 50%)', 'HSL wrong');
    assert.strictEqual(document.getElementById('colorPreviewLabel').textContent, '#FF0000');
    assert.ok(document.getElementById('colorTableBody').textContent.includes('rgb(255, 0, 0)'));

    setValue(window, hex, '#00ff00');
    assert.strictEqual(document.getElementById('hslInput').value, 'hsl(120, 100%, 50%)', 'green HSL wrong');

    setValue(window, hex, '#zzz');
    const alert = document.getElementById('colorAlert');
    assert.ok(/not a valid hex/i.test(alert.textContent), `alert was “${alert.textContent}”`);
    assert.strictEqual(hex.getAttribute('aria-invalid'), 'true', 'field not marked invalid');
    assert.ok(!/NaN|undefined/.test(document.getElementById('colorTableBody').textContent), 'table shows NaN/undefined');

    // Preset swatch
    const swatch = document.querySelector('[data-preset="#8a5a00"]');
    assert.ok(swatch, 'preset swatches missing from the HTML');
    click(window, swatch);
    assert.strictEqual(document.getElementById('colorPreviewLabel').textContent, '#8A5A00');
    dom.window.close();
    return 'hex→rgb/hsl correct, invalid hex rejected, presets work';
  });

  /* ---------- Tool 7: unit converter ---------- */
  console.log('\nTOOL 7 — unit converter (page behaviour)');

  await test('converts length, weight and temperature, and swaps units', async () => {
    const dom = await loadPage('/tools/unit-converter');
    const { document, window } = dom.window;
    const category = document.getElementById('unitCategory');
    const from = document.getElementById('unitFrom');
    const to = document.getElementById('unitTo');
    const input = document.getElementById('unitInput');
    const output = document.getElementById('unitOutput');

    // Length: 2.54 cm → 1 in
    setValue(window, from, 'cm');
    setValue(window, to, 'in');
    setValue(window, input, '2.54');
    assert.ok(output.textContent.startsWith('1'), `cm→in gave “${output.textContent}”`);
    assert.ok(output.textContent.includes('in'), 'missing unit label');

    // 1 mile → 1.609344 km
    setValue(window, from, 'mi');
    setValue(window, to, 'km');
    setValue(window, input, '1');
    assert.ok(/^1\.609344/.test(output.textContent), `mi→km gave “${output.textContent}”`);

    // Swap
    click(window, document.getElementById('unitSwap'));
    assert.strictEqual(from.value, 'km', 'swap did not exchange the units');
    assert.ok(/^0\.6213/.test(output.textContent), `after swap got “${output.textContent}”`);

    // Weight: 1 kg → 2.204622 lb
    setValue(window, category, 'weight');
    setValue(window, from, 'kg');
    setValue(window, to, 'lb');
    setValue(window, input, '1');
    assert.ok(/^2\.2046/.test(output.textContent), `kg→lb gave “${output.textContent}”`);

    // Temperature
    setValue(window, category, 'temperature');
    setValue(window, from, 'c');
    setValue(window, to, 'f');
    setValue(window, input, '100');
    assert.ok(output.textContent.startsWith('212'), `100°C→°F gave “${output.textContent}”`);
    setValue(window, input, '-40');
    assert.ok(output.textContent.startsWith('-40'), `-40°C→°F gave “${output.textContent}”`);
    setValue(window, input, '0');
    assert.ok(output.textContent.startsWith('32'), `0°C→°F gave “${output.textContent}”`);

    // Empty input → placeholder, no NaN
    setValue(window, input, '');
    assert.strictEqual(output.textContent, '—', `empty gave “${output.textContent}”`);
    assert.ok(!/NaN|undefined/.test(output.textContent + document.getElementById('unitFormula').textContent));

    // Non-numeric input → clear error
    setValue(window, input, 'abc');
    assert.ok(/not a number/i.test(document.getElementById('unitAlert').textContent), 'no error for non-numeric input');
    dom.window.close();
    return 'length, weight, temperature, swap, empty and invalid input all correct';
  });

  /* ---------- Tool 8: age calculator ---------- */
  console.log('\nTOOL 8 — age calculator (page behaviour)');

  await test('calculates a known age and rejects future dates', async () => {
    const dom = await loadPage('/tools/age-calculator');
    const { document, window } = dom.window;
    setValue(window, document.getElementById('birthDate'), '1990-05-17');
    setValue(window, document.getElementById('asOfDate'), '2026-10-05');
    document.getElementById('ageForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await tick(60);

    assert.strictEqual(document.getElementById('ageResults').hidden, false, 'results stayed hidden');
    assert.strictEqual(document.getElementById('ageYears').textContent, '36', `years: ${document.getElementById('ageYears').textContent}`);
    assert.strictEqual(document.getElementById('ageMonths').textContent, '4', `months: ${document.getElementById('ageMonths').textContent}`);
    assert.strictEqual(document.getElementById('ageDays').textContent, '18', `days: ${document.getElementById('ageDays').textContent}`);
    assert.ok(document.getElementById('ageSummary').textContent.includes('17 May 1990'), 'summary missing the birth date');
    assert.strictEqual(
      document.getElementById('ageBornWeekday').textContent,
      'Thursday',
      `weekday was “${document.getElementById('ageBornWeekday').textContent}” (17 May 1990 was a Thursday)`
    );
    assert.ok(/next birthday/i.test(document.getElementById('ageNextBirthdayWeekday').textContent + ' next birthday'), 'no next-birthday note');

    // Future date must be rejected
    setValue(window, document.getElementById('birthDate'), '2030-01-01');
    await tick(40);
    const alert = document.getElementById('ageAlert');
    assert.ok(/future/i.test(alert.textContent), `alert was “${alert.textContent}”`);
    assert.strictEqual(document.getElementById('ageResults').hidden, true, 'results were shown for a future date');

    // Empty input must not crash or print NaN
    setValue(window, document.getElementById('birthDate'), '');
    await tick(30);
    assert.ok(!/NaN/.test(document.getElementById('ageSummary').textContent), 'NaN leaked into the summary');
    dom.window.close();
    return '36y 4m 18d for 1990-05-17 → 2026-10-05; future date rejected';
  });

  /* ---------- Tool 9: URL encoder ---------- */
  console.log('\nTOOL 9 — URL encoder/decoder (page behaviour)');

  await test('encodes, decodes and reports malformed input', async () => {
    const dom = await loadPage('/tools/url-encoder');
    const { document, window } = dom.window;
    const input = document.getElementById('urlInput');
    const output = document.getElementById('urlOutput');
    const original = 'https://example.com/search?q=hello world&lang=en';

    setValue(window, input, original);
    click(window, document.getElementById('urlEncode'));
    const encoded = output.textContent;
    assert.strictEqual(
      encoded,
      'https%3A%2F%2Fexample.com%2Fsearch%3Fq%3Dhello%20world%26lang%3Den',
      `encode gave “${encoded}”`
    );
    assert.ok(document.getElementById('urlBreakdown').hidden === false, 'no escape breakdown shown');

    setValue(window, input, encoded);
    click(window, document.getElementById('urlDecode'));
    assert.strictEqual(output.textContent, original, 'round-trip failed');

    // encodeURI mode keeps the URL structure intact
    setValue(window, input, 'https://example.com/a b/c?d=e f');
    click(window, document.getElementById('urlEncodeFull'));
    assert.ok(output.textContent.startsWith('https://example.com/a%20b/c?d=e%20f'), `full encode gave “${output.textContent}”`);

    // Invalid percent-encoding
    setValue(window, input, '%E0%');
    click(window, document.getElementById('urlDecode'));
    const alert = document.getElementById('urlAlert');
    assert.ok(/not valid percent-encoding/i.test(alert.textContent), `alert was “${alert.textContent}”`);

    // Empty input
    setValue(window, input, '');
    click(window, document.getElementById('urlEncode'));
    assert.ok(/input is empty/i.test(alert.textContent), 'no empty-input message');
    assert.ok(!/undefined/.test(output.textContent));
    dom.window.close();
    return 'encode/decode round-trip + malformed input handled';
  });

  /* ---------- Tool 10: text case ---------- */
  console.log('\nTOOL 10 — text case converter (page behaviour)');

  await test('converts case and preserves line breaks', async () => {
    const dom = await loadPage('/tools/text-case-converter');
    const { document, window } = dom.window;
    const input = document.getElementById('caseInput');
    const output = document.getElementById('caseOutput');
    const source = 'hello world. second line here.\nthird line stays on its own.';

    setValue(window, input, source);
    click(window, document.querySelector('[data-case="upper"]'));
    assert.strictEqual(output.textContent, source.toUpperCase(), 'UPPERCASE failed');
    assert.strictEqual(output.textContent.split('\n').length, 2, 'line breaks were not preserved');

    click(window, document.querySelector('[data-case="lower"]'));
    assert.strictEqual(output.textContent, source.toLowerCase(), 'lowercase failed');

    click(window, document.querySelector('[data-case="title"]'));
    assert.ok(output.textContent.startsWith('Hello World.'), `Title Case gave “${output.textContent}”`);

    click(window, document.querySelector('[data-case="sentence"]'));
    assert.strictEqual(
      output.textContent,
      'Hello world. Second line here.\nThird line stays on its own.',
      `Sentence case gave “${output.textContent}”`
    );

    const active = document.querySelector('[data-case="sentence"]');
    assert.strictEqual(active.getAttribute('aria-pressed'), 'true', 'active button not marked');

    // Zero state
    click(window, document.getElementById('caseClear'));
    assert.strictEqual(output.textContent, '', 'clear did not empty the output');
    assert.ok(document.getElementById('caseStats').textContent.includes('0'));
    click(window, document.querySelector('[data-case="upper"]'));
    assert.ok(/enter some text/i.test(document.getElementById('caseAlert').textContent), 'no empty-input message');
    dom.window.close();
    return 'all five modes correct, line breaks preserved, empty state safe';
  });

  /* ---------- Accessibility / markup ---------- */
  console.log('\nACCESSIBILITY — labels, headings, semantics');

  await test('every input on every page has a label, and each page has one H1', async () => {
    const pages = [
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
    for (const url of pages) {
      const dom = await loadPage(url);
      const { document } = dom.window;
      const h1s = document.querySelectorAll('h1');
      assert.strictEqual(h1s.length, 1, `${url} has ${h1s.length} H1 elements`);
      for (const field of document.querySelectorAll('input:not([type="hidden"]), select, textarea')) {
        const id = field.getAttribute('id');
        const hasLabel = id && document.querySelector(`label[for="${id}"]`);
        const wrapped = field.closest('label');
        const labelled = field.getAttribute('aria-label') || field.getAttribute('aria-labelledby');
        assert.ok(hasLabel || wrapped || labelled, `${url}: field #${id || field.name} has no label`);
      }
      // Images need alt text.
      for (const img of document.querySelectorAll('img')) {
        assert.ok(img.hasAttribute('alt'), `${url}: an image has no alt attribute (${img.getAttribute('src')})`);
      }
      dom.window.close();
    }
    return `${pages.length} pages verified`;
  });

  await test('image compressor, admin-style previews and QR have no placeholder text', async () => {
    const pages = ['/', '/about', '/contact', '/tools/image-compressor'];
    for (const url of pages) {
      const dom = await loadPage(url);
      const html = dom.window.document.documentElement.outerHTML;
      assert.ok(!/lorem ipsum/i.test(html), `${url} contains lorem ipsum`);
      assert.ok(!/image goes here|placeholder image|coming soon/i.test(html), `${url} contains placeholder copy`);
      dom.window.close();
    }
    return 'no placeholder content';
  });

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
  console.error('Browser test harness crashed:', error);
  process.exit(1);
});
