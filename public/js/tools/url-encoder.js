/* ==========================================================================
   URL Encoder / Decoder — /tools/url-encoder
   Uses encodeURIComponent() and decodeURIComponent() in the browser.
   ========================================================================== */
(function () {
  'use strict';

  var input = document.getElementById('urlInput');
  var output = document.getElementById('urlOutput');
  var alertBox = document.getElementById('urlAlert');
  var encodeBtn = document.getElementById('urlEncode');
  var decodeBtn = document.getElementById('urlDecode');
  var encodeFullBtn = document.getElementById('urlEncodeFull');
  var copyBtn = document.getElementById('urlCopy');
  var clearBtn = document.getElementById('urlClear');
  var mode = document.getElementById('urlMode');
  var breakdownBox = document.getElementById('urlBreakdown');
  var queryBox = document.getElementById('urlQueryResult');
  if (!input || !output) return;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  /**
   * encodeURIComponent leaves !'()* unescaped; this also escapes them so the
   * output is safe inside any query value, fragment or path segment.
   * (This is the same set used by RFC 3986 for unreserved characters.)
   */
  function encodeStrict(value) {
    return encodeURIComponent(value).replace(/[!'()*]/g, function (ch) {
      return '%' + ch.charCodeAt(0).toString(16).toUpperCase();
    });
  }

  /** encodeURI-style encoding that keeps :/?#[]@ etc. intact. */
  function encodeWholeUrl(value) {
    return encodeURI(value).replace(/[!'()*]/g, function (ch) {
      return '%' + ch.charCodeAt(0).toString(16).toUpperCase();
    });
  }

  function setOutput(text) {
    output.textContent = text || '';
  }

  function showBreakdown(encoded) {
    if (!breakdownBox) return;
    if (!encoded) {
      breakdownBox.hidden = true;
      return;
    }
    var rows = [];
    var re = /%[0-9A-Fa-f]{2}/g;
    var match;
    var seen = {};
    while ((match = re.exec(encoded)) !== null) {
      var sequence = match[0].toUpperCase();
      if (seen[sequence]) continue;
      seen[sequence] = true;
      var char = '';
      try {
        char = decodeURIComponent(sequence);
      } catch (err) {
        char = '?';
      }
      rows.push(
        '<tr><td><code>' + sequence + '</code></td><td><code>' + escapeHtml(char) + '</code></td><td>' +
          escapeHtml(describeChar(char)) + '</td></tr>'
      );
      if (rows.length >= 40) break;
    }
    breakdownBox.innerHTML = rows.length
      ? '<div class="table-wrap"><table><caption class="sr-only">Characters escaped by percent-encoding</caption><thead><tr><th scope="col">Escape</th><th scope="col">Character</th><th scope="col">Description</th></tr></thead><tbody>' +
        rows.join('') +
        '</tbody></table></div>'
      : '<p class="muted">No characters needed escaping — every character in this text is URL-safe.</p>';
    breakdownBox.hidden = false;
  }

  function describeChar(char) {
    if (char === ' ') return 'space';
    if (char === '\n') return 'line feed';
    if (char === '/') return 'forward slash';
    if (char === '?') return 'question mark';
    if (char === '=') return 'equals sign';
    if (char === '&') return 'ampersand';
    if (char === '#') return 'hash / fragment';
    if (char === '+') return 'plus sign';
    if (/^[a-zA-Z0-9]$/.test(char)) return 'letter or digit';
    var code = char.charCodeAt(0);
    return 'code point U+' + code.toString(16).toUpperCase().padStart(4, '0');
  }

  /** Parses a full URL and lists its query parameters (if it is a valid URL). */
  function showQueryParams(text) {
    if (!queryBox) return;
    var candidate = text.trim();
    if (!candidate) {
      queryBox.hidden = true;
      return;
    }
    var withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate) ? candidate : 'https://' + candidate;
    var url;
    try {
      url = new URL(withProtocol);
    } catch (err) {
      queryBox.hidden = true;
      return;
    }
    var pairs = Array.from(url.searchParams.entries());
    if (!pairs.length) {
      queryBox.innerHTML =
        '<p class="muted">This looks like a URL, but it has no query parameters to list. ' +
        (url.hostname ? 'Host: <code>' + escapeHtml(url.hostname) + '</code>' : '') +
        '</p>';
      queryBox.hidden = false;
      return;
    }
    var rows = pairs
      .map(function (pair) {
        return (
          '<tr><td>' + escapeHtml(pair[0]) + '</td><td class="output-text">' + escapeHtml(pair[1]) + '</td></tr>'
        );
      })
      .join('');
    queryBox.innerHTML =
      '<h3>Query parameters found in the input</h3><div class="table-wrap"><table><caption class="sr-only">Decoded query parameters</caption><thead><tr><th scope="col">Parameter</th><th scope="col">Value (decoded)</th></tr></thead><tbody>' +
      rows +
      '</tbody></table></div>';
    queryBox.hidden = false;
  }

  function doEncode(kind) {
    var value = input.value;
    if (!value.trim()) {
      setOutput('');
      if (mode) mode.textContent = '';
      showBreakdown('');
      showQueryParams('');
      ToolBox.showAlert(alertBox, 'error', 'Enter the text or URL you want to encode — the input is empty.');
      return;
    }
    var encoded = kind === 'full' ? encodeWholeUrl(value) : encodeStrict(value);
    setOutput(encoded);
    if (mode) {
      mode.textContent =
        kind === 'full'
          ? 'Encoded with encodeURI() — URL structure (:// , / , ? , & , # ) preserved.'
          : 'Encoded with encodeURIComponent() — every reserved character escaped.';
    }
    showBreakdown(encoded);
    showQueryParams(value);
    ToolBox.showAlert(alertBox, 'success', 'Encoded ' + value.length.toLocaleString('en-US') + ' characters into ' + encoded.length.toLocaleString('en-US') + '.');
  }

  function doDecode() {
    var value = input.value;
    if (!value.trim()) {
      setOutput('');
      showBreakdown('');
      showQueryParams('');
      ToolBox.showAlert(alertBox, 'error', 'Enter the encoded text you want to decode — the input is empty.');
      return;
    }
    try {
      var decoded = decodeURIComponent(value.replace(/\+/g, '%20'));
      setOutput(decoded);
      if (mode) mode.textContent = 'Decoded with decodeURIComponent() (plus signs treated as spaces).';
      showBreakdown('');
      showQueryParams(decoded);
      ToolBox.showAlert(alertBox, 'success', 'Decoded successfully.');
    } catch (error) {
      setOutput('');
      if (mode) mode.textContent = '';
      showBreakdown('');
      var detail = String(error && error.message ? error.message : error);
      var position = '';
      try {
        // Locate the first malformed sequence to make the message actionable.
        var match = value.match(/%(?![0-9A-Fa-f]{2})|%[0-9A-Fa-f](?![0-9A-Fa-f])/);
        if (match) position = ' at position ' + match.index;
      } catch (err) {
        position = '';
      }
      ToolBox.showAlert(
        alertBox,
        'error',
        'This text is not valid percent-encoding: a “%” must be followed by exactly two hexadecimal digits (0–9, A–F). Problem found' +
          (position || '') + '. Details from the browser: ' + detail
      );
    }
  }

  [encodeBtn, decodeBtn, encodeFullBtn].forEach(function (btn) {
    if (!btn) return;
    btn.addEventListener('click', function () {
      var action = btn.getAttribute('data-action') || 'encode';
      if (action === 'decode') doDecode();
      else doEncode(action === 'full' ? 'full' : 'component');
    });
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var text = output.textContent;
      if (!text) {
        ToolBox.showAlert(alertBox, 'error', 'There is no result to copy yet — encode or decode something first.');
        return;
      }
      ToolBox.copyText(text, 'Result copied to clipboard');
      ToolBox.clearAlert(alertBox);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      input.value = '';
      setOutput('');
      if (mode) mode.textContent = '';
      showBreakdown('');
      showQueryParams('');
      ToolBox.clearAlert(alertBox);
      input.focus();
      ToolBox.toast('Cleared');
    });
  }

  input.addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      doEncode('component');
    }
  });

  ToolBox.qsa('[data-url-example]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      input.value = chip.getAttribute('data-url-example');
      input.focus();
      ToolBox.toast('Example inserted');
    });
  });

  // Deep links: /tools/url-encoder?text=hello%20world&action=encode|decode
  var params = new URLSearchParams(window.location.search);
  var preset = params.get('text') || params.get('url');
  if (preset) {
    input.value = preset;
    if (params.get('action') === 'decode') doDecode();
    else doEncode('component');
  } else {
    setOutput('');
  }
})();
