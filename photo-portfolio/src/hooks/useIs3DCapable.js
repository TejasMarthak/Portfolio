import { useEffect, useState } from 'react';
import { canRender3D } from '../../../shared/deviceRendering.js';

export function useIs3DCapable() {
  const [capable, setCapable] = useState(false);

  useEffect(() => {
    setCapable(canRender3D());
  }, []);

  return capable;
}
