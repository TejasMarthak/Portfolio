import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { AnimatePresence, motion } from 'framer-motion';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { cloudinaryUrl } from '../api';
import * as THREE from 'three';
import { getScenePixelRatio, isTouchDevice } from '../../../shared/deviceRendering.js';

gsap.registerPlugin(ScrollTrigger);

const CAMERA_FOV = 50;
const CONTACT_SCENE_CLEARANCE = 350;

function contactSceneClearance(startTrigger, endTrigger) {
  const topbarHeight = document.querySelector('.photo-topbar')?.offsetHeight || 78;
  const startPosition = startTrigger.getBoundingClientRect().top + window.scrollY - topbarHeight;
  const endPosition = endTrigger.getBoundingClientRect().top + window.scrollY - window.innerHeight;
  const availableDistance = Math.max(0, endPosition - startPosition);
  return Math.min(CONTACT_SCENE_CLEARANCE, Math.floor(availableDistance * 0.2));
}

function cameraDistanceFor(aspect) {
  const viewHeightAtUnit = 2 * Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV) / 2);
  return Math.max(6.4, 5.4 / (viewHeightAtUnit * Math.max(aspect, 0.4) * 0.82));
}

function photoLateralRange(aspect) {
  const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV) / 2) * cameraDistanceFor(aspect);
  return viewHeight * aspect * (aspect > 1.1 ? 0.12 : 0.08);
}

function photoPosition(index, aspect = 1.6) {
  const cameraDistance = cameraDistanceFor(aspect);
  return [
    Math.sin(index * 2.1) * photoLateralRange(aspect),
    Math.sin(index * 0.58) * 0.22,
    -index * (cameraDistance + 3) - 1.4
  ];
}

function CameraRig({ reducedMotion, focusedIndex, photos, startSection }) {
  const { camera, size } = useThree();
  const viewportAspect = size.width / size.height;
  const cameraDistance = cameraDistanceFor(viewportAspect);
  const progress = useRef({ value: 0 });
  const pushTarget = useRef(null);
  const focusTween = useRef(null);
  const cameraTarget = useRef(new THREE.Vector3());
  const lookTarget = useRef(new THREE.Vector3());

  useEffect(() => {
    if (reducedMotion) return undefined;
    const journey = document.getElementById('darkroom-journey');
    const startTrigger = document.getElementById(startSection) || journey;
    const endTrigger = document.querySelector('#contact .photo-contact-form') ||
      document.getElementById('contact') ||
      document.querySelector('.photo-footer') ||
      journey;
    if (!startTrigger || !endTrigger) return undefined;
    const tween = gsap.to(progress.current, {
      value: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: startTrigger,
        start: () => `top top+=${document.querySelector('.photo-topbar')?.offsetHeight || 78}`,
        endTrigger,
        end: () => `top bottom+=${contactSceneClearance(startTrigger, endTrigger)}`,
        scrub: 0.3,
        invalidateOnRefresh: true
      }
    });
    const refresh = () => ScrollTrigger.refresh();
    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(refresh);
      resizeObserver.observe(journey);
      resizeObserver.observe(startTrigger);
      resizeObserver.observe(endTrigger);
    } else {
      window.addEventListener('resize', refresh);
    }
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', refresh);
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [reducedMotion, startSection]);

  useEffect(() => {
    if (focusedIndex == null || !photos[focusedIndex]) {
      pushTarget.current = null;
      focusTween.current?.kill();
      focusTween.current = null;
      return;
    }
    const index = focusedIndex;
    const target = new THREE.Vector3(...photoPosition(index, viewportAspect));
    pushTarget.current = target;
    if (!reducedMotion) {
      focusTween.current?.kill();
      focusTween.current = gsap.to(camera.position, { x: target.x, y: target.y, z: target.z + cameraDistance, duration: 1.25, ease: 'power3.inOut' });
    }
  }, [camera, cameraDistance, focusedIndex, photos, reducedMotion, viewportAspect]);

  useFrame((_state, delta) => {
    if (focusedIndex != null && pushTarget.current) {
      camera.lookAt(pushTarget.current);
      return;
    }
    const amount = THREE.MathUtils.clamp(progress.current.value, 0, 1);
    const lastIndex = Math.max(photos.length - 1, 0);
    const scaledIndex = amount * lastIndex;
    const index = Math.min(Math.floor(scaledIndex), lastIndex);
    const fraction = THREE.MathUtils.smoothstep(scaledIndex - index, 0, 1);
    const currentPosition = photoPosition(index, viewportAspect);
    const nextPosition = photoPosition(Math.min(index + 1, lastIndex), viewportAspect);
    lookTarget.current.set(
      THREE.MathUtils.lerp(currentPosition[0], nextPosition[0], fraction) * 0.2,
      THREE.MathUtils.lerp(currentPosition[1], nextPosition[1], fraction),
      THREE.MathUtils.lerp(currentPosition[2], nextPosition[2], fraction)
    );
    const orbit = Math.sin(scaledIndex * Math.PI / 2) * 0.28;
    cameraTarget.current.set(lookTarget.current.x + orbit, lookTarget.current.y + 0.22, lookTarget.current.z + cameraDistance);
    camera.position.lerp(cameraTarget.current, reducedMotion ? 1 : 1 - Math.exp(-delta * 3.8));
    camera.lookAt(lookTarget.current);
  });

  return null;
}

