import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

export default function BluebellPreview() {
  const groupRef = useRef<Group>(null!);

  useFrame((_, delta) => {
    groupRef.current.rotation.y += delta * 0.3;
  });

  const stamenCount = 4;

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
      {/* Bell body (inverted cone) */}
      <mesh position={[0, 0.36, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.1, 0.16, 8]} />
        <meshStandardMaterial color="#6c5ce7" roughness={0.7} />
      </mesh>
      {/* Bell center */}
      <mesh position={[0, 0.28, 0]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshStandardMaterial color="#fdcb6e" roughness={0.6} />
      </mesh>
      {/* Stamens */}
      {Array.from({ length: stamenCount }).map((_, i) => {
        const angle = (i / stamenCount) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 0.035, 0.28, Math.sin(angle) * 0.035]}
          >
            <sphereGeometry args={[0.015, 4, 3]} />
            <meshStandardMaterial color="#f39c12" roughness={0.6} />
          </mesh>
        );
      })}
    </group>
  );
}
