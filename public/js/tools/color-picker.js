/* ==========================================================================
   Color Picker & Converter — /tools/color-picker
   Conversion between HEX, RGB and HSL happens entirely in the browser.
   ========================================================================== */
(function () {
  'use strict';

  var picker = document.getElementById('colorPicker');
  var hexInput = document.getElementById('hexInput');
  var rgbInput = document.getElementById('rgbInput');
  var hslInput = document.getElementById('hslInput');
  var preview = document.getElementById('colorPreview');
  var previewLabel = document.getElementById('colorPreviewLabel');
  var alertBox = document.getElementById('colorAlert');
  var tableBody = document.getElementById('colorTableBody');
  var contrastBox = document.getElementById('colorContrast');
  var clearBtn = document.getElementById('colorClear');
  if (!picker || !hexInput) return;

  var current = { r: 47, g: 111, b: 237 };

  /* ---------------- conversions ---------------- */

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function componentToHex(value) {
    var v = clamp(Math.round(value), 0, 255);
    var hex = v.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }

  function rgbToHex(rgb) {
    return '#' + componentToHex(rgb.r) + componentToHex(rgb.g) + componentToHex(rgb.b);
  }

  function rgbToHsl(rgb) {
    var r = rgb.r / 255;
    var g = rgb.g / 255;
    var b = rgb.b / 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var delta = max - min;
    var h = 0;
    var s = 0;
    var l = (max + min) / 2;

    if (delta !== 0) {
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
      if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / delta + 2) / 6;
      else h = ((r - g) / delta + 4) / 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }

  function hslToRgb(hsl) {
    var h = ((hsl.h % 360) + 360) % 360 / 360;
    var s = clamp(hsl.s, 0, 100) / 100;
    var l = clamp(hsl.l, 0, 100) / 100;

    if (s === 0) {
      var gray = Math.round(l * 255);
      return { r: gray, g: gray, b: gray };
    }

    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;

    function hueToRgb(t) {
      var tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    }

    return {
      r: Math.round(hueToRgb(h + 1 / 3) * 255),
      g: Math.round(hueToRgb(h) * 255),
      b: Math.round(hueToRgb(h - 1 / 3) * 255),
    };
  }

  /** Accepts #rgb, #rrggbb, with or without the leading hash. */
  function parseHex(value) {
    if (typeof value !== 'string') return null;
    var raw = value.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(raw)) {
      raw = raw
        .split('')
        .map(function (ch) {
          return ch + ch;
        })
        .join('');
    }
    if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16),
    };
  }

  function parseRgbString(value) {
    if (typeof value !== 'string') return null;
    var match = value.match(/rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/i);
    if (!match) return null;
    var r = Number(match[1]);
    var g = Number(match[2]);
    var b = Number(match[3]);
    if ([r, g, b].some(function (v) { return v > 255; })) return null;
    return { r: r, g: g, b: b };
  }

  function parseHslString(value) {
    if (typeof value !== 'string') return null;
    var match = value.match(/hsla?\(\s*(-?\d{1,3}(?:\.\d+)?)\s*(?:deg)?\s*[, ]\s*(\d{1,3}(?:\.\d+)?)%\s*[, ]\s*(\d{1,3}(?:\.\d+)?)%/i);
    if (!match) return null;
    return { h: Number(match[1]), s: Number(match[2]), l: Number(match[3]) };
  }

  function relativeLuminance(rgb) {
    var channels = [rgb.r, rgb.g, rgb.b].map(function (value) {
      var c = value / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  function contrastRatio(a, b) {
    var l1 = relativeLuminance(a);
    var l2 = relativeLuminance(b);
    var lighter = Math.max(l1, l2);
    var darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /* ---------------- rendering ---------------- */

  function render(rgb, sourceLabel) {
    current = rgb;
    var hex = rgbToHex(rgb);
    var hsl = rgbToHsl(rgb);

    if (picker.value.toLowerCase() !== hex.toLowerCase()) picker.value = hex;
    if (document.activeElement !== hexInput) hexInput.value = hex.toUpperCase();
    if (rgbInput && document.activeElement !== rgbInput) {
      rgbInput.value = 'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')';
    }
    if (hslInput && document.activeElement !== hslInput) {
      hslInput.value = 'hsl(' + hsl.h + ', ' + hsl.s + '%, ' + hsl.l + '%)';
    }

    preview.style.backgroundColor = hex;
    if (previewLabel) previewLabel.textContent = hex.toUpperCase();

    renderTable(hex, rgb, hsl);
    renderContrast(rgb);

    if (sourceLabel) {
      ToolBox.showAlert(alertBox, 'success', 'Converted from ' + sourceLabel + '.');
    } else {
      ToolBox.clearAlert(alertBox);
    }
  }

  function renderTable(hex, rgb, hsl) {
    if (!tableBody) return;
    var rows = [
      ['HEX', hex.toUpperCase()],
      ['HEX (short)', /^#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3$/i.test(hex) ? '#' + hex[1] + hex[3] + hex[5] : '—'],
      ['RGB', 'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')'],
      ['RGB values', rgb.r + ' / ' + rgb.g + ' / ' + rgb.b],
      ['HSL', 'hsl(' + hsl.h + ', ' + hsl.s + '%, ' + hsl.l + '%)'],
      ['CSS variable', '--color: ' + hex + ';'],
    ];
    tableBody.innerHTML = rows
      .map(function (row) {
        return (
          '<tr><th scope="row">' +
          row[0] +
          '</th><td><code class="output-text">' +
          row[1] +
          '</code></td><td><button type="button" class="btn btn--soft btn--sm" data-copy-value="' +
          row[1].replace(/"/g, '&quot;') +
          '">Copy</button></td></tr>'
        );
      })
      .join('');
  }

  function renderContrast(rgb) {
    if (!contrastBox) return;
    var white = { r: 255, g: 255, b: 255 };
    var black = { r: 0, g: 0, b: 0 };
    var withWhite = contrastRatio(rgb, white);
    var withBlack = contrastRatio(rgb, black);
    var best = withBlack >= withWhite ? 'black' : 'white';
    contrastBox.innerHTML =
      '<div><dt>Contrast with white</dt><dd>' + withWhite.toFixed(2) + ':1</dd></div>' +
      '<div><dt>Contrast with black</dt><dd>' + withBlack.toFixed(2) + ':1</dd></div>' +
      '<div><dt>Use as background</dt><dd>' + best + ' text</dd></div>' +
      '<div><dt>WCAG AA (normal text)</dt><dd>' + (Math.max(withWhite, withBlack) >= 4.5 ? 'Passes' : 'Fails') + '</dd></div>';
  }

  /* ---------------- events ---------------- */

  picker.addEventListener('input', function () {
    var rgb = parseHex(picker.value);
    if (rgb) render(rgb, 'the colour picker');
  });

  hexInput.addEventListener('input', function () {
    var value = hexInput.value;
    if (!value.trim()) {
      hexInput.removeAttribute('aria-invalid');
      ToolBox.clearAlert(alertBox);
      return;
    }
    var rgb = parseHex(value);
    if (rgb) {
      hexInput.removeAttribute('aria-invalid');
      render(rgb, 'the HEX value you typed');
    } else {
      hexInput.setAttribute('aria-invalid', 'true');
      ToolBox.showAlert(
        alertBox,
        'error',
        '“' + value + '” is not a valid HEX colour. Use 3 or 6 hexadecimal digits, for example #2f6fed or #0af.'
      );
    }
  });

  hexInput.addEventListener('blur', function () {
    var rgb = parseHex(hexInput.value);
    if (rgb) hexInput.value = rgbToHex(rgb).toUpperCase();
  });

  if (rgbInput) {
    rgbInput.addEventListener('change', function () {
      var rgb = parseRgbString(rgbInput.value);
      if (!rgb) {
        ToolBox.showAlert(alertBox, 'error', 'Enter an RGB value such as rgb(47, 111, 237) with components between 0 and 255.');
        return;
      }
      render(rgb, 'the RGB value you typed');
    });
  }

  if (hslInput) {
    hslInput.addEventListener('change', function () {
      var hsl = parseHslString(hslInput.value);
      if (!hsl) {
        ToolBox.showAlert(alertBox, 'error', 'Enter an HSL value such as hsl(220, 84%, 56%) with percentages for saturation and lightness.');
        return;
      }
      render(hslToRgb(hsl), 'the HSL value you typed');
    });
  }

  // Copy buttons inside the conversion table.
  if (tableBody) {
    tableBody.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-copy-value]');
      if (!btn) return;
      ToolBox.copyText(btn.getAttribute('data-copy-value'), 'Copied: ' + btn.getAttribute('data-copy-value'));
    });
  }

  ToolBox.qsa('[data-copy-field]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var field = document.getElementById(btn.getAttribute('data-copy-field'));
      if (!field) return;
      ToolBox.copyText(field.value, 'Copied ' + (field.value || ''));
    });
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      hexInput.value = '';
      if (rgbInput) rgbInput.value = '';
      if (hslInput) hslInput.value = '';
      render({ r: 47, g: 111, b: 237 }, null);
      ToolBox.clearAlert(alertBox);
      ToolBox.toast('Reset to the default colour');
    });
  }

  // Support ?hex=ff0000 deep links.
  var params = new URLSearchParams(window.location.search);
  var preset = params.get('hex') || params.get('color');
  var presetRgb = preset ? parseHex(preset) : null;

  // Preset swatches are rendered in the HTML; bind a click handler to each one.
  ToolBox.qsa('[data-preset]').forEach(function (swatch) {
    swatch.addEventListener('click', function () {
      var rgb = parseHex(swatch.getAttribute('data-preset'));
      if (!rgb) return;
      render(rgb, 'a preset colour');
      ToolBox.toast('Preset applied: ' + swatch.getAttribute('data-preset'));
    });
  });

  render(presetRgb || { r: 47, g: 111, b: 237 }, presetRgb ? 'the colour in the link' : null);
})();
