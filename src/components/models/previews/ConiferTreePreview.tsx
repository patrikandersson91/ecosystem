import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

export default function ConiferTreePreview() {
  const groupRef = useRef<Group>(null!);

  useFrame((_, delta) => {
    groupRef.current.rotation.y += delta * 0.3;
  });

  return (
    <group ref={groupRef}>
      {/* Trunk */}
      <mesh castShadow position={[0, 1.25, 0]}>
        <cylinderGeometry args={[0.08, 0.2, 2.5, 8]} />
        <meshStandardMaterial color="#5a3420" roughness={0.95} />
      </mesh>
      {/* Tier 1 - bottom, widest */}
      <mesh castShadow position={[0, 2.0, 0]}>
        <coneGeometry args={[1.5, 2.0, 8]} />
        <meshStandardMaterial color="#2a5e1a" roughness={0.88} />
      </mesh>
      {/* Tier 2 - middle */}
      <mesh castShadow position={[0, 3.0, 0]}>
        <coneGeometry args={[1.2, 1.8, 7]} />
        <meshStandardMaterial color="#2d6b1e" roughness={0.88} />
      </mesh>
      {/* Tier 3 - top, narrowest */}
      <mesh castShadow position={[0, 3.85, 0]}>
        <coneGeometry args={[0.75, 1.5, 7]} />
        <meshStandardMaterial color="#357a25" roughness={0.88} />
      </mesh>
    </group>
  );
}
