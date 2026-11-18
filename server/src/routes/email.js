const express = require('express');
const { verifyAccess, verifyCsrf } = require('../middleware/auth');
const { rateLimits } = require('../middleware/rateLimits');

const router = express.Router();

router.use(verifyAccess);

router.post('/test', verifyCsrf, rateLimits.adminWrite, (_req, res) => {
  const recipient = String(process.env.GMAIL_USER || '').trim();
  if (!recipient) {
    return res.status(503).json({
      error: 'Email test could not be sent.',
      code: 'EMAIL_CONFIG_MISSING'
    });
  }
  return res.json({ recipient });
});

module.exports = router;