function PhotoPlane({ photo, index, active, onFocus, reducedMotion }) {
  const textureUrl = cloudinaryUrl(photo.src, isTouchDevice() ? 800 : 1200);
  const [texture, setTexture] = useState(null);
  const [nearCamera, setNearCamera] = useState(false);
  const nearCameraRef = useRef(false);
  const group = useRef();
  const { camera, size } = useThree();
  const viewportAspect = size.width / size.height;
  const position = photoPosition(index, viewportAspect);
  const fov = THREE.MathUtils.degToRad(CAMERA_FOV);
  const cameraDistance = cameraDistanceFor(viewportAspect);
  const aspect = texture?.image?.width && texture?.image?.height ? texture.image.width / texture.image.height : 1.4;
  const frameHeight = 2 * Math.tan(fov / 2) * cameraDistance * 0.82;
  const frameWidth = frameHeight * viewportAspect * (viewportAspect > 1.1 ? 0.56 : 0.84);
  const width = Math.min(frameWidth, frameHeight * aspect);
  const height = width / aspect;

  useEffect(() => {
    if (!nearCamera) {
      setTexture(null);
      return undefined;
    }

    let disposed = false;
    const loadedTexture = new THREE.TextureLoader().load(
      textureUrl,
      (loaded) => {
        if (disposed) {
          loaded.dispose();
          return;
        }
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.anisotropy = 4;
        loaded.needsUpdate = true;
        setTexture(loaded);
      },
      undefined,
      (error) => {
        if (!disposed) console.error('[photo-scene] image texture failed to load', textureUrl, error);
      }
    );

    return () => {
      disposed = true;
      loadedTexture.dispose();
    };
  }, [nearCamera, textureUrl]);

  useFrame(() => {
    const shouldLoad = active || Math.abs(camera.position.z - position[2]) < cameraDistance + 5;
    if (shouldLoad === nearCameraRef.current) return;
    nearCameraRef.current = shouldLoad;
    setNearCamera(shouldLoad);
  });

  useFrame(({ clock }) => {
    if (reducedMotion || !group.current || active) return;
    const time = clock.elapsedTime;
    group.current.position.y = position[1] + Math.sin(time * 0.34 + index * 0.9) * 0.065;
    group.current.rotation.y = Math.sin(time * 0.18 + index) * 0.025;
    group.current.rotation.z = Math.sin(time * 0.13 + index * 0.7) * 0.012;
    group.current.scale.setScalar(1 + Math.sin(time * 0.24 + index) * 0.004);
  });

  return (
    <group ref={group} position={position}>
      <mesh position={[0, 0, -0.08]}>
        <planeGeometry args={[width + 0.48, height + 0.48]} />
        <meshBasicMaterial color="#ff6b4a" transparent opacity={0.055} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, -0.045]}>
        <planeGeometry args={[width + 0.16, height + 0.16]} />
        <meshBasicMaterial color="#c58b3d" />
      </mesh>
      <mesh
        position={[0, 0, 0.035]}
        onClick={(event) => { event.stopPropagation(); onFocus(index); }}
        onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = ''; }}
      >
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial key={texture?.uuid || 'photo-placeholder'} map={texture} color={texture ? '#fff3dc' : '#372418'} toneMapped={false} />
      </mesh>
      <mesh raycast={() => null} position={[0, 0, 0.05]} renderOrder={2}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#e8a838" transparent opacity={0.12} depthWrite={false} blending={THREE.MultiplyBlending} />
      </mesh>
    </group>
  );
}

