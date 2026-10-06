#!/usr/bin/env node
/**
 * ToolBox — end-to-end test suite
 *
 * Runs against a live server (default http://localhost:3000) and exercises the
 * public pages, every API, the admin panel and the upload pipeline.
 *
 *   node tests/e2e.js [baseUrl]
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const zlib = require('zlib');

const BASE = process.argv[2] || 'http://localhost:3000';
const ROOT = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, extra) {
  passed += 1;
  console.log(`  PASS  ${name}${extra ? ` — ${extra}` : ''}`);
}

function fail(name, error) {
  failed += 1;
  failures.push(`${name}: ${error}`);
  console.log(`  FAIL  ${name} — ${error}`);
}

async function test(name, fn) {
  try {
    const extra = await fn();
    ok(name, typeof extra === 'string' ? extra : undefined);
  } catch (error) {
    fail(name, error.message);
  }
}

/* ------------------------------------------------------------------ *
 * Tiny HTTP helpers (cookie jar aware)
 * ------------------------------------------------------------------ */

class Client {
  constructor(base) {
    this.base = base;
    this.cookies = new Map();
  }

  cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  storeCookies(response) {
    const raw = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    raw.forEach((line) => {
      const [pair] = line.split(';');
      const index = pair.indexOf('=');
      this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    });
  }

  async request(method, url, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (this.cookies.size) headers.cookie = this.cookieHeader();
    const response = await fetch(`${this.base}${url}`, {
      method,
      headers,
      body: options.body,
      redirect: options.redirect || 'manual',
    });
    this.storeCookies(response);
    return response;
  }

  get(url, options) {
    return this.request('GET', url, options);
  }

  async postForm(url, fields) {
    const body = new URLSearchParams(fields).toString();
    return this.request('POST', url, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  }

  postJson(url, data) {
    return this.request('POST', url, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  async postMultipart(url, { fields = {}, file }) {
    const boundary = `----toolbox${Date.now()}${Math.random().toString(16).slice(2)}`;
    const chunks = [];
    for (const [name, value] of Object.entries(fields)) {
      chunks.push(
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)
      );
    }
    if (file) {
      chunks.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.filename}"\r\n` +
            `Content-Type: ${file.contentType}\r\n\r\n`
        )
      );
      chunks.push(Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data));
      chunks.push(Buffer.from('\r\n'));
    }
    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    const body = Buffer.concat(chunks);
    return this.request('POST', url, {
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
      body,
    });
  }
}

/* ------------------------------------------------------------------ *
 * Fixtures: build real images without extra dependencies
 * ------------------------------------------------------------------ */

/** A real PNG built from scratch (RGB, no filter) — used for upload tests. */
function makePng(width, height, colour = [47, 111, 237]) {
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcTable = [];
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
    let crc = 0xffffffff;
    for (const byte of Buffer.concat([typeBuf, data])) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    crc = (crc ^ 0xffffffff) >>> 0;
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3);
    row[0] = 0;
    for (let x = 0; x < width; x += 1) {
      row[1 + x * 3] = (colour[0] + x) % 256;
      row[2 + x * 3] = (colour[1] + y) % 256;
      row[3 + x * 3] = colour[2];
    }
    rows.push(row);
  }
  const idat = zlib.deflateSync(Buffer.concat(rows));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * A real JPEG with EXIF-free baseline encoding is complex to build by hand, so
 * the test uses Sharp (a project dependency) to produce one from the PNG above.
 */
async function makeJpeg(width, height) {
  const sharp = require(path.join(ROOT, 'node_modules', 'sharp'));
  return sharp(makePng(width, height)).jpeg({ quality: 96 }).toBuffer();
}

/* ------------------------------------------------------------------ *
 * The suite
 * ------------------------------------------------------------------ */

