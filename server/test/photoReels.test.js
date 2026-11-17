const test = require('node:test');
const assert = require('node:assert/strict');
const PhotoContent = require('../src/models/PhotoContent');
const { updateSection } = require('../src/services/content');

test('photo reels can be saved as a repeatable content section', async () => {
  const originalFindOneAndUpdate = PhotoContent.findOneAndUpdate;
  let update;
  PhotoContent.findOneAndUpdate = async (_filter, updateDocument) => {
    update = updateDocument;
    return { reels: updateDocument.$set.reels };
  };

  try {
    const reels = [
      { id: 'reel-1', title: 'First reel', videoURL: 'https://example.com/first.mp4' },
      { id: 'reel-2', title: 'Second reel', videoURL: 'https://example.com/second.mp4' }
    ];
    const content = await updateSection('photo', 'reels', reels);

    assert.deepEqual(content.reels, reels);
    assert.deepEqual(update.$set.reels, reels);
  } finally {
    PhotoContent.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
