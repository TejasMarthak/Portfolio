export function getScenePixelRatio() {
  const nativePixelRatio = window.devicePixelRatio || 1;
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  const hasLowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;
  const ceiling = isTouch || hasLowMemory ? 1.25 : 1.5;
  return Math.min(nativePixelRatio, ceiling);
}
