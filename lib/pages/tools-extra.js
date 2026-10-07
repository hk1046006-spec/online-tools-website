'use strict';

/**
 * Tool pages 6–10 plus the /tools index.
 */

const { TOOLS } = require('../tools');
const t = require('../templates');
const { escapeHtml: e, icon, adSlot, breadcrumbs, toolGrid, relatedToolsBlock, faqBlock, howToUse, layout } = t;
const { toolShell, proseSection, p } = require('./tools');

/* ------------------------------------------------------------------ *
 * 6. Color Picker & Converter
 * ------------------------------------------------------------------ */

function colorPicker() {
  const swatches = ['#2f6fed', '#0f7a45', '#b42318', '#8a5a00', '#6b21a8', '#0e7490', '#111827', '#f8fafc']
    .map(
      (hex) =>
        `<button type="button" class="swatch" data-preset="${hex}" style="background:${hex}" aria-label="Use colour ${hex}"></button>`
    )
    .join('\n                  ');

  const ui = `
          <section class="tool-panel" aria-labelledby="color-heading">
            <h2 id="color-heading" class="sr-only">Pick a colour</h2>

            <div class="field-row field-row--2">
              <div class="field">
                <label for="colorPicker">Pick a colour</label>
                <input type="color" id="colorPicker" value="#2f6fed" aria-describedby="color-help" />
                <p class="field__hint" id="color-help">Use the native picker, or type a HEX value by hand below.</p>
              </div>
              <div class="field">
                <label for="hexInput">HEX value</label>
                <div class="input-group">
                  <input type="text" id="hexInput" value="#2F6FED" spellcheck="false" autocomplete="off" inputmode="text" placeholder="#2f6fed" aria-describedby="hex-help" />
                  <button class="btn btn--soft" type="button" data-copy-field="hexInput">Copy</button>
                </div>
                <p class="field__hint" id="hex-help">Accepts #rgb or #rrggbb, with or without the leading hash.</p>
              </div>
            </div>

            <div class="field">
              <span class="field__label">Preset colours</span>
              <div class="swatch-row" id="presetSwatches">
                  ${swatches}
              </div>
            </div>

            <div class="alert" id="colorAlert" hidden></div>
          </section>

          <section class="tool-panel" aria-labelledby="color-result-heading">
            <h2 id="color-result-heading">Conversions</h2>
            <div class="color-preview" id="colorPreview" style="background:#2f6fed" role="img" aria-label="Preview of the selected colour">
              <span class="color-preview__label" id="colorPreviewLabel">#2F6FED</span>
            </div>

            <div class="field-row field-row--2" style="margin-top:1rem">
              <div class="field">
                <label for="rgbInput">RGB</label>
                <div class="input-group">
                  <input type="text" id="rgbInput" value="rgb(47, 111, 237)" spellcheck="false" autocomplete="off" />
                  <button class="btn btn--soft" type="button" data-copy-field="rgbInput">Copy</button>
                </div>
              </div>
              <div class="field">
                <label for="hslInput">HSL</label>
                <div class="input-group">
                  <input type="text" id="hslInput" value="hsl(220, 84%, 56%)" spellcheck="false" autocomplete="off" />
                  <button class="btn btn--soft" type="button" data-copy-field="hslInput">Copy</button>
                </div>
              </div>
            </div>

            <div class="table-wrap" style="margin-top:1rem">
              <table>
                <caption class="sr-only">All colour representations of the selected colour, each with a copy button</caption>
                <thead>
                  <tr><th scope="col">Format</th><th scope="col">Value</th><th scope="col">Action</th></tr>
                </thead>
                <tbody id="colorTableBody"></tbody>
              </table>
            </div>

            <h3 style="margin-top:1.5rem">Accessibility check</h3>
            <dl class="metric-list" id="colorContrast"></dl>

            <div class="btn-row" style="margin-top:1rem">
              <button class="btn btn--soft" type="button" id="colorClear">Reset to default colour</button>
            </div>
          </section>`;

  return toolShell('color-picker', {
    title: 'Color Picker & Converter — HEX, RGB, HSL Codes | ToolBox',
    description:
      'Pick any colour and instantly get its HEX, RGB and HSL values. Type a HEX code manually, check contrast ratios and copy each format with one click.',
    lede:
      'Choose a colour with the native picker or type a HEX code, and read the exact HEX, RGB and HSL values — plus a contrast check against white and black text.',
    ui,
    sidebar: true,
    steps: [
      'Click the large colour field to open your system colour picker, or type a HEX value such as #2f6fed.',
      'Watch the preview, the RGB and the HSL values update immediately as you adjust the colour.',
      'Use the Copy button next to any value to put it on your clipboard in the exact format you need.',
      'Check the accessibility panel to see whether white or black text is the better match for this colour as a background.',
      'Press “Reset to default colour” to start over from a neutral blue.',
    ],
    sections: [
      proseSection(
        'color-formats',
        'HEX, RGB and HSL explained',
        p(
          '<strong>HEX</strong> is simply RGB written in base 16: <code>#2F6FED</code> means red 0x2F (47), green 0x6F (111) and blue 0xED (237). The shorthand form <code>#RGB</code> collapses each pair to one digit, so <code>#09F</code> is the same as <code>#0099FF</code>. It is the format most design tools export and the most compact to type.'
        ) +
          p(
            '<strong>RGB</strong> lists the three channels on a 0–255 scale. It is the format JavaScript and canvas code expect, and the one to use when you need to mix channels programmatically. <strong>HSL</strong> describes the same colour as hue (0–360°), saturation and lightness (both 0–100%), which is far easier to reason about when building a palette: keep the hue and adjust lightness to produce consistent shades and tints.'
          ) +
          p(
            'One caveat worth knowing: the RGB and HSL values shown are the closest whole-number representations, so converting HSL → RGB → HSL can shift a value by one. For CSS, prefer keeping the format you started with rather than round-tripping.'
          )
      ),
      proseSection(
        'color-accessibility',
        'Choosing readable colours',
        p(
          'Contrast is measured as a ratio between 1:1 (identical colours) and 21:1 (black on white). The Web Content Accessibility Guidelines require at least <strong>4.5:1</strong> for normal body text and <strong>3:1</strong> for large text (roughly 24 px, or 19 px bold). The accessibility panel shows the ratio against both white and black, so you can see immediately whether your chosen colour works as a background.'
        ) +
          p(
            'Never rely on colour alone to convey meaning. A red asterisk, a green “success” label or a coloured-only status dot is invisible to people with colour vision deficiency — around 8% of men. Pair colour with text, an icon or a pattern. If your brand palette fails contrast, darken or lighten the same hue rather than switching hue, which keeps the palette recognisable.'
          )
      ),
    ],
    faq: [
      {
        q: 'What happens if I type an invalid HEX code?',
        a: 'The field is marked as invalid, the conversion is left untouched and a message explains the expected format. Values that cannot be parsed are never shown as “NaN” or “undefined”.',
      },
      {
        q: 'Are the conversions rounded?',
        a: 'Yes, to the nearest whole number, which is how CSS writes colours. The rounding error is at most half a unit per channel — invisible in practice.',
      },
      {
        q: 'Can I use the output in CSS directly?',
        a: 'Yes. Copy the HEX, RGB or HSL value and paste it into your stylesheet. The table also offers a ready-made CSS custom property declaration.',
      },
      {
        q: 'Does this tool upload anything?',
        a: 'No. Colours are converted in your browser and nothing is transmitted to the server.',
      },
    ],
  });
}

