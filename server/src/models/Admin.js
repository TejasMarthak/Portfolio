const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  name: { type: String, required: true },
  avatar: { type: String, default: '' },
  role: { type: String, enum: ['admin'], default: 'admin' },
  twoFASecret: { type: String, default: null, select: false },
  twoFAEnabled: { type: Boolean, default: false },
  lastLogin: { type: Date },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
