import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Sparkles, useTexture } from '@react-three/drei';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cloudinaryUrl } from '../api';
import * as THREE from 'three';

gsap.registerPlugin(ScrollTrigger);

function CameraRig({ reducedMotion, focusedIndex, photos }) {
  const { camera } = useThree();
  const progress = useRef({ value: 0 });
  const pushTarget = useRef(null);
  const points = useMemo(() => [
    new THREE.Vector3(0, 0.4, 12),
    new THREE.Vector3(-1, 0.4, 6),
    new THREE.Vector3(1, 0.4, 0),
    new THREE.Vector3(-1, 0.4, -6),
    new THREE.Vector3(1, 0.4, -12),
    new THREE.Vector3(0, 0.4, -18)
  ], []);

  useEffect(() => {
    if (reducedMotion) return undefined;
    const tween = gsap.to(progress.current, {
      value: 1,
      ease: 'none',
      scrollTrigger: { trigger: '#darkroom-journey', start: 'top top', end: 'bottom bottom', scrub: 1.2 }
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (focusedIndex == null || !photos[focusedIndex]) {
      pushTarget.current = null;
      return;
    }
    const index = focusedIndex;
    const target = new THREE.Vector3(Math.sin(index * 2.1) * 2.5, (index % 3) * 0.85, -index * 2.2 - 0.2);
    pushTarget.current = target;
    if (!reducedMotion) gsap.to(camera.position, { x: target.x, y: target.y, z: target.z + 2.3, duration: 1.25, ease: 'power3.inOut' });
  }, [camera, focusedIndex, photos, reducedMotion]);

  useFrame(() => {
    if (focusedIndex != null && pushTarget.current) {
      camera.lookAt(pushTarget.current);
      return;
    }
    const position = progress.current.value * (points.length - 1);
    const index = Math.min(Math.floor(position), points.length - 2);
    const target = points[index].clone().lerp(points[index + 1], position - index);
    camera.position.lerp(target, reducedMotion ? 1 : 0.065);
    camera.lookAt(0, 0, camera.position.z - 7);
  });

  return null;
}

function PhotoPlane({ photo, index, active, onFocus }) {
  const textureUrl = cloudinaryUrl(photo.src, 1200);
  const texture = useTexture(textureUrl);
  const mesh = useRef();
  const x = Math.sin(index * 2.1) * 2.5;
  const y = (index % 3) * 0.85;
  const z = -index * 2.2 - 1.4;
  const aspect = texture.image?.width && texture.image?.height ? texture.image.width / texture.image.height : 1.4;
  const width = Math.min(4.2, Math.max(2.4, aspect * 2.15));
  const height = width / aspect;

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return () => {
      useTexture.clear(textureUrl);
      texture.dispose();
      document.body.style.cursor = '';
    };
  }, [texture, textureUrl]);

  useFrame(({ clock }) => {
    if (mesh.current && !active) mesh.current.position.y = Math.sin(clock.elapsedTime * 0.35 + index) * 0.045;
  });

  return (
    <group position={[x, y, z]}>
      <mesh
        ref={mesh}
        onClick={(event) => { event.stopPropagation(); onFocus(index); }}
        onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = ''; }}
      >
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial map={texture} emissive="#6c3e1b" emissiveMap={texture} emissiveIntensity={0.19} roughness={0.78} />
      </mesh>
      {(photo.title || photo.category) && (
        <Html position={[-width / 2, -height / 2 - 0.24, 0]} transform distanceFactor={10} className="photo-scene-label">
          <span>{photo.title || photo.category}</span>
        </Html>
      )}
    </group>
  );
}

function Scene({ photos, reducedMotion, focusedIndex, setFocusedIndex }) {
  return (
    <>
      <color attach="background" args={['#0b0907']} />
      <fog attach="fog" args={['#0b0907', 7, 33]} />
      <ambientLight intensity={0.8} color="#f4d0a0" />
      <spotLight position={[-6, 8, 2]} angle={0.35} penumbra={0.8} intensity={50} color="#e8a838" />
      <pointLight position={[6, 0, -10]} intensity={16} color="#ff6b4a" distance={22} />
      <Sparkles count={140} scale={[18, 8, 38]} size={2.2} speed={reducedMotion ? 0 : 0.13} opacity={0.48} color="#e8a838" />
      {photos.map((photo, index) => (
        <Suspense key={photo.id || photo.publicId || photo.src} fallback={(
          <mesh position={[Math.sin(index * 2.1) * 2.5, (index % 3) * 0.85, -index * 2.2 - 1.4]}>
            <planeGeometry args={[2.8, 2]} />
            <meshBasicMaterial color="#372418" />
          </mesh>
        )}>
          <PhotoPlane photo={photo} index={index} active={focusedIndex === index} onFocus={setFocusedIndex} />
        </Suspense>
      ))}
      <CameraRig reducedMotion={reducedMotion} focusedIndex={focusedIndex} photos={photos} />
    </>
  );
}

export default function Darkroom({ photos = [], reducedMotion }) {
  const [focusedIndex, setFocusedIndex] = useState(null);
  const visiblePhotos = useMemo(() => photos.filter((photo) => photo.src), [photos]);

  useEffect(() => {
    if (focusedIndex == null) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setFocusedIndex(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusedIndex]);

  return (
    <>
      <Canvas camera={{ position: [0, 0.4, 12], fov: 50 }} dpr={[1, Math.min(window.devicePixelRatio || 1, 1.5)]} gl={{ antialias: false, powerPreference: 'high-performance' }} onPointerMissed={() => setFocusedIndex(null)}>
        <Suspense fallback={<mesh><planeGeometry args={[3, 2]} /><meshBasicMaterial color="#372418" /></mesh>}>
          <Scene photos={visiblePhotos} reducedMotion={reducedMotion} focusedIndex={focusedIndex} setFocusedIndex={setFocusedIndex} />
        </Suspense>
      </Canvas>
      <AnimatePresence>
        {focusedIndex != null && visiblePhotos[focusedIndex] && (
          <motion.div className="photo-focus" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label={visiblePhotos[focusedIndex].title || 'Photograph'} onClick={() => setFocusedIndex(null)}>
            <button type="button" className="photo-focus-close" aria-label="Close image" onClick={() => setFocusedIndex(null)}><X size={20} /></button>
            <motion.img
              src={visiblePhotos[focusedIndex].src}
              alt={visiblePhotos[focusedIndex].alt || visiblePhotos[focusedIndex].title || ''}
              initial={{ scale: 0.92, filter: 'blur(10px)' }}
              animate={{ scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.6 }}
              onClick={(event) => event.stopPropagation()}
            />
            {visiblePhotos[focusedIndex].title && <p>{visiblePhotos[focusedIndex].title}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