/* ------------------------------------------------------------------ *
 * 7. Unit Converter
 * ------------------------------------------------------------------ */

function unitConverter() {
  const ui = `
          <section class="tool-panel" aria-labelledby="unit-heading">
            <h2 id="unit-heading" class="sr-only">Convert units</h2>

            <div class="field">
              <label for="unitCategory">Category</label>
              <select id="unitCategory">
                <option value="length" selected>Length / distance</option>
                <option value="weight">Weight / mass</option>
                <option value="temperature">Temperature</option>
              </select>
            </div>

            <div class="field-row field-row--2">
              <div class="field">
                <label for="unitFrom">From</label>
                <select id="unitFrom"></select>
              </div>
              <div class="field">
                <label for="unitTo">To</label>
                <select id="unitTo"></select>
              </div>
            </div>

            <div class="field">
              <label for="unitInput">Value</label>
              <input type="text" id="unitInput" inputmode="decimal" value="1" autocomplete="off" spellcheck="false" aria-describedby="unit-help" />
              <p class="field__hint" id="unit-help">Decimals and negative numbers are supported (try −40 for Celsius to Fahrenheit).</p>
            </div>

            <div class="btn-row">
              <button class="btn btn--soft" type="button" id="unitSwap">${icon('swap', 'icon')} Swap units</button>
              <button class="btn btn--soft" type="button" id="unitCopy">Copy result</button>
              <button class="btn btn--soft" type="button" id="unitClear">Clear</button>
            </div>

            <div class="alert" id="unitAlert" hidden></div>

            <div class="output">
              <div class="result-box">
                <span class="stat__label">Result</span>
                <span class="stat__value" id="unitOutput">—</span>
                <p class="muted" id="unitFormula" style="margin:0.4rem 0 0">Enter a value above to convert it instantly.</p>
              </div>
            </div>
          </section>

          <section class="tool-panel" aria-labelledby="unit-table-heading">
            <h2 id="unit-table-heading">Common conversions</h2>
            <div class="table-wrap">
              <table id="unitQuickTable"></table>
            </div>
          </section>`;

  return toolShell('unit-converter', {
    title: 'Unit Converter — Length, Weight & Temperature | ToolBox',
    description:
      'Free unit converter for length (mm, cm, m, km, inch, foot, yard, mile), weight (mg, g, kg, ounce, pound) and temperature (Celsius, Fahrenheit, Kelvin).',
    lede:
      'Convert length, weight and temperature in real time. Pick the units, type a value and read the result — the formula used is shown underneath so you can check it.',
    ui,
    sidebar: true,
    steps: [
      'Choose a category: length, weight or temperature.',
      'Select the unit you are converting from and the unit you want to convert to.',
      'Type the value — the result updates as you type, including decimals and negative numbers.',
      'Press “Swap units” to flip the direction of the conversion, or “Copy result” to save the full sentence.',
      'Use the “Common conversions” table to sanity-check results such as 1 inch = 2.54 cm or 100 °C = 212 °F.',
    ],
    sections: [
      proseSection(
        'unit-accuracy',
        'Exact conversion factors',
        p(
          'Length and weight conversions use the internationally agreed definitions: an inch is exactly <strong>0.0254 m</strong>, a foot is 12 inches, a yard is 3 feet, a mile is exactly <strong>1609.344 m</strong>, a pound is exactly <strong>0.45359237 kg</strong> and an ounce is one sixteenth of a pound. Because these definitions are exact, converting from one unit to its inverse returns precisely the original value.'
        ) +
          p(
            'Temperature is different in kind: the three scales have different zero points rather than just different sizes. The tool therefore converts through Celsius as a common base — <code>°C = (°F − 32) × 5/9</code> and <code>K = °C + 273.15</code>. Negative values, zero and decimals are all handled by the same code path, so −40 °C correctly returns −40 °F, the one point where the two scales meet.'
          )
      ),
      proseSection(
        'unit-tips',
        'When conversions trip people up',
        p(
          'The most common mistake is confusing mass with force. A “200 kg” reading on a bathroom scale is a mass; the weight in newtons would be about 1962 N at sea level, and would change at altitude or on the Moon. In everyday contexts, including this tool, “weight” means mass.'
        ) +
          p(
            'Similarly, the US and UK fluid measures differ historically, but the <em>weight</em> units shown here — ounce and pound — are the same in both countries. Length too: a US survey foot differs from the international foot by about two parts per million, which is why surveying conversions may not match this tool exactly.'
          ) +
          p(
            'If you are cooking, note that a US cup is 236.6 ml and a metric cup is 250 ml — a reminder that this converter covers length, weight and temperature only, not volume.'
          )
      ),
    ],
    faq: [
      {
        q: 'How accurate are the results?',
        a: 'Conversions use the exact international definitions of each unit and are displayed with up to nine significant figures for small values, which is far more precise than any practical measurement.',
      },
      {
        q: 'Does it handle negative temperatures?',
        a: 'Yes. Negative values, zero and decimals all work — for example −40 °C equals −40 °F, and −273.15 °C equals 0 K.',
      },
      {
        q: 'Why is the result sometimes shown in scientific notation?',
        a: 'Extremely large or small results (beyond 10¹² or below 10⁻⁹) are shown in scientific notation so that the digits stay readable and the layout cannot overflow.',
      },
      {
        q: 'Can I convert between categories, such as kilograms to litres?',
        a: 'No, and no tool can without extra information: mass and volume are different quantities. Converting kg to litres requires the density of the specific substance.',
      },
    ],
  });
}

