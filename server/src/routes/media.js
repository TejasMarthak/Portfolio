const express = require('express');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const Media = require('../models/Media');
const Admin = require('../models/Admin');
const { verifyAccess, verifyCsrf } = require('../middleware/auth');
const { rateLimits } = require('../middleware/rateLimits');
const { createMediaUpload } = require('../middleware/upload');
const { deleteFromCloudinary } = require('../services/cloudinary');
const { removeMediaReferences } = require('../services/mediaReferences');
const { deleteMediaAssets } = require('../services/deleteMediaAssets');
const ProContent = require('../models/ProContent');
const PhotoContent = require('../models/PhotoContent');
const router = express.Router();
const folders = new Set(['pro-portfolio', 'photo-gallery', 'photo-videos', 'documents', 'admin-profile']);

async function fetchPdfSource(url, range) {
  const request = (includeRange) => fetch(url, {
    redirect: 'error',
    headers: includeRange && range ? { range } : undefined
  });
  let upstream;
  try {
    upstream = await request(true);
  } catch (error) {
    if (!range) throw error;
    upstream = await request(false);
  }
  if (range && (![200, 206].includes(upstream.status) || !upstream.body)) {
    await upstream.body?.cancel();
    upstream = await request(false);
  }
  return upstream;
}

async function inlinePdf(req, res, next) {
  try {
    const publicId = typeof req.query.publicId === 'string' ? req.query.publicId : '';
    const folder = publicId.split('/')[0];
    if (!/^[A-Za-z0-9_./-]{1,512}$/i.test(publicId) ||
        !folders.has(folder) ||
        publicId.split('/').some((part) => !part || part === '.' || part === '..')) {
      return res.status(400).json({ error: 'Invalid PDF asset' });
    }

    const media = await Media.findOne({
      publicId: { $in: [publicId, `${publicId}.pdf`] },
      folder,
      resourceType: { $in: ['raw', 'image'] }
    }).lean();
    if (!media) return res.status(404).json({ error: 'PDF not found' });

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const source = new URL(media.url);
    const resourceType = media.resourceType;
    const expectedPath = `/${cloudName}/${resourceType}/upload/`;
    if (!cloudName || source.hostname !== 'res.cloudinary.com' || !source.pathname.startsWith(expectedPath)) {
      return res.status(502).json({ error: 'PDF delivery is not configured' });
    }
    if (!source.pathname.split('/').includes(folder) ||
        (folder !== 'documents' && !/\.pdf$/i.test(source.pathname))) {
      return res.status(404).json({ error: 'PDF not found' });
    }
    source.pathname = source.pathname.replace(
      new RegExp(`/${resourceType}/upload/(?:fl_inline|fl_attachment)(?:,[^/]*)?/`, 'i'),
      `/${resourceType}/upload/`
    );

    const range = req.get('range');
    const upstream = await fetchPdfSource(source.href, range);
    if (![200, 206].includes(upstream.status) || !upstream.body) {
      await upstream.body?.cancel();
      return res.status(502).json({ error: 'PDF could not be loaded from media storage' });
    }
    const upstreamType = upstream.headers.get('content-type') || '';
    if (!/^application\/(?:pdf|octet-stream)(?:;|$)/i.test(upstreamType)) {
      await upstream.body.cancel();
      return res.status(502).json({ error: 'Media storage returned an invalid PDF response' });
    }

    const reader = upstream.body.getReader();
    const prefixChunks = [];
    let prefixSize = 0;
    while (prefixSize < 5) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      prefixChunks.push(chunk);
      prefixSize += chunk.length;
    }
    const prefix = Buffer.concat(prefixChunks);
    const shouldVerifyHeader = !range || (/^bytes=0-/i.test(range) && prefix.length >= 5);
    if (shouldVerifyHeader && prefix.subarray(0, 5).toString() !== '%PDF-') {
      await reader.cancel();
      return res.status(502).json({ error: 'Media storage returned an invalid PDF file' });
    }

    let filename = media.publicId.split('/').pop().replace(/[^\w.-]/g, '_');
    if (!/\.pdf$/i.test(filename)) filename += '.pdf';
    res.status(upstream.status);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'public, max-age=900',
      'Accept-Ranges': 'bytes',
      'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Range, Content-Length',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Content-Security-Policy': pdfFramePolicy()
    });
    if (upstream.status === 206) {
      const contentRange = upstream.headers.get('content-range');
      const contentLength = upstream.headers.get('content-length');
      if (contentRange) res.set('Content-Range', contentRange);
      if (contentLength) res.set('Content-Length', contentLength);
    }
    res.removeHeader('X-Frame-Options');
    const body = Readable.from((async function* streamPdf() {
      if (prefix.length) yield prefix;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield Buffer.from(value);
      }
    })());
    await pipeline(body, res);
    return undefined;
  } catch (error) {
    if (res.headersSent) {
      res.destroy(error);
      return undefined;
    }
    return next(error);
  }
}

