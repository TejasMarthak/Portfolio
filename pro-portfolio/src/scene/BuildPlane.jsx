import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, Stars } from '@react-three/drei';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';
import { getScenePixelRatio, isTouchDevice } from '../../../shared/deviceRendering.js';

gsap.registerPlugin(ScrollTrigger);

const NODE_SPACING = 9.5;
const CAMERA_DISTANCE = 7.2;
const CAMERA_FOV = 58;

function sceneClearance(startTrigger, endTrigger) {
  const topbarHeight = document.querySelector('.topbar')?.offsetHeight || 76;
  const startPosition = startTrigger.getBoundingClientRect().top + window.scrollY - topbarHeight;
  const endPosition = endTrigger.getBoundingClientRect().top + window.scrollY - window.innerHeight;
  const availableDistance = Math.max(0, endPosition - startPosition);
  return Math.min(300, Math.floor(availableDistance * 0.2));
}

function CameraRig({ nodes, reducedMotion, startSection }) {
  const { camera } = useThree();
  const progress = useRef({ value: 0 });
  const cameraTarget = useRef(new THREE.Vector3());
  const desiredLookTarget = useRef(new THREE.Vector3());
  const lookTarget = useRef(new THREE.Vector3());

  useEffect(() => {
    if (reducedMotion || !startSection) return undefined;
    const journey = document.getElementById('journey');
    const startTrigger = document.getElementById(startSection);
    const endTrigger = document.querySelector('#contact .contact-form') ||
      document.getElementById('contact') ||
      document.querySelector('.site-footer') ||
      journey;
    if (!journey || !startTrigger || !endTrigger) return undefined;
    const tween = gsap.to(progress.current, {
      value: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: startTrigger,
        start: () => `top top+=${document.querySelector('.topbar')?.offsetHeight || 76}`,
        endTrigger,
        end: () => `top bottom+=${sceneClearance(startTrigger, endTrigger)}`,
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

  useFrame((_state, delta) => {
    if (!nodes.length) return;
    const lastIndex = nodes.length - 1;
    const scaledIndex = THREE.MathUtils.clamp(progress.current.value, 0, 1) * lastIndex;
    const index = Math.min(Math.floor(scaledIndex), lastIndex);
    const nextIndex = Math.min(index + 1, lastIndex);
    const fraction = THREE.MathUtils.smoothstep(scaledIndex - index, 0, 1);
    desiredLookTarget.current.copy(nodes[index]).lerp(nodes[nextIndex], fraction);
    const smoothing = reducedMotion ? 1 : 1 - Math.exp(-delta * 6);
    lookTarget.current.lerp(desiredLookTarget.current, smoothing);
    cameraTarget.current.set(
      lookTarget.current.x,
      lookTarget.current.y,
      lookTarget.current.z + CAMERA_DISTANCE
    );
    camera.position.lerp(cameraTarget.current, smoothing);
    camera.lookAt(lookTarget.current);
  });

  return null;
}

function Terrain({ depth }) {
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(44, depth, 36, Math.max(36, Math.ceil(depth / 1.5)));
    const positions = plane.attributes.position;
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      positions.setZ(i, Math.sin(x * 0.45) * Math.cos(y * 0.36) * 0.42);
    }
    plane.computeVertexNormals();
    return plane;
  }, [depth]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.35, -depth / 2]}>
      <meshBasicMaterial color="#392a73" wireframe transparent opacity={0.28} />
    </mesh>
  );
}

function stackPosition(index) {
  const x = Math.sin(index * 2.4) * 2.8;
  const y = 0.15 + Math.sin(index * 1.3) * 0.42;
  const z = -1 - index * NODE_SPACING;
  return [x, y, z];
}

function StackNode({ item, index, position }) {
  return (
    <group position={position}>
      <mesh>
        <icosahedronGeometry args={[0.2, 1]} />
        <meshStandardMaterial color={index % 2 ? '#33f2c7' : '#7c5cff'} emissive={index % 2 ? '#16775f' : '#35206f'} emissiveIntensity={2.2} />
      </mesh>
      <Html distanceFactor={9} position={[0, 0.38, 0]} center className="scene-label">
        <span>{item.name || item.title || item.category}</span>
      </Html>
    </group>
  );
}

function Network({ items = [] }) {
  const nodes = items.slice(0, 28);
  const points = nodes.map((_, index) => stackPosition(index));
  return (
    <>
      {nodes.map((item, index) => <StackNode key={`${item.name || item.title}-${index}`} item={item} index={index} position={points[index]} />)}
      {points.slice(1).map((point, index) => (
        <Line key={`link-${index}`} points={[points[index], point]} color={index % 2 ? '#33f2c7' : '#7c5cff'} transparent opacity={0.35} lineWidth={1} />
      ))}
    </>
  );
}

function World({ content, reducedMotion, startSection }) {
  const nodes = useMemo(() => [
    ...(content.skills || []).flatMap((category) => category.items || []),
    ...(content.projects || [])
  ].slice(0, 28), [content.skills, content.projects]);
  const positions = useMemo(
    () => nodes.map((_, index) => new THREE.Vector3(...stackPosition(index))),
    [nodes]
  );
  const depth = Math.max(44, (nodes.length - 1) * NODE_SPACING + 34);
  const starCount = isTouchDevice() ? 450 : 1400;
  return (
    <>
      <color attach="background" args={['#05070d']} />
      <fog attach="fog" args={['#05070d', 9, Math.max(38, depth * 0.72)]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[4, 5, 4]} color="#7c5cff" intensity={20} distance={25} />
      <pointLight position={[-5, 2, -14]} color="#33f2c7" intensity={14} distance={30} />
      <Stars radius={Math.max(70, depth)} depth={Math.max(40, depth)} count={starCount} factor={3} saturation={0.3} fade speed={reducedMotion ? 0 : 0.25} />
      <Terrain depth={depth} />
      <Network items={nodes} />
      <CameraRig nodes={positions} reducedMotion={reducedMotion} startSection={startSection} />
    </>
  );
}

export default function BuildPlane({ content, reducedMotion, startSection }) {
  return (
    <Canvas camera={{ position: [0, 0, CAMERA_DISTANCE], fov: CAMERA_FOV }} dpr={[1, getScenePixelRatio()]} frameloop={reducedMotion ? 'demand' : 'always'} gl={{ antialias: false, powerPreference: 'high-performance' }}>
      <Suspense fallback={<mesh><icosahedronGeometry args={[0.6, 1]} /><meshBasicMaterial color="#7c5cff" wireframe /></mesh>}>
        <World content={content} reducedMotion={reducedMotion} startSection={startSection} />
      </Suspense>
    </Canvas>
  );
}
