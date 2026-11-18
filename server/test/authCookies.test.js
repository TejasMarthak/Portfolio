const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const originalNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'production';
const { clearPairCookies, setCsrfCookie, setPairCookies } = require('../src/config/tokens');
if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
else process.env.NODE_ENV = originalNodeEnv;

test('production auth cookies support cross-site HTTPS requests', () => {
  const cookies = new Map();
  const clearedCookies = new Map();
  const response = {
    cookie(name, value, options) {
      cookies.set(name, { value, options });
    },
    clearCookie(name, options) {
      clearedCookies.set(name, options);
    }
  };
  const token = () => jwt.sign({ exp: Math.floor(Date.now() / 1000) + 3600 }, 'test-secret');

  setPairCookies(response, { accessToken: token(), refreshToken: token() });

  for (const name of ['accessToken', 'refreshToken', 'csrfToken']) {
    const cookie = cookies.get(name);
    assert.ok(cookie);
    assert.equal(cookie.options.sameSite, 'none');
    assert.equal(cookie.options.secure, true);
    assert.equal(cookie.options.path, '/');
  }
  assert.equal(cookies.get('accessToken').options.httpOnly, true);
  assert.equal(cookies.get('refreshToken').options.httpOnly, true);
  assert.notEqual(cookies.get('csrfToken').options.httpOnly, true);

  clearPairCookies(response);
  assert.deepEqual(clearedCookies.get('accessToken'), {
    httpOnly: true, secure: true, sameSite: 'none', path: '/'
  });
  assert.deepEqual(clearedCookies.get('refreshToken'), {
    httpOnly: true, secure: true, sameSite: 'none', path: '/'
  });
  assert.deepEqual(clearedCookies.get('csrfToken'), {
    secure: true, sameSite: 'none', path: '/'
  });
});

test('creates a production CSRF cookie when an authenticated request has none', () => {
  const cookies = new Map();
  const response = {
    cookie(name, value, options) {
      cookies.set(name, { value, options });
    }
  };

  const token = setCsrfCookie(response);

  assert.match(token, /^[a-f\d]{64}$/);
  assert.equal(cookies.get('csrfToken').value, token);
  assert.deepEqual(cookies.get('csrfToken').options, {
    secure: true,
    sameSite: 'none',
    path: '/'
  });
});