function LightShafts({ reducedMotion, photoCount }) {
  const { size } = useThree();
  const viewportAspect = size.width / size.height;
  const touchDevice = isTouchDevice();
  const refs = useRef([]);
  const shafts = useMemo(() => {
    const count = Math.min(touchDevice ? 8 : 24, Math.max(3, Math.ceil(photoCount / 3)));
    const lastZ = photoCount ? photoPosition(photoCount - 1, viewportAspect)[2] : -44;
    return Array.from({ length: count }, (_value, index) => ({
      position: [index % 2 ? 5 : -5, 4.5, -12 + ((lastZ + 12) * index) / (count - 1)],
      rotation: [0, 0, index % 2 ? 0.2 : -0.2],
      color: index % 3 === 1 ? '#ff6b4a' : '#e8a838'
    }));
  }, [photoCount, touchDevice, viewportAspect]);

  useFrame(({ clock }) => {
    refs.current.forEach((shaft, index) => {
      if (!shaft || reducedMotion) return;
      shaft.material.opacity = 0.045 + (Math.sin(clock.elapsedTime * 0.35 + index * 1.7) + 1) * 0.012;
      shaft.rotation.z = shafts[index].rotation[2] + Math.sin(clock.elapsedTime * 0.12 + index) * 0.035;
    });
  });

  return shafts.map((shaft, index) => (
    <mesh key={shaft.position[2]} ref={(node) => { refs.current[index] = node; }} position={shaft.position} rotation={shaft.rotation}>
      <cylinderGeometry args={[0.08, 2.8, 15, touchDevice ? 10 : 24, 1, true]} />
      <meshBasicMaterial color={shaft.color} transparent opacity={0.055} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
    </mesh>
  ));
}

function Scene({ photos, reducedMotion, focusedIndex, setFocusedIndex, startSection }) {
  return (
    <>
      <color attach="background" args={['#0b0907']} />
      <fog attach="fog" args={['#0b0907', 7, 33]} />
      <ambientLight intensity={0.8} color="#f4d0a0" />
      <spotLight position={[-6, 8, 2]} angle={0.35} penumbra={0.8} intensity={50} color="#e8a838" />
      <pointLight position={[6, 0, -10]} intensity={16} color="#ff6b4a" distance={22} />
      <LightShafts reducedMotion={reducedMotion} photoCount={photos.length} />
      {photos.map((photo, index) => (
        <Suspense key={photo.id || photo.publicId || photo.src} fallback={(
          <mesh position={photoPosition(index)}>
            <planeGeometry args={[2.5, 3.5]} />
            <meshBasicMaterial color="#372418" />
          </mesh>
        )}>
          <PhotoPlane photo={photo} index={index} active={focusedIndex === index} onFocus={setFocusedIndex} reducedMotion={reducedMotion} />
        </Suspense>
      ))}
      <CameraRig reducedMotion={reducedMotion} focusedIndex={focusedIndex} photos={photos} startSection={startSection} />
    </>
  );
}

