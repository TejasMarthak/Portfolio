const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  publicId: { type: String, required: true, unique: true },
  url: { type: String, required: true },
  resourceType: { type: String, enum: ['image', 'video', 'raw'], required: true },
  folder: { type: String, required: true },
  size: Number,
  width: Number,
  height: Number
}, { timestamps: { createdAt: 'uploadedAt', updatedAt: false } });

module.exports = mongoose.model('Media', mediaSchema);
