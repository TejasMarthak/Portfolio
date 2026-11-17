const test = require('node:test');
const assert = require('node:assert/strict');
const { deleteMediaAssets } = require('../src/services/deleteMediaAssets');

test('deletes media in bounded batches and treats already-missing assets as deleted', async () => {
  const items = Array.from({ length: 12 }, (_, index) => ({
    publicId: `asset-${index}`,
    resourceType: index % 2 ? 'video' : 'image'
  }));
  let active = 0;
  let peak = 0;
  const result = await deleteMediaAssets(items, async (publicId) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active -= 1;
    return { result: publicId === 'asset-1' ? 'not found' : 'ok' };
  });

  assert.equal(peak, 5);
  assert.equal(result.deleted.length, items.length);
  assert.deepEqual(result.failed, []);
});

test('keeps assets whose provider deletion fails in the failure list', async () => {
  const items = [
    { publicId: 'deleted', resourceType: 'image' },
    { publicId: 'rejected', resourceType: 'raw' },
    { publicId: 'unexpected', resourceType: 'video' }
  ];
  const result = await deleteMediaAssets(items, async (publicId) => {
    if (publicId === 'rejected') throw new Error('provider unavailable');
    return { result: publicId === 'unexpected' ? 'error' : 'ok' };
  });

  assert.deepEqual(result.deleted.map(({ publicId }) => publicId), ['deleted']);
  assert.deepEqual(result.failed.map(({ publicId }) => publicId), ['rejected', 'unexpected']);
});
