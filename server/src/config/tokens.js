const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const AuthSession = require('../models/AuthSession');
const TokenRevocation = require('../models/TokenRevocation');

const accessCookie = 'accessToken';
const refreshCookie = 'refreshToken';
const cookieSameSite = process.env.NODE_ENV === 'production' ? 'none' : 'strict';
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: cookieSameSite,
  path: '/'
};
const csrfCookieOptions = {
  secure: process.env.NODE_ENV === 'production',
  sameSite: cookieSameSite,
  path: '/'
};

function assertSecrets() {
  if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.length < 32 ||
      !process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) {
    throw new Error('JWT secrets of at least 32 characters are required');
  }
}

async function issuePair(admin) {
  assertSecrets();
  const accessJti = crypto.randomUUID();
  const refreshJti = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const identity = { sub: String(admin._id), email: admin.email };
  const accessToken = jwt.sign({ ...identity, jti: accessJti, sid: sessionId, type: 'access' }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m'
  });
  const accessExp = jwt.decode(accessToken).exp;
  const refreshToken = jwt.sign({
    ...identity, jti: refreshJti, accessJti, accessExp, sid: sessionId, type: 'refresh'
  }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '30d'
  });
  const refreshExp = jwt.decode(refreshToken).exp;
  await AuthSession.create({
    sessionId, adminId: admin._id, accessJti, refreshJti,
    expiresAt: new Date(refreshExp * 1000)
  });
  return { accessToken, refreshToken, accessJti, refreshJti };
}

function setPairCookies(res, pair, csrfToken) {
  const accessExp = jwt.decode(pair.accessToken)?.exp;
  const refreshExp = jwt.decode(pair.refreshToken)?.exp;
  res.cookie(accessCookie, pair.accessToken, { ...cookieOptions, maxAge: Math.max(0, accessExp * 1000 - Date.now()) });
  res.cookie(refreshCookie, pair.refreshToken, { ...cookieOptions, maxAge: Math.max(0, refreshExp * 1000 - Date.now()) });
  res.cookie('csrfToken', csrfToken || crypto.randomBytes(32).toString('hex'), csrfCookieOptions);
}

function clearPairCookies(res) {
  res.clearCookie(accessCookie, cookieOptions);
  res.clearCookie(refreshCookie, cookieOptions);
  res.clearCookie('csrfToken', csrfCookieOptions);
}

async function revokeToken(jti, exp) {
  if (!jti || !exp) return;
  await TokenRevocation.updateOne(
    { jti },
    { $setOnInsert: { jti, expiresAt: new Date(exp * 1000) } },
    { upsert: true }
  );
}

async function rotateRefresh(token) {
  const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  if (payload.type !== 'refresh' || !payload.sid || await TokenRevocation.exists({ jti: payload.jti })) {
    const error = new Error('Authentication required');
    error.code = 'AUTH_INVALID';
    throw error;
  }
  const session = await AuthSession.findOneAndDelete({
    sessionId: payload.sid,
    adminId: payload.sub,
    refreshJti: payload.jti,
    accessJti: payload.accessJti
  });
  if (!session) {
    const error = new Error('Authentication required');
    error.code = 'AUTH_INVALID';
    throw error;
  }
  const Admin = require('../models/Admin');
  const admin = await Admin.findOne({ _id: payload.sub, email: process.env.ADMIN_EMAIL?.toLowerCase() });
  if (!admin) {
    const error = new Error('Authentication required');
    error.code = 'AUTH_INVALID';
    throw error;
  }
  await Promise.all([
    revokeToken(payload.jti, payload.exp),
    payload.accessJti ? revokeToken(payload.accessJti, payload.accessExp) : Promise.resolve()
  ]);
  return issuePair(admin);
}

module.exports = {
  accessCookie, refreshCookie, cookieOptions, csrfCookieOptions, issuePair, setPairCookies,
  clearPairCookies, revokeToken, rotateRefresh
};
