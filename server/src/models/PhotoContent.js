const mongoose = require('mongoose');

const photoContentSchema = new mongoose.Schema({
  singleton: { type: String, default: 'default', unique: true, immutable: true },
  hero: { type: mongoose.Schema.Types.Mixed, default: {} },
  gallery: { type: [mongoose.Schema.Types.Mixed], default: [] },
  stories: { type: [mongoose.Schema.Types.Mixed], default: [] },
  reels: { type: [mongoose.Schema.Types.Mixed], default: [] },
  videos: { type: [mongoose.Schema.Types.Mixed], default: [] },
  clients: { type: [mongoose.Schema.Types.Mixed], default: [] },
  categories: { type: mongoose.Schema.Types.Mixed, default: { gallery: [], stories: [], reels: [], videos: [] } },
  about: { type: mongoose.Schema.Types.Mixed, default: {} },
  seo: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true, minimize: false });

module.exports = mongoose.model('PhotoContent', photoContentSchema);
