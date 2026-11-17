const Busboy = require('busboy');
const { Transform, Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { randomUUID } = require('node:crypto');
const { uploadToCloudinaryStream, deleteFromCloudinary } = require('../services/cloudinary');

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;
const uploadLimits = Object.freeze({
  image: 200 * MiB,
  video: 10 * GiB,
  document: 10 * MiB
});
const folders = new Set(['pro-portfolio', 'photo-gallery', 'photo-videos', 'documents']);
const allowedTypes = new Map([
  ['image/jpeg', 'image'], ['image/png', 'image'], ['image/webp', 'image'],
  ['image/avif', 'image'], ['video/mp4', 'video'], ['video/quicktime', 'video'],
  ['application/pdf', 'document']
]);

function requestError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function sniffStream(fileStream) {
  const iterator = fileStream[Symbol.asyncIterator]();
  const sample = [];
  let sampleSize = 0;
  let ended = false;

  while (sampleSize < 4100) {
    const result = await iterator.next();
    if (result.done) {
      ended = true;
      break;
    }
    sample.push(result.value);
    sampleSize += result.value.length;
  }

  const { fileTypeFromBuffer } = await import('file-type');
  const detected = sampleSize ? await fileTypeFromBuffer(Buffer.concat(sample)) : undefined;
  const stream = Readable.from((async function* replay() {
    yield* sample;
    if (!ended) {
      while (true) {
        const result = await iterator.next();
        if (result.done) break;
        yield result.value;
      }
    }
  })());
  return { detected, stream };
}

function createMediaUpload({
  allowVideos = false,
  uploadStream = uploadToCloudinaryStream,
  removeAsset = deleteFromCloudinary
} = {}) {
  return function receiveMediaUpload(req, _res, next) {
    let parser;
    try {
      parser = Busboy({
        headers: req.headers,
        limits: {
          files: 1,
          fields: 4,
          fieldSize: 1024,
          fileSize: (allowVideos ? uploadLimits.video : uploadLimits.image) + 1
        }
      });
    } catch (error) {
      return next(requestError(error.message));
    }

    let folder = 'pro-portfolio';
    let fileReceived = false;
    let fileTask;
    let parseError;

    parser.on('field', (name, value) => {
      if (name === 'folder') folder = value;
    });
    parser.on('file', (name, fileStream, info) => {
      if (name !== 'file' || fileReceived) {
        fileStream.resume();
        parseError = requestError('Upload exactly one file using the file field');
        return;
      }
      fileReceived = true;
      fileTask = (async () => {
        const mimeType = info.mimeType.toLowerCase();
        const resourceType = allowedTypes.get(mimeType);
        if (!resourceType || (allowVideos ? resourceType !== 'video' : resourceType === 'video')) {
          fileStream.resume();
          throw requestError(allowVideos ? 'Only video files are accepted on this endpoint' : 'Unsupported file type');
        }

        const { detected, stream } = await sniffStream(fileStream);
        if (!detected || detected.mime !== mimeType) {
          stream.resume();
          throw requestError('File content does not match its declared type');
        }

        const maxSize = uploadLimits[resourceType];
        const targetFolder = folders.has(folder) ? folder : 'pro-portfolio';
        let size = 0;
        let tooLarge = false;
        const limiter = new Transform({
          transform(chunk, _encoding, callback) {
            size += chunk.length;
            if (size > maxSize) {
              tooLarge = true;
              return callback();
            }
            return callback(null, chunk);
          }
        });
        fileStream.on('limit', () => { tooLarge = true; });
        const publicId = randomUUID() + (resourceType === 'document' ? '.pdf' : '');

        let cloudinaryStream;
        const uploaded = new Promise((resolve, reject) => {
          cloudinaryStream = uploadStream({
            folder: targetFolder,
            publicId,
            resourceType
          }, (error, result) => error ? reject(error) : resolve(result));
        });

        try {
          const transfer = pipeline(stream, limiter, cloudinaryStream);
          const [result] = await Promise.all([uploaded, transfer]);
          req.verifiedFile = { result: { ...result, resourceType }, folder: targetFolder, size };
          if (tooLarge) {
            await removeAsset(result.public_id, resourceType === 'document' ? 'raw' : resourceType);
            delete req.verifiedFile;
            throw requestError(`File exceeds the ${resourceType} upload limit`, 413);
          }
        } catch (error) {
          cloudinaryStream?.destroy();
          throw error;
        }
      })().catch((error) => {
        fileStream.resume();
        parseError = error;
      });
    });
    parser.on('filesLimit', () => { parseError = requestError('Upload exactly one file'); });
    parser.on('fieldsLimit', () => { parseError = requestError('Too many upload fields'); });
    parser.on('error', (error) => { parseError = error; });
    parser.on('finish', async () => {
      try {
        if (fileTask) await fileTask;
        if (parseError) {
          if (req.verifiedFile?.result?.public_id) {
            const resourceType = req.verifiedFile.result.resourceType;
            await removeAsset(req.verifiedFile.result.public_id, resourceType === 'document' ? 'raw' : resourceType);
            delete req.verifiedFile;
          }
          return next(parseError);
        }
        if (!fileReceived) return next(requestError('A file is required'));
        return next();
      } catch (error) {
        return next(error);
      }
    });

    req.pipe(parser);
  };
}

function virusScanPlaceholder(_req, _res, next) {
  // TODO: run an approved ClamAV scan before production media upload.
  return next();
}

module.exports = { createMediaUpload, uploadLimits, virusScanPlaceholder };
