'use strict';

/**
 * Central catalogue of every tool on the website.
 *
 * Every page, navigation item, tool card, related-tools block, sitemap entry
 * and the JSON-LD structured data are generated from this single source of
 * truth, so adding a new tool only requires one entry here plus its two files
 * (public/tools/<slug>.html and public/js/tools/<slug>.js).
 */

const TOOLS = [
  {
    slug: 'image-compressor',
    url: '/tools/image-compressor',
    file: 'image-compressor.html',
    name: 'Image Compressor',
    short: 'Compress JPG and PNG images in seconds.',
    description:
      'Reduce JPG and PNG file size without a visible loss of quality. Upload an image, pick a quality level and download the optimised file.',
    icon: 'compress',
    keywords: ['compress image', 'image compressor', 'reduce jpg size', 'optimise png'],
  },
  {
    slug: 'qr-code-generator',
    url: '/tools/qr-code-generator',
    file: 'qr-code-generator.html',
    name: 'QR Code Generator',
    short: 'Turn any text or link into a scannable QR code.',
    description:
      'Create a QR code from a website link, text, phone number or any other short piece of data, then download it as a PNG image.',
    icon: 'qr',
    keywords: ['qr code generator', 'make qr code', 'url to qr', 'download qr png'],
  },
  {
    slug: 'password-generator',
    url: '/tools/password-generator',
    file: 'password-generator.html',
    name: 'Password Generator',
    short: 'Create strong random passwords instantly.',
    description:
      'Generate strong, random passwords in the browser with a length slider and full control over upper case, lower case, digits and symbols.',
    icon: 'key',
    keywords: ['password generator', 'strong password', 'random password', 'secure password'],
  },
  {
    slug: 'word-counter',
    url: '/tools/word-counter',
    file: 'word-counter.html',
    name: 'Word Counter',
    short: 'Live word, character and reading-time counts.',
    description:
      'Count words, characters, characters without spaces, sentences and paragraphs while you type, and see an estimated reading time for your text.',
    icon: 'text',
    keywords: ['word counter', 'character counter', 'reading time', 'sentence count'],
  },
  {
    slug: 'json-formatter',
    url: '/tools/json-formatter',
    file: 'json-formatter.html',
    name: 'JSON Formatter & Validator',
    short: 'Beautify, minify and validate JSON.',
    description:
      'Format messy JSON into readable indented output, minify it for production, or validate it and get a clear error message with the exact line and column.',
    icon: 'code',
    keywords: ['json formatter', 'json validator', 'json beautifier', 'minify json'],
  },
  {
    slug: 'color-picker',
    url: '/tools/color-picker',
    file: 'color-picker.html',
    name: 'Color Picker & Converter',
    short: 'Convert colours between HEX, RGB and HSL.',
    description:
      'Pick a colour and instantly read its HEX, RGB and HSL values. Type a HEX code manually and copy any value with one click.',
    icon: 'palette',
    keywords: ['color picker', 'hex to rgb', 'rgb to hsl', 'color converter'],
  },
  {
    slug: 'unit-converter',
    url: '/tools/unit-converter',
    file: 'unit-converter.html',
    name: 'Unit Converter',
    short: 'Length, weight and temperature conversion.',
    description:
      'Convert between length units (mm, cm, m, km, inch, foot, yard, mile), weight units (mg, g, kg, ounce, pound) and temperatures (Celsius, Fahrenheit, Kelvin).',
    icon: 'ruler',
    keywords: ['unit converter', 'cm to inches', 'kg to pounds', 'celsius to fahrenheit'],
  },
  {
    slug: 'age-calculator',
    url: '/tools/age-calculator',
    file: 'age-calculator.html',
    name: 'Age Calculator',
    short: 'Exact age in years, months and days.',
    description:
      'Work out an exact age in years, months and days from a date of birth, including totals in weeks, days and hours, with correct leap-year maths.',
    icon: 'calendar',
    keywords: ['age calculator', 'date of birth calculator', 'how old am i', 'age in days'],
  },
  {
    slug: 'url-encoder',
    url: '/tools/url-encoder',
    file: 'url-encoder.html',
    name: 'URL Encoder / Decoder',
    short: 'Percent-encode and decode URLs safely.',
    description:
      'Percent-encode text and query strings with encodeURIComponent, or decode encoded URLs back to readable text with clear error reporting.',
    icon: 'link',
    keywords: ['url encoder', 'url decoder', 'percent encoding', 'encodeuricomponent'],
  },
  {
    slug: 'text-case-converter',
    url: '/tools/text-case-converter',
    file: 'text-case-converter.html',
    name: 'Text Case Converter',
    short: 'UPPER, lower, Title and Sentence case.',
    description:
      'Change the capitalisation of any text: UPPERCASE, lowercase, Title Case or Sentence case, while keeping your line breaks intact.',
    icon: 'case',
    keywords: ['text case converter', 'uppercase converter', 'title case', 'sentence case'],
  },
];

const bySlug = new Map(TOOLS.map((t) => [t.slug, t]));

function getTool(slug) {
  return bySlug.get(slug) || null;
}

/** Tools related to `slug` (everything else, deterministic order). */
function relatedTools(slug, limit = 3) {
  const others = TOOLS.filter((t) => t.slug !== slug);
  return others.slice(0, limit);
}

function toolPaths(extra = []) {
  return TOOLS.map((t) => ({ url: t.url, priority: '0.9' })).concat(extra);
}

module.exports = { TOOLS, getTool, relatedTools, toolPaths };
