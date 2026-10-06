/* ==========================================================================
   QR Code Generator — /tools/qr-code-generator
   The QR bitmap is rendered on the server (qrcode) and returned as a PNG data
   URL, so the downloaded file is guaranteed to contain exactly what was typed.
   ========================================================================== */
(function () {
  'use strict';

  var form = document.getElementById('qrForm');
  var input = document.getElementById('qrInput');
  var sizeSelect = document.getElementById('qrSize');
  var levelSelect = document.getElementById('qrLevel');
  var alertBox = document.getElementById('qrAlert');
  var output = document.getElementById('qrOutput');
  var image = document.getElementById('qrImage');
  var meta = document.getElementById('qrMeta');
  var downloadBtn = document.getElementById('qrDownload');
  var copyBtn = document.getElementById('qrCopyText');
  var clearBtn = document.getElementById('qrClear');
  var submitBtn = document.getElementById('qrSubmit');
  if (!form || !input) return;

  var MAX_LENGTH = 2000;
  var last = { dataUrl: '', text: '', size: 0 };

  input.addEventListener('input', function () {
    var len = input.value.length;
    if (len > MAX_LENGTH) {
      ToolBox.showAlert(alertBox, 'error', 'Please keep the content under ' + MAX_LENGTH + ' characters (' + len + ' used).');
    } else if (len > 0) {
      ToolBox.clearAlert(alertBox);
    }
  });

  function setLoading(loading) {
    if (!submitBtn) return;
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? 'Generating…' : 'Generate QR code';
  }

  function generate() {
    var text = input.value.trim();
    if (!text) {
      ToolBox.showAlert(alertBox, 'error', 'Please enter some text or a URL before generating a QR code.');
      input.focus();
      return;
    }
    if (text.length > MAX_LENGTH) {
      ToolBox.showAlert(alertBox, 'error', 'That content is ' + text.length + ' characters long. The limit is ' + MAX_LENGTH + '.');
      return;
    }

    setLoading(true);
    ToolBox.showAlert(alertBox, 'info', 'Generating your QR code…');

    fetch('/api/qr/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        size: Number(sizeSelect && sizeSelect.value) || 320,
        level: (levelSelect && levelSelect.value) || 'M',
      }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok || !result.data || !result.data.dataUrl) {
          throw new Error((result.data && result.data.error) || 'The QR code could not be generated.');
        }
        last = {
          dataUrl: result.data.dataUrl,
          text: result.data.text || text,
          size: result.data.size || 320,
        };
        image.src = result.data.dataUrl;
        image.alt = 'QR code containing: ' + last.text.slice(0, 120);
        image.width = last.size;
        image.height = last.size;
        output.hidden = false;
        if (meta) {
          meta.textContent =
            'Contents: ' + last.text +
            ' • ' + last.size + '×' + last.size + ' px PNG • error correction ' + (result.data.level || 'M');
        }
        ToolBox.clearAlert(alertBox);
        ToolBox.toast('QR code generated');
      })
      .catch(function (error) {
        ToolBox.showAlert(alertBox, 'error', error.message || 'Something went wrong while generating the QR code.');
      })
      .finally(function () {
        setLoading(false);
      });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    generate();
  });

  if (downloadBtn) {
    downloadBtn.addEventListener('click', function () {
      if (!last.dataUrl) {
        ToolBox.showAlert(alertBox, 'error', 'Generate a QR code first, then download it.');
        return;
      }
      var name = 'qr-code-' + last.size + 'px.png';
      ToolBox.downloadDataUrl(last.dataUrl, name);
      ToolBox.toast('Downloading ' + name);
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var text = image && image.src ? last.text : input.value;
      if (!text) {
        ToolBox.showAlert(alertBox, 'error', 'Nothing to copy yet.');
        return;
      }
      ToolBox.copyText(text, 'QR contents copied');
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      input.value = '';
      last = { dataUrl: '', text: '', size: 0 };
      if (image) image.removeAttribute('src');
      output.hidden = true;
      ToolBox.clearAlert(alertBox);
      input.focus();
      ToolBox.toast('Cleared');
    });
  }

  // Example chips fill the input with a realistic value.
  ToolBox.qsa('[data-qr-example]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      input.value = chip.getAttribute('data-qr-example');
      input.focus();
      ToolBox.toast('Example inserted — press Generate');
    });
  });

  // Support deep links such as /tools/qr-code-generator?text=...&generate=1
  var params = new URLSearchParams(window.location.search);
  var preset = params.get('text');
  if (preset) {
    input.value = preset;
    if (params.get('generate') === '1') generate();
  }
})();
