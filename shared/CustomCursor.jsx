import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './custom-cursor.css';

const interactiveSelector = [
  'a', 'button:not(:disabled)', '[role="button"]:not([aria-disabled="true"])',
  'summary', 'select:not(:disabled)', 'input[type="checkbox"]',
  'input[type="radio"]', 'input[type="range"]', 'label'
].join(',');

export default function CustomCursor({ theme }) {
  const cursorRef = useRef(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return undefined;
    const finePointer = window.matchMedia('(pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let enabled = false;
    const root = document.documentElement;

    const updateEnabled = () => {
      enabled = finePointer.matches && !reducedMotion.matches;
      root.classList.toggle('has-custom-cursor', enabled);
      if (!enabled) cursor.classList.remove('is-visible', 'is-interactive', 'is-down');
    };
    const handlePointerMove = (event) => {
      if (event.pointerType !== 'mouse' || !enabled) {
        cursor.classList.remove('is-visible');
        return;
      }
      cursor.style.setProperty('--pointer-x', `${event.clientX}px`);
      cursor.style.setProperty('--pointer-y', `${event.clientY}px`);
      cursor.classList.add('is-visible');
      const target = event.target instanceof Element ? event.target.closest(interactiveSelector) : null;
      cursor.classList.toggle('is-interactive', Boolean(target));
    };
    const handlePointerDown = (event) => {
      if (event.pointerType === 'mouse' && enabled) cursor.classList.add('is-down');
    };
    const handlePointerUp = (event) => {
      if (event.pointerType === 'mouse') cursor.classList.remove('is-down');
    };
    const handlePointerLeave = () => cursor.classList.remove('is-visible', 'is-down');

    updateEnabled();
    finePointer.addEventListener('change', updateEnabled);
    reducedMotion.addEventListener('change', updateEnabled);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', handlePointerUp, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave);
    return () => {
      root.classList.remove('has-custom-cursor');
      finePointer.removeEventListener('change', updateEnabled);
      reducedMotion.removeEventListener('change', updateEnabled);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  return createPortal(
    <div ref={cursorRef} className={`custom-cursor custom-cursor-${theme}`} aria-hidden="true">
      <span className="custom-cursor-ring" />
      <span className="custom-cursor-core" />
    </div>,
    document.body
  );
}
