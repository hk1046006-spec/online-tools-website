/* ==========================================================================
   Image Compressor — /tools/image-compressor
   The file is compressed on the server with Sharp. Nothing is written to disk
   permanently: the upload is processed in memory and deleted right after the
   response is sent.
   ========================================================================== */
(function () {
  'use strict';

  var form = document.getElementById('icForm');
  var dropzone = document.getElementById('icDropzone');
  var fileInput = document.getElementById('icFile');
  var quality = document.getElementById('icQuality');
  var qualityValue = document.getElementById('icQualityValue');
  var formatSelect = document.getElementById('icFormat');
  var resizeSelect = document.getElementById('icResize');
  var alertBox = document.getElementById('icAlert');
  var statusEl = document.getElementById('icStatus');
  var results = document.getElementById('icResults');
  var originalImg = document.getElementById('icOriginalImg');
  var compressedImg = document.getElementById('icCompressedImg');
  var originalMeta = document.getElementById('icOriginalMeta');
  var compressedMeta = document.getElementById('icCompressedMeta');
  var downloadBtn = document.getElementById('icDownload');
  var resetBtn = document.getElementById('icReset');
  var submitBtn = document.getElementById('icCompress');
  var progressWrap = document.getElementById('icProgress');
  var progressBar = document.getElementById('icProgressBar');
  if (!form || !fileInput) return;

  var ACCEPTED_TYPES = ['image/jpeg', 'image/png'];
  var ACCEPTED_EXT = /\.(jpe?g|png)$/i;
  var REJECTED_EXT = /\.(exe|zip|rar|7z|tar|gz|pdf|js|mjs|php|php\d|html?|htm|txt|csv|sh|bat|cmd|msi|dll|so|py|rb|pl|svg|gif|bmp|tiff?|webp|avif|heic|ico|mp4|mov|mp3|wav|docx?|xlsx?|pptx?)$/i;
  var MAX_BYTES = 10 * 1024 * 1024; // 10 MB

  var selectedFile = null;
  var originalUrl = null;
  var resultUrl = null;
  var resultBlob = null;
  var resultName = 'compressed-image';

  /* ---------------- helpers ---------------- */

  function setStatus(message, type) {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.className = message ? 'muted' : 'muted';
    statusEl.style.color = type === 'error' ? 'var(--danger)' : '';
  }

  function setProgress(percent) {
    if (!progressWrap || !progressBar) return;
    if (percent === null) {
      progressWrap.hidden = true;
      progressBar.style.width = '0%';
      return;
    }
    progressWrap.hidden = false;
    progressBar.style.width = Math.max(0, Math.min(100, percent)) + '%';
  }

  function extensionOf(name) {
    var match = /\.([a-z0-9]+)$/i.exec(name || '');
    return match ? match[1].toLowerCase() : '';
  }

  function validate(file) {
    if (!file) return 'No file selected.';
    var ext = extensionOf(file.name);
    var type = (file.type || '').toLowerCase();

    if (REJECTED_EXT.test('.' + ext) && ACCEPTED_TYPES.indexOf(type) === -1) {
      return 'Files ending in .' + ext + ' are not supported. This tool accepts JPG and PNG images only.';
    }
    if (type && ACCEPTED_TYPES.indexOf(type) === -1) {
      return 'That file type (“' + (file.type || 'unknown') + '”) is not supported. This tool accepts JPG and PNG images only.';
    }
    if (!ACCEPTED_TYPES.includes(type) && !ACCEPTED_EXT.test(file.name || '')) {
      return 'Unsupported file. Please choose a .jpg, .jpeg or .png image.';
    }
    if (file.size === 0) {
      return 'That file is empty (0 bytes). Please choose a different image.';
    }
    if (file.size > MAX_BYTES) {
      return 'That image is ' + ToolBox.formatBytes(file.size) + ', which is larger than the 10 MB limit. Please pick a smaller file.';
    }
    return null;
  }

  function resetResults() {
    if (results) results.hidden = true;
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    originalUrl = null;
    resultUrl = null;
    resultBlob = null;
    if (originalImg) originalImg.removeAttribute('src');
    if (compressedImg) compressedImg.removeAttribute('src');
  }

  function clearAll() {
    resetResults();
    selectedFile = null;
    fileInput.value = '';
    setProgress(null);
    setStatus('');
    ToolBox.clearAlert(alertBox);
  }

  function handleFile(file) {
    var error = validate(file);
    ToolBox.clearAlert(alertBox);
    resetResults();

    if (error) {
      selectedFile = null;
      setStatus('');
      ToolBox.showAlert(alertBox, 'error', error);
      return;
    }

    selectedFile = file;
    originalUrl = URL.createObjectURL(file);
    if (originalImg) {
      originalImg.src = originalUrl;
      originalImg.alt = 'Preview of the selected image: ' + file.name;
    }
    if (originalMeta) {
      originalMeta.textContent = file.name + ' • ' + ToolBox.formatBytes(file.size) + ' • ' + (file.type || 'image');
    }
    setStatus('Ready — press “Compress image” to optimise ' + file.name + '.');
    ToolBox.showAlert(alertBox, 'info', 'Image loaded: ' + file.name + ' (' + ToolBox.formatBytes(file.size) + '). Choose a quality level and compress.');
  }

  function loadImageMeta(url, target) {
    if (!target) return;
    var probe = new Image();
    probe.onload = function () {
      target.dataset.dimensions = probe.naturalWidth + '×' + probe.naturalHeight;
      if (target === originalImg && originalMeta && selectedFile) {
        originalMeta.textContent =
          selectedFile.name + ' • ' + ToolBox.formatBytes(selectedFile.size) + ' • ' +
          probe.naturalWidth + '×' + probe.naturalHeight + ' px • ' + (selectedFile.type || 'image');
      }
      if (target === compressedImg && compressedMeta && resultBlob) {
        compressedMeta.textContent =
          resultName + ' • ' + ToolBox.formatBytes(resultBlob.size) + ' • ' +
          probe.naturalWidth + '×' + probe.naturalHeight + ' px';
      }
    };
    probe.src = url;
  }

  /* ---------------- compress ---------------- */

  function compress() {
    if (!selectedFile) {
      ToolBox.showAlert(alertBox, 'error', 'Choose a JPG or PNG image first, then press “Compress image”.');
      return;
    }

    var body = new FormData();
    body.append('image', selectedFile, selectedFile.name);
    body.append('quality', quality ? quality.value : '75');
    body.append('format', formatSelect ? formatSelect.value : 'auto');
    body.append('maxWidth', resizeSelect ? resizeSelect.value : '0');

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/image/compress', true);
    xhr.responseType = 'json';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Compressing…';
    }
    setProgress(15);
    setStatus('Uploading ' + ToolBox.formatBytes(selectedFile.size) + '…');

    xhr.upload.addEventListener('progress', function (event) {
      if (!event.lengthComputable) return;
      setProgress(15 + (event.loaded / event.total) * 55);
    });

  xhr.addEventListener('load', function () {
      setProgress(100);
      var data = xhr.response;

      if (xhr.status >= 200 && xhr.status < 300 && data && data.success && data.dataUrl) {
        // The server returns the optimised image as a base64 data URL; turn it
        // into a Blob so the download button works with a real file.
        fetch(data.dataUrl)
          .then(function (response) {
            return response.blob();
          })
          .then(function (blob) {
            if (resultUrl) URL.revokeObjectURL(resultUrl);
            resultBlob = blob;
            resultUrl = URL.createObjectURL(blob);
            resultName = data.fileName || 'compressed-image';

            if (compressedImg) {
              compressedImg.src = resultUrl;
              compressedImg.alt = 'Preview of the compressed image (' + ToolBox.formatBytes(blob.size) + ')';
            }
            // Show the file name and size straight away; the dimensions are
            // appended as soon as the browser has decoded the preview.
            if (compressedMeta) {
              compressedMeta.textContent = resultName + ' • ' + ToolBox.formatBytes(blob.size);
            }
            loadImageMeta(resultUrl, compressedImg);

            var originalSize = data.originalSize || selectedFile.size;
            var compressedSize = blob.size;
            var saved = originalSize - compressedSize;
            var percent = data.reductionPercent != null
              ? data.reductionPercent
              : (originalSize ? (saved / originalSize) * 100 : 0);

            ToolBox.showAlert(
              alertBox,
              saved > 0 ? 'success' : 'warn',
              saved > 0
                ? 'Done. ' + ToolBox.formatBytes(originalSize) + ' → ' + ToolBox.formatBytes(compressedSize) +
                  ' (' + percent.toFixed(1) + '% smaller, ' + ToolBox.formatBytes(saved) + ' saved).'
                : 'Compression finished, but the file did not get smaller (' + percent.toFixed(1) + '%). ' +
                  'Try a lower quality setting, or keep the original if it is already optimised.'
            );
            setStatus(
              'Compressed with quality ' + data.quality +
              (data.width ? ' • ' + data.width + '×' + data.height + ' px' : '') +
              ' • output format: ' + (data.format || 'same as input') + '.'
            );
            if (results) results.hidden = false;
          })
          .catch(function () {
            ToolBox.showAlert(alertBox, 'error', 'The compressed image could not be prepared for download. Please try again.');
            setStatus('');
            setProgress(null);
          })
          .finally(function () {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Compress image';
            }
          });
      } else {
        var message = (data && (data.error || data.message)) || 'The image could not be compressed (HTTP ' + xhr.status + ').';
        ToolBox.showAlert(alertBox, 'error', message);
        setStatus('');
        setProgress(null);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Compress image';
        }
      }
    });

    xhr.addEventListener('error', function () {
      ToolBox.showAlert(alertBox, 'error', 'The upload failed — the connection to the server was interrupted. Please try again.');
      setStatus('');
      setProgress(null);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Compress image';
      }
    });

    xhr.addEventListener('abort', function () {
      setProgress(null);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Compress image';
      }
    });

    // The server answers with JSON containing a base64 data URL (see server.js).
    xhr.send(body);
  }

  /* ---------------- events ---------------- */

  if (quality) {
    var syncQuality = function () {
      if (qualityValue) qualityValue.textContent = quality.value + '%';
    };
    quality.addEventListener('input', syncQuality);
    syncQuality();
  }

  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  if (dropzone) {
    ['dragenter', 'dragover'].forEach(function (name) {
      dropzone.addEventListener(name, function (event) {
        event.preventDefault();
        dropzone.classList.add('is-dragover');
      });
    });
    ['dragleave', 'drop'].forEach(function (name) {
      dropzone.addEventListener(name, function (event) {
        event.preventDefault();
        dropzone.classList.remove('is-dragover');
      });
    });
    dropzone.addEventListener('drop', function (event) {
      var files = event.dataTransfer && event.dataTransfer.files;
      if (files && files.length) handleFile(files[0]);
    });
    dropzone.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        fileInput.click();
      }
    });
    dropzone.addEventListener('click', function () {
      fileInput.click();
    });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    compress();
  });

  if (downloadBtn) {
    downloadBtn.addEventListener('click', function () {
      if (!resultBlob) {
        ToolBox.showAlert(alertBox, 'error', 'Compress an image first, then download the result.');
        return;
      }
      ToolBox.downloadBlob(resultBlob, resultName);
      ToolBox.toast('Downloading ' + resultName);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      clearAll();
      ToolBox.toast('Reset — choose another image');
    });
  }

  // Prevent the browser from opening a dropped file when it misses the dropzone.
  ['dragover', 'drop'].forEach(function (name) {
    window.addEventListener(name, function (event) {
      if (!event.target.closest || !event.target.closest('#icDropzone')) event.preventDefault();
    });
  });
})();
