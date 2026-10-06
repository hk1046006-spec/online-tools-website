/* ==========================================================================
   ToolBox — shared browser behaviour
   Mobile navigation, theme switch, clipboard helper, toasts, copy buttons.
   Plain vanilla JavaScript. No libraries, no build step.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------- Mobile navigation ---------------- */
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('primaryNav');

  function closeNav() {
    if (!nav || !toggle) return;
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open main menu');
  }

  function openNav() {
    if (!nav || !toggle) return;
    nav.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close main menu');
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function (event) {
      event.stopPropagation();
      if (nav.classList.contains('is-open')) {
        closeNav();
      } else {
        openNav();
      }
    });

    // Close when clicking outside the menu.
    document.addEventListener('click', function (event) {
      if (!nav.classList.contains('is-open')) return;
      if (nav.contains(event.target) || toggle.contains(event.target)) return;
      closeNav();
    });

    // Close with Escape (keyboard accessibility).
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (!nav.classList.contains('is-open')) return;
      closeNav();
      toggle.focus();
    });

    // Close when a link inside is activated.
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) closeNav();
    });

    // Reset state when switching to the desktop layout.
    // matchMedia is guarded because some embedded webviews do not provide it.
    var desktop = window.matchMedia ? window.matchMedia('(min-width: 1024px)') : null;
    var onChange = function (event) {
      if (event.matches) closeNav();
    };
    if (desktop && desktop.addEventListener) desktop.addEventListener('change', onChange);
    else if (desktop && desktop.addListener) desktop.addListener(onChange);
  }

  /* ---------------- Theme ---------------- */
  var THEME_KEY = 'toolbox-theme';
  var themeToggle = document.getElementById('themeToggle');

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeToggle) {
      var dark = theme === 'dark';
      themeToggle.setAttribute('aria-pressed', dark ? 'true' : 'false');
      themeToggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b1220' : '#2f6fed');
  }

  var storedTheme = null;
  try {
    storedTheme = window.localStorage.getItem(THEME_KEY);
  } catch (err) {
    storedTheme = null;
  }

  if (!storedTheme) {
    var prefersDark = window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;
    storedTheme = prefersDark ? 'dark' : 'light';
  }
  applyTheme(storedTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch (err) {
        /* storage may be unavailable — the theme still applies for this page */
      }
    });
  }

  /* ---------------- Toast ---------------- */
  var toastEl = null;
  var toastTimer = null;

  function toast(message) {
    if (!message) return;
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    // Force a reflow so the transition runs when the same message repeats.
    void toastEl.offsetWidth;
    toastEl.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove('is-visible');
    }, 2200);
  }

  /* ---------------- Clipboard ---------------- */
  function legacyCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', 'readonly');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (err) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  /**
   * Copy text to the clipboard with a sensible fallback for older browsers and
   * non-secure origins (e.g. plain http:// on a LAN address).
   * @returns {Promise<boolean>}
   */
  function copyText(text, successMessage) {
    var value = text == null ? '' : String(text);
    if (!value) {
      toast('Nothing to copy yet');
      return Promise.resolve(false);
    }

    var done = function (ok) {
      if (ok) toast(successMessage || 'Copied to clipboard');
      else toast('Copy failed — select the text and copy manually');
      return ok;
    };

    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard
        .writeText(value)
        .then(function () {
          return done(true);
        })
        .catch(function () {
          return done(legacyCopy(value));
        });
    }
    return Promise.resolve(done(legacyCopy(value)));
  }

  // Copy confirmation for any button carrying data-copy-target.
  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-copy-target]');
    if (!trigger) return;
    var selector = trigger.getAttribute('data-copy-target');
    var source = selector ? document.querySelector(selector) : null;
    if (!source) return;

    var text = 'value' in source && source.value !== undefined ? source.value : source.textContent;
    copyText(text, trigger.getAttribute('data-copy-message') || 'Copied to clipboard');
  });

  /* ---------------- Download helper ---------------- */
  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1500);
  }

  function downloadDataUrl(dataUrl, filename) {
    var link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function formatBytes(bytes) {
    var n = Number(bytes);
    if (!isFinite(n) || n < 0) return '—';
    if (n < 1024) return n + ' B';
    var units = ['KB', 'MB', 'GB'];
    var value = n / 1024;
    var i = 0;
    while (value >= 1024 && i < units.length - 1) {
      value /= 1024;
      i += 1;
    }
    return (value >= 100 ? value.toFixed(0) : value.toFixed(value >= 10 ? 1 : 2)) + ' ' + units[i];
  }

  function showAlert(el, type, message) {
    if (!el) return;
    el.className = 'alert alert--' + type;
    el.textContent = message || '';
    el.hidden = !message;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  }

  function clearAlert(el) {
    if (!el) return;
    el.textContent = '';
    el.hidden = true;
    el.className = 'alert';
  }

  function qs(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function qsa(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  /* ---------------- Footer year / misc ---------------- */
  // Nothing else is needed globally; every tool script wires its own UI.

  window.ToolBox = {
    toast: toast,
    copyText: copyText,
    downloadBlob: downloadBlob,
    downloadDataUrl: downloadDataUrl,
    formatBytes: formatBytes,
    showAlert: showAlert,
    clearAlert: clearAlert,
    qs: qs,
    qsa: qsa,
    closeNav: closeNav,
  };
})();
