const mongoose = require('mongoose');

const authSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
  accessJti: { type: String, required: true, unique: true },
  refreshJti: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true });

module.exports = mongoose.model('AuthSession', authSessionSchema);
