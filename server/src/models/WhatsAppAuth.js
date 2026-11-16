const mongoose = require('mongoose');

const whatsappAuthSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true }
}, { versionKey: false });

module.exports = mongoose.model('WhatsAppAuth', whatsappAuthSchema);
