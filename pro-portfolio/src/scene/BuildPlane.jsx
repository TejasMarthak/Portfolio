import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, Stars } from '@react-three/drei';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';
import { getScenePixelRatio, isTouchDevice } from '../../../shared/deviceRendering.js';

gsap.registerPlugin(ScrollTrigger);

function CameraRig({ reducedMotion }) {
  const { camera } = useThree();
  const progress = useRef({ value: 0 });
  const destinations = useMemo(() => [
    new THREE.Vector3(0, 1, 11),
    new THREE.Vector3(1.5, 1.2, 6),
    new THREE.Vector3(-1, 1.4, 1),
    new THREE.Vector3(1, 1.5, -4),
    new THREE.Vector3(-1, 1.2, -9),
    new THREE.Vector3(0, 1.6, -14)
  ], []);

  useEffect(() => {
    if (reducedMotion) return undefined;
    const tween = gsap.to(progress.current, {
      value: 1,
      ease: 'none',
      scrollTrigger: { trigger: '#journey', start: 'top top', end: 'bottom bottom', scrub: 1 }
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [reducedMotion]);

  useFrame(() => {
    const position = progress.current.value * (destinations.length - 1);
    const index = Math.min(Math.floor(position), destinations.length - 2);
    const target = destinations[index].clone().lerp(destinations[index + 1], position - index);
    camera.position.lerp(target, reducedMotion ? 1 : 0.075);
    camera.lookAt(0, 0, camera.position.z - 7);
  });

  return null;
}

function Terrain() {
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(44, 44, 36, 36);
    const positions = plane.attributes.position;
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      positions.setZ(i, Math.sin(x * 0.45) * Math.cos(y * 0.36) * 0.42);
    }
    plane.computeVertexNormals();
    return plane;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.05, -4]}>
      <meshBasicMaterial color="#392a73" wireframe transparent opacity={0.28} />
    </mesh>
  );
}

function StackNode({ item, index }) {
  const x = Math.sin(index * 2.4) * 3.2;
  const y = 0.5 + (index % 4) * 0.65;
  const z = -index * 2.35 - 1;
  return (
    <group position={[x, y, z]}>
      <mesh>
        <icosahedronGeometry args={[0.16 + (index % 3) * 0.06, 1]} />
        <meshStandardMaterial color={index % 2 ? '#33f2c7' : '#7c5cff'} emissive={index % 2 ? '#16775f' : '#35206f'} emissiveIntensity={2.2} />
      </mesh>
      <Html distanceFactor={10} position={[0.25, 0.18, 0]} className="scene-label">
        <span>{item.name || item.title || item.category}</span>
      </Html>
    </group>
  );
}

function Network({ items = [] }) {
  const nodes = items.slice(0, 28);
  const points = nodes.map((_, index) => [
    Math.sin(index * 2.4) * 3.2,
    0.5 + (index % 4) * 0.65,
    -index * 2.35 - 1
  ]);
  return (
    <>
      {nodes.map((item, index) => <StackNode key={`${item.name || item.title}-${index}`} item={item} index={index} />)}
      {points.slice(1).map((point, index) => (
        <Line key={`link-${index}`} points={[points[index], point]} color={index % 2 ? '#33f2c7' : '#7c5cff'} transparent opacity={0.35} lineWidth={1} />
      ))}
    </>
  );
}

function World({ content, reducedMotion }) {
  const nodes = [
    ...(content.skills || []).flatMap((category) => category.items || []),
    ...(content.projects || [])
  ];
  const starCount = isTouchDevice() ? 450 : 1400;
  return (
    <>
      <color attach="background" args={['#05070d']} />
      <fog attach="fog" args={['#05070d', 9, 38]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[4, 5, 4]} color="#7c5cff" intensity={20} distance={25} />
      <pointLight position={[-5, 2, -14]} color="#33f2c7" intensity={14} distance={30} />
      <Stars radius={70} depth={40} count={starCount} factor={3} saturation={0.3} fade speed={reducedMotion ? 0 : 0.25} />
      <Terrain />
      <Network items={nodes} />
      <CameraRig reducedMotion={reducedMotion} />
    </>
  );
}

export default function BuildPlane({ content, reducedMotion }) {
  return (
    <Canvas camera={{ position: [0, 1, 11], fov: 58 }} dpr={[1, getScenePixelRatio()]} frameloop={reducedMotion ? 'demand' : 'always'} gl={{ antialias: false, powerPreference: 'high-performance' }}>
      <Suspense fallback={<mesh><icosahedronGeometry args={[0.6, 1]} /><meshBasicMaterial color="#7c5cff" wireframe /></mesh>}>
        <World content={content} reducedMotion={reducedMotion} />
      </Suspense>
    </Canvas>
  );
}
