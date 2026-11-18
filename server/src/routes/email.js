const express = require('express');
const { verifyAccess, verifyCsrf } = require('../middleware/auth');
const { rateLimits } = require('../middleware/rateLimits');
const { sendContactEmail } = require('../services/email');

const router = express.Router();

router.use(verifyAccess);

router.post('/test', verifyCsrf, rateLimits.adminWrite, async (_req, res, next) => {
  try {
    const result = await sendContactEmail({
      source: 'admin',
      name: 'Portfolio CMS',
      email: String(process.env.GMAIL_USER || '').trim(),
      subject: 'Email delivery test',
      message: 'This is a test of the portfolio contact email configuration.'
    });
    if (!result.sent) {
      return res.status(503).json({
        error: 'Email test could not be sent.',
        code: result.errorCode || 'EMAIL_SEND_FAILED',
        responseCode: result.responseCode
      });
    }
    return res.json({ sent: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
