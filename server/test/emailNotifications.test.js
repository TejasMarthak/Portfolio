const test = require('node:test');
const assert = require('node:assert/strict');
const { sendContactEmail } = require('../src/services/email');

test('reports missing recipient configuration without attempting to send', async () => {
  const originalUser = process.env.GMAIL_USER;
  const originalConsoleError = console.error;
  const errors = [];
  delete process.env.GMAIL_USER;
  console.error = (...args) => errors.push(args);

  try {
    const result = await sendContactEmail({});
    assert.deepEqual(result, {
      sent: false,
      error: 'Missing GMAIL_USER',
      errorCode: 'EMAIL_CONFIG_MISSING'
    });
    assert.deepEqual(errors, [[
      '[email] notification skipped:',
      'Missing GMAIL_USER'
    ]]);
  } finally {
    if (originalUser === undefined) delete process.env.GMAIL_USER;
    else process.env.GMAIL_USER = originalUser;
    console.error = originalConsoleError;
  }
});

test('sends email through FormSubmit using the configured recipient', async () => {
  const originalUser = process.env.GMAIL_USER;
  const originalProUrl = process.env.PRO_CLIENT_URL;
  const originalFetch = global.fetch;
  process.env.GMAIL_USER = 'owner@example.com';
  process.env.PRO_CLIENT_URL = 'https://pro.example.com/portfolio';
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://formsubmit.co/ajax/owner%40example.com');
    assert.equal(options.headers.Origin, 'https://pro.example.com');
    assert.equal(options.headers.Referer, 'https://pro.example.com/');
    assert.equal(options.headers.Accept, 'application/json');
    assert.equal(options.headers['Content-Type'], 'application/json');
    const body = JSON.parse(options.body);
    assert.equal(body._subject, '[pro] Portfolio test');
    assert.equal(body._replyto, 'visitor@example.net');
    assert.equal(body.email, 'visitor@example.net');
    assert.equal(body.message, '<script>');
    return new Response(JSON.stringify({ success: 'true', message: 'Form submitted successfully.' }), { status: 200 });
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
    if (originalProUrl === undefined) delete process.env.PRO_CLIENT_URL;
    else process.env.PRO_CLIENT_URL = originalProUrl;
    global.fetch = originalFetch;
  }
});

test('reports first-time FormSubmit confirmation without exposing provider details', async () => {
  const originalUser = process.env.GMAIL_USER;
  const originalProUrl = process.env.PRO_CLIENT_URL;
  const originalFetch = global.fetch;
  const originalConsoleError = console.error;
  const errors = [];
  process.env.GMAIL_USER = 'owner@example.com';
  process.env.PRO_CLIENT_URL = 'https://pro.example.com';
  console.error = (...args) => errors.push(args);
  global.fetch = async () => new Response(JSON.stringify({
    success: false,
    message: 'Please verify your email address using the activation link.',
    private: 'private provider detail'
  }), { status: 200 });

  try {
    const result = await sendContactEmail({ source: 'pro', subject: 'Test' });
    assert.deepEqual(result, {
      sent: false,
      error: 'Email provider could not accept the notification.',
      errorCode: 'FORMSUBMIT_CONFIRMATION_REQUIRED',
      responseCode: 200
    });
    assert.deepEqual(errors, [[
      '[email] notification failed:',
      { code: 'FORMSUBMIT_CONFIRMATION_REQUIRED', responseCode: 200 }
    ]]);
  } finally {
    if (originalUser === undefined) delete process.env.GMAIL_USER;
    else process.env.GMAIL_USER = originalUser;
    if (originalProUrl === undefined) delete process.env.PRO_CLIENT_URL;
    else process.env.PRO_CLIENT_URL = originalProUrl;
    global.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

test('does not expose FormSubmit response details when the provider rejects a request', async () => {
  const originalUser = process.env.GMAIL_USER;
  const originalProUrl = process.env.PRO_CLIENT_URL;
  const originalFetch = global.fetch;
  const originalConsoleError = console.error;
  const errors = [];
  process.env.GMAIL_USER = 'owner@example.com';
  process.env.PRO_CLIENT_URL = 'https://pro.example.com';
  console.error = (...args) => errors.push(args);
  global.fetch = async () => new Response(JSON.stringify({
    success: false,
    message: 'private provider detail'
  }), { status: 403 });

  try {
    const result = await sendContactEmail({ source: 'pro', subject: 'Test' });
    assert.deepEqual(result, {
      sent: false,
      error: 'Email provider could not accept the notification.',
      errorCode: 'FORMSUBMIT_REJECTED',
      responseCode: 403
    });
    assert.deepEqual(errors, [[
      '[email] notification failed:',
      { code: 'FORMSUBMIT_REJECTED', responseCode: 403 }
    ]]);
  } finally {
    if (originalUser === undefined) delete process.env.GMAIL_USER;
    else process.env.GMAIL_USER = originalUser;
    if (originalProUrl === undefined) delete process.env.PRO_CLIENT_URL;
    else process.env.PRO_CLIENT_URL = originalProUrl;
    global.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

test('rejects malformed FormSubmit responses safely', async () => {
  const originalUser = process.env.GMAIL_USER;
  const originalProUrl = process.env.PRO_CLIENT_URL;
  const originalFetch = global.fetch;
  const originalConsoleError = console.error;
  const errors = [];
  process.env.GMAIL_USER = 'owner@example.com';
  process.env.PRO_CLIENT_URL = 'https://pro.example.com';
  console.error = (...args) => errors.push(args);
  global.fetch = async () => new Response('null', { status: 200 });

  try {
    const result = await sendContactEmail({ source: 'pro', subject: 'Test' });
    assert.deepEqual(result, {
      sent: false,
      error: 'Email provider could not accept the notification.',
      errorCode: 'FORMSUBMIT_INVALID_RESPONSE',
      responseCode: 200
    });
    assert.deepEqual(errors, [[
      '[email] notification failed:',
      { code: 'FORMSUBMIT_INVALID_RESPONSE', responseCode: 200 }
    ]]);
  } finally {
    if (originalUser === undefined) delete process.env.GMAIL_USER;
    else process.env.GMAIL_USER = originalUser;
    if (originalProUrl === undefined) delete process.env.PRO_CLIENT_URL;
    else process.env.PRO_CLIENT_URL = originalProUrl;
    global.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

test('reports non-JSON HTTP rejections by status instead of as malformed JSON', async () => {
  const originalUser = process.env.GMAIL_USER;
  const originalProUrl = process.env.PRO_CLIENT_URL;
  const originalFetch = global.fetch;
  const originalConsoleError = console.error;
  const errors = [];
  process.env.GMAIL_USER = 'owner@example.com';
  process.env.PRO_CLIENT_URL = 'https://pro.example.com';
  console.error = (...args) => errors.push(args);
  global.fetch = async () => new Response('<html>Forbidden</html>', { status: 403 });

  try {
    const result = await sendContactEmail({ source: 'pro', subject: 'Test' });
    assert.deepEqual(result, {
      sent: false,
      error: 'Email provider could not accept the notification.',
      errorCode: 'FORMSUBMIT_REJECTED',
      responseCode: 403
    });
    assert.deepEqual(errors, [[
      '[email] notification failed:',
      { code: 'FORMSUBMIT_REJECTED', responseCode: 403 }
    ]]);
  } finally {
    if (originalUser === undefined) delete process.env.GMAIL_USER;
    else process.env.GMAIL_USER = originalUser;
    if (originalProUrl === undefined) delete process.env.PRO_CLIENT_URL;
    else process.env.PRO_CLIENT_URL = originalProUrl;
    global.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});
