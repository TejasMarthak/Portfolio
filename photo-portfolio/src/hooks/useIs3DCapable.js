import { useEffect, useState } from 'react';

export function useIs3DCapable() {
  const [capable, setCapable] = useState(false);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    let context;
    try {
      context = canvas.getContext('webgl2');
    } catch {
      setCapable(false);
      return;
    }

    setCapable(Boolean(context));
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  }, []);

  return capable;
}
