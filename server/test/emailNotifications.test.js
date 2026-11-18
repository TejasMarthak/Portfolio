const test = require('node:test');
const assert = require('node:assert/strict');
const { sendContactEmail } = require('../src/services/email');

test('reports missing Gmail settings without attempting to send', async () => {
  const originalUser = process.env.GMAIL_USER;
  const originalPassword = process.env.GMAIL_APP_PASSWORD;
  const originalConsoleError = console.error;
  const errors = [];
  delete process.env.GMAIL_USER;
  delete process.env.GMAIL_APP_PASSWORD;
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
    console.error = originalConsoleError;
  }
});