/* ------------------------------------------------------------------ *
 * 8. Age Calculator
 * ------------------------------------------------------------------ */

function ageCalculator() {
  const ui = `
          <section class="tool-panel" aria-labelledby="age-heading">
            <h2 id="age-heading" class="sr-only">Calculate an age</h2>
            <form id="ageForm" novalidate>
              <div class="field-row field-row--2">
                <div class="field">
                  <label for="birthDate">Date of birth</label>
                  <input type="date" id="birthDate" name="birthDate" required aria-describedby="age-help" />
                  <p class="field__hint" id="age-help">Pick the date from the calendar, or type it in yyyy-mm-dd form.</p>
                </div>
                <div class="field">
                  <label for="asOfDate">Calculate age as of</label>
                  <input type="date" id="asOfDate" name="asOfDate" />
                  <p class="field__hint">Leave as today, or set another date to find an age in the past or future.</p>
                </div>
              </div>

              <div class="field">
                <span class="field__label">Examples</span>
                <div class="btn-row">
                  <button class="btn btn--soft btn--sm" type="button" data-birth-example="1990-01-01">1 Jan 1990</button>
                  <button class="btn btn--soft btn--sm" type="button" data-birth-example="2000-02-29">29 Feb 2000 (leap day)</button>
                  <button class="btn btn--soft btn--sm" type="button" data-birth-example="2024-12-31">31 Dec 2024</button>
                </div>
              </div>

              <div class="btn-row">
                <button class="btn btn--lg" type="submit">Calculate age</button>
              </div>
              <div class="alert" id="ageAlert" hidden></div>
            </form>
          </section>

          <section class="tool-panel" id="ageResults" hidden aria-labelledby="age-result-heading" aria-live="polite">
            <h2 id="age-result-heading">Result</h2>

            <div class="result-grid">
              <div class="stat"><span class="stat__label">Years</span><span class="stat__value" id="ageYears">0</span></div>
              <div class="stat"><span class="stat__label">Months</span><span class="stat__value" id="ageMonths">0</span></div>
              <div class="stat"><span class="stat__label">Days</span><span class="stat__value" id="ageDays">0</span></div>
            </div>

            <p class="note" id="ageSummary" style="margin-top:1rem"></p>

            <h3 style="margin-top:1.5rem">Totals and extras</h3>
            <dl class="metric-list">
              <div><dt>Total months</dt><dd id="ageTotalMonths">0</dd></div>
              <div><dt>Total weeks</dt><dd id="ageTotalWeeks">0</dd></div>
              <div><dt>Total days</dt><dd id="ageTotalDays">0</dd></div>
              <div><dt>Total hours</dt><dd id="ageTotalHours">0</dd></div>
              <div><dt>Total minutes</dt><dd id="ageTotalMinutes">0</dd></div>
              <div><dt>Born on a</dt><dd id="ageBornWeekday">—</dd></div>
              <div><dt>Next birthday</dt><dd id="ageNextBirthday">—</dd></div>
              <div><dt>Star sign</dt><dd id="ageZodiac">—</dd></div>
            </dl>
            <p class="muted" id="ageNextBirthdayWeekday"></p>
          </section>`;

  return toolShell('age-calculator', {
    title: 'Age Calculator — Exact Age in Years, Months & Days | ToolBox',
    description:
      'Calculate an exact age in years, months and days from any date of birth, with totals in weeks, days, hours and minutes. Handles leap years and future dates.',
    lede:
      'Enter a date of birth and get the precise age in years, months and days — plus totals in weeks, days, hours and minutes, the day of the week and the next birthday.',
    ui,
    sidebar: true,
    steps: [
      'Choose the date of birth in the first field.',
      'Leave “Calculate age as of” at today, or set a different reference date.',
      'Press “Calculate age” — the result appears immediately in years, months and days.',
      'Read the totals below for the same period in weeks, days, hours and minutes.',
      'Check the next birthday line to see when the age increases and how many days away it is.',
    ],
    sections: [
      proseSection(
        'age-maths',
        'How the age maths works',
        p(
          'The calculation is a proper calendar difference, not an approximation based on 365.25 days. Years and months are subtracted first; if the day of the month is earlier in the reference month than in the birth month, one month is borrowed and its real length — 28, 29, 30 or 31 days — is added to the day count. That is what makes 31 January to 1 March come out as 1 month and 1 day instead of a nonsensical 29 days.'
        ) +
          p(
            'Leap years are handled by the calendar itself: someone born on 29 February 2000 is 24 years old on 29 February 2024, and in non-leap years the next-birthday line falls back to 28 February, the convention most legal systems use.'
          ) +
          p(
            'All arithmetic runs on UTC dates, so daylight-saving transitions can never shift a result by a day — a real bug in tools that use local timestamps.'
          )
      ),
      proseSection(
        'age-uses',
        'What people use an age calculator for',
        p(
            'Beyond simple curiosity, an exact age is needed to complete forms — many require age in years, months and days rather than a date of birth. Parents tracking a baby’s development milestones work in months and weeks, where the difference between “11 months” and “1 year” matters.'
        ) +
          p(
            'It is equally useful for checking dates: superannuation, insurance and retirement rules are usually expressed as “age attained”, visa applications often have an age cut-off on a specific date, and paediatric medication doses depend on age in months. Setting the reference date lets you calculate the exact age someone will be on a future deadline.'
          ) +
          p(
            'The tool also reports the weekday you were born on, which is a quick way to verify a remembered date of birth.'
          )
      ),
    ],
    faq: [
      {
        q: 'Can I use a future date of birth?',
        a: 'No. If the birth date is after the reference date the tool refuses and explains why, because a negative age is meaningless. This also catches typos such as entering the current year instead of the birth year.',
      },
      {
        q: 'How is a 29 February birthday handled?',
        a: 'In leap years the birthday is 29 February. In other years, the next-birthday calculation uses 28 February, following the common legal convention.',
      },
      {
        q: 'Is the age in months and days always what I would count by hand?',
        a: 'Yes. Months are borrowed at their true length, so the result matches counting on a calendar rather than assuming 30-day months.',
      },
      {
        q: 'Is my date of birth sent anywhere?',
        a: 'No. The calculation runs entirely in your browser, and the date is never transmitted to this server or stored anywhere.',
      },
    ],
  });
}