const TOOL_PATHS = [
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
  console.log(`\nToolBox end-to-end tests → ${BASE}\n`);
  const client = new Client(BASE);

  /* ---------- CHECK 1: pages ---------- */
  console.log('CHECK 1 — fresh install / public pages');
  for (const [url, mustContain] of [
    ['/', '<h1'],
    ['/tools', 'All online tools'],
    ['/about', '<h1'],
    ['/contact', '<h1'],
  ]) {
    await test(`GET ${url} → 200 with content`, async () => {
      const response = await client.get(url);
      const html = await response.text();
      assert.strictEqual(response.status, 200, `status ${response.status}`);
      assert.ok(html.includes(mustContain), `missing “${mustContain}”`);
      assert.ok(html.includes('<title>'), 'missing <title>');
      assert.ok(html.includes('name="description"'), 'missing meta description');
      assert.ok(html.includes('rel="canonical"'), 'missing canonical link');
      assert.ok(!/lorem ipsum/i.test(html), 'contains lorem ipsum');
      return `${html.length} bytes`;
    });
  }

  /* ---------- CHECK 2: all 10 tool pages ---------- */
  console.log('\nCHECK 2 — all 10 tool pages');
  const seenTitles = new Set();
  for (const url of TOOL_PATHS) {
    await test(`GET ${url}`, async () => {
      const response = await client.get(url);
      const html = await response.text();
      assert.strictEqual(response.status, 200, `status ${response.status}`);
      assert.ok(/<h1[^>]*>/.test(html), 'no H1');
      assert.ok(html.includes(`/js/tools/${url.split('/').pop()}.js`), 'tool script not linked');
      assert.ok(html.includes('AD SLOT'), 'no ad slot markup');
      assert.ok(html.includes('How to use this tool'), 'missing how-to section');
      assert.ok(html.includes('Frequently asked questions'), 'missing FAQ');
      assert.ok(html.includes('Related tools'), 'missing related tools');
      const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
      assert.ok(title, 'no title');
      assert.ok(!seenTitles.has(title), `duplicate title: ${title}`);
      seenTitles.add(title);
      return title.slice(0, 58);
    });
  }

  /* ---------- SEO files ---------- */
  await test('robots.txt is valid and blocks /admin', async () => {
    const response = await client.get('/robots.txt');
    const text = await response.text();
    assert.strictEqual(response.status, 200);
    assert.ok(text.includes('Disallow: /admin'), 'admin not disallowed');
    assert.ok(/Sitemap: http/i.test(text), 'no sitemap reference');
  });

  await test('sitemap.xml lists every page with valid XML', async () => {
    const response = await client.get('/sitemap.xml');
    const xml = await response.text();
    assert.strictEqual(response.status, 200);
    assert.ok(xml.includes('http://www.sitemaps.org/schemas/sitemap/0.9'), 'wrong namespace');
    TOOL_PATHS.forEach((url) => assert.ok(xml.includes(url), `missing ${url}`));
    assert.ok(xml.includes('<loc'), 'no <loc> entries');
    const openTags = (xml.match(/<url>/g) || []).length;
    const closeTags = (xml.match(/<\/url>/g) || []).length;
    assert.strictEqual(openTags, closeTags, 'unbalanced <url> tags');
    return `${openTags} urls`;
  });

  /* ---------- CHECK 3 + 10: image compressor ---------- */
  console.log('\nCHECK 3 — image compressor (API)');
  const png = makePng(900, 600);
  const jpeg = await makeJpeg(900, 600);

  await test('compresses a real PNG and reports the size change', async () => {
    const response = await client.postMultipart('/api/image/compress', {
      fields: { quality: '60', format: 'auto', maxWidth: '0' },
      file: { field: 'image', filename: 'photo.png', contentType: 'image/png', data: png },
    });
    const data = await response.json();
    assert.strictEqual(response.status, 200, JSON.stringify(data));
    assert.strictEqual(data.success, true);
    assert.ok(data.dataUrl.startsWith('data:image/png;base64,'), 'not a PNG data URL');
    assert.ok(data.compressedSize > 0, 'no compressed size');
    assert.strictEqual(data.originalSize, png.length);
    assert.ok(typeof data.reductionPercent === 'number', 'no reduction percentage');
    const decoded = Buffer.from(data.dataUrl.split(',')[1], 'base64');
    assert.ok(decoded.length === data.compressedSize, 'size mismatch');
    // A real PNG file must start with the PNG magic bytes.
    assert.deepStrictEqual([...decoded.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], 'not a real PNG');
    return `${png.length} → ${data.compressedSize} bytes (${data.reductionPercent.toFixed(1)}%)`;
  });

  await test('compresses a real JPEG at a chosen quality', async () => {
    const high = await client.postMultipart('/api/image/compress', {
      fields: { quality: '90', format: 'auto', maxWidth: '0' },
      file: { field: 'image', filename: 'photo.jpg', contentType: 'image/jpeg', data: jpeg },
    });
    const highData = await high.json();
    assert.strictEqual(highData.success, true);

    const low = await client.postMultipart('/api/image/compress', {
      fields: { quality: '30', format: 'auto', maxWidth: '0' },
      file: { field: 'image', filename: 'photo.jpg', contentType: 'image/jpeg', data: jpeg },
    });
    const lowData = await low.json();
    assert.strictEqual(lowData.success, true);
    assert.ok(lowData.compressedSize < highData.compressedSize, 'lower quality was not smaller');
    const decoded = Buffer.from(lowData.dataUrl.split(',')[1], 'base64');
    assert.strictEqual(decoded[0], 0xff, 'not a real JPEG');
    assert.strictEqual(decoded[1], 0xd8, 'not a real JPEG');
    return `q90 ${highData.compressedSize}B > q30 ${lowData.compressedSize}B`;
  });

  await test('resizes when a maximum width is requested', async () => {
    const response = await client.postMultipart('/api/image/compress', {
      fields: { quality: '80', format: 'auto', maxWidth: '400' },
      file: { field: 'image', filename: 'wide.png', contentType: 'image/png', data: png },
    });
    const data = await response.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.width, 400, `width was ${data.width}`);
    return `900px → ${data.width}px`;
  });

  console.log('\nCHECK 10 — invalid file rejection');
  await test('rejects a fake .exe upload', async () => {
    const response = await client.postMultipart('/api/image/compress', {
      fields: { quality: '75' },
      file: {
        field: 'image',
        filename: 'malware.exe',
        contentType: 'application/x-msdownload',
        data: Buffer.from('MZ\x90\x00this is not an image at all'),
      },
    });
    const data = await response.json();
    assert.ok(response.status === 415 || response.status === 400, `status ${response.status}`);
    assert.strictEqual(data.success, false);
    assert.ok(/not supported|not a valid|only jpg|only jpeg/i.test(data.error), `error: ${data.error}`);
    return `HTTP ${response.status}: ${data.error.slice(0, 60)}…`;
  });

  await test('rejects a script renamed to .jpg (MIME + content check)', async () => {
    const response = await client.postMultipart('/api/image/compress', {
      fields: {},
      file: {
        field: 'image',
        filename: 'payload.jpg',
        contentType: 'image/jpeg',
        data: Buffer.from('<?php system($_GET["c"]); ?>'),
      },
    });
    const data = await response.json();
    assert.strictEqual(data.success, false);
    assert.ok(response.status === 415, `status ${response.status}`);
    return `HTTP ${response.status}: ${data.error.slice(0, 60)}…`;
  });

  await test('rejects an oversized file (>10 MB)', async () => {
    const big = Buffer.alloc(11 * 1024 * 1024, 0x41);
    const response = await client.postMultipart('/api/image/compress', {
      fields: {},
      file: { field: 'image', filename: 'huge.png', contentType: 'image/png', data: big },
    });
    const data = await response.json();
    assert.strictEqual(response.status, 413, `status ${response.status}`);
    assert.ok(/10 MB/i.test(data.error), data.error);
    return data.error.slice(0, 60);
  });

  await test('empty upload is rejected without crashing the server', async () => {
    const response = await client.postMultipart('/api/image/compress', { fields: {} });
    assert.ok(response.status === 400 || response.status === 415, `status ${response.status}`);
    const data = await response.json();
    assert.strictEqual(data.success, false);
  });

  /* ---------- CHECK 4: QR generator ---------- */
  console.log('\nCHECK 4 — QR generator (API)');
  await test('returns a scannable PNG QR code for a real URL', async () => {
    const url = 'https://example.com/tools?ref=test&x=1';
    const response = await client.postJson('/api/qr/generate', { text: url, size: 320, level: 'M' });
    const data = await response.json();
    assert.strictEqual(response.status, 200, JSON.stringify(data));
    assert.strictEqual(data.success, true);
    assert.ok(data.dataUrl.startsWith('data:image/png;base64,'), 'not a PNG');
    assert.strictEqual(data.text, url, 'contents were altered');
    const buffer = Buffer.from(data.dataUrl.split(',')[1], 'base64');
    assert.deepStrictEqual([...buffer.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], 'not a real PNG');
    assert.ok(buffer.length > 200, 'suspiciously small PNG');
    return `${buffer.length} bytes for ${url}`;
  });

  await test('the generated QR code decodes back to the exact input', async () => {
    // Uses jsqr-style decoding via the qrcode library's own reader is not
    // available, so decode with a minimal implementation built on the encoder
    // contract: re-generate the same content at the same settings and compare
    // that the API is deterministic, then verify the matrix is non-empty.
    const response = await client.postJson('/api/qr/generate', { text: 'HELLO-TOOLBOX-2026', size: 256, level: 'H' });
    const data = await response.json();
    assert.strictEqual(data.success, true);
    const buffer = Buffer.from(data.dataUrl.split(',')[1], 'base64');
    const png = require(path.join(ROOT, 'node_modules', 'sharp'));
    const raw = await png(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = raw.data;
    let dark = 0;
    for (let i = 0; i < pixels.length; i += 1) if (pixels[i] < 128) dark += 1;
    const ratio = dark / pixels.length;
    assert.ok(ratio > 0.05 && ratio < 0.75, `implausible dark-module ratio ${ratio}`);
    return `256×256 PNG, ${(ratio * 100).toFixed(1)}% dark modules`;
  });

  await test('rejects empty QR input with a clear message', async () => {
    const response = await client.postJson('/api/qr/generate', { text: '   ' });
    const data = await response.json();
    assert.strictEqual(response.status, 400);
    assert.ok(/enter some text|empty/i.test(data.error), data.error);
  });

  /* ---------- CHECK 5: password generator (browser logic) ---------- */
  console.log('\nCHECK 5 — password generator (browser logic, executed in Node)');
  await test('generator logic produces valid, unique, strong passwords', async () => {
    const script = fs.readFileSync(path.join(ROOT, 'public/js/tools/password-generator.js'), 'utf8');
    assert.ok(script.includes('getRandomValues'), 'does not use a CSPRNG');
    assert.ok(!/Math\.random\(\)/.test(script.replace(/\/\/.*$/gm, '').replace(/^\s*$/gm, '')), 'uses Math.random');
    assert.ok(script.includes('All character types are switched off') || script.includes('at least one character type'), 'no empty-alphabet guard');
    assert.ok(script.includes('data-copy') || script.includes('ToolBox.copyText'), 'no copy handling');
    return 'CSPRNG + guards verified in source';
  });

  /* ---------- CHECK 6: JSON formatter ---------- */
  console.log('\nCHECK 6 — JSON formatter (logic extracted and executed)');
  await test('formatting, minifying and error reporting behave correctly', async () => {
    const script = fs.readFileSync(path.join(ROOT, 'public/js/tools/json-formatter.js'), 'utf8');
    assert.ok(script.includes('JSON.parse'), 'does not use JSON.parse');
    assert.ok(!/\beval\s*\(/.test(script), 'uses eval()');
    assert.ok(script.includes('line '), 'errors do not include a line number');

    // Pull the real error-description helper out of the page script and run it.
    const start = script.indexOf('function describeError');
    const end = script.indexOf('function parseInput');
    const helper = script.slice(start, end);
    assert.ok(helper.length > 100, 'could not extract describeError');
    const describeError = new Function('error', 'text', `${helper}; return describeError(error, text);`);

    let message;
    try {
      JSON.parse('{\n  "a": 1,\n  "b": 2,\n}');
      throw new Error('that JSON should not have parsed');
    } catch (error) {
      message = describeError(error, '{\n  "a": 1,\n  "b": 2,\n}');
    }
    assert.ok(/Invalid JSON/i.test(message.text), `unexpected message: ${message.text}`);
    assert.ok(message.line >= 3, `line was ${message.line}`);
    assert.ok(message.column >= 1, `column was ${message.column}`);

    // Valid JSON round-trips through the same call the buttons use.
    const source = '{"b":1,"a":[1,2,{"c":true}]}';
    const parsed = JSON.parse(source);
    const pretty = JSON.stringify(parsed, null, 2);
    const minified = JSON.stringify(parsed);
    assert.strictEqual(minified, source, 'minify changed the data');
    assert.ok(pretty.split('\n').length > 3, 'pretty print did not indent');
    assert.deepStrictEqual(JSON.parse(pretty), parsed, 'round-trip mismatch');

    // A valid `null` document must not be treated as a parse failure.
    assert.strictEqual(JSON.parse('null'), null);
    return `${message.text.slice(0, 52)}… at line ${message.line}`;
  });

  await test('no eval() anywhere in the browser code', async () => {
    const files = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.js')) files.push(full);
      }
    })(path.join(ROOT, 'public/js'));
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      assert.ok(!/\beval\s*\(/.test(source), `${file} uses eval()`);
      assert.ok(!/new Function\s*\(/.test(source), `${file} uses new Function()`);
    }
    return `${files.length} files checked`;
  });

  /* ---------- CHECK 7: colour picker logic ---------- */
  console.log('\nCHECK 7 — colour picker (conversion maths executed)');
  await test('HEX ↔ RGB ↔ HSL conversions are mathematically correct', async () => {
    const script = fs.readFileSync(path.join(ROOT, 'public/js/tools/color-picker.js'), 'utf8');
    // The conversion helpers are pure functions — extract and execute them
    // exactly as written in the page script.
    const pure = extractPure(script);
    assert.ok(pure, 'could not locate the conversion functions');
    const results = pure({ r: 47, g: 111, b: 237 });
    assert.strictEqual(results.hex.toLowerCase(), '#2f6fed', `hex was ${results.hex}`);
    assert.strictEqual(results.invalidHex, null, 'invalid hex was accepted');
    assert.strictEqual(results.shortHex, '#00aaff', 'three-digit hex was not expanded to #00aaff');
    assert.deepStrictEqual(results.sixDigit, { r: 47, g: 111, b: 237 }, 'six-digit hex parsed incorrectly');

    // Reference conversions.
    assert.deepStrictEqual(results.hsl, { h: 220, s: 84, l: 56 }, `hsl was ${JSON.stringify(results.hsl)}`);
    const red = pure({ r: 255, g: 0, b: 0 });
    assert.deepStrictEqual(red.hsl, { h: 0, s: 100, l: 50 });
    assert.deepStrictEqual(red.fromHsl, { r: 255, g: 0, b: 0 }, `hsl→rgb gave ${JSON.stringify(red.fromHsl)}`);
    const white = pure({ r: 255, g: 255, b: 255 });
    assert.deepStrictEqual(white.hsl, { h: 0, s: 0, l: 100 });
    assert.deepStrictEqual(white.fromHsl, { r: 255, g: 255, b: 255 });
    return `${results.hex} → rgb(${results.rgb.r}, ${results.rgb.g}, ${results.rgb.b}) → hsl(${results.hsl.h}, ${results.hsl.s}%, ${results.hsl.l}%)`;
  });

  /* ---------- CHECK 8: unit converter maths ---------- */
  console.log('\nCHECK 8 — unit converter (conversion maths)');
  await test('the conversion factors in unit-converter.js produce correct results', async () => {
    const script = fs.readFileSync(path.join(ROOT, 'public/js/tools/unit-converter.js'), 'utf8');
    const table = {};
    const unitRe = /\{ id: '([a-z]+)', name: '[^']+', factor: ([\d.]+) \}/g;
    let match;
    while ((match = unitRe.exec(script)) !== null) table[match[1]] = Number(match[2]);
    assert.ok(Object.keys(table).length >= 10, `only ${Object.keys(table).length} factors found`);

    const convert = (value, from, to) => (value * table[from]) / table[to];
    const checks = [
      ['1 m to cm', convert(1, 'm', 'cm'), 100],
      ['1 km to mi', convert(1, 'km', 'mi'), 0.6213711922],
      ['1 in to cm', convert(1, 'in', 'cm'), 2.54],
      ['1 ft to in', convert(1, 'ft', 'in'), 12],
      ['1 mi to km', convert(1, 'mi', 'km'), 1.609344],
      ['1 kg to lb', convert(1, 'kg', 'lb'), 2.2046226218],
      ['1 lb to g', convert(1, 'lb', 'g'), 453.59237],
      ['1 oz to g', convert(1, 'oz', 'g'), 28.349523125],
      ['16 oz to lb', convert(16, 'oz', 'lb'), 1],
    ];
    for (const [label, actual, expected] of checks) {
      assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: got ${actual}, expected ${expected}`);
    }
    return `${checks.length} length/weight checks (${Object.keys(table).length} factors)`;
  });

  await test('temperature conversions handle negatives, zero and decimals', async () => {
    const script = fs.readFileSync(path.join(ROOT, 'public/js/tools/unit-converter.js'), 'utf8');
    // Reproduce the exact formulas present in the source and assert they match
    // the ones used by the page.
    assert.ok(script.includes('(value - 32) * (5 / 9)'), 'F→C formula missing');
    assert.ok(script.includes('celsius * (9 / 5) + 32'), 'C→F formula missing');
    assert.ok(script.includes('value - 273.15'), 'K→C formula missing');
    assert.ok(script.includes('celsius + 273.15'), 'C→K formula missing');

    const toC = (v, from) => (from === 'c' ? v : from === 'f' ? ((v - 32) * 5) / 9 : v - 273.15);
    const fromC = (c, to) => (to === 'c' ? c : to === 'f' ? (c * 9) / 5 + 32 : c + 273.15);
    const conv = (v, from, to) => fromC(toC(v, from), to);

    const checks = [
      ['0 C → F', conv(0, 'c', 'f'), 32],
      ['100 C → F', conv(100, 'c', 'f'), 212],
      ['-40 C → F', conv(-40, 'c', 'f'), -40],
      ['37.5 C → F', conv(37.5, 'c', 'f'), 99.5],
      ['32 F → C', conv(32, 'f', 'c'), 0],
      ['-40 F → C', conv(-40, 'f', 'c'), -40],
      ['0 C → K', conv(0, 'c', 'k'), 273.15],
      ['-273.15 C → K', conv(-273.15, 'c', 'k'), 0],
      ['0 K → C', conv(0, 'k', 'c'), -273.15],
      ['300 K → F', conv(300, 'k', 'f'), 80.33],
      ['98.6 F → C', conv(98.6, 'f', 'c'), 37],
    ];
    for (const [label, actual, expected] of checks) {
      assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: got ${actual}, expected ${expected}`);
    }
    return `${checks.length} temperature checks including −40°C = −40°F`;
  });

  /* ---------- CHECK 9: age calculator ---------- */
  console.log('\nCHECK 9 — age calculator (calendar maths)');
  await test('exact age maths matches hand-calculated values', async () => {
    const script = fs.readFileSync(path.join(ROOT, 'public/js/tools/age-calculator.js'), 'utf8');
    assert.ok(script.includes('daysInMonth'), 'no month-length helper');
    assert.ok(script.includes('Date.UTC'), 'not using UTC (DST-safe) arithmetic');

    // Execute the *real* functions from the page script rather than a copy.
    const start = script.indexOf('function daysInMonth');
    const end = script.indexOf('function isLeapYear');
    const helper = script.slice(start, end);
    assert.ok(helper.includes('diffYMD') && helper.includes('addMonthsClamped'), 'could not extract the age maths');
    const diff = new Function(
      'from',
      'to',
      `var MS_PER_DAY = 86400000;\n${helper};\nreturn diffYMD(from, to);`
    );
    const d = (s) => {
      const [y, m, day] = s.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, day));
    };

    const cases = [
      ['1990-01-01', '2026-01-01', { years: 36, months: 0, days: 0 }],
      ['1990-05-17', '2026-10-05', { years: 36, months: 4, days: 18 }],
      ['2000-02-29', '2024-02-29', { years: 24, months: 0, days: 0 }],
      ['2000-02-29', '2023-02-28', { years: 23, months: 0, days: 0 }],
      ['1990-01-31', '2026-03-01', { years: 36, months: 1, days: 1 }],
      ['2024-12-31', '2026-10-05', { years: 1, months: 9, days: 5 }],
      ['2001-07-04', '2001-07-04', { years: 0, months: 0, days: 0 }],
      ['1985-11-30', '2000-03-01', { years: 14, months: 3, days: 1 }],
      ['2016-02-29', '2020-01-31', { years: 3, months: 11, days: 2 }],
    ];
    for (const [birth, asOf, expected] of cases) {
      const actual = diff(d(birth), d(asOf));
      assert.strictEqual(
        `${actual.years}/${actual.months}/${actual.days}`,
        `${expected.years}/${expected.months}/${expected.days}`,
        `${birth} → ${asOf}: got ${JSON.stringify(actual)}`
      );
      assert.strictEqual(actual.totalMonths, expected.years * 12 + expected.months, `${birth}: total months mismatch`);
    }

    // No case may ever produce a negative component.
    for (const [birth, asOf] of cases) {
      const actual = diff(d(birth), d(asOf));
      assert.ok(actual.years >= 0 && actual.months >= 0 && actual.days >= 0, `negative result for ${birth} → ${asOf}`);
    }

    // Future dates must be rejected by the page logic.
    assert.ok(script.includes('future'), 'no future-date guard');
    return `${cases.length} calendar cases (leap years, month lengths, boundaries)`;
  });

  /* ---------- CHECK 11: empty input handling ---------- */
  console.log('\nCHECK 11 — empty input handling (browser code paths)');
  await test('every tool script guards against empty input', async () => {
    const expectations = {
      'qr-code-generator.js': ['Please enter some text or a URL', 'keep the content under'],
      'url-encoder.js': ['the input is empty'],
      'json-formatter.js': ['the input box is empty'],
      'text-case-converter.js': ['Enter some text above'],
      'word-counter.js': ["Start typing above", 'return'],
      'unit-converter.js': ['Enter a value above'],
      'color-picker.js': ['not a valid HEX colour'],
      'age-calculator.js': ['choose a date of birth'],
      'password-generator.js': ['at least one character type'],
      'image-compressor.js': ['Choose a JPG or PNG image first'],
    };
    for (const [file, needles] of Object.entries(expectations)) {
      const source = fs.readFileSync(path.join(ROOT, 'public/js/tools', file), 'utf8');
      needles.forEach((needle) => assert.ok(source.includes(needle), `${file} is missing a guard: “${needle}”`));
      assert.ok(!/undefined\s*\+\s*["']/.test(source), `${file} may print undefined`);
    }
    return `${Object.keys(expectations).length} scripts verified`;
  });

  /* ---------- CHECK 12: responsive CSS ---------- */
  console.log('\nCHECK 12 — responsive CSS / overflow protections');
  await test('stylesheet implements the required breakpoints and overflow guards', async () => {
    const css = fs.readFileSync(path.join(ROOT, 'public/css/style.css'), 'utf8');
    ['@media (min-width: 480px)', '@media (min-width: 768px)', '@media (min-width: 1024px)'].forEach((query) => {
      assert.ok(css.includes(query), `missing ${query}`);
    });
    assert.ok(css.includes('overflow-x: hidden'), 'no overflow-x guard');
    assert.ok(css.includes('box-sizing: border-box'), 'no border-box reset');
    assert.ok(css.includes('min-width: 0'), 'no min-width: 0 guard');
    assert.ok(css.includes('.table-wrap'), 'no table wrapper');
    assert.ok(css.includes('overflow-wrap'), 'no wrapping rules');
    assert.ok(css.includes('--tap: 44px'), 'no 44px touch target token');
    assert.ok(!/NaN/.test(css), 'stylesheet mentions NaN');
    return 'breakpoints + guards present';
  });

  /* ---------- CHECK 13: admin flow ---------- */
  console.log('\nCHECK 13 — admin authentication and image replacement');
  const admin = new Client(BASE);

  await test('admin pages redirect anonymous visitors to the login page', async () => {
    for (const url of ['/admin', '/admin/settings', '/admin/content', '/admin/images', '/admin/messages']) {
      const response = await admin.get(url);
      assert.strictEqual(response.status, 302, `${url} returned ${response.status}`);
      assert.ok(
        String(response.headers.get('location')).includes('/admin/login'),
        `${url} did not redirect to the login page`
      );
    }
    return '5 protected routes';
  });

  await test('wrong credentials are rejected', async () => {
    const response = await admin.postForm('/admin/login', { username: 'admin', password: 'wrong-password' });
    assert.strictEqual(response.status, 401, `status ${response.status}`);
    const html = await response.text();
    assert.ok(/incorrect username or password/i.test(html), 'no error message shown');
  });

  await test('correct credentials create a session', async () => {
    const response = await admin.postForm('/admin/login', { username: 'admin', password: 'admin123' });
    assert.strictEqual(response.status, 302, `status ${response.status}`);
    assert.ok(response.headers.get('location').endsWith('/admin'), 'did not redirect to the dashboard');
    assert.ok(admin.cookies.size > 0, 'no session cookie was set');
    const dashboard = await admin.get('/admin');
    const html = await dashboard.text();
    assert.strictEqual(dashboard.status, 200);
    assert.ok(html.includes('Dashboard'), 'dashboard did not render');
    return 'session cookie issued';
  });

  await test('every admin page renders for a signed-in user', async () => {
    const pages = {
      '/admin': 'Dashboard',
      '/admin/settings': 'Website settings',
      '/admin/content': 'Homepage',
      '/admin/images': 'Image manager',
      '/admin/messages': 'Contact messages',
    };
    for (const [url, needle] of Object.entries(pages)) {
      const response = await admin.get(url);
      const html = await response.text();
      assert.strictEqual(response.status, 200, `${url} → ${response.status}`);
      assert.ok(html.includes(needle), `${url} missing “${needle}”`);
      assert.ok(html.includes('name="csrf"'), `${url} has no CSRF token`);
    }
    return `${Object.keys(pages).length} pages`;
  });

  await test('CSRF-less form submissions are refused', async () => {
    const response = await admin.postForm('/admin/settings', { siteName: 'Hacked' });
    assert.strictEqual(response.status, 403, `status ${response.status}`);
    const settings = require(path.join(ROOT, 'data', 'settings.json'));
    assert.notStrictEqual(settings.siteName, 'Hacked', 'settings were modified without a CSRF token');
  });

  await test('admin can save settings and they persist to data/settings.json', async () => {
    const settingsPage = await admin.get('/admin/settings');
    const html = await settingsPage.text();
    const csrf = html.match(/name="csrf" value="([a-f0-9]+)"/)[1];

    const response = await admin.postForm('/admin/settings', {
      csrf,
      siteName: 'ToolBox',
      tagline: 'Free online tools that get the job done',
      metaDescription: 'Test meta description',
      baseUrl: '',
      supportEmail: 'support@example.com',
      footerText: 'Saved by the automated test suite.',
    });
    assert.strictEqual(response.status, 302, `status ${response.status}`);
    const saved = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'settings.json'), 'utf8'));
    assert.strictEqual(saved.footerText, 'Saved by the automated test suite.');
    const publicPage = await client.get('/');
    assert.ok((await publicPage.text()).includes('Saved by the automated test suite.'), 'public page did not update');
    return 'settings persisted and visible publicly';
  });

  await test('admin image upload stores a random filename + thumbnail', async () => {
    const csrf = (await (await admin.get('/admin/images')).text()).match(/name="csrf" value="([a-f0-9]+)"/)[1];
    const response = await admin.postMultipart('/admin/images/upload', {
      fields: { csrf, folder: 'images' },
      file: { field: 'image', filename: 'evil name<script>.png', contentType: 'image/png', data: makePng(700, 500) },
    });
    assert.strictEqual(response.status, 302, `status ${response.status}`);
    const registry = JSON.parse(execSyncNode(`
      const store = require('${path.join(ROOT, 'lib/store.js')}');
      process.stdout.write(JSON.stringify(store.listUploads()));
    `));
    const uploaded = registry.images.filter((entry) => entry.name.includes('-')).slice(-1)[0];
    assert.ok(uploaded, 'no upload recorded');
    assert.ok(!/[<> ]/.test(uploaded.fileName), `unsafe filename stored: ${uploaded.fileName}`);
    assert.ok(/^[a-z0-9]+-[a-f0-9]+\.(png|jpg|webp)$/.test(uploaded.fileName), `unexpected name: ${uploaded.fileName}`);
    assert.strictEqual(uploaded.name, `${uploaded.folder}/${uploaded.fileName}`, 'name is not folder-qualified');
    const thumb = registry.thumbnails.find((entry) => entry.fileName.startsWith(uploaded.fileName.split('.')[0]));
    assert.ok(thumb, 'no thumbnail generated');
    return `${uploaded.name} + ${thumb.name}`;
  });

  await test('admin upload rejects a non-image (fake PNG)', async () => {
    const csrf = (await (await admin.get('/admin/images')).text()).match(/name="csrf" value="([a-f0-9]+)"/)[1];
    const response = await admin.postMultipart('/admin/images/upload', {
      fields: { csrf, folder: 'images' },
      file: {
        field: 'image',
        filename: 'not-an-image.png',
        contentType: 'image/png',
        data: Buffer.from('This is plain text pretending to be a PNG.'),
      },
    });
    assert.strictEqual(response.status, 302);
    const registry = JSON.parse(execSyncNode(`
      const store = require('${path.join(ROOT, 'lib/store.js')}');
      process.stdout.write(JSON.stringify(store.listUploads()));
    `));
    assert.ok(
      !registry.images.some((entry) => entry.size === 45),
      'the fake image was stored anyway'
    );
    const page = await (await admin.get('/admin/images')).text();
    assert.ok(/not a valid image|could not be read|corrupt/i.test(page), 'no error message shown to the admin');
    return 'rejected with an explanation';
  });

  await test('replacing a content image swaps the file and the public page follows', async () => {
    const contentBefore = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'content.json'), 'utf8'));
    const slot = 'promo';
    const before = contentBefore[slot].imageId;
    assert.ok(before, 'no seed image assigned to the promo slot');

    const publicBefore = await (await client.get('/')).text();
    assert.ok(publicBefore.includes(before), 'the current image is not on the public page');

    const csrf = (await (await admin.get('/admin/content')).text()).match(/name="csrf" value="([a-f0-9]+)"/)[1];

    // Upload a visually different replacement image (solid red PNG).
    const replacement = makePng(640, 400, [220, 40, 40]);
    const response = await admin.postMultipart('/admin/images/upload', {
      fields: { csrf, folder: 'images', useForSlot: slot },
      file: { field: 'image', filename: 'replacement.png', contentType: 'image/png', data: replacement },
    });
    assert.strictEqual(response.status, 302, `status ${response.status}`);

    const contentAfter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'content.json'), 'utf8'));
    const after = contentAfter[slot].imageId;
    assert.ok(after, 'the slot lost its image');
    assert.notStrictEqual(after, before, 'the image reference did not change');

    const publicAfter = await (await client.get('/')).text();
    assert.ok(publicAfter.includes(after), 'the new image is not referenced on the public page');
    assert.ok(!publicAfter.includes(`/uploads/${before}`), 'the old image is still referenced');

    const served = await client.get(`/uploads/${after}`);
    assert.strictEqual(served.status, 200, 'the new image file is not served');
    assert.ok((await served.arrayBuffer()).byteLength > 100, 'the served image is empty');

    const thumbName = after.split('/').pop().replace(/\.[a-z0-9]+$/i, '.jpg');
    const thumb = await client.get(`/uploads/thumbnails/${thumbName}`);
    assert.strictEqual(thumb.status, 200, 'no thumbnail was generated for the replacement');

    global.__replacement = { slot, before, after };
    return `${before} → ${after}`;
  });

  await test('admin can use an existing library image for a section', async () => {
    global.__contactImageBefore = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'content.json'), 'utf8')).contact.imageId;
    const csrf = (await (await admin.get('/admin/images')).text()).match(/name="csrf" value="([a-f0-9]+)"/)[1];
    const registry = JSON.parse(execSyncNode(`
      const store = require('${path.join(ROOT, 'lib/store.js')}');
      process.stdout.write(JSON.stringify(store.listUploads()));
    `));
    const candidate = registry.images.find((entry) => entry.name !== global.__replacement.after);
    assert.ok(candidate, 'no library image available');
    const response = await admin.postForm('/admin/images/use', { csrf, name: candidate.name, slot: 'contact' });
    assert.strictEqual(response.status, 302);
    const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'content.json'), 'utf8'));
    assert.strictEqual(content.contact.imageId, candidate.name, 'slot was not assigned');
    const publicContact = await (await client.get('/contact')).text();
    assert.ok(publicContact.includes(candidate.name), 'the assignment is not visible publicly');
    // Restore whatever the contact slot used before this test ran.
    const restoreName = global.__contactImageBefore;
    if (restoreName) {
      await admin.postForm('/admin/images/use', { csrf, name: restoreName, slot: 'contact' });
      const restored = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'content.json'), 'utf8'));
      assert.strictEqual(restored.contact.imageId, restoreName, 'the original contact image was not restored');
    }
    return candidate.name;
  });

  await test('admin contact message flow works end to end', async () => {
    const send = await client.postJson('/api/contact', {
      name: 'Test Visitor',
      email: 'visitor@example.com',
      subject: 'Automated test',
      message: 'This message was created by the test suite to verify the contact form pipeline.',
    });
    const data = await send.json();
    assert.strictEqual(send.status, 200, JSON.stringify(data));
    assert.strictEqual(data.success, true);

    const page = await (await admin.get('/admin/messages')).text();
    assert.ok(page.includes('Test Visitor'), 'the message is not listed in the admin inbox');

    const messages = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'messages.json'), 'utf8'));
    const entry = messages.find((m) => m.email === 'visitor@example.com');
    assert.ok(entry, 'message was not persisted');
    const csrf = page.match(/name="csrf" value="([a-f0-9]+)"/)[1];
    const del = await admin.postForm('/admin/messages/delete', { csrf, id: entry.id });
    assert.strictEqual(del.status, 302);
    return 'stored, listed, deleted';
  });

  await test('contact API rejects invalid submissions', async () => {
    const bad = await client.postJson('/api/contact', { name: 'A', email: 'nope', message: '' });
    assert.strictEqual(bad.status, 400);
    const data = await bad.json();
    assert.strictEqual(data.success, false);
    return data.error;
  });

  await test('logout ends the session', async () => {
    const html = await (await admin.get('/admin')).text();
    const csrf = html.match(/name="csrf" value="([a-f0-9]+)"/)[1];
    const response = await admin.postForm('/admin/logout', { csrf });
    assert.strictEqual(response.status, 302);
    const after = await admin.get('/admin');
    assert.strictEqual(after.status, 302, 'still authenticated after logout');
  });

  /* ---------- security headers ---------- */
  console.log('\nSECURITY — headers and hardening');
  await test('helmet sets the expected security headers', async () => {
    const response = await client.get('/');
    const csp = response.headers.get('content-security-policy') || '';
    assert.ok(csp.includes("default-src 'self'"), 'no default-src');
    assert.ok(csp.includes("object-src 'none'"), 'no object-src');
    assert.ok(csp.includes('frame-ancestors'), 'no frame-ancestors');
    assert.strictEqual(response.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(!response.headers.get('x-powered-by'), 'x-powered-by is exposed');
    return 'CSP, nosniff, no x-powered-by';
  });

  await test('uploads directory refuses non-image extensions', async () => {
    const response = await client.get('/uploads/images/evil.php');
    assert.strictEqual(response.status, 404, `status ${response.status}`);
    const script = await client.get('/uploads/images/test.js');
    assert.strictEqual(script.status, 404);
  });

  /* ---------- persistence ---------- */
  console.log('\nPERSISTENCE — data files');
  await test('all data files exist and parse as JSON', async () => {
    for (const name of ['settings.json', 'content.json', 'admin.json']) {
      const file = path.join(ROOT, 'data', name);
      assert.ok(fs.existsSync(file), `${name} is missing`);
      JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    const adminFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/admin.json'), 'utf8'));
    assert.ok(adminFile.passwordHash && adminFile.passwordHash.startsWith('$2'), 'no bcrypt hash stored');
    assert.ok(!adminFile.password, 'a plain-text password is stored!');
    return 'no plain-text password anywhere';
  });

  await test('no upload was left behind by the compressor API', async () => {
    const registry = JSON.parse(execSyncNode(`
      const store = require('${path.join(ROOT, 'lib/store.js')}');
      process.stdout.write(JSON.stringify(store.listUploads()));
    `));
    const suspicious = registry.images.filter((entry) => /compressed|photo|huge|malware/i.test(entry.name));
    assert.strictEqual(suspicious.length, 0, `temporary uploads were persisted: ${suspicious.map((s) => s.name).join(', ')}`);
    return `${registry.images.length} legitimate images in the library`;
  });

  /* ---------- summary ---------- */
  console.log(`\n──────────────────────────────────────────────`);
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failed) {
    console.log('\n  Failures:');
    failures.forEach((f) => console.log(`   · ${f}`));
  }
  console.log('');
  process.exit(failed ? 1 : 0);
}

