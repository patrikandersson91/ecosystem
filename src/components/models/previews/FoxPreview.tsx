import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

export default function FoxPreview() {
  const groupRef = useRef<Group>(null!);
  const flLegRef = useRef<Group>(null!);
  const frLegRef = useRef<Group>(null!);
  const blLegRef = useRef<Group>(null!);
  const brLegRef = useRef<Group>(null!);
  const tailRef = useRef<Group>(null!);
  const phase = useRef(0);

  useFrame((_, delta) => {
    phase.current += delta * 2.5;
    const walk = Math.sin(phase.current);

    flLegRef.current.rotation.x = walk * 0.3;
    brLegRef.current.rotation.x = walk * 0.3;
    frLegRef.current.rotation.x = -walk * 0.3;
    blLegRef.current.rotation.x = -walk * 0.3;

    tailRef.current.rotation.y = Math.sin(phase.current * 1.3) * 0.3;
    tailRef.current.rotation.x = 0.2 + Math.sin(phase.current * 0.7) * 0.1;

    groupRef.current.rotation.y += delta * 0.3;
  });

  return (
    <group ref={groupRef} position={[0, 0.5, 0]} scale={[1.6, 1.6, 1.6]}>
      {/* Body - sleek torso */}
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.15, 0.36, 4, 6]} />
        <meshStandardMaterial color="#c85a1c" />
      </mesh>
      {/* Chest / underbelly */}
      <mesh position={[0, -0.07, 0.1]} scale={[0.85, 0.6, 1]}>
        <sphereGeometry args={[0.14, 6, 6]} />
        <meshStandardMaterial color="#f0c890" />
      </mesh>
      {/* Head */}
      <mesh castShadow position={[0, 0.1, 0.42]}>
        <sphereGeometry args={[0.14, 6, 6]} />
        <meshStandardMaterial color="#d06820" />
      </mesh>
      {/* Cheek ruff - left */}
      <mesh position={[-0.08, 0.04, 0.46]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#f0c890" />
      </mesh>
      {/* Cheek ruff - right */}
      <mesh position={[0.08, 0.04, 0.46]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#f0c890" />
      </mesh>
      {/* Snout */}
      <mesh position={[0, 0.04, 0.56]} rotation={[Math.PI / 2, 0, 0]} scale={[0.8, 1, 0.7]}>
        <capsuleGeometry args={[0.06, 0.14, 4, 6]} />
        <meshStandardMaterial color="#e0a060" />
      </mesh>
      {/* Nose */}
      <mesh position={[0, 0.06, 0.65]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* Left eye */}
      <mesh position={[-0.09, 0.16, 0.52]}>
        <sphereGeometry args={[0.03, 6, 6]} />
        <meshStandardMaterial color="#1a1000" />
      </mesh>
      {/* Right eye */}
      <mesh position={[0.09, 0.16, 0.52]}>
        <sphereGeometry args={[0.03, 6, 6]} />
        <meshStandardMaterial color="#1a1000" />
      </mesh>
      {/* Left ear outer */}
      <mesh position={[-0.09, 0.32, 0.38]} rotation={[0.15, 0, -0.2]}>
        <capsuleGeometry args={[0.04, 0.12, 3, 4]} />
        <meshStandardMaterial color="#c85a1c" />
      </mesh>
      {/* Left ear inner */}
      <mesh position={[-0.087, 0.31, 0.385]} rotation={[0.15, 0, -0.2]}>
        <capsuleGeometry args={[0.025, 0.08, 3, 4]} />
        <meshStandardMaterial color="#e8a060" />
      </mesh>
      {/* Right ear outer */}
      <mesh position={[0.09, 0.32, 0.38]} rotation={[0.15, 0, 0.2]}>
        <capsuleGeometry args={[0.04, 0.12, 3, 4]} />
        <meshStandardMaterial color="#c85a1c" />
      </mesh>
      {/* Right ear inner */}
      <mesh position={[0.087, 0.31, 0.385]} rotation={[0.15, 0, 0.2]}>
        <capsuleGeometry args={[0.025, 0.08, 3, 4]} />
        <meshStandardMaterial color="#e8a060" />
      </mesh>
      {/* Front Left Leg */}
      <group ref={flLegRef} position={[-0.1, -0.1, 0.18]}>
        <mesh position={[0, -0.09, 0]} castShadow>
          <boxGeometry args={[0.06, 0.18, 0.06]} />
          <meshStandardMaterial color="#a04510" />
        </mesh>
        <mesh position={[0, -0.19, 0]}>
          <boxGeometry args={[0.065, 0.04, 0.065]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>
      {/* Front Right Leg */}
      <group ref={frLegRef} position={[0.1, -0.1, 0.18]}>
        <mesh position={[0, -0.09, 0]} castShadow>
          <boxGeometry args={[0.06, 0.18, 0.06]} />
          <meshStandardMaterial color="#a04510" />
        </mesh>
        <mesh position={[0, -0.19, 0]}>
          <boxGeometry args={[0.065, 0.04, 0.065]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>
      {/* Back Left Leg */}
      <group ref={blLegRef} position={[-0.1, -0.1, -0.2]}>
        <mesh position={[0, -0.09, 0]} castShadow>
          <boxGeometry args={[0.06, 0.18, 0.06]} />
          <meshStandardMaterial color="#a04510" />
        </mesh>
        <mesh position={[0, -0.19, 0]}>
          <boxGeometry args={[0.065, 0.04, 0.065]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>
      {/* Back Right Leg */}
      <group ref={brLegRef} position={[0.1, -0.1, -0.2]}>
        <mesh position={[0, -0.09, 0]} castShadow>
          <boxGeometry args={[0.06, 0.18, 0.06]} />
          <meshStandardMaterial color="#a04510" />
        </mesh>
        <mesh position={[0, -0.19, 0]}>
          <boxGeometry args={[0.065, 0.04, 0.065]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>
      {/* Tail group */}
      <group ref={tailRef} position={[0, 0.05, -0.26]}>
        <mesh position={[0, 0.02, 0]} castShadow>
          <sphereGeometry args={[0.08, 6, 6]} />
          <meshStandardMaterial color="#a04818" />
        </mesh>
        <mesh position={[0, 0, -0.12]} castShadow scale={[1.15, 0.85, 1.1]}>
          <sphereGeometry args={[0.1, 6, 6]} />
          <meshStandardMaterial color="#c85a1c" />
        </mesh>
        <mesh position={[0, -0.02, -0.22]} scale={[1, 0.85, 1]}>
          <sphereGeometry args={[0.08, 6, 6]} />
          <meshStandardMaterial color="#d88030" />
        </mesh>
        <mesh position={[0, -0.04, -0.3]}>
          <sphereGeometry args={[0.06, 6, 6]} />
          <meshStandardMaterial color="#f5f0e8" />
        </mesh>
      </group>
    </group>
  );
}
