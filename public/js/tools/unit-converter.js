/* ==========================================================================
   Unit Converter — /tools/unit-converter
   Length, weight and temperature. All maths runs in the browser.
   ========================================================================== */
(function () {
  'use strict';

  var category = document.getElementById('unitCategory');
  var fromSelect = document.getElementById('unitFrom');
  var toSelect = document.getElementById('unitTo');
  var input = document.getElementById('unitInput');
  var output = document.getElementById('unitOutput');
  var alertBox = document.getElementById('unitAlert');
  var swapBtn = document.getElementById('unitSwap');
  var clearBtn = document.getElementById('unitClear');
  var formulaBox = document.getElementById('unitFormula');
  var quickBox = document.getElementById('unitQuickTable');
  var copyBtn = document.getElementById('unitCopy');
  if (!category || !fromSelect || !toSelect || !input) return;

  /* Linear categories are defined as "how many base units in one unit". */
  var UNITS = {
    length: {
      label: 'Length',
      base: 'metre',
      units: [
        { id: 'mm', name: 'Millimeter (mm)', factor: 0.001 },
        { id: 'cm', name: 'Centimeter (cm)', factor: 0.01 },
        { id: 'm', name: 'Meter (m)', factor: 1 },
        { id: 'km', name: 'Kilometer (km)', factor: 1000 },
        { id: 'in', name: 'Inch (in)', factor: 0.0254 },
        { id: 'ft', name: 'Foot (ft)', factor: 0.3048 },
        { id: 'yd', name: 'Yard (yd)', factor: 0.9144 },
        { id: 'mi', name: 'Mile (mi)', factor: 1609.344 },
      ],
      defaults: ['cm', 'in'],
      samples: [1, 10, 100],
    },
    weight: {
      label: 'Weight',
      base: 'gram',
      units: [
        { id: 'mg', name: 'Milligram (mg)', factor: 0.001 },
        { id: 'g', name: 'Gram (g)', factor: 1 },
        { id: 'kg', name: 'Kilogram (kg)', factor: 1000 },
        { id: 'oz', name: 'Ounce (oz)', factor: 28.349523125 },
        { id: 'lb', name: 'Pound (lb)', factor: 453.59237 },
      ],
      defaults: ['kg', 'lb'],
      samples: [1, 10, 100],
    },
    temperature: {
      label: 'Temperature',
      special: true,
      units: [
        { id: 'c', name: 'Celsius (°C)' },
        { id: 'f', name: 'Fahrenheit (°F)' },
        { id: 'k', name: 'Kelvin (K)' },
      ],
      defaults: ['c', 'f'],
      samples: [0, 25, 100],
    },
  };

  function unitList(catKey) {
    return UNITS[catKey].units;
  }

  function unitById(catKey, id) {
    return unitList(catKey).filter(function (u) {
      return u.id === id;
    })[0];
  }

  function toCelsius(value, from) {
    if (from === 'c') return value;
    if (from === 'f') return (value - 32) * (5 / 9);
    return value - 273.15; // Kelvin
  }

  function fromCelsius(celsius, to) {
    if (to === 'c') return celsius;
    if (to === 'f') return celsius * (9 / 5) + 32;
    return celsius + 273.15; // Kelvin
  }

  function convert(value, catKey, fromId, toId) {
    if (catKey === 'temperature') {
      return fromCelsius(toCelsius(value, fromId), toId);
    }
    var from = unitById(catKey, fromId);
    var to = unitById(catKey, toId);
    if (!from || !to) return NaN;
    return (value * from.factor) / to.factor;
  }

  /** Formats a number for display without ever printing NaN or undefined. */
  function formatNumber(value) {
    if (typeof value !== 'number' || !isFinite(value)) return '—';
    if (value === 0) return '0';
    var abs = Math.abs(value);
    if (abs >= 1e12 || abs < 1e-9) return value.toExponential(6);
    var decimals = abs >= 1000 ? 4 : abs >= 1 ? 6 : 9;
    var rounded = Number(value.toFixed(decimals));
    return rounded.toLocaleString('en-US', { maximumFractionDigits: decimals });
  }

  function fillUnits(catKey, keep) {
    var list = unitList(catKey);
    var options = list
      .map(function (u) {
        return '<option value="' + u.id + '">' + u.name + '</option>';
      })
      .join('');
    fromSelect.innerHTML = options;
    toSelect.innerHTML = options;

    var defaults = UNITS[catKey].defaults;
    fromSelect.value = keep && unitById(catKey, keep.from) ? keep.from : defaults[0];
    toSelect.value = keep && unitById(catKey, keep.to) ? keep.to : defaults[1];
  }

  function updateQuickTable(catKey, fromId, toId, value) {
    if (!quickBox) return;
    var samples = UNITS[catKey].samples.slice();
    if (UNITS[catKey].special) samples = [-40, 0, 25, 37, 100, 212];
    var rows = samples
      .map(function (sample) {
        var result = convert(sample, catKey, fromId, toId);
        return (
          '<tr><td>' + formatNumber(sample) + '</td><td class="output-text">' +
          formatNumber(result) + '</td></tr>'
        );
      })
      .join('');
    quickBox.innerHTML =
      '<caption class="sr-only">Common conversions from the selected unit to the target unit</caption>' +
      '<thead><tr><th scope="col">' + unitLabel(catKey, fromId) + '</th><th scope="col">' + unitLabel(catKey, toId) + '</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>';
    if (typeof value === 'number' && isFinite(value)) {
      // Nothing extra: the live result is shown above the table.
    }
  }

  function unitLabel(catKey, id) {
    var unit = unitById(catKey, id);
    return unit ? unit.name : id;
  }

  function update(showErrors) {
    var catKey = category.value;
    var fromId = fromSelect.value;
    var toId = toSelect.value;
    var raw = input.value.trim();

    if (raw === '') {
      if (output) output.textContent = '—';
      if (formulaBox) formulaBox.textContent = 'Enter a value above to convert it instantly.';
      updateQuickTable(catKey, fromId, toId, null);
      if (showErrors) {
        ToolBox.showAlert(alertBox, 'info', 'Type a number to convert. Decimal and negative values are supported.');
      } else if (alertBox) {
        ToolBox.clearAlert(alertBox);
      }
      return;
    }

    var value = Number(raw.replace(/,/g, ''));
    if (!isFinite(value)) {
      if (output) output.textContent = '—';
      if (formulaBox) formulaBox.textContent = 'Only numbers can be converted.';
      ToolBox.showAlert(alertBox, 'error', '“' + input.value + '” is not a number. Enter digits only, for example 12.5 or -40.');
      input.setAttribute('aria-invalid', 'true');
      return;
    }

    input.removeAttribute('aria-invalid');
    var result = convert(value, catKey, fromId, toId);

    if (!isFinite(result)) {
      if (output) output.textContent = '—';
      ToolBox.showAlert(alertBox, 'error', 'That conversion could not be calculated. Check the units you selected.');
      return;
    }

    if (output) output.textContent = formatNumber(result) + ' ' + shortLabel(catKey, toId);
    if (formulaBox) formulaBox.textContent = formulaText(catKey, fromId, toId);
    updateQuickTable(catKey, fromId, toId, value);
    if (alertBox) ToolBox.clearAlert(alertBox);
  }

  function shortLabel(catKey, id) {
    var unit = unitById(catKey, id);
    if (!unit) return '';
    var match = unit.name.match(/\(([^)]+)\)/);
    if (match) return match[1];
    return unit.name;
  }

  function formulaText(catKey, fromId, toId) {
    if (catKey === 'temperature') {
      var map = {
        c: { f: '°F = °C × 9/5 + 32', k: 'K = °C + 273.15' },
        f: { c: '°C = (°F − 32) × 5/9', k: 'K = (°F − 32) × 5/9 + 273.15' },
        k: { c: '°C = K − 273.15', f: '°F = (K − 273.15) × 9/5 + 32' },
      };
      return (map[fromId] && map[fromId][toId]) || '°C = K − 273.15, °F = °C × 9/5 + 32';
    }
    var from = unitById(catKey, fromId);
    var to = unitById(catKey, toId);
    if (!from || !to) return '';
    var factor = from.factor / to.factor;
    return '1 ' + shortLabel(catKey, fromId) + ' = ' + formatNumber(factor) + ' ' + shortLabel(catKey, toId);
  }

  category.addEventListener('change', function () {
    fillUnits(category.value, null);
    update(false);
  });

  [fromSelect, toSelect].forEach(function (select) {
    select.addEventListener('change', function () {
      update(false);
    });
  });

  input.addEventListener('input', function () {
    update(false);
  });

  if (swapBtn) {
    swapBtn.addEventListener('click', function () {
      var from = fromSelect.value;
      fromSelect.value = toSelect.value;
      toSelect.value = from;
      update(false);
      ToolBox.toast('Units swapped');
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      input.value = '';
      input.removeAttribute('aria-invalid');
      update(false);
      input.focus();
      ToolBox.toast('Cleared');
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var value = output ? output.textContent : '';
      if (!value || value === '—') {
        ToolBox.showAlert(alertBox, 'error', 'There is no converted value to copy yet.');
        return;
      }
      var raw = input.value.trim() + ' ' + shortLabel(category.value, fromSelect.value) + ' = ' + value;
      ToolBox.copyText(raw, 'Conversion copied');
    });
  }

  // Deep links: /tools/unit-converter?category=weight&from=kg&to=lb&value=70
  var params = new URLSearchParams(window.location.search);
  var catParam = params.get('category');
  if (catParam && UNITS[catParam]) category.value = catParam;
  fillUnits(category.value, {
    from: params.get('from'),
    to: params.get('to'),
  });
  var valueParam = params.get('value');
  if (valueParam !== null && valueParam !== '') input.value = valueParam;
  update(false);
})();