export default function Darkroom({ photos = [], reducedMotion, startSection }) {
  const [focusedIndex, setFocusedIndex] = useState(null);
  const [fitPhotoToScreen, setFitPhotoToScreen] = useState(false);
  const visiblePhotos = useMemo(() => photos.filter((photo) => photo.src), [photos]);

  useEffect(() => {
    const canvas = document.querySelector('.darkroom-layer canvas');
    const startTrigger = document.getElementById(startSection);
    const endTrigger = document.querySelector('#contact .photo-contact-form') ||
      document.getElementById('contact') ||
      document.querySelector('.photo-footer');
    if (!canvas || !startTrigger || !endTrigger) return undefined;

    const topbarHeight = () => document.querySelector('.photo-topbar')?.offsetHeight || 78;
    const setOpacity = (opacity) => {
      gsap.killTweensOf(canvas);
      gsap.to(canvas, { opacity, duration: reducedMotion ? 0 : 0.2, overwrite: true });
    };
    const journeyStarted = startTrigger.getBoundingClientRect().top <= topbarHeight();
    const contactStarted = endTrigger.getBoundingClientRect().top <= window.innerHeight;
    gsap.set(canvas, { opacity: journeyStarted && !contactStarted ? 1 : 0 });
    const reveal = ScrollTrigger.create({
      trigger: startTrigger,
      start: () => `top top+=${topbarHeight()}`,
      onEnter: () => setOpacity(1),
      onEnterBack: () => setOpacity(1),
      onLeaveBack: () => setOpacity(0),
      invalidateOnRefresh: true
    });
    const hideTrigger = reducedMotion
      ? ScrollTrigger.create({
        trigger: endTrigger,
        start: 'top bottom',
        onEnter: () => gsap.set(canvas, { opacity: 0 }),
        onLeaveBack: () => setOpacity(1),
        invalidateOnRefresh: true
      })
      : gsap.to(canvas, {
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: endTrigger,
          start: () => `top bottom+=${contactSceneClearance(startTrigger, endTrigger)}`,
          end: 'top bottom',
          scrub: true,
          invalidateOnRefresh: true
        }
      });
    const refresh = () => ScrollTrigger.refresh();
    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(refresh);
      resizeObserver.observe(startTrigger);
      resizeObserver.observe(endTrigger);
    } else {
      window.addEventListener('resize', refresh);
    }

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', refresh);
      reveal.kill();
      hideTrigger.scrollTrigger?.kill();
      hideTrigger.kill();
      gsap.killTweensOf(canvas);
      gsap.set(canvas, { clearProps: 'opacity' });
    };
  }, [reducedMotion, startSection]);

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
      <Canvas camera={{ position: [0, 0, 8], fov: CAMERA_FOV }} dpr={[1, getScenePixelRatio()]} frameloop={reducedMotion ? 'demand' : 'always'} gl={{ antialias: false, powerPreference: 'high-performance' }} onPointerMissed={() => setFocusedIndex(null)}>
        <Suspense fallback={<mesh><planeGeometry args={[3, 2]} /><meshBasicMaterial color="#372418" /></mesh>}>
          <Scene photos={visiblePhotos} reducedMotion={reducedMotion} focusedIndex={focusedIndex} setFocusedIndex={setFocusedIndex} startSection={startSection} />
        </Suspense>
      </Canvas>
      <AnimatePresence>
        {focusedIndex != null && visiblePhotos[focusedIndex] && (
          <motion.div className={`photo-focus ${fitPhotoToScreen ? 'photo-focus-fit' : ''}`} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reducedMotion ? undefined : { opacity: 0 }} role="dialog" aria-modal="true" aria-label={visiblePhotos[focusedIndex].title || 'Photograph'} onClick={() => setFocusedIndex(null)}>
            <button type="button" className="photo-focus-fit-toggle" aria-label={fitPhotoToScreen ? 'Restore image margins' : 'Fit photo to screen'} aria-pressed={fitPhotoToScreen} onClick={(event) => { event.stopPropagation(); setFitPhotoToScreen(!fitPhotoToScreen); }}>
              {fitPhotoToScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button type="button" className="photo-focus-close" aria-label="Close image" onClick={() => setFocusedIndex(null)}><X size={20} /></button>
            <motion.img
              src={cloudinaryUrl(visiblePhotos[focusedIndex].src, isTouchDevice() ? 1400 : 2000)}
              alt={visiblePhotos[focusedIndex].alt || visiblePhotos[focusedIndex].title || ''}
              initial={reducedMotion ? false : { scale: 0.92, filter: 'blur(10px)' }}
              animate={{ scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: reducedMotion ? 0 : 0.6 }}
              onClick={(event) => event.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
