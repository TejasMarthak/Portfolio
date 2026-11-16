const express = require('express');
const { getContent, updateSection } = require('../services/content');
const { verifyAccess, verifyCsrf } = require('../middleware/auth');
const { rateLimits } = require('../middleware/rateLimits');

function createContentRouter(site) {
  const router = express.Router();
  router.get('/content', async (_req, res, next) => {
    try {
      const content = await getContent(site);
      res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
      return res.json({ content });
    } catch (error) {
      return next(error);
    }
  });
  router.patch('/:section', verifyAccess, verifyCsrf, rateLimits.adminWrite, async (req, res, next) => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'Invalid content payload' });
      }
      const content = await updateSection(site, req.params.section, req.body);
      return res.json({ content });
    } catch (error) {
      return next(error);
    }
  });
  router.post('/:section', verifyAccess, verifyCsrf, rateLimits.adminWrite, async (req, res, next) => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'Invalid content payload' });
      }
      const content = await updateSection(site, req.params.section, req.body);
      return res.status(201).json({ content });
    } catch (error) {
      return next(error);
    }
  });
  router.put('/:section', verifyAccess, verifyCsrf, rateLimits.adminWrite, async (req, res, next) => {
    try {
      const content = await updateSection(site, req.params.section, req.body);
      return res.json({ content });
    } catch (error) {
      return next(error);
    }
  });
  router.delete('/:section', verifyAccess, verifyCsrf, rateLimits.adminWrite, async (req, res, next) => {
    try {
      const arraySections = site === 'pro' ? ['skills', 'projects'] : ['gallery', 'stories', 'videos', 'clients'];
      const resetValue = arraySections.includes(req.params.section) ? [] : {};
      const content = await updateSection(site, req.params.section, resetValue);
      return res.json({ content });
    } catch (error) {
      return next(error);
    }
  });
  return router;
}

module.exports = { createContentRouter };
