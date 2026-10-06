# public/tools/

Tool pages are **server-rendered**, not static files.

Each page is generated from `lib/pages/tools.js` (tools 1–5) and `lib/pages/tools-extra.js`
(tools 6–10), which produce complete HTML — including the unique title, meta description,
canonical URL and JSON-LD — for these URLs:

/tools/image-compressor · /tools/qr-code-generator · /tools/password-generator · /tools/word-counter ·
/tools/json-formatter · /tools/color-picker · /tools/unit-converter · /tools/age-calculator ·
/tools/url-encoder · /tools/text-case-converter

Why: the site name, tagline, meta description, base URL, logo and all page copy are editable from
the admin panel, so the HTML has to be built at request time. Generating it on the server also means
every crawler receives the full page with no client-side rendering step.

The interactive part of each tool is a plain JavaScript file in **`public/js/tools/`**, one per tool,
loaded with a `<script defer>` tag. Nothing else is needed in this folder.
