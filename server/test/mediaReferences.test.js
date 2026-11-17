const test = require('node:test');
const assert = require('node:assert/strict');
const { removeMediaReferences } = require('../src/services/mediaReferences');
const { uploadLimits } = require('../src/middleware/upload');

const media = {
  publicId: 'photo-gallery/portrait-1',
  url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/photo-gallery/portrait-1.jpg'
};

test('removes a deleted asset from transformed URLs and public-id fields', () => {
  const content = {
    projects: [{
      title: 'Portfolio',
      imageURL: 'https://res.cloudinary.com/demo/image/upload/c_fill,w_800/v123/photo-gallery/portrait-1.jpg',
      imagePublicId: media.publicId
    }],
    unrelated: { src: 'https://example.com/image.jpg' }
  };

  const result = removeMediaReferences(content, media);

  assert.equal(result.changed, true);
  assert.equal(result.value.projects[0].title, 'Portfolio');
  assert.equal(result.value.projects[0].imageURL, '');
  assert.equal(result.value.projects[0].imagePublicId, '');
  assert.equal(result.value.unrelated.src, 'https://example.com/image.jpg');
});

test('removes gallery entries that contain no content other than the deleted asset', () => {
  const result = removeMediaReferences({
    gallery: [
      { id: 'one', src: media.url, publicId: media.publicId, aspect: 'portrait' },
      { id: 'two', src: 'https://res.cloudinary.com/demo/image/upload/another.jpg', title: 'Keep me' }
    ]
  }, media);

  assert.deepEqual(result.value.gallery, [
    { id: 'two', src: 'https://res.cloudinary.com/demo/image/upload/another.jpg', title: 'Keep me' }
  ]);
});

test('enforces the requested streaming upload size ceilings', () => {
  assert.equal(uploadLimits.image, 200 * 1024 * 1024);
  assert.equal(uploadLimits.video, 10 * 1024 * 1024 * 1024);
  assert.equal(uploadLimits.document, 10 * 1024 * 1024);
});
