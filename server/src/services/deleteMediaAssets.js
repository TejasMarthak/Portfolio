const deleteConcurrency = 5;

async function deleteMediaAssets(items, deleteAsset) {
  const deleted = [];
  const failed = [];

  for (let offset = 0; offset < items.length; offset += deleteConcurrency) {
    const batch = items.slice(offset, offset + deleteConcurrency);
    const results = await Promise.allSettled(
      batch.map((media) => deleteAsset(media.publicId, media.resourceType))
    );

    results.forEach((result, index) => {
      const media = batch[index];
      if (result.status === 'fulfilled' && ['ok', 'not found'].includes(result.value?.result)) {
        deleted.push(media);
      } else {
        failed.push(media);
      }
    });
  }

  return { deleted, failed };
}

module.exports = { deleteMediaAssets };
