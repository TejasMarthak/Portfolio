const { redis } = require('./rateLimits');
const fallbackAttempts = new Map();
const lockDurationSeconds = 15 * 60;

function keyFor(req) {
  return `portfolio:auth-lock-v2:${req.ip}`;
}

async function checkLockout(req, res, next) {
  try {
    const key = keyFor(req);
    let attempts;
    if (redis) {
      attempts = Number(await redis.get(key) || 0);
    } else {
      const entry = fallbackAttempts.get(key);
      if (entry?.expiresAt <= Date.now()) fallbackAttempts.delete(key);
      attempts = entry?.expiresAt > Date.now() ? entry.count : 0;
    }
    if (attempts >= 5) return res.status(429).json({ error: 'Sign-in temporarily locked; try again later' });
    return next();
  } catch (error) {
    return next(error);
  }
}

async function recordFailure(req) {
  const key = keyFor(req);
  if (redis) {
    const attempts = await redis.incr(key);
    if (attempts === 1) await redis.expire(key, lockDurationSeconds);
    return;
  }
  const entry = fallbackAttempts.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    fallbackAttempts.set(key, { count: 1, expiresAt: Date.now() + lockDurationSeconds * 1000 });
  } else {
    entry.count += 1;
  }
}

async function clearFailures(req) {
  const key = keyFor(req);
  if (redis) await redis.del(key);
  else fallbackAttempts.delete(key);
}

module.exports = { checkLockout, recordFailure, clearFailures };
