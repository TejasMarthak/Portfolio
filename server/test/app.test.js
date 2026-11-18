const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const Media = require('../src/models/Media');

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

test('WhatsApp connection status requires an authenticated admin', async (context) => {
  const server = app.listen(0);
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve) => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/whatsapp`);
  assert.equal(response.status, 401);
});

test('WhatsApp test notifications require an authenticated admin', async (context) => {
  const server = app.listen(0);
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve) => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/whatsapp/test`, {
    method: 'POST'
  });
  assert.equal(response.status, 401);
});

test('email test notifications require an authenticated admin', async (context) => {
  const server = app.listen(0);
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve) => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/email/test`, {
    method: 'POST'
  });
  assert.equal(response.status, 401);
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

test('invalid inline PDF identifiers are rejected before media lookup', async (context) => {
  const server = app.listen(0);
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve) => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/media/inline-pdf?publicId=${encodeURIComponent('../private.pdf')}`);
  assert.equal(response.status, 400);
});

test('delete all media requires an authenticated admin before accessing the library', async (context) => {
  const server = app.listen(0);
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve) => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/media`, {
    method: 'DELETE'
  });
  assert.equal(response.status, 401);
});

test('inline PDF delivery validates and streams Cloudinary byte ranges', async (context) => {
  const originalFindOne = Media.findOne;
  const originalFetch = global.fetch;
  const originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;
  let mediaRecord = {
    publicId: 'documents/resume.pdf',
    folder: 'documents',
    resourceType: 'raw',
    url: 'https://res.cloudinary.com/test-cloud/raw/upload/fl_inline/v123/documents/resume.pdf'
  };
  Media.findOne = () => ({ lean: async () => mediaRecord });
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
  global.fetch = async (url, options) => {
    if (url.endsWith('/documents/unsupported-range.pdf') && options?.headers?.range) {
      return new Response('Byte ranges are unavailable', { status: 416 });
    }
    if (url.endsWith('/documents/unsupported-range.pdf')) {
      return new Response(Buffer.from('%PDF-1.7\nfull file'), {
        status: 200,
        headers: { 'content-type': 'application/pdf' }
      });
    }
    if (url.endsWith('/documents/resume.pdf')) {
      assert.equal(url, 'https://res.cloudinary.com/test-cloud/raw/upload/v123/documents/resume.pdf');
      assert.equal(options.headers.range, 'bytes=0-13');
      return new Response(Buffer.from('%PDF-1.7\nbytes'), {
        status: 206,
        headers: {
          'content-type': 'application/pdf',
          'content-range': 'bytes 0-13/100',
          'content-length': '14'
        }
      });
    }
    assert.equal(url, 'https://res.cloudinary.com/test-cloud/raw/upload/v123/photo-gallery/guide.pdf');
    return new Response(Buffer.from('%PDF-1.7\ninline'), {
      status: 200,
      headers: { 'content-type': 'application/pdf' }
    });
  };
  const server = app.listen(0);
  context.after(() => new Promise((resolve, reject) => {
    Media.findOne = originalFindOne;
    global.fetch = originalFetch;
    if (originalCloudName === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = originalCloudName;
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve) => server.once('listening', resolve));

  const origin = `http://127.0.0.1:${server.address().port}`;
  const preflight = await originalFetch(`${origin}/api/media/inline-pdf?publicId=documents%2Fresume.pdf`, {
    method: 'OPTIONS',
    headers: {
      origin: 'http://127.0.0.1:5174',
      'access-control-request-method': 'GET',
      'access-control-request-headers': 'range'
    }
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5174');
  const response = await originalFetch(`${origin}/api/media/inline-pdf?publicId=documents%2Fresume.pdf`, {
    headers: { range: 'bytes=0-13', origin: 'http://127.0.0.1:5174' }
  });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(response.headers.get('content-range'), 'bytes 0-13/100');
  assert.match(response.headers.get('access-control-expose-headers'), /Content-Range/i);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5174');
  assert.equal(response.headers.get('content-disposition'), 'inline; filename="resume.pdf"');
  assert.equal(response.headers.get('x-frame-options'), null);
  assert.equal(await response.text(), '%PDF-1.7\nbytes');

  mediaRecord = {
    publicId: 'photo-gallery/guide.pdf',
    folder: 'photo-gallery',
    resourceType: 'raw',
    url: 'https://res.cloudinary.com/test-cloud/raw/upload/v123/photo-gallery/guide.pdf'
  };
  const secondResponse = await originalFetch(`http://127.0.0.1:${server.address().port}/api/media/inline-pdf?publicId=photo-gallery%2Fguide.pdf`);
  assert.equal(secondResponse.status, 200);
  assert.equal(secondResponse.headers.get('content-disposition'), 'inline; filename="guide.pdf"');
  assert.equal(await secondResponse.text(), '%PDF-1.7\ninline');

  mediaRecord = {
    publicId: 'documents/unsupported-range.pdf',
    folder: 'documents',
    resourceType: 'raw',
    url: 'https://res.cloudinary.com/test-cloud/raw/upload/v123/documents/unsupported-range.pdf'
  };
  const rangeFallback = await originalFetch(`http://127.0.0.1:${server.address().port}/api/media/inline-pdf?publicId=documents%2Funsupported-range.pdf`, {
    headers: { range: 'bytes=0-65535' }
  });
  assert.equal(rangeFallback.status, 200);
  assert.equal(await rangeFallback.text(), '%PDF-1.7\nfull file');
});

test('inline PDF falls back to a signed Cloudinary download when public delivery is denied', async (context) => {
  const originalFindOne = Media.findOne;
  const originalFetch = global.fetch;
  const originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const originalApiKey = process.env.CLOUDINARY_API_KEY;
  const originalApiSecret = process.env.CLOUDINARY_API_SECRET;
  Media.findOne = () => ({
    lean: async () => ({
      publicId: 'pro-portfolio/resume.pdf',
      folder: 'pro-portfolio',
      resourceType: 'raw',
      url: 'https://res.cloudinary.com/test-cloud/raw/upload/v123/pro-portfolio/resume.pdf'
    })
  });
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
  process.env.CLOUDINARY_API_KEY = 'test-key';
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url: String(url), headers: options?.headers });
    if (String(url).startsWith('https://api.cloudinary.com/')) {
      return new Response(Buffer.from('%PDF-1.7\nprivate download'), {
        status: 200,
        headers: { 'content-type': 'application/pdf' }
      });
    }
    return new Response('deny or ACL failure', {
      status: 401,
      headers: { 'content-type': 'application/json' }
    });
  };
  const server = app.listen(0);
  context.after(() => new Promise((resolve, reject) => {
    Media.findOne = originalFindOne;
    global.fetch = originalFetch;
    if (originalCloudName === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = originalCloudName;
    if (originalApiKey === undefined) delete process.env.CLOUDINARY_API_KEY;
    else process.env.CLOUDINARY_API_KEY = originalApiKey;
    if (originalApiSecret === undefined) delete process.env.CLOUDINARY_API_SECRET;
    else process.env.CLOUDINARY_API_SECRET = originalApiSecret;
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve) => server.once('listening', resolve));

  const response = await originalFetch(
    `http://127.0.0.1:${server.address().port}/api/media/inline-pdf?publicId=pro-portfolio%2Fresume.pdf`,
    { headers: { range: 'bytes=0-63' } }
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(response.headers.get('content-disposition'), 'inline; filename="resume.pdf"');
  assert.equal(await response.text(), '%PDF-1.7\nprivate download');
  assert.equal(requests.filter(({ url }) => url.startsWith('https://res.cloudinary.com/')).length, 2);
  const signedDownload = new URL(requests.find(({ url }) => url.startsWith('https://api.cloudinary.com/')).url);
  assert.equal(signedDownload.pathname, '/v1_1/test-cloud/raw/download');
  assert.equal(signedDownload.searchParams.get('public_id'), 'pro-portfolio/resume');
  assert.equal(signedDownload.searchParams.get('format'), 'pdf');
  assert.equal(signedDownload.searchParams.get('api_key'), 'test-key');
  assert.ok(signedDownload.searchParams.get('signature'));
});
