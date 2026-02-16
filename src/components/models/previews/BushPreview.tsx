import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

export default function BushPreview() {
  const groupRef = useRef<Group>(null!);

  useFrame((_, delta) => {
    groupRef.current.rotation.y += delta * 0.3;
  });

  return (
    <group ref={groupRef}>
      {/* Main dome */}
      <mesh castShadow position={[0, 0.38, 0]} scale={[1, 0.75, 1]}>
        <sphereGeometry args={[0.55, 8, 6]} />
        <meshStandardMaterial color="#3a7d28" roughness={0.92} />
      </mesh>
      {/* Side lobe - right forward */}
      <mesh castShadow position={[0.25, 0.28, 0.15]} scale={[1, 0.7, 1]}>
        <sphereGeometry args={[0.38, 7, 5]} />
        <meshStandardMaterial color="#2e6b1e" roughness={0.92} />
      </mesh>
      {/* Side lobe - left back */}
      <mesh castShadow position={[-0.22, 0.26, -0.18]} scale={[1, 0.65, 1]}>
        <sphereGeometry args={[0.35, 7, 5]} />
        <meshStandardMaterial color="#358a22" roughness={0.92} />
      </mesh>
    </group>
  );
}
