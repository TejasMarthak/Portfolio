const express = require('express');
const jwt = require('jsonwebtoken');
const passport = require('../config/passport');
const { rateLimits } = require('../middleware/rateLimits');
const { verifyAccess, verifyCsrf } = require('../middleware/auth');
const { checkLockout, recordFailure, clearFailures } = require('../middleware/authLockout');
const { issuePair, setPairCookies, revokeToken, rotateRefresh, refreshCookie, accessCookie } = require('../config/tokens');
const AuthSession = require('../models/AuthSession');
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
    res.clearCookie(accessCookie, { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
    res.clearCookie(refreshCookie, { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
    res.clearCookie('csrfToken', { path: '/', secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
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
    res.clearCookie(accessCookie, { path: '/' });
    res.clearCookie(refreshCookie, { path: '/' });
    res.clearCookie('csrfToken', { path: '/' });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});
router.get('/me', verifyAccess, (req, res) => res.json({
  user: req.admin,
  csrfToken: req.cookies.csrfToken || ''
}));

module.exports = router;
