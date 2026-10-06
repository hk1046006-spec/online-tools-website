'use strict';

/**
 * Renders every tool page (/tools/<slug>) and the tools index (/tools).
 *
 * Each tool page contains: breadcrumb, H1, short introduction, the working
 * tool itself near the top, an output/result area, a how-to-use list, the
 * explanatory content, an FAQ section and related tools — plus clearly marked
 * empty advertisement slots.
 */

const { TOOLS, getTool } = require('../tools');
const t = require('../templates');
const { escapeHtml: e, icon, adSlot, breadcrumbs, relatedToolsBlock, faqBlock, howToUse, layout } = t;

/* ------------------------------------------------------------------ *
 * Shared helpers
 * ------------------------------------------------------------------ */

function toolShell(slug, opts) {
  const tool = getTool(slug);
  const sidebar = opts.sidebar
    ? `\n        <aside class="tool-sidebar">${adSlot('SIDEBAR')}\n          <div class="card">
            <h2>Other tools</h2>
            <ul class="site-footer__links">
              ${TOOLS.filter((x) => x.slug !== slug)
                .slice(0, 5)
                .map((x) => `<li><a href="/tools/${x.slug}">${e(x.name)}</a></li>`)
                .join('\n              ')}
            </ul>
          </div>
        </aside>`
    : '';

  const body = `
    <div class="container">
      ${breadcrumbs([
        { label: 'Home', href: '/' },
        { label: 'Tools', href: '/tools' },
        { label: tool.name },
      ])}
      <header class="tool-header">
        <h1>${e(tool.name)}</h1>
        <p class="tool-header__lede">${e(opts.lede)}</p>
      </header>

      <div class="tool-layout${opts.sidebar ? ' tool-layout--split' : ''}">
        <div class="tool-main">
          ${opts.ui}
        </div>${sidebar}
      </div>

      <!-- AD SLOT: IN-CONTENT -->
      <div class="ad-inline">${adSlot('IN-CONTENT')}</div>
      <!-- /AD SLOT: IN-CONTENT -->

      ${howToUse(opts.steps)}
      ${opts.sections || ''}
      ${faqBlock(opts.faq, `faq-${slug}`)}
      ${relatedToolsBlock(slug)}
    </div>`;

  return layout({
    title: opts.title,
    description: opts.description,
    canonicalPath: `/tools/${slug}`,
    body,
    bodyClass: 'page-tool',
    pageScript: `/js/tools/${slug}.js`,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: tool.name,
        url: t.absolute(`/tools/${slug}`),
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any (web browser)',
        description: opts.description,
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: (opts.faq || []).map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: t.absolute('/') },
          { '@type': 'ListItem', position: 2, name: 'Tools', item: t.absolute('/tools') },
          { '@type': 'ListItem', position: 3, name: tool.name, item: t.absolute(`/tools/${slug}`) },
        ],
      },
    ],
  });
}

function proseSection(id, heading, html) {
  return `
      <section class="section section--tight" aria-labelledby="${id}">
        <h2 id="${id}">${e(heading)}</h2>
        <div class="prose">${html}</div>
      </section>`;
}

function p(text) {
  return `<p>${text}</p>`;
}

/* ------------------------------------------------------------------ *
 * 1. Image Compressor
 * ------------------------------------------------------------------ */

