require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./src/app');
const { startKeepAlive } = require('./src/jobs/keepAlive');
const { startWhatsApp } = require('./src/services/whatsapp');

const port = Number(process.env.PORT || 4000);

async function start() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI);
  const server = app.listen(port, () => {
    console.log(`Portfolio API listening on ${port}`);
    startKeepAlive().catch((error) =>     console.error('[keep-alive] scheduler failed:', error.code || error.name));
    startWhatsApp().catch((error) => console.error('[whatsapp] startup failed:', error.code || error.name));
  });
  server.on('error', (error) => {
    console.error('HTTP server failed to start:', { name: error.name, code: error.code || 'HTTP_STARTUP_ERROR' });
    process.exitCode = 1;
  });
}

start().catch((error) => {
  console.error('Server startup failed:', { name: error.name, code: error.code || 'STARTUP_ERROR' });
  process.exitCode = 1;
});
