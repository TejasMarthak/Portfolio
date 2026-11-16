const mongoose = require('mongoose');

const proContentSchema = new mongoose.Schema({
  singleton: { type: String, default: 'default', unique: true, immutable: true },
  hero: { type: mongoose.Schema.Types.Mixed, default: {} },
  about: { type: mongoose.Schema.Types.Mixed, default: {} },
  skills: { type: [mongoose.Schema.Types.Mixed], default: [] },
  projects: { type: [mongoose.Schema.Types.Mixed], default: [] },
  hobby: { type: mongoose.Schema.Types.Mixed, default: {} },
  resume: { type: mongoose.Schema.Types.Mixed, default: {} },
  seo: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true, minimize: false });

module.exports = mongoose.model('ProContent', proContentSchema);
