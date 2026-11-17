const ProContent = require('../models/ProContent');
const PhotoContent = require('../models/PhotoContent');

const collections = { pro: ProContent, photo: PhotoContent };
const allowedSections = {
  pro: new Set(['hero', 'about', 'skills', 'projects', 'hobby', 'resume', 'seo']),
  photo: new Set(['hero', 'gallery', 'stories', 'reels', 'videos', 'clients', 'categories', 'about', 'seo'])
};

async function getContent(site) {
  const Model = collections[site];
  return Model.findOneAndUpdate({ singleton: 'default' }, { $setOnInsert: {} }, { upsert: true, new: true, setDefaultsOnInsert: true });
}

async function updateSection(site, section, value) {
  if (!allowedSections[site]?.has(section)) {
    const error = new Error('Unknown content section');
    error.status = 404;
    throw error;
  }
  const Model = collections[site];
  const safeValue = sanitize(value);
  return Model.findOneAndUpdate({ singleton: 'default' }, { $set: { [section]: safeValue } }, {
    upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true
  });
}

function sanitize(value, depth = 0) {
  if (depth > 20) return null;
  if (typeof value === 'string') {
    const clean = [...value].filter((character) => {
      const code = character.charCodeAt(0);
      return !(code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31));
    }).join('');
    return clean.slice(0, 10000);
  }
  if (Array.isArray(value)) return value.slice(0, 500).map((item) => sanitize(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 200)
      .filter(([key]) => !['__proto__', 'constructor', 'prototype'].includes(key))
      .map(([key, item]) => [key.replace(/[.$]/g, '').slice(0, 100), sanitize(item, depth + 1)]));
  }
  return value;
}

module.exports = { getContent, updateSection, sanitize };
