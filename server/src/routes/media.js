const express = require('express');
const Media = require('../models/Media');
const { verifyAccess, verifyCsrf } = require('../middleware/auth');
const { rateLimits } = require('../middleware/rateLimits');
const { upload, videoUpload, verifyUploadedFile, virusScanPlaceholder } = require('../middleware/upload');
const { uploadToCloudinary, deleteFromCloudinary } = require('../services/cloudinary');
const router = express.Router();
const folders = new Set(['pro-portfolio', 'photo-gallery', 'photo-videos', 'documents']);

async function saveUpload(req, res, next) {
  try {
    const file = req.verifiedFile;
    const folder = folders.has(req.body.folder) ? req.body.folder : 'pro-portfolio';
    const maxBytes = file.resourceType === 'video' ? 200 : file.resourceType === 'document' ? 10 : 25;
    if (file.size > maxBytes * 1024 * 1024) return res.status(413).json({ error: 'File is too large' });
    const result = await uploadToCloudinary(file.buffer, file.mimetype, folder);
    const url = result.resourceType === 'image' || result.resourceType === 'video'
      ? result.secure_url.replace('/upload/', '/upload/f_auto,q_auto/')
      : file.mimetype === 'application/pdf'
        ? result.secure_url.replace('/upload/', '/upload/fl_inline/')
      : result.secure_url;
    const media = await Media.create({
      publicId: result.public_id, url, resourceType: result.resourceType,
      folder, size: result.bytes, width: result.width, height: result.height
    });
    return res.status(201).json({ media });
  } catch (error) {
    return next(error);
  }
}

const secureUpload = [verifyAccess, verifyCsrf, rateLimits.upload];
router.post('/upload', ...secureUpload, upload, verifyUploadedFile, virusScanPlaceholder, saveUpload);
router.post('/upload/video', ...secureUpload, videoUpload, verifyUploadedFile, virusScanPlaceholder, saveUpload);

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

router.delete('/:id', verifyAccess, verifyCsrf, rateLimits.adminWrite, async (req, res, next) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ error: 'Media not found' });
    await deleteFromCloudinary(media.publicId, media.resourceType === 'raw' ? 'raw' : media.resourceType);
    await media.deleteOne();
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