/* ------------------------------------------------------------------ *
 * 9. URL Encoder / Decoder
 * ------------------------------------------------------------------ */

function urlEncoder() {
  const ui = `
          <section class="tool-panel" aria-labelledby="url-heading">
            <h2 id="url-heading" class="sr-only">Encode or decode a URL</h2>

            <div class="field">
              <label for="urlInput">Text or URL</label>
              <textarea id="urlInput" rows="5" spellcheck="false" placeholder="https://example.com/search?q=hello world&amp;lang=en" aria-describedby="url-help"></textarea>
              <p class="field__hint" id="url-help">Paste a link to encode it, or paste percent-encoded text to decode it. Ctrl/Cmd + Enter encodes.</p>
            </div>

            <div class="field">
              <span class="field__label">Examples</span>
              <div class="btn-row">
                <button class="btn btn--soft btn--sm" type="button" data-url-example="https://example.com/search?q=hello world&lang=en">Search URL with a space</button>
                <button class="btn btn--soft btn--sm" type="button" data-url-example="café & crème — 100%">Accented text</button>
                <button class="btn btn--soft btn--sm" type="button" data-url-example="https%3A%2F%2Fexample.com%2Fsearch%3Fq%3Dhello%20world%26lang%3Den">Encoded example (for decoding)</button>
              </div>
            </div>

            <div class="btn-row">
              <button class="btn" type="button" id="urlEncode" data-action="encode">Encode (component)</button>
              <button class="btn btn--soft" type="button" id="urlEncodeFull" data-action="full">Encode whole URL</button>
              <button class="btn btn--soft" type="button" id="urlDecode" data-action="decode">Decode</button>
              <button class="btn btn--soft" type="button" id="urlCopy">Copy result</button>
              <button class="btn btn--soft" type="button" id="urlClear">Clear</button>
            </div>

            <div class="alert" id="urlAlert" hidden></div>
          </section>

          <section class="tool-panel" aria-labelledby="url-result-heading">
            <h2 id="url-result-heading">Result</h2>
            <p class="muted" id="urlMode"></p>
            <pre id="urlOutput" tabindex="0" aria-live="polite" aria-label="Encoded or decoded result"></pre>
            <div id="urlBreakdown" hidden style="margin-top:1rem"></div>
            <div id="urlQueryResult" hidden style="margin-top:1rem"></div>
          </section>`;

  return toolShell('url-encoder', {
    title: 'URL Encoder / Decoder — Percent Encoding Tool | ToolBox',
    description:
      'Encode text and URLs with encodeURIComponent or decode percent-encoded strings safely. Clear error messages for malformed input. Runs in your browser.',
    lede:
      'Convert text to safe percent-encoded URLs, or turn an encoded string back into readable text. The result is shown with an explanation of every character that had to be escaped.',
    ui,
    sidebar: true,
    steps: [
      'Paste the text or URL you want to process into the input box.',
      'Press “Encode (component)” to escape every reserved character — the right choice for a single query value.',
      'Press “Encode whole URL” when you already have a full address and want to keep :// / ? & # intact.',
      'Press “Decode” to turn percent-encoded text back into readable characters.',
      'Use “Copy result” and check the breakdown table to see exactly what each escape sequence represents.',
    ],
    sections: [
      proseSection(
        'url-about',
        'Why URLs need encoding',
        p(
          'A URL may only contain a limited set of characters. Spaces, accented letters, quotes, ampersands, hashes and characters such as <code>?</code> and <code>&</code> all have special meanings, so they must be replaced by a percent sign followed by the hexadecimal code of the byte — a space becomes <code>%20</code>, an ampersand becomes <code>%26</code>. Non-ASCII characters are first converted to UTF-8 bytes, each of which is then escaped, which is why “é” becomes <code>%C3%A9</code>.'
        ) +
          p(
            '<strong>encodeURIComponent()</strong> — used by the “Encode (component)” button — escapes everything that is not an unreserved character, which is what you want for a single parameter value. <strong>encodeURI()</strong> — the “Encode whole URL” button — leaves characters that define URL structure, such as <code>:</code> <code>/</code> <code>?</code> <code>#</code> and <code>&amp;</code>, untouched, because escaping those would destroy a working address.'
          ) +
          p(
            'The one character worth remembering is the plus sign. In a query string <code>+</code> means a space, while in a path it means a literal plus. This tool treats <code>+</code> as a space when decoding, which matches how form data is sent.'
          )
      ),
      proseSection(
        'url-errors',
        'Handling malformed input',
        p(
          'Decoding fails when a percent sign is not followed by two hexadecimal digits — for example <code>%E0%</code> or a stray <code>%</code> at the end of the string. Instead of breaking the page or silently returning <code>undefined</code>, the tool explains that the input is not valid percent-encoding and points to the position of the first suspicious sequence.'
        ) +
          p(
            'A common real-world cause is double encoding: a value that was already encoded gets encoded again, so <code>%20</code> becomes <code>%2520</code>. That is not an error — it is one extra layer of escaping — and decoding once returns <code>%20</code>, which is often exactly what the receiving system expects. If decoding twice gives you the text you expect, the value was double-encoded somewhere upstream.'
          )
      ),
    ],
    faq: [
      {
        q: 'What is the difference between the two Encode buttons?',
        a: '“Encode (component)” uses encodeURIComponent() and escapes everything reserved — correct for a single query value. “Encode whole URL” uses encodeURI() and preserves the characters that give a URL its structure.',
      },
      {
        q: 'Why does my encoded URL contain %20 instead of +?',
        a: 'Both represent a space; %20 is the standard percent-encoding and + is a form-encoding convention. %20 is the safer choice because it is unambiguous in every part of a URL.',
      },
      {
        q: 'What does “not valid percent-encoding” mean?',
        a: 'A “%” must be followed by exactly two hexadecimal digits. Input such as “%G7” or a trailing “%” cannot be decoded, and the tool tells you rather than showing a broken result.',
      },
      {
        q: 'Can I encode very long text?',
        a: 'Yes. Encoding runs in your browser, so the practical limit is the memory of your device. Browser address bars are the real constraint: anything beyond roughly 2,000 characters may be truncated by some servers.',
      },
    ],
  });
}