function pdfFramePolicy() {
  const localhostOrigins = [
    'http://localhost:5173', 'http://localhost:5174',
    'http://127.0.0.1:5173', 'http://127.0.0.1:5174'
  ];
  const origins = [...new Set([
    ...[process.env.PRO_CLIENT_URL, process.env.PHOTO_CLIENT_URL],
    ...localhostOrigins
  ].filter(Boolean).map((value) => {
    try {
      return new URL(value).origin;
    } catch {
      return '';
    }
  }).filter(Boolean))];
  return `default-src 'none'; frame-ancestors 'self' ${origins.join(' ')}`;
}

async function saveUpload(req, res, next) {
  try {
    const file = req.verifiedFile;
    const result = file.result;
    const url = result.resourceType === 'image' || result.resourceType === 'video'
      ? result.secure_url.replace('/upload/', '/upload/f_auto,q_auto/')
      : result.secure_url;
    let media;
    try {
      media = await Media.create({
        publicId: result.public_id, url, resourceType: result.resourceType === 'document' ? 'raw' : result.resourceType,
        folder: file.folder, size: file.size, width: result.width, height: result.height
      });
    } catch (error) {
      await deleteFromCloudinary(result.public_id, result.resourceType === 'document' ? 'raw' : result.resourceType);
      throw error;
    }
    return res.status(201).json({ media });
  } catch (error) {
    return next(error);
  }
}

async function clearPortfolioReferences(mediaItems) {
  if (!mediaItems.length) return;
  const contents = await Promise.all([
    ProContent.findOne({ singleton: 'default' }),
    PhotoContent.findOne({ singleton: 'default' })
  ]);
  await Promise.all(contents.map(async (content) => {
    if (!content) return;
    const values = content.toObject();
    const changedKeys = new Set();
    for (const media of mediaItems) {
      for (const [key, value] of Object.entries(values)) {
        if (['_id', '__v', 'singleton', 'createdAt', 'updatedAt'].includes(key)) continue;
        const result = removeMediaReferences(value, media);
        if (result.changed) {
          values[key] = result.value;
          changedKeys.add(key);
        }
      }
    }
    if (!changedKeys.size) return;
    for (const key of changedKeys) content.set(key, values[key]);
    await content.save();
  }));
  await Admin.updateMany(
    { avatar: { $in: mediaItems.map((media) => media.url) } },
    { $set: { avatar: '' } }
  );
}

const secureUpload = [verifyAccess, verifyCsrf, rateLimits.upload];
router.post('/upload', ...secureUpload, createMediaUpload(), saveUpload);
router.post('/upload/video', ...secureUpload, createMediaUpload({ allowVideos: true }), saveUpload);
router.get('/inline-pdf', inlinePdf);

router.get('/', verifyAccess, async (req, res, next) => {
  try {
    const filter = {};
    if (['image', 'video', 'raw'].includes(req.query.type)) filter.resourceType = req.query.type;
    if (folders.has(req.query.folder)) filter.folder = req.query.folder;
    const page = Math.min(100000, Math.max(1, Number(req.query.page) || 1));
    const [items, total] = await Promise.all([
      Media.find(filter).sort({ uploadedAt: -1 }).skip((page - 1) * 40).limit(40).lean(),
      Media.countDocuments(filter)
    ]);
    return res.json({ items, page, total });
  } catch (error) {
    return next(error);
  }
});

router.delete('/', verifyAccess, verifyCsrf, rateLimits.adminWrite, async (_req, res, next) => {
  try {
    const mediaItems = await Media.find({}).lean();
    const { deleted, failed } = await deleteMediaAssets(mediaItems, deleteFromCloudinary);
    if (!deleted.length) {
      if (failed.length) {
        return res.status(207).json({
          deleted: 0,
          failed: failed.length,
          total: mediaItems.length
        });
      }
      return res.json({ deleted: 0, failed: 0, total: 0 });
    }

    await clearPortfolioReferences(deleted);
    await Media.deleteMany({ _id: { $in: deleted.map((media) => media._id) } });
    return res.status(failed.length ? 207 : 200).json({
      deleted: deleted.length,
      failed: failed.length,
      total: mediaItems.length
    });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', verifyAccess, verifyCsrf, rateLimits.adminWrite, async (req, res, next) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ error: 'Media not found' });
    const deleted = await deleteFromCloudinary(media.publicId, media.resourceType);
    if (!['ok', 'not found'].includes(deleted.result)) {
      const error = new Error('Cloudinary did not confirm media deletion');
      error.status = 502;
      throw error;
    }
    await clearPortfolioReferences([media]);
    await media.deleteOne();
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
