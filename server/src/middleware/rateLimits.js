const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const Redis = require('ioredis');

let redis;
let store;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
  redis.on('error', (error) => console.error('[redis] connection error:', error.code || error.name));
  store = new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: 'portfolio:rl:'
  });
} else if (process.env.NODE_ENV === 'production') {
  throw new Error('REDIS_URL is required in production for shared rate limits');
} else {
  console.warn('[rate-limit] Redis unavailable; development uses per-process limits');
}

function limiter(windowMs, limit, message, prefix) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: store ? new RedisStore({
      sendCommand: (...args) => redis.call(...args),
      prefix: `portfolio:${prefix}:`
    }) : undefined,
    handler: (_req, res) => res.status(429).json({ error: message })
  });
}

const rateLimits = {
  general: limiter(15 * 60 * 1000, 100, 'Too many requests', 'general-v2'),
  contact: limiter(60 * 60 * 1000, 5, 'Too many contact requests', 'contact'),
  authStart: limiter(15 * 60 * 1000, 30, 'Too many sign-in requests. Try again shortly.', 'auth-start-v2'),
  authCallback: limiter(60 * 60 * 1000, 10, 'Too many authentication attempts. Try again later.', 'auth-callback-v3'),
  authRefresh: limiter(15 * 60 * 1000, 30, 'Too many session refresh requests. Try again shortly.', 'auth-refresh-v2'),
  whatsapp: limiter(60 * 60 * 1000, 10, 'Too many WhatsApp pairing attempts. Wait before trying again.', 'whatsapp-v3'),
  whatsappStatus: limiter(15 * 60 * 1000, 1000, 'Too many WhatsApp status requests. Try again shortly.', 'whatsapp-status-v1'),
  adminWrite: limiter(15 * 60 * 1000, 60, 'Too many changes', 'admin-write'),
  upload: limiter(60 * 60 * 1000, 20, 'Too many uploads', 'upload')
};

module.exports = { rateLimits, redis };