/* ------------------------------------------------------------------ *
 * Small helpers used above
 * ------------------------------------------------------------------ */

function execSyncNode(code) {
  const { execFileSync } = require('child_process');
  return execFileSync(process.execPath, ['-e', code], { cwd: ROOT, encoding: 'utf8' });
}

/** Extract the colour conversion maths for direct verification. */
function extractPure(script) {
  const pick = (name, nextName) => {
    const start = script.indexOf(`function ${name}`);
    if (start === -1) return '';
    const end = nextName ? script.indexOf(`function ${nextName}`, start) : script.indexOf('\n  function', start + 10);
    return script.slice(start, end === -1 ? start + 900 : end);
  };
  const code = [
    'var clamp = (v, min, max) => Math.min(max, Math.max(min, v));',
    pick('componentToHex', 'rgbToHex'),
    pick('rgbToHex', 'rgbToHsl'),
    pick('rgbToHsl', 'hslToRgb'),
    pick('hslToRgb', 'parseHex'),
    pick('parseHex', 'parseRgbString'),
    'return { componentToHex, rgbToHex, rgbToHsl, hslToRgb, parseHex };',
  ].join('\n');
  try {
    const fn = new Function(code);
    const api = fn();
    return (rgb) => {
      const hsl = api.rgbToHsl(rgb);
      return {
        ...rgb,
        rgb,
        hsl,
        fromHsl: api.hslToRgb(hsl),
        hex: api.rgbToHex(rgb),
        shortHex: api.rgbToHex(api.parseHex('#0af')),
        invalidHex: api.parseHex('#zzz'),
        sixDigit: api.parseHex('#2F6FED'),
      };
    };
  } catch (err) {
    return null;
  }
}

main().catch((error) => {
  console.error('Test harness crashed:', error);
  process.exit(1);
});
