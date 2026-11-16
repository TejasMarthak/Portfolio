const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

test('health and ping endpoints are public and lightweight', async (context) => {
  const server = app.listen(0);
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  const ping = await fetch(`${origin}/ping`);
  assert.equal(ping.status, 200);
  assert.equal(await ping.text(), 'OK');

  const health = await fetch(`${origin}/health`);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('x-frame-options'), 'DENY');
  assert.deepEqual(Object.keys(await health.json()).sort(), ['lastPing', 'status', 'ts', 'uptime']);
});

test('auth status reports readiness without exposing credentials', async (context) => {
  const server = app.listen(0);
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve) => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/status`);
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(await response.json()), ['googleSignInConfigured']);
});

test('unknown content sections are rejected without database access', async (context) => {
  const server = app.listen(0);
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve) => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/pro/not-a-section`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ value: true })
  });
  assert.equal(response.status, 401);
});
