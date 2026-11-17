const express = require('express');
const SiteSettings = require('../models/SiteSettings');
const { verifyAccess, verifyCsrf } = require('../middleware/auth');
const { rateLimits } = require('../middleware/rateLimits');
const { sanitize } = require('../services/content');
const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const settings = await SiteSettings.findOneAndUpdate({ singleton: 'default' }, { $setOnInsert: {} }, {
      upsert: true, new: true, setDefaultsOnInsert: true
    });
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    return res.json({ settings });
  } catch (error) {
    return next(error);
  }
});

router.patch('/', verifyAccess, verifyCsrf, rateLimits.adminWrite, async (req, res, next) => {
  try {
    const permitted = ['social', 'sections', 'contact', 'proSite', 'photoSite', 'analytics'];
    const update = Object.fromEntries(Object.entries(req.body || {})
      .filter(([key]) => permitted.includes(key))
      .map(([key, value]) => [key, sanitize(value)]));
    const settings = await SiteSettings.findOneAndUpdate({ singleton: 'default' }, { $set: update }, {
      upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true
    });
    return res.json({ settings });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
