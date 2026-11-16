const multer = require('multer');

const allowedTypes = new Map([
  ['image/jpeg', 'image'], ['image/png', 'image'], ['image/webp', 'image'],
  ['image/avif', 'image'], ['video/mp4', 'video'], ['video/quicktime', 'video'],
  ['application/pdf', 'document']
]);

function createUpload({ maxSize, allowVideos }) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSize, files: 1, fields: 4, fieldSize: 1024 },
    fileFilter: (_req, file, callback) => {
      if (!allowedTypes.has(file.mimetype)) return callback(new Error('Unsupported file type'));
      if (!allowVideos && allowedTypes.get(file.mimetype) === 'video') {
        return callback(new Error('Video uploads use the dedicated video upload endpoint'));
      }
      if (allowVideos && allowedTypes.get(file.mimetype) !== 'video') {
        return callback(new Error('Only video files are accepted on this endpoint'));
      }
      return callback(null, true);
    }
  }).single('file');
}

const upload = createUpload({ maxSize: 25 * 1024 * 1024, allowVideos: false });
const videoUpload = createUpload({ maxSize: 200 * 1024 * 1024, allowVideos: true });

async function verifyUploadedFile(req, _res, next) {
  try {
    if (!req.file) return next(new Error('A file is required'));
    const { fileTypeFromBuffer } = await import('file-type');
    const detected = await fileTypeFromBuffer(req.file.buffer);
    if (detected?.mime !== req.file.mimetype) return next(new Error('File content does not match its declared type'));
    req.verifiedFile = { ...req.file, resourceType: allowedTypes.get(detected.mime) };
    return next();
  } catch (error) {
    return next(error);
  }
}

function virusScanPlaceholder(_req, _res, next) {
  // TODO: run an approved ClamAV scan before production media upload.
  return next();
}

module.exports = { upload, videoUpload, verifyUploadedFile, virusScanPlaceholder };
