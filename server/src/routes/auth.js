const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const passport = require('../config/passport');
const { rateLimits } = require('../middleware/rateLimits');
const { verifyAccess, verifyCsrf } = require('../middleware/auth');
const { checkLockout, recordFailure, clearFailures } = require('../middleware/authLockout');
const {
  issuePair, setPairCookies, clearPairCookies, revokeToken, rotateRefresh, refreshCookie, accessCookie
} = require('../config/tokens');
const AuthSession = require('../models/AuthSession');
const Admin = require('../models/Admin');
const Media = require('../models/Media');
const { createOAuthState, consumeOAuthState } = require('../services/oauthState');
const router = express.Router();

router.get('/status', (_req, res) => res.json({
  googleSignInConfigured: Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CALLBACK_URL &&
    process.env.ADMIN_EMAIL
  )
}));

router.get('/google', rateLimits.authStart, checkLockout, async (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'Google sign-in is not configured' });
  try {
    const state = await createOAuthState();
    return passport.authenticate('google', { scope: ['profile', 'email'], session: false, state })(req, res, next);
  } catch (error) {
    return next(error);
  }
});
router.get('/google/callback', rateLimits.authCallback, checkLockout, async (req, res, next) => {
  try {
    if (!await consumeOAuthState(req.query.state)) {
      await recordFailure(req);
      return res.status(403).json({ error: 'Sign-in request could not be verified' });
    }
  } catch (error) {
    return next(error);
  }
  passport.authenticate('google', { session: false }, (error, admin) => {
    if (error) return next(error);
    if (!admin) {
      return recordFailure(req).then(() => res.status(403).json({ error: 'Access denied' })).catch(next);
    }
    return clearFailures(req).then(async () => {
      setPairCookies(res, await issuePair(admin));
      return res.redirect(process.env.ADMIN_CLIENT_URL || '/');
    }).catch(next);
  })(req, res, next);
});
router.post('/refresh', rateLimits.authRefresh, verifyCsrf, async (req, res, next) => {
  try {
    if (!req.cookies[refreshCookie]) return res.status(401).json({ error: 'Authentication required' });
    const pair = await rotateRefresh(req.cookies[refreshCookie]);
    setPairCookies(res, pair, req.cookies.csrfToken);
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});
router.post('/logout', verifyAccess, verifyCsrf, async (req, res, next) => {
  try {
    const access = req.tokenPayload || jwt.decode(req.cookies[accessCookie]);
    const refresh = jwt.decode(req.cookies[refreshCookie]);
    await Promise.all([
      access && revokeToken(access.jti, access.exp),
      refresh && revokeToken(refresh.jti, refresh.exp),
      req.rotatedPair && revokeToken(req.rotatedPair.refreshJti, jwt.decode(req.rotatedPair.refreshToken).exp),
      (req.tokenPayload || access)?.sid && AuthSession.deleteOne({ sessionId: (req.tokenPayload || access).sid })
    ]);
    clearPairCookies(res);
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});
router.post('/session/invalidate', verifyAccess, verifyCsrf, async (req, res, next) => {
  try {
    const access = req.tokenPayload || jwt.decode(req.cookies[accessCookie]);
    const refresh = jwt.decode(req.cookies[refreshCookie]);
    await Promise.all([
      access && revokeToken(access.jti, access.exp),
      refresh && revokeToken(refresh.jti, refresh.exp),
      req.rotatedPair && revokeToken(req.rotatedPair.refreshJti, jwt.decode(req.rotatedPair.refreshToken).exp),
      (req.tokenPayload || access)?.sid && AuthSession.deleteOne({ sessionId: (req.tokenPayload || access).sid })
    ]);
    clearPairCookies(res);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});
router.get('/me', verifyAccess, (req, res) => res.json({
  user: req.admin,
  csrfToken: req.cookies.csrfToken || ''
}));

router.patch('/me/avatar', verifyAccess, verifyCsrf, rateLimits.adminWrite, async (req, res, next) => {
  const { mediaId } = req.body || {};
  if (typeof mediaId !== 'string' || !mongoose.isValidObjectId(mediaId)) {
    return res.status(400).json({ error: 'A valid uploaded profile photo is required' });
  }
  try {
    const media = await Media.findOne({
      _id: mediaId,
      folder: 'admin-profile',
      resourceType: 'image'
    }).select('url').lean();
    if (!media) return res.status(404).json({ error: 'Profile photo not found' });
    const user = await Admin.findByIdAndUpdate(
      req.admin._id,
      { avatar: media.url },
      { new: true, runValidators: true }
    ).select('_id email name avatar role twoFAEnabled');
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