/* ------------------------------------------------------------------ *
 * 10. Text Case Converter
 * ------------------------------------------------------------------ */

function textCaseConverter() {
  const ui = `
          <section class="tool-panel" aria-labelledby="case-heading">
            <h2 id="case-heading" class="sr-only">Convert text case</h2>
            <div class="field">
              <label for="caseInput">Your text</label>
              <textarea id="caseInput" rows="8" placeholder="Type or paste the text you want to convert…" aria-describedby="case-help"></textarea>
              <p class="field__hint" id="case-help">Line breaks are preserved in every conversion. Nothing is uploaded.</p>
            </div>

            <div class="btn-row">
              <button class="btn btn--soft" type="button" data-case="upper" aria-pressed="false">UPPERCASE</button>
              <button class="btn btn--soft" type="button" data-case="lower" aria-pressed="false">lowercase</button>
              <button class="btn btn--soft" type="button" data-case="title" aria-pressed="false">Title Case</button>
              <button class="btn btn--soft" type="button" data-case="sentence" aria-pressed="false">Sentence case</button>
              <button class="btn btn--soft" type="button" data-case="toggle" aria-pressed="false">tOGGLE cASE</button>
            </div>
            <div class="alert" id="caseAlert" hidden></div>
          </section>

          <section class="tool-panel" aria-labelledby="case-result-heading">
            <h2 id="case-result-heading">Result</h2>
            <div class="btn-row" style="margin-bottom:1rem">
              <button class="btn btn--sm" type="button" id="caseCopy">Copy result</button>
              <button class="btn btn--soft btn--sm" type="button" id="caseClear">Clear</button>
            </div>
            <pre id="caseOutput" tabindex="0" aria-live="polite" aria-label="Converted text"></pre>
            <h3 style="margin-top:1.5rem">Result summary</h3>
            <dl class="metric-list" id="caseStats">
              <div><dt>Words</dt><dd>0</dd></div>
              <div><dt>Characters</dt><dd>0</dd></div>
              <div><dt>Lines</dt><dd>0</dd></div>
            </dl>
          </section>`;

  return toolShell('text-case-converter', {
    title: 'Text Case Converter — UPPER, lower, Title & Sentence | ToolBox',
    description:
      'Convert text to UPPERCASE, lowercase, Title Case or Sentence case online while keeping line breaks. Copy the result with one click. No uploads, no sign-up.',
    lede:
      'Paste any text and switch its capitalisation in one click: UPPERCASE, lowercase, Title Case, Sentence case or tOGGLE cASE. Line breaks stay exactly where they were.',
    ui,
    sidebar: true,
    steps: [
      'Paste your text into the input box — headings, list items and blank lines are all preserved.',
      'Click the case you want: UPPERCASE, lowercase, Title Case, Sentence case or tOGGLE cASE.',
      'Check the conversion in the result panel; the word, character and line counts update with it.',
      'Change the case again at any time — conversions are applied to the original input, not stacked on each other.',
      'Press “Copy result” to put the converted text on your clipboard, ready to paste.',
    ],
    sections: [
      proseSection(
        'case-rules',
        'What each style actually does',
        p(
          '<strong>UPPERCASE</strong> and <strong>lowercase</strong> are literal conversions of every character. <strong>Title Case</strong> capitalises the first letter of every word, which is the convention used by most publication style guides for headlines (some also keep short words such as “of” and “the” lowercase — adjust those by hand if your style guide requires it).'
        ) +
          p(
            '<strong>Sentence case</strong> lowercases everything and then capitalises the first letter that follows a full stop, question mark, exclamation mark or line break. That is the style used in most modern interface copy and in many editorial styles, because it is easier to read than Title Case. <strong>tOGGLE cASE</strong> swaps the case of every letter, which is a quick fix for text typed with Caps Lock on.'
        ) +
          p(
            'One honest note: no automatic converter can match a good copy editor. Proper nouns and acronyms — “iPhone”, “NASA”, “Berlin” — are normalised along with everything else, so give the result a quick read before publishing.'
          )
      ),
      proseSection(
        'case-typing',
        'Where case conversion saves time',
        p(
          'The most common use is fixing text that was typed with Caps Lock on, or pasting content from a document that used a different style guide. It is also handy in spreadsheets — convert a column of email addresses to lowercase to avoid duplicate records, or make a list of codes consistent before importing it.'
        ) +
          p(
            'Developers reach for it when naming constants and variables, and when converting headings from a CMS that exports sentence case into a design that expects title case. For accessibility, ALL CAPS is worth avoiding for anything longer than a short label: all-capital text is measurably slower to read because the shapes of words are lost, and some screen readers spell out short capitalised words letter by letter.'
          )
      ),
    ],
    faq: [
      {
        q: 'Are line breaks preserved?',
        a: 'Yes. Every conversion keeps newlines exactly where you put them, so lists and paragraphs come back in the same shape.',
      },
      {
        q: 'What happens with an empty input?',
        a: 'Nothing breaks. The tool shows a short message asking you to enter some text, and all counts stay at zero.',
      },
      {
        q: 'Does Title Case follow the APA or Chicago rules exactly?',
        a: 'It applies the common headline rule of capitalising each word. Style guides differ on short words such as “of” and “and”, so treat the result as a starting point and adjust those few words as needed.',
      },
      {
        q: 'Can I convert text without JavaScript?',
        a: 'No — this tool is deliberately client-side so your text never leaves your device. With JavaScript disabled the page still loads and explains what the tool does, but the conversion needs scripting.',
      },
    ],
  });
}

