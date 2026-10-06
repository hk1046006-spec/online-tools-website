/* ==========================================================================
   Password Generator — /tools/password-generator
   Secure random values come from window.crypto (never Math.random).
   Runs entirely in the browser: nothing is ever sent to the server.
   ========================================================================== */
(function () {
  'use strict';

  var output = document.getElementById('pwOutput');
  var lengthInput = document.getElementById('pwLength');
  var lengthValue = document.getElementById('pwLengthValue');
  var upper = document.getElementById('optUpper');
  var lower = document.getElementById('optLower');
  var numbers = document.getElementById('optNumbers');
  var symbols = document.getElementById('optSymbols');
  var excludeSimilar = document.getElementById('optExcludeSimilar');
  var generateBtn = document.getElementById('pwGenerate');
  var copyBtn = document.getElementById('pwCopy');
  var clearBtn = document.getElementById('pwClear');
  var alertBox = document.getElementById('pwAlert');
  var strengthBar = document.getElementById('pwStrengthBar');
  var strengthText = document.getElementById('pwStrengthText');
  var entropyText = document.getElementById('pwEntropy');
  var history = document.getElementById('pwHistory');
  if (!output || !lengthInput) return;

  var SETS = {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()-_=+[]{};:,.?/',
  };
  var SIMILAR = /[Il1O0o]/g;

  /* --- Cryptographically secure helpers ---
     All randomness comes from window.crypto; a non-cryptographic fallback is
     deliberately not provided, because a predictable password is worse than a
     clear error message. */
  function randomInt(maxExclusive) {
    if (maxExclusive <= 0) throw new Error('Invalid range');
    var cryptoObj = window.crypto || window.msCrypto;
    if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
      throw new Error('This browser does not expose the Web Crypto API, so a secure password cannot be generated here.');
    }
    // Rejection sampling keeps the distribution uniform.
    var limit = Math.floor(0xffffffff / maxExclusive) * maxExclusive;
    var buf = new Uint32Array(1);
    var value;
    do {
      cryptoObj.getRandomValues(buf);
      value = buf[0];
    } while (value >= limit);
    return value % maxExclusive;
  }

  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i -= 1) {
      var j = randomInt(i + 1);
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  function activeSets() {
    var sets = [];
    if (upper && upper.checked) sets.push(SETS.upper);
    if (lower && lower.checked) sets.push(SETS.lower);
    if (numbers && numbers.checked) sets.push(SETS.numbers);
    if (symbols && symbols.checked) sets.push(SETS.symbols);
    if (excludeSimilar && excludeSimilar.checked) {
      sets = sets.map(function (set) {
        return set.replace(SIMILAR, '');
      });
    }
    return sets.filter(function (set) {
      return set.length > 0;
    });
  }

  function strengthOf(length, poolSize) {
    if (!length || !poolSize) return { label: '—', percent: 0, bits: 0 };
    var bits = Math.round(length * (Math.log(poolSize) / Math.log(2)));
    var percent = Math.max(6, Math.min(100, Math.round((bits / 128) * 100)));
    var label;
    if (bits < 40) label = 'Weak';
    else if (bits < 60) label = 'Fair';
    else if (bits < 80) label = 'Strong';
    else label = 'Very strong';
    return { label: label, percent: percent, bits: bits };
  }

  function updateReadout() {
    if (lengthValue) lengthValue.textContent = lengthInput.value;
  }

  function updateStrength(poolSize) {
    var strength = strengthOf(Number(lengthInput.value), poolSize || 0);
    if (strengthBar) strengthBar.style.width = strength.percent + '%';
    if (strengthText) strengthText.textContent = strength.label;
    if (entropyText) {
      entropyText.textContent = strength.bits
        ? strength.bits + ' bits of entropy (pool of ' + poolSize + ' characters)'
        : 'Enable at least one character type to generate a password.';
    }
  }

  function generate() {
    var sets = activeSets();
    if (!sets.length) {
      ToolBox.showAlert(
        alertBox,
        'error',
        'Select at least one character type (upper case, lower case, numbers or symbols) before generating a password.'
      );
      output.textContent = '';
      updateStrength(0);
      return;
    }

    var length = Math.max(4, Math.min(128, Number(lengthInput.value) || 16));
    var pool = sets.join('');
    var chars = [];
    var password;

    try {
      // Guarantee at least one character from every selected set.
      sets.forEach(function (set) {
        chars.push(set[randomInt(set.length)]);
      });
      while (chars.length < length) {
        chars.push(pool[randomInt(pool.length)]);
      }
      password = shuffle(chars).slice(0, length).join('');
    } catch (error) {
      ToolBox.showAlert(alertBox, 'error', error.message || 'A secure password could not be generated in this browser.');
      output.textContent = '';
      updateStrength(0);
      return;
    }

    output.textContent = password;
    ToolBox.clearAlert(alertBox);
    updateStrength(pool.length);
    addToHistory(password);
    ToolBox.toast('Password generated');
  }

  function addToHistory(password) {
    if (!history) return;
    var item = document.createElement('li');
    var code = document.createElement('code');
    code.className = 'output-text';
    code.textContent = password;
    item.appendChild(code);
    var time = document.createElement('span');
    time.className = 'muted';
    time.style.fontSize = '0.75rem';
    time.textContent = new Date().toLocaleTimeString();
    item.appendChild(time);
    history.insertBefore(item, history.firstChild);
    while (history.children.length > 5) history.removeChild(history.lastChild);
  }

  lengthInput.addEventListener('input', function () {
    updateReadout();
    var sets = activeSets();
    updateStrength(sets.length ? sets.join('').length : 0);
  });

  [upper, lower, numbers, symbols, excludeSimilar].forEach(function (box) {
    if (!box) return;
    box.addEventListener('change', function () {
      var sets = activeSets();
      var poolSize = sets.length ? sets.join('').length : 0;
      updateStrength(poolSize);
      if (!sets.length) {
        ToolBox.showAlert(alertBox, 'error', 'All character types are switched off. Enable at least one to continue.');
      } else {
        ToolBox.clearAlert(alertBox);
      }
    });
  });

  if (generateBtn) {
    generateBtn.addEventListener('click', function () {
      generate();
      updateReadout();
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var password = output.textContent;
      if (!password) {
        ToolBox.showAlert(alertBox, 'error', 'Generate a password first, then copy it.');
        return;
      }
      ToolBox.copyText(password, 'Password copied to clipboard');
      ToolBox.clearAlert(alertBox);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      output.textContent = '';
      if (history) history.innerHTML = '';
      ToolBox.clearAlert(alertBox);
      updateStrength(activeSets().length ? activeSets().join('').length : 0);
      ToolBox.toast('Cleared');
    });
  }

  // Initial state: length readout, strength meter and a first password.
  updateReadout();
  generate();
})();
