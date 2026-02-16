import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

export default function StonePreview() {
  const groupRef = useRef<Group>(null!);

  useFrame((_, delta) => {
    groupRef.current.rotation.y += delta * 0.3;
  });

  return (
    <group ref={groupRef}>
      {/* Main stone body - squashed dodecahedron */}
      <mesh castShadow position={[0, 0.2, 0]} scale={[1, 0.6, 0.85]}>
        <dodecahedronGeometry args={[0.42, 1]} />
        <meshStandardMaterial color="#8a8a8a" roughness={1} metalness={0.05} />
      </mesh>
      {/* Smaller angular accent stone */}
      <mesh castShadow position={[0.3, 0.1, 0.15]} scale={[1, 0.55, 0.9]}>
        <icosahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial color="#7a7a7a" roughness={1} metalness={0.08} />
      </mesh>
    </group>
  );
}
