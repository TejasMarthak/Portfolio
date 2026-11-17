const mongoose = require('mongoose');

const siteSettingsSchema = new mongoose.Schema({
  singleton: { type: String, default: 'default', unique: true, immutable: true },
  social: { type: mongoose.Schema.Types.Mixed, default: {} },
  sections: { type: mongoose.Schema.Types.Mixed, default: {} },
  contact: { type: mongoose.Schema.Types.Mixed, default: {} },
  proSite: { type: mongoose.Schema.Types.Mixed, default: { live: true } },
  photoSite: { type: mongoose.Schema.Types.Mixed, default: { live: true } },
  analytics: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true, minimize: false });

module.exports = mongoose.model('SiteSettings', siteSettingsSchema);
