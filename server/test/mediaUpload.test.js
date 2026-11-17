const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable, Writable } = require('node:stream');
const { createMediaUpload } = require('../src/middleware/upload');

function multipartRequest({ mimeType, bytes, folder = 'photo-gallery' }) {
  const boundary = 'portfolio-upload-test';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="folder"\r\n\r\n${folder}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="upload.bin"\r\nContent-Type: ${mimeType}\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);
  const request = Readable.from([body]);
  request.headers = { 'content-type': `multipart/form-data; boundary=${boundary}` };
  return request;
}

function runUpload(request, options) {
  return new Promise((resolve) => {
    const middleware = createMediaUpload(options);
    middleware(request, {}, (error) => resolve({ error, verifiedFile: request.verifiedFile }));
  });
}

function fakeUploader() {
  const calls = [];
  return {
    calls,
    uploadStream(options, callback) {
      let size = 0;
      calls.push(options);
      return new Writable({
        write(chunk, _encoding, done) {
          size += chunk.length;
          done();
        },
        final(done) {
          callback(null, {
            public_id: options.publicId,
            secure_url: `https://res.cloudinary.com/demo/${options.resourceType}/upload/${options.publicId}`,
            bytes: size
          });
          done();
        }
      });
    }
  };
}

test('streams a valid image to Cloudinary and records only verified upload metadata', async () => {
  const uploader = fakeUploader();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lO8AAAAASUVORK5CYII=', 'base64');
  const result = await runUpload(multipartRequest({ mimeType: 'image/png', bytes: png }), {
    uploadStream: uploader.uploadStream,
    removeAsset: async () => ({ result: 'ok' })
  });

  assert.equal(result.error, undefined);
  assert.equal(result.verifiedFile.result.resourceType, 'image');
  assert.equal(result.verifiedFile.folder, 'photo-gallery');
  assert.equal(result.verifiedFile.size, png.length);
  assert.equal(uploader.calls.length, 1);
});

test('rejects file content that does not match the multipart MIME type', async () => {
  const uploader = fakeUploader();
  const result = await runUpload(multipartRequest({
    mimeType: 'image/png',
    bytes: Buffer.from('not an image')
  }), {
    uploadStream: uploader.uploadStream,
    removeAsset: async () => ({ result: 'ok' })
  });

  assert.match(result.error.message, /does not match/);
  assert.equal(uploader.calls.length, 0);
});

test('deletes an oversized PDF upload and returns HTTP 413', async () => {
  const uploader = fakeUploader();
  let removed = false;
  const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(10 * 1024 * 1024)]);
  const result = await runUpload(multipartRequest({ mimeType: 'application/pdf', bytes: pdf }), {
    uploadStream: uploader.uploadStream,
    removeAsset: async () => { removed = true; return { result: 'ok' }; }
  });

  assert.equal(result.error.status, 413);
  assert.equal(removed, true);
});
