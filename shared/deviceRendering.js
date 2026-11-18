export function canRender3D() {
  let context;
  try {
    context = document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }

  const capable = Boolean(context);
  context?.getExtension('WEBGL_lose_context')?.loseContext();
  return capable;
}

export function isTouchDevice() {
  return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

export function getScenePixelRatio() {
  const nativePixelRatio = window.devicePixelRatio || 1;
  const isTouch = isTouchDevice();
  const lowCpu = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
  const hasLowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;
  const ceiling = isTouch || lowCpu || hasLowMemory ? 1 : 1.5;
  return Math.min(nativePixelRatio, ceiling);
}
