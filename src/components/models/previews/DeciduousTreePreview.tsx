import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

export default function DeciduousTreePreview() {
  const groupRef = useRef<Group>(null!);

  useFrame((_, delta) => {
    groupRef.current.rotation.y += delta * 0.3;
  });

  return (
    <group ref={groupRef}>
      {/* Trunk - thicker */}
      <mesh castShadow position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.12, 0.3, 2.2, 8]} />
        <meshStandardMaterial color="#6b4226" roughness={0.95} />
      </mesh>
      {/* Main canopy */}
      <mesh castShadow position={[0, 2.9, 0]}>
        <dodecahedronGeometry args={[1.5, 1]} />
        <meshStandardMaterial color="#3a7a2a" roughness={0.82} />
      </mesh>
      {/* Secondary canopy cluster */}
      <mesh castShadow position={[0.4, 2.7, 0.3]}>
        <dodecahedronGeometry args={[1.1, 1]} />
        <meshStandardMaterial color="#347524" roughness={0.82} />
      </mesh>
    </group>
  );
}
