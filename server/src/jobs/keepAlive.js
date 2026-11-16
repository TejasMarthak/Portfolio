const https = require('https');
let lastPing = null;

function pingServer() {
  const url = process.env.SERVER_URL;
  if (!url) {
    console.warn('[keep-alive] SERVER_URL is not configured; ping skipped');
    return;
  }
  let target;
  try {
    target = new URL(`${url.replace(/\/$/, '')}/ping`);
    if (target.protocol !== 'https:') throw new Error('SERVER_URL must use HTTPS');
  } catch (error) {
    console.error('[keep-alive] ping failed:', error.message);
    return;
  }
  const request = https.get(target, (response) => {
    lastPing = new Date().toISOString();
    console.log('[keep-alive] ping sent →', response.statusCode);
    response.resume();
  });
  request.setTimeout(10000, () => request.destroy(new Error('Ping timed out')));
  request.on('error', (error) => console.error('[keep-alive] ping failed →', error.message));
}

async function startKeepAlive() {
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.SERVER_URL) {
    console.warn('[keep-alive] SERVER_URL is not configured; scheduler skipped');
    return;
  }
  const cron = await import('node-cron');
  cron.schedule('*/10 * * * *', pingServer);
  console.log('[keep-alive] scheduler started');
}

module.exports = { startKeepAlive, pingServer, getLastPing: () => lastPing };
