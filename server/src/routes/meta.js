const express = require('express');
const ProContent = require('../models/ProContent');
const PhotoContent = require('../models/PhotoContent');
const router = express.Router();

router.get('/sitemap.xml', async (_req, res, next) => {
  try {
    const [pro, photo] = await Promise.all([ProContent.findOne().lean(), PhotoContent.findOne().lean()]);
    const origins = [process.env.PRO_CLIENT_URL, process.env.PHOTO_CLIENT_URL].filter(Boolean);
    const urls = origins.map((origin, index) => {
      const seo = index === 0 ? pro?.seo : photo?.seo;
      return `<url><loc>${escapeXml(origin)}</loc>${seo?.updatedAt ? `<lastmod>${new Date(seo.updatedAt).toISOString()}</lastmod>` : ''}</url>`;
    }).join('');
    res.type('application/xml');
    return res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
  } catch (error) {
    return next(error);
  }
});

router.get('/robots.txt', (_req, res) => {
  const sitemap = process.env.SERVER_URL ? `${process.env.SERVER_URL.replace(/\/$/, '')}/sitemap.xml` : '';
  return res.type('text/plain').send(`User-agent: *\nAllow: /\n${sitemap ? `Sitemap: ${sitemap}\n` : ''}`);
});

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, (char) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'
  }[char]));
}

module.exports = router;