function imageCompressor() {
  const ui = `
          <section class="tool-panel" aria-labelledby="ic-heading">
            <h2 id="ic-heading" class="sr-only">Compress an image</h2>
            <form id="icForm" novalidate>
              <div class="field">
                <label for="icFile" class="field__label">Choose an image</label>
                <div class="dropzone" id="icDropzone" role="button" tabindex="0" aria-describedby="ic-drop-hint">
                  <span class="dropzone__icon" aria-hidden="true">${icon('compress', 'icon')}</span>
                  <span class="dropzone__title">Drop a JPG or PNG here, or tap to browse</span>
                  <span class="dropzone__hint" id="ic-drop-hint">Maximum 4 MB per file. Images are compressed on the server and never stored permanently.</span>
                </div>
                <input class="sr-only" type="file" id="icFile" name="image" accept="image/jpeg,image/png,.jpg,.jpeg,.png" />
                <p class="field__hint">Accepted: JPG, JPEG and PNG. Everything else (PDF, ZIP, EXE, SVG, GIF…) is rejected.</p>
              </div>

              <div class="field-row field-row--2">
                <div class="field">
                  <label for="icQuality">Compression quality</label>
                  <div class="range-row">
                    <input type="range" id="icQuality" name="quality" min="10" max="100" step="5" value="75" aria-describedby="ic-quality-help" />
                    <output class="range-value" id="icQualityValue" for="icQuality">75%</output>
                  </div>
                  <p class="field__hint" id="ic-quality-help">Lower values give smaller files. 70–80% is usually indistinguishable from the original.</p>
                </div>
                <div class="field">
                  <label for="icResize">Maximum width</label>
                  <select id="icResize" name="maxWidth">
                    <option value="0">Keep original dimensions</option>
                    <option value="1920">1920 px (Full HD)</option>
                    <option value="1280">1280 px (large)</option>
                    <option value="800">800 px (blog)</option>
                    <option value="480">480 px (thumbnail)</option>
                  </select>
                </div>
              </div>

              <div class="field">
                <label for="icFormat">Output format</label>
                <select id="icFormat" name="format">
                  <option value="auto">Same as the uploaded file</option>
                  <option value="jpeg">JPEG (best for photos)</option>
                  <option value="png">PNG (best for graphics)</option>
                  <option value="webp">WebP (smallest, modern browsers)</option>
                </select>
              </div>

              <div class="btn-row">
                <button class="btn btn--lg" type="submit" id="icCompress">Compress image</button>
                <button class="btn btn--soft" type="button" id="icReset">Reset</button>
              </div>
              <div class="progress" id="icProgress" hidden aria-hidden="true">
                <div class="progress__bar" id="icProgressBar"></div>
              </div>
              <p class="muted" id="icStatus" role="status" aria-live="polite"></p>
              <div class="alert" id="icAlert" hidden></div>
            </form>
          </section>

          <section class="tool-panel" id="icResults" hidden aria-labelledby="ic-results-heading">
            <h2 id="ic-results-heading">Result</h2>
            <div class="preview-grid">
              <div class="preview-card">
                <h3>Original</h3>
                <div class="preview-frame"><img class="preview-img" id="icOriginalImg" alt="Original image preview" loading="lazy" decoding="async" /></div>
                <p class="muted" id="icOriginalMeta"></p>
              </div>
              <div class="preview-card">
                <h3>Compressed</h3>
                <div class="preview-frame"><img class="preview-img" id="icCompressedImg" alt="Compressed image preview" loading="lazy" decoding="async" /></div>
                <p class="muted" id="icCompressedMeta"></p>
              </div>
            </div>
            <div class="btn-row" style="margin-top:1rem">
              <button class="btn" type="button" id="icDownload">${icon('download', 'icon')} Download compressed image</button>
            </div>
          </section>`;

  return toolShell('image-compressor', {
    title: 'Image Compressor — Compress JPG & PNG Online (Free) | ToolBox',
    description:
      'Compress JPG and PNG images online for free. Choose the quality, resize large photos and download the optimised file in seconds. No sign-up, 4 MB limit.',
    lede:
      'Upload a JPG or PNG up to 4 MB, choose how much compression you want, and download a lighter file. You will see the original size, the new size and the exact percentage saved.',
    ui,
    sidebar: true,
    steps: [
      'Drop your JPG or PNG file onto the upload box, or tap it to pick a file from your device.',
      'Move the quality slider — 70–80% usually halves the file size with no visible difference.',
      'Optionally limit the maximum width, which shrinks photo-heavy images dramatically.',
      'Press “Compress image” and wait a moment while the server processes the file.',
      'Compare the two previews and the size figures, then press “Download compressed image”.',
    ],
    sections: [
      proseSection(
        'ic-about',
        'How image compression works here',
        p(
          'Compression is performed on the server with <strong>Sharp</strong>, an image library built on libvips. For JPEG files the encoder rewrites the image with a lower quality coefficient, which discards detail the human eye barely registers. For PNG files the image is re-encoded with maximum compression effort and a reduced colour palette where that does not hurt quality, which is what usually produces the largest savings on screenshots and graphics.'
        ) +
          p(
            'Because the work happens on the server, the tool behaves identically on older phones and tablets that would otherwise struggle to re-encode a large photo in the browser. Your file is held in memory only, is never written to a permanent location, and the temporary copy is deleted as soon as the response has been sent.'
          ) +
          p(
            'The percentage figure you see is calculated from the exact byte counts, so it always matches the file you download.'
          )
      ),
      proseSection(
        'ic-when',
        'Choosing the right settings',
        p(
          '<strong>Quality 80%</strong> is the sweet spot for photographs: typical savings of 50–70% with no difference visible on a phone screen. <strong>Quality 60%</strong> is useful for thumbnails and previews. <strong>Quality 40%</strong> is noticeably soft and only makes sense when bandwidth matters more than fidelity.'
        ) +
          p(
            'If your image is wider than roughly 2000 pixels and will only ever be viewed on a screen, limiting the maximum width to 1920 px removes pixels nobody will see. This is often the single biggest saving available and it is lossless from the viewer\'s point of view.'
          ) +
          p(
            'Converting to <strong>WebP</strong> typically produces files 25–35% smaller than JPEG at the same visual quality. WebP is supported by every current browser, so it is safe for the web; keep JPEG or PNG if the file is going somewhere that may not accept WebP.'
          )
      ),
    ],
    faq: [
      {
        q: 'Is there a file size limit?',
        a: 'Yes — 4 MB per image. Larger files are rejected before any processing starts, with a message telling you the exact size of the file you picked.',
      },
      {
        q: 'Which formats can I upload?',
        a: 'JPG, JPEG and PNG. Anything else — PDF, ZIP, EXE, SVG, GIF, WebP input, text files and so on — is rejected by both the browser and the server, which checks the real file content rather than trusting the extension.',
      },
      {
        q: 'Do you keep my images?',
        a: 'No. The upload is handled in memory, the compressed result is returned to your browser, and any temporary file is deleted immediately afterwards. Nothing appears in the site’s storage.',
      },
      {
        q: 'Why did my file get bigger?',
        a: 'That happens when the original is already heavily optimised, or when a small PNG is converted to JPEG or WebP at high quality. In that case the tool tells you and suggests either a lower quality setting or keeping the original.',
      },
      {
        q: 'Can I compress several images at once?',
        a: 'One image per run keeps the page fast and predictable. Compress the first file, download it, then press Reset to load the next one.',
      },
    ],
  });
}

