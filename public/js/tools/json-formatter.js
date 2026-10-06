/* ==========================================================================
   JSON Formatter & Validator — /tools/json-formatter
   Formatting, minifying and validation all run in the browser with JSON.parse.
   eval is never used.
   ========================================================================== */
(function () {
  'use strict';

  var input = document.getElementById('jsonInput');
  var output = document.getElementById('jsonOutput');
  var alertBox = document.getElementById('jsonAlert');
  var indentSelect = document.getElementById('jsonIndent');
  var sortKeys = document.getElementById('jsonSortKeys');
  var formatBtn = document.getElementById('jsonFormat');
  var minifyBtn = document.getElementById('jsonMinify');
  var validateBtn = document.getElementById('jsonValidate');
  var copyBtn = document.getElementById('jsonCopy');
  var downloadBtn = document.getElementById('jsonDownload');
  var clearBtn = document.getElementById('jsonClear');
  var loadSample = document.getElementById('jsonSample');
  var statsBox = document.getElementById('jsonStats');
  if (!input) return;

  var SAMPLE = JSON.stringify(
    {
      site: 'ToolBox',
      version: 1,
      tools: [
        { slug: 'json-formatter', name: 'JSON Formatter', client: true },
        { slug: 'image-compressor', name: 'Image Compressor', client: false }
      ],
      limits: { maxUploadMb: 10, formats: ['jpeg', 'png'] },
      active: true,
      notes: null
    },
    null,
    2
  );

  var lastResult = '';

  /**
   * Turn a JSON.parse SyntaxError into a readable message with a line/column.
   */
  function describeError(error, text) {
    var message = String(error && error.message ? error.message : error);
    var position = null;
    var match = message.match(/position\s+(\d+)/i);
    if (match) position = Number(match[1]);
    var lineMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);

    if (lineMatch) {
      return {
        text:
          'Invalid JSON: ' +
          message.replace(/^JSON\.parse:\s*/i, '').replace(/\s*in JSON at position.*$/i, '') +
          ' (line ' + lineMatch[1] + ', column ' + lineMatch[2] + ').',
        line: Number(lineMatch[1]),
        column: Number(lineMatch[2]),
      };
    }

    if (position !== null && typeof text === 'string') {
      var before = text.slice(0, position);
      var line = before.split(/\n/).length;
      var column = position - before.lastIndexOf('\n');
      return {
        text:
          'Invalid JSON: ' +
          message.replace(/^JSON\.parse:\s*/i, '').replace(/\s*in JSON at position \d+.*$/i, '') +
          ' (line ' + line + ', column ' + column + ').',
        line: line,
        column: column,
      };
    }

    return { text: 'Invalid JSON: ' + message, line: null, column: null };
  }

  /**
   * @returns {{ok: true, value: *} | {ok: false}} so that a valid literal
   * `null`, `false`, `0` or `""` is never confused with a parse failure.
   */
  function parseInput() {
    var text = input.value;
    if (!text.trim()) {
      ToolBox.showAlert(alertBox, 'error', 'Enter some JSON first — the input box is empty.');
      setOutput('');
      renderStats(undefined);
      return { ok: false };
    }
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch (error) {
      var described = describeError(error, text);
      ToolBox.showAlert(alertBox, 'error', described.text);
      setOutput('');
      renderStats(undefined);
      if (described.line) highlightLine(described.line);
      return { ok: false };
    }
  }

  function highlightLine(line) {
    var lines = input.value.split(/\r\n|\r|\n/);
    if (line < 1 || line > lines.length) return;
    var start = 0;
    for (var i = 0; i < line - 1; i += 1) start += lines[i].length + 1;
    var end = start + lines[line - 1].length;
    try {
      input.setSelectionRange(start, end);
    } catch (err) {
      /* not fatal */
    }
  }

  function setOutput(text) {
    lastResult = text || '';
    if (!output) return;
    output.textContent = lastResult;
  }

  function sortObjectKeys(value) {
    if (Array.isArray(value)) return value.map(sortObjectKeys);
    if (value && typeof value === 'object') {
      var out = {};
      Object.keys(value)
        .sort(function (a, b) {
          return a.localeCompare(b);
        })
        .forEach(function (key) {
          out[key] = sortObjectKeys(value[key]);
        });
      return out;
    }
    return value;
  }

  function indentValue() {
    var raw = indentSelect ? indentSelect.value : '2';
    if (raw === 'tab') return '\t';
    var n = parseInt(raw, 10);
    return isNaN(n) ? 2 : Math.max(0, Math.min(8, n));
  }

  function renderStats(parsed) {
    if (!statsBox) return;
    if (parsed === undefined) {
      statsBox.innerHTML =
        '<div><dt>Keys</dt><dd>0</dd></div>' +
        '<div><dt>Arrays</dt><dd>0</dd></div>' +
        '<div><dt>Values</dt><dd>0</dd></div>' +
        '<div><dt>Depth</dt><dd>0</dd></div>';
      return;
    }
    var counts = { keys: 0, arrays: 0, values: 0, depth: 0 };
    (function walk(node, depth) {
      counts.depth = Math.max(counts.depth, depth);
      if (Array.isArray(node)) {
        counts.arrays += 1;
        node.forEach(function (child) {
          walk(child, depth + 1);
        });
      } else if (node && typeof node === 'object') {
        Object.keys(node).forEach(function (key) {
          counts.keys += 1;
          walk(node[key], depth + 1);
        });
      } else {
        counts.values += 1;
      }
    })(parsed, 1);

    statsBox.innerHTML =
      '<div><dt>Keys</dt><dd>' + counts.keys + '</dd></div>' +
      '<div><dt>Arrays</dt><dd>' + counts.arrays + '</dd></div>' +
      '<div><dt>Values</dt><dd>' + counts.values + '</dd></div>' +
      '<div><dt>Depth</dt><dd>' + counts.depth + '</dd></div>';
  }

  function run(action) {
    var result = parseInput();
    if (!result.ok) return; // the error has already been reported

    var parsed = result.value;
    var pretty = JSON.stringify(parsed, null, indentValue()) || String(parsed);
    var formatted = lastResult;

    if (action === 'minify') {
      formatted = JSON.stringify(parsed);
      if (formatted === undefined) formatted = String(parsed);
      setOutput(formatted);
      ToolBox.showAlert(
        alertBox,
        'success',
        'Valid JSON — minified from ' + input.value.length.toLocaleString('en-US') + ' to ' + formatted.length.toLocaleString('en-US') + ' characters.'
      );
    } else if (action === 'validate') {
      setOutput(pretty);
      ToolBox.showAlert(alertBox, 'success', 'Valid JSON. Nothing in the input box was modified.');
    } else {
      var value = sortKeys && sortKeys.checked ? sortObjectKeys(parsed) : parsed;
      formatted = JSON.stringify(value, null, indentValue());
      if (formatted === undefined) formatted = String(value);
      setOutput(formatted);
      ToolBox.showAlert(
        alertBox,
        'success',
        'Valid JSON — formatted with ' + (indentSelect && indentSelect.value === 'tab' ? 'tab indentation' : indentValue() + ' space indentation') + '.'
      );
    }
    renderStats(parsed);
  }

  [formatBtn, minifyBtn, validateBtn].forEach(function (btn) {
    if (!btn) return;
    btn.addEventListener('click', function () {
      run(btn.getAttribute('data-action') || 'format');
    });
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      if (!lastResult) {
        ToolBox.showAlert(alertBox, 'error', 'There is no formatted result to copy yet — format or minify your JSON first.');
        return;
      }
      ToolBox.copyText(lastResult, 'Result copied to clipboard');
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', function () {
      if (!lastResult) {
        ToolBox.showAlert(alertBox, 'error', 'Format or minify your JSON before downloading it.');
        return;
      }
      ToolBox.downloadBlob(new Blob([lastResult], { type: 'application/json' }), 'formatted.json');
      ToolBox.toast('Downloading formatted.json');
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      input.value = '';
      setOutput('');
      renderStats(undefined);
      ToolBox.clearAlert(alertBox);
      input.focus();
      ToolBox.toast('Cleared');
    });
  }

  if (loadSample) {
    loadSample.addEventListener('click', function () {
      input.value = SAMPLE;
      run('format');
      ToolBox.toast('Sample JSON loaded');
    });
  }

  // Ctrl/Cmd + Enter formats quickly.
  input.addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      run('format');
    }
  });

  renderStats(undefined);
})();
