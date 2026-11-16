const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  source: { type: String, enum: ['pro', 'photo'], required: true },
  name: { type: String, required: true, maxlength: 120 },
  email: { type: String, required: true, maxlength: 254 },
  phone: { type: String, default: '', maxlength: 40 },
  subject: { type: String, required: true, maxlength: 180 },
  projectType: { type: String, default: '', maxlength: 100 },
  message: { type: String, required: true, maxlength: 5000 },
  status: { type: String, enum: ['new', 'read', 'replied'], default: 'new' },
  adminNote: { type: String, default: '', maxlength: 4000 },
  whatsappSent: { type: Boolean, default: false },
  emailSent: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Contact', contactSchema);
