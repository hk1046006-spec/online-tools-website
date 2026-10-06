/* ==========================================================================
   Word Counter — /tools/word-counter
   Everything is counted live in the browser while you type.
   ========================================================================== */
(function () {
  'use strict';

  var input = document.getElementById('wcInput');
  var alertBox = document.getElementById('wcAlert');
  var clearBtn = document.getElementById('wcClear');
  var copyBtn = document.getElementById('wcCopy');
  if (!input) return;

  var WORDS_PER_MINUTE = 200; // average adult reading speed for plain prose
  var out = {
    words: document.getElementById('wcWords'),
    chars: document.getElementById('wcChars'),
    charsNoSpaces: document.getElementById('wcCharsNoSpaces'),
    sentences: document.getElementById('wcSentences'),
    paragraphs: document.getElementById('wcParagraphs'),
    lines: document.getElementById('wcLines'),
    readTime: document.getElementById('wcReadTime'),
    speakTime: document.getElementById('wcSpeakTime'),
    longest: document.getElementById('wcLongest'),
    avgWords: document.getElementById('wcAvgWords'),
    topWords: document.getElementById('wcTopWords'),
  };

  var LIMIT_HINT = 'Start typing above — every figure below updates as you write.';

  function countAll(text) {
    var trimmed = text.trim();

    var words = trimmed ? trimmed.split(/\s+/).length : 0;

    var sentences = trimmed
      ? trimmed
          .split(/[.!?…]+(?:["'”’)\]]*)(?=\s|$)/)
          .map(function (s) {
            return s.trim();
          })
          .filter(function (s) {
            return s.length > 0;
          }).length
      : 0;

    // A paragraph is a run of text separated by one or more blank lines.
    var paragraphs = trimmed
      ? trimmed
          .split(/\n\s*\n/)
          .map(function (p) {
            return p.trim();
          })
          .filter(function (p) {
            return p.length > 0;
          }).length
      : 0;

    var lines = text.length ? text.split(/\r\n|\r|\n/).filter(function (l) { return l.trim().length > 0; }).length : 0;

    var charsNoSpaces = text.replace(/\s/g, '').length;

    return {
      words: words,
      chars: text.length,
      charsNoSpaces: charsNoSpaces,
      sentences: sentences,
      paragraphs: paragraphs,
      lines: lines,
    };
  }

  function formatDuration(minutes) {
    if (!minutes || minutes <= 0) return '0 min';
    if (minutes < 1) {
      var seconds = Math.max(1, Math.round(minutes * 60));
      return seconds + ' sec';
    }
    var whole = Math.floor(minutes);
    var rest = Math.round((minutes - whole) * 60);
    return rest ? whole + ' min ' + rest + ' sec' : whole + ' min';
  }

  function number(value) {
    return (value || 0).toLocaleString('en-US');
  }

  function render(text) {
    var c = countAll(text);
    if (out.words) out.words.textContent = number(c.words);
    if (out.chars) out.chars.textContent = number(c.chars);
    if (out.charsNoSpaces) out.charsNoSpaces.textContent = number(c.charsNoSpaces);
    if (out.sentences) out.sentences.textContent = number(c.sentences);
    if (out.paragraphs) out.paragraphs.textContent = number(c.paragraphs);
    if (out.lines) out.lines.textContent = number(c.lines);

    if (out.readTime) out.readTime.textContent = formatDuration(c.words / WORDS_PER_MINUTE);
    if (out.speakTime) out.speakTime.textContent = formatDuration(c.words / 130);
    if (out.avgWords) {
      out.avgWords.textContent = c.sentences ? Math.round(c.words / c.sentences) + ' words' : '0 words';
    }

    var wordList = text.toLowerCase().match(/[a-z\u00e0-\u00ff']{2,}/g) || [];
    var longest = '';
    wordList.forEach(function (w) {
      if (w.length > longest.length) longest = w;
    });
    if (out.longest) {
      out.longest.textContent = longest ? longest + ' (' + longest.length + ' letters)' : '—';
    }

    if (out.topWords) {
      if (!wordList.length) {
        out.topWords.innerHTML = '<li class="muted">No repeated words yet.</li>';
      } else {
        var freq = {};
        wordList.forEach(function (w) {
          freq[w] = (freq[w] || 0) + 1;
        });
        var top = Object.keys(freq)
          .filter(function (w) {
            return freq[w] > 1;
          })
          .sort(function (a, b) {
            return freq[b] - freq[a] || a.localeCompare(b);
          })
          .slice(0, 6);
        out.topWords.innerHTML = top.length
          ? top
              .map(function (w) {
                return '<li><span class="badge">' + freq[w] + '×</span> ' + escapeHtml(w) + '</li>';
              })
              .join('')
          : '<li class="muted">No word is repeated yet.</li>';
      }
    }

    if (alertBox) {
      if (!text) ToolBox.showAlert(alertBox, 'info', LIMIT_HINT);
      else ToolBox.clearAlert(alertBox);
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  input.addEventListener('input', function () {
    render(input.value);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      input.value = '';
      render('');
      input.focus();
      ToolBox.toast('Cleared');
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      if (!input.value) {
        ToolBox.toast('There is nothing to copy yet');
        return;
      }
      ToolBox.copyText(input.value, 'Text copied to clipboard');
    });
  }

  // Sensible zero state on load.
  render(input.value);
})();
