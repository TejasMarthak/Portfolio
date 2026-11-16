const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const AuthSession = require('../models/AuthSession');
const TokenRevocation = require('../models/TokenRevocation');
const { accessCookie, refreshCookie, setPairCookies, rotateRefresh } = require('../config/tokens');

async function verifyAccess(req, res, next) {
  try {
    let payload;
    try {
      payload = jwt.verify(req.cookies[accessCookie], process.env.JWT_ACCESS_SECRET);
    } catch (error) {
      if (!(error instanceof jwt.TokenExpiredError) || !req.cookies[refreshCookie]) throw error;
      const pair = await rotateRefresh(req.cookies[refreshCookie]);
      req.rotatedPair = pair;
      setPairCookies(res, pair, req.cookies.csrfToken);
      payload = jwt.verify(pair.accessToken, process.env.JWT_ACCESS_SECRET);
    }
    if (payload.type !== 'access' || !payload.sid || await TokenRevocation.exists({ jti: payload.jti }) ||
        !await AuthSession.exists({ sessionId: payload.sid, adminId: payload.sub, accessJti: payload.jti })) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const admin = await Admin.findOne({ _id: payload.sub, email: process.env.ADMIN_EMAIL?.toLowerCase() })
      .select('_id email name avatar role twoFAEnabled');
    if (!admin) return res.status(401).json({ error: 'Authentication required' });
    req.admin = admin;
    req.tokenPayload = payload;
    return next();
  } catch (error) {
    if (error.code === 'AUTH_INVALID' || error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return next(error);
  }
}

function verifyCsrf(req, res, next) {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return next();
  const cookie = req.cookies.csrfToken;
  const header = req.get('x-csrf-token');
  const cookieBuffer = Buffer.from(cookie || '');
  const headerBuffer = Buffer.from(header || '');
  if (!cookie || !header || cookieBuffer.length !== headerBuffer.length ||
      !require('crypto').timingSafeEqual(cookieBuffer, headerBuffer)) {
    return res.status(403).json({ error: 'Request could not be verified' });
  }
  return next();
}

module.exports = { verifyAccess, verifyCsrf };
