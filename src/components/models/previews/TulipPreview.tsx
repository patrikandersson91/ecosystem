import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

export default function TulipPreview() {
  const groupRef = useRef<Group>(null!);

  useFrame((_, delta) => {
    groupRef.current.rotation.y += delta * 0.3;
  });

  const petalCount = 5;

  return (
    <group ref={groupRef}>
      {/* Stem */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.015, 0.022, 0.4, 5]} />
        <meshStandardMaterial color="#3d8b37" roughness={0.85} />
      </mesh>
      {/* Leaf */}
      <mesh position={[0.06, 0.14, 0]} rotation={[0, 0, 0.5]} scale={[0.5, 0.3, 1.2]}>
        <sphereGeometry args={[0.055, 5, 3]} />
        <meshStandardMaterial color="#4caf50" roughness={0.8} />
      </mesh>
      {/* Petals - cupped goblet shape */}
      {Array.from({ length: petalCount }).map((_, i) => {
        const angle = (i / petalCount) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 0.035, 0.4, Math.sin(angle) * 0.035]}
            rotation={[0, angle, 0]}
            scale={[0.5, 1.2, 0.7]}
          >
            <sphereGeometry args={[0.065, 6, 5]} />
            <meshStandardMaterial color="#fd79a8" roughness={0.65} />
          </mesh>
        );
      })}
      {/* Center */}
      <mesh position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.03, 6, 6]} />
        <meshStandardMaterial color="#f39c12" roughness={0.6} />
      </mesh>
    </group>
  );
}