/* ------------------------------------------------------------------ *
 * 2. QR Code Generator
 * ------------------------------------------------------------------ */

function qrGenerator() {
  const ui = `
          <section class="tool-panel" aria-labelledby="qr-heading">
            <h2 id="qr-heading" class="sr-only">Generate a QR code</h2>
            <form id="qrForm" novalidate>
              <div class="field">
                <label for="qrInput">Text or URL to encode</label>
                <textarea id="qrInput" name="text" rows="4" placeholder="https://example.com" aria-describedby="qr-hint" required></textarea>
                <p class="field__hint" id="qr-hint">Enter a link, plain text, an email address, a phone number or any other short content. Up to 2000 characters.</p>
              </div>

              <div class="field-row field-row--2">
                <div class="field">
                  <label for="qrSize">Image size</label>
                  <select id="qrSize" name="size">
                    <option value="256">256 × 256 px</option>
                    <option value="320" selected>320 × 320 px</option>
                    <option value="512">512 × 512 px</option>
                    <option value="800">800 × 800 px</option>
                    <option value="1024">1024 × 1024 px (print)</option>
                  </select>
                </div>
                <div class="field">
                  <label for="qrLevel">Error correction</label>
                  <select id="qrLevel" name="level">
                    <option value="L">Low (7%) — smallest file</option>
                    <option value="M" selected>Medium (15%) — recommended</option>
                    <option value="Q">Quartile (25%) — robust</option>
                    <option value="H">High (30%) — best for print</option>
                  </select>
                </div>
              </div>

              <div class="field">
                <span class="field__label">Quick examples</span>
                <div class="btn-row">
                  <button class="btn btn--soft btn--sm" type="button" data-qr-example="https://example.com">Website link</button>
                  <button class="btn btn--soft btn--sm" type="button" data-qr-example="mailto:hello@example.com">Email address</button>
                  <button class="btn btn--soft btn--sm" type="button" data-qr-example="tel:+390212345678">Phone number</button>
                  <button class="btn btn--soft btn--sm" type="button" data-qr-example="WIFI:T:WPA;S:MyNetwork;P:supersecret;;">Wi-Fi network</button>
                </div>
              </div>

              <div class="btn-row">
                <button class="btn btn--lg" type="submit" id="qrSubmit">Generate QR code</button>
                <button class="btn btn--soft" type="button" id="qrClear">Clear</button>
              </div>
              <div class="alert" id="qrAlert" hidden></div>
            </form>

            <div class="output" id="qrOutput" hidden>
              <h3>Your QR code</h3>
              <div class="qr-output">
                <img id="qrImage" alt="Generated QR code" width="320" height="320" />
              </div>
              <p class="muted" id="qrMeta"></p>
              <div class="btn-row">
                <button class="btn" type="button" id="qrDownload">${icon('download', 'icon')} Download PNG</button>
                <button class="btn btn--soft" type="button" id="qrCopyText">Copy contents</button>
              </div>
              <p class="field__hint">Scan it with any phone camera to confirm it opens the exact link you entered.</p>
            </div>
          </section>`;

  return toolShell('qr-code-generator', {
    title: 'QR Code Generator — Free QR Codes with PNG Download | ToolBox',
    description:
      'Generate a QR code from any URL, text, email address or phone number and download it as a PNG. Free, no sign-up, choose size and error correction level.',
    lede:
      'Type a link or any other short text, press Generate, and download a PNG that contains exactly what you entered. No account, no watermark, no expiry.',
    ui,
    sidebar: true,
    steps: [
      'Type or paste the content you want the QR code to contain — a link, text, email address or phone number.',
      'Pick an image size: 320 px is perfect for screens, 1024 px is better for printing.',
      'Choose an error correction level. Medium is fine for most uses; Quartile or High survives smudges and logos.',
      'Press “Generate QR code”. The code appears instantly with its contents listed underneath.',
      'Press “Download PNG” to save the image, then scan it with a phone to double-check before printing.',
    ],
    sections: [
      proseSection(
        'qr-about',
        'What is stored in a QR code?',
        p(
          'A QR code is a two-dimensional barcode that stores raw data — it does not contain a link to this website. The image you download encodes exactly the characters you typed, which is why the same code keeps working forever, wherever you host the image, and why it still works if this site is unavailable.'
        ) +
          p(
            'Because the content is stored directly in the pattern, shorter content produces a less dense grid that cameras can read from further away. A 60-character URL makes a comfortable code; 500 characters of text produces a much busier pattern that needs a closer scan. If you need to change the destination later, encode a short link you control and update the redirect instead of the QR code itself.'
          )
      ),
      proseSection(
        'qr-use',
        'Practical tips for printing',
        p(
          'For print, use a size of at least 2 × 2 cm at normal reading distance and at least 3 cm if the code will be scanned from further away. Always leave a quiet zone — a margin of white space around the code — of about four modules; the downloaded PNG already includes a white background, so keep it visible rather than cropping it tight.'
        ) +
          p(
            'Dark modules on a light background scan reliably; inverted colours often do not. Do not stretch the image out of proportion: QR readers cope with rotation but not with a non-square grid. If the code is placed on a curved or reflective surface, raise the error correction level to Quartile or High so that a partly damaged pattern is still readable.'
          ) +
          p(
            'Every code generated here is static. Nothing is measured, traced or redirected by this website.'
          )
      ),
    ],
    faq: [
      {
        q: 'Do the QR codes expire?',
        a: 'No. The content is encoded directly into the image, so the code works for as long as the destination exists — there is nothing on this server that could expire.',
      },
      {
        q: 'How much text can a QR code hold?',
        a: 'This tool accepts up to 2000 characters, which is well inside the practical limit of the QR standard. Very long content produces a dense pattern that is harder for older phones to scan, so short URLs work best.',
      },
      {
        q: 'Does the QR code keep my data private?',
        a: 'Your content is sent to this server only to render the PNG, then it is discarded. Nothing is logged in the data files and nothing is stored in a database — there is no database.',
      },
      {
        q: 'Can I print the downloaded PNG?',
        a: 'Yes. It is a normal PNG with a white background. For anything printed larger than a business card, choose 1024 px and error correction level Quartile or High.',
      },
    ],
  });
}

