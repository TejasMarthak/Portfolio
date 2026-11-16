const mongoose = require('mongoose');

const tokenRevocationSchema = new mongoose.Schema({
  jti: { type: String, required: true, unique: true },
  revokedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, expires: 0 }
});

module.exports = mongoose.model('TokenRevocation', tokenRevocationSchema);