/* ------------------------------------------------------------------ *
 * Tools index /tools
 * ------------------------------------------------------------------ */

function toolsIndex() {
  const body = `
    <div class="container">
      ${breadcrumbs([{ label: 'Home', href: '/' }, { label: 'Tools' }])}
      <header class="tool-header">
        <h1>All online tools</h1>
        <p class="tool-header__lede">
          Ten focused utilities for everyday tasks. Eight of them run entirely in your browser, so the text and numbers you
          type are never sent anywhere. Each one is free, needs no account and works on phone, tablet and desktop.
        </p>
      </header>
      ${toolGrid()}

      <section class="section" aria-labelledby="choose-heading">
        <h2 id="choose-heading">Which tool should I use?</h2>
        <div class="prose">
          <p>
            If you are preparing files for a website, start with the <a href="/tools/image-compressor">Image Compressor</a> —
            it is the one tool here that genuinely needs a server, because re-encoding a large photo can be slow on older
            phones. Everything else is instant and local.
          </p>
          <p>
            Writing something? The <a href="/tools/word-counter">Word Counter</a> shows length, reading time and repeated
            words as you type, and the <a href="/tools/text-case-converter">Text Case Converter</a> fixes capitalisation
            without touching your line breaks.
          </p>
          <p>
            Working with data or code? The <a href="/tools/json-formatter">JSON Formatter</a> beautifies, minifies and
            validates payloads, while the <a href="/tools/url-encoder">URL Encoder</a> makes query strings safe to send.
          </p>
          <p>
            Everything else — <a href="/tools/qr-code-generator">QR codes</a>,
            <a href="/tools/password-generator">passwords</a>, <a href="/tools/color-picker">colour conversion</a>,
            <a href="/tools/unit-converter">units</a> and <a href="/tools/age-calculator">ages</a> — is arranged below in
            the same layout, so you always know where the input and the result are.
          </p>
        </div>
      </section>

      ${faqBlock(
        [
          {
            q: 'Do I need to create an account?',
            a: 'No. Every tool is available immediately, with no registration and no usage limits.',
          },
          {
            q: 'Are the tools safe to use with sensitive text?',
            a: 'Eight of the ten tools never send your input anywhere — the work happens in your browser. The image compressor and the QR generator do use the server, and both discard your input as soon as the response is sent.',
          },
          {
            q: 'Will more tools be added?',
            a: 'The site is built so a new tool is a single entry in the tool catalogue plus one page and one script. New utilities will appear in this list when they are finished and tested, not before.',
          },
          {
            q: 'Does the site work offline?',
            a: 'The pages are served over the network, so an initial connection is required. Once a page is open, the browser-side tools keep working even if the connection drops.',
          },
        ],
        'tools-faq'
      )}

      ${adSlot('IN-CONTENT')}
    </div>

    <div class="container">
      ${relatedToolsBlock('', 'Most used tools')}
    </div>`;

  return layout({
    title: 'All Online Tools — 10 Free Utilities in One Place | ToolBox',
    description:
      'Browse all ten free online tools: image compressor, QR code generator, password generator, word counter, JSON formatter, colour picker, unit converter, age calculator and more.',
    canonicalPath: '/tools',
    body,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'All online tools',
        url: t.absolute('/tools'),
        hasPart: TOOLS.map((tool) => ({
          '@type': 'WebApplication',
          name: tool.name,
          url: t.absolute(tool.url),
          description: tool.short,
        })),
      },
    ],
  });
}

module.exports = {
  colorPicker,
  unitConverter,
  ageCalculator,
  urlEncoder,
  textCaseConverter,
  toolsIndex,
};
