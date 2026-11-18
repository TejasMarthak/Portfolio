const test = require('node:test');
const assert = require('node:assert/strict');
const { sendContactEmail } = require('../src/services/email');

test('reports missing Gmail settings without attempting to send', async () => {
  const originalUser = process.env.GMAIL_USER;
  const originalPassword = process.env.GMAIL_APP_PASSWORD;
  const originalResendKey = process.env.RESEND_API_KEY;
  const originalEmailFrom = process.env.EMAIL_FROM;
  const originalConsoleError = console.error;
  const errors = [];
  delete process.env.GMAIL_USER;
  delete process.env.GMAIL_APP_PASSWORD;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  console.error = (...args) => errors.push(args);

  try {
    const result = await sendContactEmail({});
    assert.deepEqual(result, {
      sent: false,
      error: 'Missing GMAIL_USER and GMAIL_APP_PASSWORD',
      errorCode: 'EMAIL_CONFIG_MISSING'
    });
    assert.deepEqual(errors, [[
      '[email] notification skipped:',
      'Missing GMAIL_USER and GMAIL_APP_PASSWORD'
    ]]);
  } finally {
    if (originalUser === undefined) delete process.env.GMAIL_USER;
    else process.env.GMAIL_USER = originalUser;
    if (originalPassword === undefined) delete process.env.GMAIL_APP_PASSWORD;
    else process.env.GMAIL_APP_PASSWORD = originalPassword;
    if (originalResendKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalResendKey;
    if (originalEmailFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = originalEmailFrom;
    console.error = originalConsoleError;
  }
});

test('sends email through Resend over HTTPS when configured', async () => {
  const originalUser = process.env.GMAIL_USER;
  const originalPassword = process.env.GMAIL_APP_PASSWORD;
  const originalResendKey = process.env.RESEND_API_KEY;
  const originalEmailFrom = process.env.EMAIL_FROM;
  const originalFetch = global.fetch;
  process.env.GMAIL_USER = 'owner@example.com';
  delete process.env.GMAIL_APP_PASSWORD;
  process.env.RESEND_API_KEY = 'test-resend-key';
  process.env.EMAIL_FROM = 'Portfolio <hello@example.com>';
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.headers.Authorization, 'Bearer test-resend-key');
    const body = JSON.parse(options.body);
    assert.deepEqual(body.to, ['owner@example.com']);
    assert.equal(body.from, 'Portfolio <hello@example.com>');
    assert.equal(body.reply_to, 'visitor@example.net');
    assert.match(body.html, /&lt;script&gt;/);
    return new Response(JSON.stringify({ id: 'email_test_id' }), { status: 200 });
  };

  try {
    const result = await sendContactEmail({
      source: 'pro',
      name: '<script>',
      email: 'visitor@example.net',
      subject: 'Portfolio test',
      message: '<script>'
    });
    assert.deepEqual(result, { sent: true });
  } finally {
    if (originalUser === undefined) delete process.env.GMAIL_USER;
    else process.env.GMAIL_USER = originalUser;
    if (originalPassword === undefined) delete process.env.GMAIL_APP_PASSWORD;
    else process.env.GMAIL_APP_PASSWORD = originalPassword;
    if (originalResendKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalResendKey;
    if (originalEmailFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = originalEmailFrom;
    global.fetch = originalFetch;
  }
});

test('returns a safe Resend sender error without exposing provider response details', async () => {
  const originalUser = process.env.GMAIL_USER;
  const originalResendKey = process.env.RESEND_API_KEY;
  const originalEmailFrom = process.env.EMAIL_FROM;
  const originalFetch = global.fetch;
  const originalConsoleError = console.error;
  const errors = [];
  process.env.GMAIL_USER = 'owner@example.com';
  process.env.RESEND_API_KEY = 'test-resend-key';
  process.env.EMAIL_FROM = 'unverified@example.com';
  console.error = (...args) => errors.push(args);
  global.fetch = async () => new Response(JSON.stringify({ message: 'private provider detail' }), { status: 403 });

  try {
    const result = await sendContactEmail({ source: 'pro', subject: 'Test' });
    assert.deepEqual(result, {
      sent: false,
      error: 'Email provider could not accept the notification.',
      errorCode: 'EMAIL_SENDER_REJECTED',
      responseCode: 403
    });
    assert.deepEqual(errors, [[
      '[email] notification failed:',
      { code: 'EMAIL_SENDER_REJECTED', responseCode: 403 }
    ]]);
  } finally {
    if (originalUser === undefined) delete process.env.GMAIL_USER;
    else process.env.GMAIL_USER = originalUser;
    if (originalResendKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalResendKey;
    if (originalEmailFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = originalEmailFrom;
    global.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});