/* ------------------------------------------------------------------ *
 * 3. Password Generator
 * ------------------------------------------------------------------ */

function passwordGenerator() {
  const ui = `
          <section class="tool-panel" aria-labelledby="pw-heading">
            <h2 id="pw-heading" class="sr-only">Generate a password</h2>

            <div class="field">
              <label for="pwLength">Password length: <output id="pwLengthValue" for="pwLength">16</output> characters</label>
              <input type="range" id="pwLength" min="4" max="128" step="1" value="16" />
              <p class="field__hint">16 characters is a good default. Anything above 20 characters is effectively unbreakable.</p>
            </div>

            <fieldset>
              <legend>Characters to include</legend>
              <label class="check"><input type="checkbox" id="optUpper" checked /><span>Uppercase letters (A–Z)</span></label>
              <label class="check"><input type="checkbox" id="optLower" checked /><span>Lowercase letters (a–z)</span></label>
              <label class="check"><input type="checkbox" id="optNumbers" checked /><span>Numbers (0–9)</span></label>
              <label class="check"><input type="checkbox" id="optSymbols" checked /><span>Symbols (!@#$%^&amp;* …)</span></label>
              <label class="check"><input type="checkbox" id="optExcludeSimilar" /><span>Exclude look-alike characters (I, l, 1, O, 0)</span></label>
            </fieldset>

            <div class="btn-row">
              <button class="btn btn--lg" type="button" id="pwGenerate">Generate password</button>
              <button class="btn" type="button" id="pwCopy">Copy</button>
              <button class="btn btn--soft" type="button" id="pwClear">Clear</button>
            </div>

            <div class="alert" id="pwAlert" hidden></div>

            <div class="output">
              <div class="result-box">
                <span class="stat__label">Your new password</span>
                <code class="output-text" id="pwOutput" aria-live="polite"></code>
              </div>
              <div class="progress" aria-hidden="true"><div class="progress__bar" id="pwStrengthBar"></div></div>
              <p class="muted"><strong>Strength:</strong> <span id="pwStrengthText">—</span> — <span id="pwEntropy">Enable at least one character type to generate a password.</span></p>
            </div>
          </section>

          <section class="tool-panel" aria-labelledby="pw-history-heading">
            <h2 id="pw-history-heading">Recently generated</h2>
            <p class="field__hint">Kept in this page only — nothing is stored on the server, and the list is emptied when you reload or clear it.</p>
            <ul class="stack" id="pwHistory" style="list-style:none;padding:0;margin:0"></ul>
          </section>`;

  return toolShell('password-generator', {
    title: 'Password Generator — Create Strong Random Passwords | ToolBox',
    description:
      'Generate strong random passwords in your browser. Choose the length and character types, check the strength meter and copy with one click. Nothing is sent to a server.',
    lede:
      'Create a strong random password with a length slider and full control over letters, numbers and symbols. Everything happens inside your browser using the Web Crypto API.',
    ui,
    sidebar: true,
    steps: [
      'Drag the length slider — 16 characters is a sensible default for everyday accounts.',
      'Enable or disable uppercase letters, lowercase letters, numbers and symbols as the site requires.',
      'Press “Generate password”. At least one character from every enabled group is guaranteed.',
      'Check the strength meter, then press Copy and paste the password into your password manager.',
      'Press Clear when you are finished so the password is not left on screen.',
    ],
    sections: [
      proseSection(
        'pw-security',
        'Why these passwords are safe to use',
        p(
          'Passwords are produced with <strong>window.crypto.getRandomValues()</strong>, the browser\'s cryptographically secure random number generator. Unlike a typical <code>Math.random()</code> implementation, its output is not predictable from previous values, so nobody can work out the next password by watching earlier ones.'
        ) +
          p(
            'Virtually all password advice reduces to two things: length and unpredictability. A 16-character password from a 90-character alphabet has roughly 104 bits of entropy — far beyond what brute force can reach — while <em>Summer2024!</em> has very little entropy even though it looks complicated, because it follows a pattern that cracking tools try first.'
          ) +
          p(
            'Because generation happens entirely in your browser, the password is never transmitted, never logged and never stored. The “Recently generated” list exists only in this page and disappears on reload.'
          )
      ),
      proseSection(
        'pw-practice',
        'Getting the most out of generated passwords',
        p(
          'Never reuse a password across sites: when one service is breached, attackers immediately try the same address and password everywhere else. Generate a separate password for every account and let a password manager remember them.'
        ) +
          p(
            'Not every site deserves the same treatment. You can shorten to 12 characters for a forum you rarely use, while banking and email accounts deserve 20 characters or more with symbols enabled — those two accounts are the keys to everything else, because email is where password resets land.'
          ) +
          p(
            'If a site rejects symbols, turn them off rather than giving up on length: a 24-character alphanumeric password is stronger than a 12-character one with symbols. And when a service offers two-factor authentication, switch it on — it protects you even if the password itself leaks.'
          )
      ),
    ],
    faq: [
      {
        q: 'Are these passwords truly random?',
        a: 'Yes. They come from the browser’s cryptographic random generator, not from a pattern, a word list or a formula that could be reproduced.',
      },
      {
        q: 'Is my password sent to your server?',
        a: 'No. The generator runs entirely in your browser. This site never receives, stores or logs the passwords you create.',
      },
      {
        q: 'What happens if I switch off every character type?',
        a: 'The tool refuses to generate anything and shows a clear message asking you to enable at least one character type, because an empty alphabet cannot produce a password.',
      },
      {
        q: 'How long should my password be?',
        a: 'Use at least 12 characters for everyday accounts and 20 or more for email, banking and work accounts. Length matters more than complexity.',
      },
    ],
  });
}

