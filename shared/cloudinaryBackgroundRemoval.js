export function cloudinaryBackgroundRemovalUrl(value, width = 1200) {
  if (typeof value !== 'string' || !value.trim()) return '';

  try {
    const url = new URL(value);
    if (url.hostname !== 'res.cloudinary.com') return value;

    const segments = url.pathname.split('/').filter(Boolean);
    const uploadIndex = segments.findIndex((segment, index) =>
      segment === 'upload' && segments[index - 1] === 'image'
    );
    if (uploadIndex === -1) return value;

    const versionIndex = segments.findIndex((segment, index) =>
      index > uploadIndex && /^v\d+$/.test(segment)
    );
    if (versionIndex === -1) return value;

    const assetPath = segments.slice(versionIndex);
    const prefix = segments.slice(0, uploadIndex + 1);
    url.pathname = `/${[
      ...prefix,
      `e_background_removal,f_png,q_auto,w_${Math.round(width)}`,
      ...assetPath
    ].join('/')}`;
    return url.href;
  } catch {
    return value;
  }
}
