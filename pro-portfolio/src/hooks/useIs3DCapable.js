import { useEffect, useState } from 'react';

export function useIs3DCapable() {
  const [capable, setCapable] = useState(false);

  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)');
    const update = () => {
      setCapable(!coarse.matches && (navigator.hardwareConcurrency || 4) > 2);
    };
    update();
    coarse.addEventListener('change', update);
    return () => coarse.removeEventListener('change', update);
  }, []);

  return capable;
}