/* ------------------------------------------------------------------ *
 * 4. Word Counter
 * ------------------------------------------------------------------ */

function wordCounter() {
  const ui = `
          <section class="tool-panel" aria-labelledby="wc-heading">
            <h2 id="wc-heading" class="sr-only">Paste your text</h2>
            <div class="field">
              <label for="wcInput">Your text</label>
              <textarea id="wcInput" rows="10" placeholder="Start typing or paste your text here…" aria-describedby="wc-help"></textarea>
              <p class="field__hint" id="wc-help">Counts update as you type. Nothing is uploaded — the text stays in your browser.</p>
            </div>
            <div class="btn-row">
              <button class="btn btn--soft" type="button" id="wcCopy">Copy text</button>
              <button class="btn btn--soft" type="button" id="wcClear">Clear</button>
            </div>
            <div class="alert" id="wcAlert" hidden></div>
          </section>

          <section class="tool-panel" aria-labelledby="wc-stats-heading">
            <h2 id="wc-stats-heading">Statistics</h2>
            <div class="result-grid" aria-live="polite">
              <div class="stat"><span class="stat__label">Words</span><span class="stat__value" id="wcWords">0</span></div>
              <div class="stat"><span class="stat__label">Characters</span><span class="stat__value" id="wcChars">0</span></div>
              <div class="stat"><span class="stat__label">Characters (no spaces)</span><span class="stat__value" id="wcCharsNoSpaces">0</span></div>
              <div class="stat"><span class="stat__label">Sentences</span><span class="stat__value" id="wcSentences">0</span></div>
              <div class="stat"><span class="stat__label">Paragraphs</span><span class="stat__value" id="wcParagraphs">0</span></div>
              <div class="stat"><span class="stat__label">Non-empty lines</span><span class="stat__value" id="wcLines">0</span></div>
            </div>

            <h3 style="margin-top:1.5rem">Reading and speaking time</h3>
            <dl class="metric-list">
              <div><dt>Reading time (200 wpm)</dt><dd id="wcReadTime">0 min</dd></div>
              <div><dt>Speaking time (130 wpm)</dt><dd id="wcSpeakTime">0 min</dd></div>
              <div><dt>Average sentence length</dt><dd id="wcAvgWords">0 words</dd></div>
              <div><dt>Longest word</dt><dd id="wcLongest">—</dd></div>
            </dl>

            <h3 style="margin-top:1.5rem">Most frequent words</h3>
            <ul id="wcTopWords" class="stack" style="list-style:none;padding:0;margin:0"></ul>
          </section>`;

  return toolShell('word-counter', {
    title: 'Word Counter — Count Words, Characters & Reading Time | ToolBox',
    description:
      'Free online word counter. Count words, characters with and without spaces, sentences, paragraphs, lines, reading time and the most frequent words as you type.',
    lede:
      'Paste or type your text and watch every figure update live: words, characters, characters without spaces, sentences, paragraphs, lines, reading time and more.',
    ui,
    sidebar: true,
    steps: [
      'Paste your text into the box, or simply start typing.',
      'Watch the counters update instantly — no button to press.',
      'Use the reading and speaking time estimates to plan an article, video script or presentation.',
      'Check the most frequent words to catch unintended repetition in your writing.',
      'Press Clear to start with a fresh document; Copy text puts the whole text on your clipboard.',
    ],
    sections: [
      proseSection(
        'wc-how',
        'How each count is calculated',
        p(
          '<strong>Words</strong> are runs of non-whitespace characters, so “well-known” counts as one word and double spaces never inflate the total. <strong>Characters</strong> counts everything in the box including spaces and line breaks, while <strong>characters without spaces</strong> removes every whitespace character — the figure that matters for forms with a strict character limit.'
        ) +
          p(
            '<strong>Sentences</strong> are counted by splitting on full stops, question marks and exclamation marks, including those immediately followed by a closing quote or bracket. <strong>Paragraphs</strong> are runs of text separated by a blank line, and <strong>lines</strong> counts only lines that actually contain text, ignoring empty ones.'
          ) +
          p(
            'Reading time assumes 200 words per minute, the average for adult readers working through ordinary prose; speaking time assumes 130 words per minute, a normal conversational pace. Both are estimates — technical content is read more slowly, dialogue may be faster.'
          )
      ),
      proseSection(
        'wc-limits',
        'Common word and character limits',
        p(
          'Different platforms measure in different ways, which is why showing several counts at once is useful.'
        ) +
          '<div class="table-wrap"><table><caption class="sr-only">Common content limits and the figure they use</caption><thead><tr><th scope="col">Where</th><th scope="col">Limit</th><th scope="col">Counted as</th></tr></thead><tbody>' +
          '<tr><td>Meta description (Search)</td><td>~155 characters</td><td>Characters</td></tr>' +
          '<tr><td>Title tag</td><td>~60 characters</td><td>Characters</td></tr>' +
          '<tr><td>X / Twitter post</td><td>280 characters</td><td>Characters (links shortened)</td></tr>' +
          '<tr><td>Instagram caption</td><td>2,200 characters</td><td>Characters</td></tr>' +
          '<tr><td>LinkedIn post</td><td>3,000 characters</td><td>Characters</td></tr>' +
          '<tr><td>Standard blog post</td><td>800–1,500 words</td><td>Words</td></tr>' +
          '<tr><td>University essay</td><td>1,500–5,000 words</td><td>Words</td></tr>' +
          '</tbody></table></div>' +
          p(
            'If you are writing for search engines, aim for the point where the idea is complete rather than a target count: thin pages are penalised and padded pages read badly.'
          )
      ),
    ],
    faq: [
      {
        q: 'Does the word counter send my text anywhere?',
        a: 'No. Counting happens entirely in your browser with JavaScript. The text you paste never leaves your device.',
      },
      {
        q: 'How do you count words in languages without spaces?',
        a: 'The counter splits on whitespace, which suits languages such as English, Spanish or German. For Chinese, Japanese or Thai, the character count is the meaningful figure — it is displayed separately.',
      },
      {
        q: 'Why does my word processor show a different total?',
        a: 'Different tools handle hyphenated words, numbers and symbols differently. Both figures are defensible; this counter uses the common definition of whitespace-separated tokens.',
      },
      {
        q: 'Is there a limit on the amount of text?',
        a: 'There is no enforced limit. Because counting runs locally, very long documents — tens of thousands of words — are processed as fast as your device can type.',
      },
    ],
  });
}

