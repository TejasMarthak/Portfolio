const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const compression = require('compression');
const morgan = require('morgan');
const passport = require('./config/passport');
const { rateLimits } = require('./middleware/rateLimits');
const { createContentRouter } = require('./routes/content');
const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contact');
const mediaRoutes = require('./routes/media');
const whatsappRoutes = require('./routes/whatsapp');
const settingsRoutes = require('./routes/settings');
const metaRoutes = require('./routes/meta');
const { getLastPing } = require('./jobs/keepAlive');
const { redis } = require('./middleware/rateLimits');

const app = express();
const clientOrigins = [
  process.env.PRO_CLIENT_URL,
  process.env.PHOTO_CLIENT_URL,
  process.env.ADMIN_CLIENT_URL
].filter(Boolean);

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.get('/ping', (_req, res) => res.status(200).send('OK'));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
      mediaSrc: ["'self'", 'https://res.cloudinary.com'],
      connectSrc: ["'self'", ...clientOrigins],
      frameAncestors: ["'none'"]
    }
  },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    if (!process.env.SERVER_URL) return res.status(400).json({ error: 'HTTPS is required' });
    const publicOrigin = new URL(process.env.SERVER_URL);
    if (publicOrigin.protocol !== 'https:') return res.status(400).json({ error: 'HTTPS is required' });
    return res.redirect(301, `${publicOrigin.origin}${req.originalUrl}`);
  }
  return next();
});
app.use(cors({
  origin(origin, callback) {
    if (!origin || clientOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token']
}));
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(xss());
app.use(compression());
app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/ping') return next();
  return rateLimits.general(req, res, next);
});
app.use(morgan((tokens, req, res) => JSON.stringify({
  event: 'http_request',
  method: tokens.method(req, res),
  path: req.path,
  status: Number(tokens.status(req, res)),
  durationMs: Number(tokens['response-time'](req, res)),
  ip: req.ip
}), { skip: (req) => req.path === '/ping' || req.path === '/health' }));
const authFailureCounts = new Map();
app.use((req, res, next) => {
  if (req.path === '/ping' || req.path === '/health') return next();
  res.on('finish', () => {
    if (res.statusCode !== 401 && res.statusCode !== 403) return;
    const key = `portfolio:security:auth-failure:${req.ip}`;
    const record = redis
      ? redis.incr(key).then(async (count) => {
        if (count === 1) await redis.expire(key, 15 * 60);
        if (count === 5) console.warn('[security] repeated 401/403 responses from client IP', req.ip);
      })
      : Promise.resolve().then(() => {
        const now = Date.now();
        const previous = authFailureCounts.get(key);
        const count = previous && previous.expiresAt > now ? previous.count + 1 : 1;
        authFailureCounts.set(key, { count, expiresAt: now + 15 * 60 * 1000 });
        if (count === 5) console.warn('[security] repeated 401/403 responses from client IP', req.ip);
      });
    record.catch((error) => console.error('[security] failed to record authentication response:', error.code || error.name));
  });
  return next();
});
app.use(passport.initialize());

app.get('/health', (_req, res) => res.json({
  status: 'ok',
  uptime: process.uptime(),
  ts: new Date().toISOString(),
  lastPing: getLastPing()
}));
app.use('/api/auth', authRoutes);
app.use('/api/pro', createContentRouter('pro'));
app.use('/api/photo', createContentRouter('photo'));
app.use('/api/contact', contactRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/', metaRoutes);
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

app.use((error, _req, res, _next) => {
  if (error.message === 'Origin is not allowed by CORS') {
    return res.status(403).json({ error: 'Request origin is not allowed' });
  }
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid request' });
  }
  if (error.code === 'AUTH_INVALID' || error instanceof require('jsonwebtoken').JsonWebTokenError) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (error.type === 'entity.too.large' || (error.name === 'MulterError' && error.code === 'LIMIT_FILE_SIZE')) {
    return res.status(413).json({ error: 'Request is too large' });
  }
  if (error instanceof SyntaxError && error.status === 400 && Object.hasOwn(error, 'body')) {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  if (error.name === 'MulterError' || error.message === 'Unsupported file type' ||
      error.message === 'Video uploads use the dedicated video upload endpoint' ||
      error.message === 'Only video files are accepted on this endpoint' ||
      error.message === 'A file is required' || error.message.startsWith('File content')) {
    return res.status(400).json({ error: error.message });
  }
  const status = Number(error.status) >= 400 && Number(error.status) < 500 ? Number(error.status) : 500;
  console.error('[request-error]', { status, name: error.name, code: error.code || 'REQUEST_ERROR' });
  return res.status(status).json({ error: status === 500 ? 'An unexpected error occurred' : error.message });
});

module.exports = app;
