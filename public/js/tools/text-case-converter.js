/* ==========================================================================
   Text Case Converter — /tools/text-case-converter
   Runs entirely in the browser.
   ========================================================================== */
(function () {
  'use strict';

  var input = document.getElementById('caseInput');
  var output = document.getElementById('caseOutput');
  var alertBox = document.getElementById('caseAlert');
  var stats = document.getElementById('caseStats');
  var copyBtn = document.getElementById('caseCopy');
  var clearBtn = document.getElementById('caseClear');
  var buttons = document.querySelectorAll('[data-case]');
  if (!input || !output) return;

  var MODE_LABEL = {
    upper: 'UPPERCASE',
    lower: 'lowercase',
    title: 'Title Case',
    sentence: 'Sentence case',
    toggle: 'tOGGLE cASE',
  };

  /** UPPERCASE — keeps line breaks exactly as typed. */
  function toUpper(text) {
    return text.toUpperCase();
  }

  /** lowercase */
  function toLower(text) {
    return text.toLowerCase();
  }
  /** Title Case — capitalises the first letter of every word, keeps line breaks. */
  function toTitle(text) {
    return text.replace(/([^\s]+)/g, function (word) {
      var lower = word.toLowerCase();
      // Keep small words lowercased unless they start a line.
      return lower.replace(/^([a-z\u00e0-\u00ff])/, function (ch) {
        return ch.toUpperCase();
      });
    });
  }

  /**
   * Sentence case — capitalises the first letter of every sentence.
   * Line breaks are preserved and each new line starts a new sentence.
   */
  function toSentence(text) {
    var lower = text.toLowerCase();
    var out = '';
    var capitaliseNext = true;
    for (var i = 0; i < lower.length; i += 1) {
      var ch = lower[i];
      if (capitaliseNext && /[a-z\u00e0-\u00ff]/.test(ch)) {
        out += ch.toUpperCase();
        capitaliseNext = false;
        continue;
      }
      out += ch;
      if (ch === '.' || ch === '!' || ch === '?' || ch === '\n' || ch === '\r') {
        capitaliseNext = true;
      }
    }
    return out;
  }

  /** tOGGLE cASE */
  function toToggle(text) {
    return text.replace(/[a-zA-Z]/g, function (ch) {
      return ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase();
    });
  }

  var CONVERTERS = {
    upper: toUpper,
    lower: toLower,
    title: toTitle,
    sentence: toSentence,
    toggle: toToggle,
  };

  var lastMode = null;

  function countStats(text) {
    return {
      words: text.trim() ? text.trim().split(/\s+/).length : 0,
      characters: text.length,
      lines: text.length ? text.split(/\r\n|\r|\n/).length : 0,
    };
  }

  function renderStats(text) {
    if (!stats) return;
    var s = countStats(text);
    stats.innerHTML =
      '<div><dt>Words</dt><dd>' + s.words + '</dd></div>' +
      '<div><dt>Characters</dt><dd>' + s.characters + '</dd></div>' +
      '<div><dt>Lines</dt><dd>' + s.lines + '</dd></div>';
  }

  function convert(mode) {
    var text = input.value;
    if (!text) {
      output.textContent = '';
      lastMode = mode;
      updateButtons(mode);
      ToolBox.showAlert(alertBox, 'info', 'Enter some text above, then choose a case to convert it.');
      renderStats('');
      return;
    }
    var converted = CONVERTERS[mode](text);
    output.textContent = converted;
    lastMode = mode;
    updateButtons(mode);
    ToolBox.clearAlert(alertBox);
    renderStats(converted);
    ToolBox.toast('Converted to ' + MODE_LABEL[mode]);
  }

  function updateButtons(mode) {
    buttons.forEach(function (btn) {
      var active = btn.getAttribute('data-case') === mode;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.classList.toggle('is-active', active);
    });
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      convert(btn.getAttribute('data-case'));
    });
  });

  input.addEventListener('input', function () {
    renderStats(input.value);
    if (lastMode && input.value) convert(lastMode);
    else if (!input.value) {
      output.textContent = '';
      renderStats('');
      ToolBox.clearAlert(alertBox);
    }
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var text = output.textContent;
      if (!text) {
        ToolBox.showAlert(alertBox, 'error', 'There is no converted text to copy yet.');
        return;
      }
      ToolBox.copyText(text, 'Converted text copied');
      ToolBox.clearAlert(alertBox);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      input.value = '';
      output.textContent = '';
      lastMode = null;
      updateButtons(null);
      renderStats('');
      ToolBox.clearAlert(alertBox);
      input.focus();
      ToolBox.toast('Cleared');
    });
  }

  renderStats('');
})();
