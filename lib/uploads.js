'use strict';

/**
 * Image upload pipeline.
 *
 * Safety rules enforced for every uploaded file:
 *   1. MIME type must be image/jpeg, image/png or image/webp (checked before
 *      anything is read and again after the file has been received).
 *   2. Size is capped by multer (5 MB for content images).
 *   3. The actual bytes must be a real, decodable image — verified with Sharp.
 *      A script renamed to ".jpg" fails here even if the MIME type was faked.
 *   4. The stored filename is random; the user-supplied name is never used.
 *   5. Files are saved only into the dedicated upload directories, and they are
 *      only ever served as static files (never executed, never interpreted).
 */

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const store = require('./store');

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);

/** Max size for admin content images (5 MB as documented). */
const CONTENT_MAX_BYTES = 5 * 1024 * 1024;

/** Max size for the public image compressor (10 MB). */
const COMPRESS_MAX_BYTES = 10 * 1024 * 1024;

function makeUploader(maxBytes) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1, fields: 12 },
    fileFilter(req, file, cb) {
      const mime = String(file.mimetype || '').toLowerCase();
      if (!ALLOWED_MIME.includes(mime)) {
        const error = new Error(
          `That file type (${mime || 'unknown'}) is not supported. Allowed formats: JPG, PNG and WebP.`
        );
        error.code = 'UNSUPPORTED_TYPE';
        cb(error);
        return;
      }
      cb(null, true);
    },
  });
}

/**
 * Validate a buffer as a real image and re-encode it.
 *
 * @param {Buffer} buffer        raw upload
 * @param {object} options
 * @param {number} [options.maxWidth=2000]  longest edge limit
 * @param {number} [options.quality=82]     encoder quality for jpeg/webp
 * @param {string} [options.forceFormat]    'jpeg' | 'png' | 'webp' (optional)
 * @returns {Promise<{buffer: Buffer, format: string, width: number, height: number, size: number, originalFormat: string}>}
 */
async function processImage(buffer, options = {}) {
  const maxWidth = Number.isFinite(options.maxWidth) ? options.maxWidth : 2000;
  const quality = Math.min(100, Math.max(10, Number(options.quality) || 82));

  let pipeline;
  let metadata;
  try {
    metadata = await sharp(buffer, { failOn: 'error' }).metadata();
  } catch (err) {
    const error = new Error('That file is not a valid image, or it is corrupt and could not be read.');
    error.code = 'INVALID_IMAGE';
    throw error;
  }

  if (!metadata || !metadata.format) {
    const error = new Error('That file could not be recognised as an image.');
    error.code = 'INVALID_IMAGE';
    throw error;
  }
  if (!ALLOWED_FORMATS.has(metadata.format)) {
    const error = new Error(
      `The image format “${metadata.format}” is not supported. Allowed formats: JPG, PNG and WebP.`
    );
    error.code = 'UNSUPPORTED_TYPE';
    throw error;
  }

  const targetFormat = ALLOWED_FORMATS.has(options.forceFormat) ? options.forceFormat : metadata.format;

  pipeline = sharp(buffer, { failOn: 'error' }).rotate(); // honour EXIF orientation
  if (maxWidth > 0 && (metadata.width || 0) > maxWidth) {
    pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true, fit: 'inside' });
  }

  if (targetFormat === 'jpeg') {
    pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality, mozjpeg: true, progressive: true });
  } else if (targetFormat === 'png') {
    pipeline = pipeline.png({ compressionLevel: 9, palette: quality < 80, effort: 7 });
  } else {
    pipeline = pipeline.webp({ quality: Math.min(quality, 95), effort: 5 });
  }

  let output;
  try {
    output = await pipeline.toBuffer({ resolveWithObject: true });
  } catch (err) {
    const error = new Error('The image could not be processed. Try a different file or a smaller image.');
    error.code = 'PROCESS_FAILED';
    throw error;
  }

  return {
    buffer: output.data,
    format: targetFormat,
    width: output.info.width,
    height: output.info.height,
    size: output.data.length,
    originalFormat: metadata.format,
  };
}

function extensionFor(format) {
  if (format === 'jpeg') return '.jpg';
  if (format === 'png') return '.png';
  return '.webp';
}

/**
 * Store an uploaded image (already validated) plus its thumbnail.
 *
 * @param {Buffer} buffer
 * @param {string} folder one of images | logo | banners | thumbnails
 * @param {object} [options]
 * @returns {Promise<{name, fileName, folder, url, thumbnail, thumbnailUrl, width, height, size, format, createdAt}>}
 */
async function saveImage(buffer, folder, options = {}) {
  if (!store.UPLOAD_SUBDIRS.includes(folder)) {
    const error = new Error('Unknown upload folder.');
    error.code = 'BAD_FOLDER';
    throw error;
  }

  const processed = await processImage(buffer, {
    maxWidth: options.maxWidth || (folder === 'logo' ? 512 : 2000),
    quality: options.quality || 82,
    forceFormat: options.forceFormat,
  });

  const fileName = store.randomFileName(extensionFor(processed.format));
  const dir = path.join(store.UPLOAD_DIR, folder);
  const thumbDir = path.join(store.UPLOAD_DIR, 'thumbnails');
  store.bootstrap(); // guarantees the directories exist

  fs.writeFileSync(path.join(dir, fileName), processed.buffer);

  // Thumbnail (used by the admin library; the public site can use it too).
  let thumbName = '';
  try {
    const thumb = await sharp(processed.buffer)
      .resize({ width: 400, withoutEnlargement: true, fit: 'inside' })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
    thumbName = fileName.replace(/\.[a-z0-9]+$/i, '.jpg');
    fs.writeFileSync(path.join(thumbDir, thumbName), thumb);
  } catch (err) {
    // A missing thumbnail must never break an upload.
    thumbName = '';
  }

  const relative = `${folder}/${fileName}`;
  return {
    name: relative,
    fileName,
    folder,
    url: `/uploads/${relative}`,
    thumbnail: thumbName ? `thumbnails/${thumbName}` : relative,
    thumbnailUrl: thumbName ? `/uploads/thumbnails/${thumbName}` : `/uploads/${relative}`,
    width: processed.width,
    height: processed.height,
    size: processed.size,
    format: processed.format,
    originalFormat: processed.originalFormat,
    createdAt: new Date().toISOString(),
  };
}

/** Delete a stored image (and its thumbnail). Returns true when a file was removed. */
function deleteImage(folder, name) {
  const target = store.uploadPath(folder, name);
  if (!target) return false;
  let removed = false;
  try {
    fs.unlinkSync(target);
    removed = true;
  } catch (err) {
    removed = false;
  }
  // Remove the matching thumbnail if there is one.
  const thumbName = String(name).replace(/\.[a-z0-9]+$/i, '.jpg');
  const thumbTarget = store.uploadPath('thumbnails', thumbName);
  if (thumbTarget) {
    try {
      fs.unlinkSync(thumbTarget);
    } catch (err) {
      /* no thumbnail — nothing to do */
    }
  }
  return removed;
}

/** Total size of the upload directories, for the dashboard. */
function uploadsDiskUsage() {
  let bytes = 0;
  let files = 0;
  const registry = store.listUploads();
  Object.keys(registry).forEach((folder) => {
    registry[folder].forEach((entry) => {
      bytes += entry.size;
      files += 1;
    });
  });
  return { bytes, files };
}

module.exports = {
  ALLOWED_MIME,
  CONTENT_MAX_BYTES,
  COMPRESS_MAX_BYTES,
  makeUploader,
  processImage,
  saveImage,
  deleteImage,
  extensionFor,
  uploadsDiskUsage,
};
