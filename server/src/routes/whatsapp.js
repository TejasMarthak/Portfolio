const express = require('express');
const { verifyAccess, verifyCsrf } = require('../middleware/auth');
const { rateLimits } = require('../middleware/rateLimits');
const {
  startWhatsAppLinking,
  requestWhatsAppPairingCode,
  disconnectWhatsApp,
  getWhatsAppStatus,
  sendWhatsAppTestMessage
} = require('../services/whatsapp');

const router = express.Router();

router.use(verifyAccess);

router.get('/', (_req, res) => {
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

router.post('/pairing-code', verifyCsrf, rateLimits.whatsapp, async (req, res, next) => {
  try {
    const whatsapp = await requestWhatsAppPairingCode(req.body?.phoneNumber);
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
