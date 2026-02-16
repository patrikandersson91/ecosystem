import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

export default function DaisyPreview() {
  const groupRef = useRef<Group>(null!);

  useFrame((_, delta) => {
    groupRef.current.rotation.y += delta * 0.3;
  });

  const petalCount = 7;

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
      {/* Petals - ring of flat oval spheres */}
      {Array.from({ length: petalCount }).map((_, i) => {
        const angle = (i / petalCount) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 0.1, 0.42, Math.sin(angle) * 0.1]}
            rotation={[0, angle, 0]}
            scale={[0.6, 0.3, 1.4]}
          >
            <sphereGeometry args={[0.065, 6, 4]} />
            <meshStandardMaterial color="#e84393" roughness={0.7} />
          </mesh>
        );
      })}
      {/* Center */}
      <mesh position={[0, 0.43, 0]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshStandardMaterial color="#fdcb6e" roughness={0.6} />
      </mesh>
    </group>
  );
}
