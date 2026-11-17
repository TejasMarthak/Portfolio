function matchesMediaReference(value, media) {
  if (typeof value !== 'string') return false;
  if (value === media.publicId || value === media.url) return true;
  try {
    const url = new URL(value);
    if (!url.hostname.endsWith('res.cloudinary.com')) return false;
    const pathname = decodeURIComponent(url.pathname);
    const publicId = media.publicId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`/${publicId}(?:\\.[^/]+)?$`).test(pathname);
  } catch {
    return false;
  }
}

function hasMeaningfulContent(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.some(hasMeaningfulContent);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, item]) => {
    if (key === 'id' || key === '_id' || key === 'aspect' || /publicId$/i.test(key)) return false;
    return hasMeaningfulContent(item);
  });
}

function removeMediaReferences(value, media) {
  if (matchesMediaReference(value, media)) return { value: '', changed: true };
  if (Array.isArray(value)) {
    let changed = false;
    const next = [];
    for (const item of value) {
      const result = removeMediaReferences(item, media);
      changed ||= result.changed;
      if (result.changed && !hasMeaningfulContent(result.value)) continue;
      next.push(result.value);
    }
    return { value: changed ? next : value, changed };
  }
  if (!value || typeof value !== 'object') return { value, changed: false };

  let changed = false;
  const next = { ...value };
  for (const [key, item] of Object.entries(value)) {
    const isPublicId = /publicId$/i.test(key) && item === media.publicId;
    const result = isPublicId ? { value: '', changed: true } : removeMediaReferences(item, media);
    if (result.changed) {
      next[key] = result.value;
      changed = true;
    }
  }
  return { value: changed ? next : value, changed };
}

module.exports = { matchesMediaReference, removeMediaReferences };