/* ------------------------------------------------------------------ *
 * 5. JSON Formatter & Validator
 * ------------------------------------------------------------------ */

function jsonFormatter() {
  const ui = `
          <section class="tool-panel" aria-labelledby="json-heading">
            <h2 id="json-heading" class="sr-only">Paste JSON</h2>
            <div class="field">
              <label for="jsonInput">JSON input</label>
              <textarea id="jsonInput" rows="12" spellcheck="false" placeholder='{"example": true, "items": [1, 2, 3]}' aria-describedby="json-help"></textarea>
              <p class="field__hint" id="json-help">Paste minified, pretty-printed or broken JSON. Press Ctrl/Cmd + Enter to format quickly. Nothing is sent to the server.</p>
            </div>

            <div class="field-row field-row--2">
              <div class="field">
                <label for="jsonIndent">Indentation</label>
                <select id="jsonIndent">
                  <option value="2" selected>2 spaces</option>
                  <option value="4">4 spaces</option>
                  <option value="tab">Tab</option>
                  <option value="0">Minified (no indentation)</option>
                </select>
              </div>
              <div class="field">
                <span class="field__label">Options</span>
                <label class="check"><input type="checkbox" id="jsonSortKeys" /><span>Sort object keys alphabetically</span></label>
              </div>
            </div>

            <div class="btn-row">
              <button class="btn" type="button" id="jsonFormat" data-action="format">Format / beautify</button>
              <button class="btn btn--soft" type="button" id="jsonMinify" data-action="minify">Minify</button>
              <button class="btn btn--soft" type="button" id="jsonValidate" data-action="validate">Validate only</button>
              <button class="btn btn--soft" type="button" id="jsonSample">Load sample</button>
            </div>
            <div class="alert" id="jsonAlert" hidden></div>
          </section>

          <section class="tool-panel" aria-labelledby="json-output-heading">
            <h2 id="json-output-heading">Result</h2>
            <div class="btn-row" style="margin-bottom:1rem">
              <button class="btn btn--sm" type="button" id="jsonCopy">Copy result</button>
              <button class="btn btn--soft btn--sm" type="button" id="jsonDownload">Download .json</button>
              <button class="btn btn--soft btn--sm" type="button" id="jsonClear">Clear everything</button>
            </div>
            <pre id="jsonOutput" tabindex="0" aria-live="polite" aria-label="Formatted JSON output"></pre>

            <h3 style="margin-top:1.5rem">Structure summary</h3>
            <dl class="metric-list" id="jsonStats">
              <div><dt>Keys</dt><dd>0</dd></div>
              <div><dt>Arrays</dt><dd>0</dd></div>
              <div><dt>Values</dt><dd>0</dd></div>
              <div><dt>Depth</dt><dd>0</dd></div>
            </dl>
          </section>`;

  return toolShell('json-formatter', {
    title: 'JSON Formatter & Validator — Beautify, Minify, Validate | ToolBox',
    description:
      'Format, minify and validate JSON online. Get readable indented output or a clear error message with the exact line and column. Everything runs in your browser.',
    lede:
      'Paste any JSON — valid or broken — and get it formatted, minified or checked. Invalid input produces a plain-English error with the line and column where parsing stopped.',
    ui,
    sidebar: true,
    steps: [
      'Paste your JSON into the input box — it does not matter whether it is minified or already indented.',
      'Choose an indentation style, and tick “Sort object keys” if you want predictable key order.',
      'Press “Format / beautify” for readable output, “Minify” to remove all optional whitespace, or “Validate only” to check without changing anything.',
      'If the JSON is invalid, the alert shows the reason and the position; the offending line is selected in the input box.',
      'Use “Copy result” or “Download .json” to take the output with you.',
    ],
    sections: [
      proseSection(
        'json-about',
        'What each action does',
        p(
          '<strong>Format</strong> parses the JSON and re-serialises it with the indentation you choose, which makes nested structures readable and diff-friendly. <strong>Minify</strong> removes every optional space, tab and newline, producing the smallest valid representation — useful when a payload has to be pasted into a form or a config field. <strong>Validate only</strong> parses and re-formats the output without touching your input, so you can check a snippet without losing your place.'
        ) +
          p(
            'Parsing uses the browser\'s built-in <code>JSON.parse()</code>. That function never executes code, which is why <code>eval()</code> — the classic security hole in JSON tooling — is not used anywhere in this project. Duplicate keys keep the last value, as the JSON specification requires, and <code>NaN</code>, comments, trailing commas and single-quoted strings are all rejected because they are not legal JSON.'
          )
      ),
      proseSection(
        'json-errors',
        'Reading the error messages',
        p(
          'When parsing fails the tool reports the reason and translates the parser position into a line and column number, then selects that line in the input box so you can see it immediately. Typical messages include “Unexpected token }” for a stray comma before a closing brace, “Unexpected end of JSON input” for a truncated payload, and “Expected property name or ’}’” when a key is missing its quotes.'
        ) +
          p(
            'Two failure patterns are worth memorising. Single quotes are not valid JSON: replace <code>\'key\'</code> with <code>"key"</code>. A trailing comma after the final item of an object or array — perfectly legal in JavaScript — is a syntax error in JSON and is the single most common cause of a failed API request.'
          ) +
          p(
            'The structure summary below the output counts keys, arrays, scalar values and the nesting depth. It is a quick way to confirm that a payload contains everything you expect.'
          )
      ),
    ],
    faq: [
      {
        q: 'Is there a size limit for the JSON I paste?',
        a: 'No hard limit. Because formatting happens in your browser, the practical limit is your device’s memory — files of several megabytes are handled without trouble.',
      },
      {
        q: 'Can this tool read JSON with comments?',
        a: 'Standard JSON does not allow comments, so they are reported as errors. If you are working with JSON5 or JSONC configuration files, remove the comments first.',
      },
      {
        q: 'Do I need to worry about security when pasting JSON?',
        a: 'No code is executed at any point. The input is parsed as data with JSON.parse(), never evaluated, and it is not uploaded anywhere.',
      },
      {
        q: 'Why does the output number lose precision?',
        a: 'JavaScript represents all numbers as double-precision floats, so integers beyond 2^53 lose precision — a language limitation. Keep such values quoted as strings if they must stay exact.',
      },
    ],
  });
}

module.exports = {
  imageCompressor,
  qrGenerator,
  passwordGenerator,
  wordCounter,
  jsonFormatter,
  toolShell,
  proseSection,
  p,
};
