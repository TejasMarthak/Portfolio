const express = require('express');
const { verifyAccess, verifyCsrf } = require('../middleware/auth');
const { rateLimits } = require('../middleware/rateLimits');
const { normalizeWhatsAppPhoneNumber } = require('../utils/whatsappPhoneNumber');
const {
  startWhatsAppLinking,
  requestWhatsAppPairingCode,
  disconnectWhatsApp,
  getWhatsAppStatus,
  sendWhatsAppTestMessage
} = require('../services/whatsapp');

const router = express.Router();

function validatePairingNumber(req, res, next) {
  const phoneNumber = normalizeWhatsAppPhoneNumber(req.body?.phoneNumber);
  if (!phoneNumber) {
    return res.status(400).json({
      error: 'Enter a valid international mobile number. Indian numbers need +91 and 10 mobile digits.'
    });
  }
  req.whatsappPhoneNumber = phoneNumber;
  return next();
}

router.use(verifyAccess);

router.get('/', rateLimits.whatsappStatus, (_req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.json({ whatsapp: getWhatsAppStatus() });
});

router.post('/connect', verifyCsrf, rateLimits.whatsapp, async (_req, res, next) => {
  try {
    const whatsapp = await startWhatsAppLinking('qr');
    res.set('Cache-Control', 'no-store');
    return res.status(202).json({ whatsapp });
  } catch (error) {
    return next(error);
  }
});

router.post('/pairing-code', verifyCsrf, validatePairingNumber, rateLimits.whatsapp, async (req, res, next) => {
  try {
    const whatsapp = await requestWhatsAppPairingCode(req.whatsappPhoneNumber);
    res.set('Cache-Control', 'no-store');
    return res.json({ whatsapp });
  } catch (error) {
    return next(error);
  }
});

router.post('/disconnect', verifyCsrf, rateLimits.adminWrite, async (_req, res, next) => {
  try {
    const whatsapp = await disconnectWhatsApp();
    return res.json({ whatsapp });
  } catch (error) {
    return next(error);
  }
});

router.post('/test', verifyCsrf, rateLimits.adminWrite, async (_req, res, next) => {
  try {
    const result = await sendWhatsAppTestMessage();
    if (!result.sent) return res.status(503).json({ error: result.error || 'WhatsApp test message could not be sent.' });
    return res.json({ sent: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
