import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

export default function RabbitPreview() {
  const groupRef = useRef<Group>(null!);
  const flLegRef = useRef<Group>(null!);
  const frLegRef = useRef<Group>(null!);
  const blLegRef = useRef<Group>(null!);
  const brLegRef = useRef<Group>(null!);
  const phase = useRef(0);

  useFrame((_, delta) => {
    phase.current += delta * 3;
    const hop = Math.max(0, Math.sin(phase.current)) * 0.15;
    groupRef.current.position.y = hop + 0.1;

    const cycle = Math.sin(phase.current);
    flLegRef.current.rotation.x = cycle * 0.3;
    frLegRef.current.rotation.x = cycle * 0.3;
    blLegRef.current.rotation.x = -cycle * 0.4;
    brLegRef.current.rotation.x = -cycle * 0.4;

    groupRef.current.rotation.y += delta * 0.3;
  });

  return (
    <group ref={groupRef}>
      {/* Body - elongated oval torso */}
      <mesh castShadow position={[0, 0.2, -0.02]} scale={[1, 0.9, 1.15]}>
        <sphereGeometry args={[0.22, 6, 6]} />
        <meshStandardMaterial color="#c49a6c" />
      </mesh>
      {/* Rump - round backside */}
      <mesh castShadow position={[0, 0.24, -0.14]}>
        <sphereGeometry args={[0.17, 6, 6]} />
        <meshStandardMaterial color="#c49a6c" />
      </mesh>
      {/* Belly - lighter underside */}
      <mesh position={[0, 0.12, 0.02]}>
        <boxGeometry args={[0.18, 0.07, 0.28]} />
        <meshStandardMaterial color="#dcc8a8" />
      </mesh>
      {/* Head */}
      <mesh castShadow position={[0, 0.32, 0.26]}>
        <sphereGeometry args={[0.14, 6, 6]} />
        <meshStandardMaterial color="#c49a6c" />
      </mesh>
      {/* Muzzle */}
      <mesh position={[0, 0.26, 0.36]} scale={[1.3, 0.85, 1]}>
        <sphereGeometry args={[0.065, 6, 6]} />
        <meshStandardMaterial color="#dcc8a8" />
      </mesh>
      {/* Nose */}
      <mesh position={[0, 0.29, 0.40]}>
        <sphereGeometry args={[0.018, 6, 6]} />
        <meshStandardMaterial color="#e88a93" />
      </mesh>
      {/* Left eye */}
      <mesh position={[-0.1, 0.36, 0.32]}>
        <sphereGeometry args={[0.028, 6, 6]} />
        <meshStandardMaterial color="#1a1000" />
      </mesh>
      {/* Right eye */}
      <mesh position={[0.1, 0.36, 0.32]}>
        <sphereGeometry args={[0.028, 6, 6]} />
        <meshStandardMaterial color="#1a1000" />
      </mesh>
      {/* Left ear outer */}
      <mesh position={[-0.055, 0.55, 0.2]} rotation={[0.2, 0, -0.15]} scale={[1.4, 1, 0.5]}>
        <capsuleGeometry args={[0.035, 0.26, 4, 4]} />
        <meshStandardMaterial color="#a87e52" />
      </mesh>
      {/* Left ear inner */}
      <mesh position={[-0.052, 0.55, 0.205]} rotation={[0.2, 0, -0.15]} scale={[1.3, 1, 0.45]}>
        <capsuleGeometry args={[0.025, 0.2, 4, 4]} />
        <meshStandardMaterial color="#e8a0a8" />
      </mesh>
      {/* Right ear outer */}
      <mesh position={[0.055, 0.55, 0.2]} rotation={[0.2, 0, 0.15]} scale={[1.4, 1, 0.5]}>
        <capsuleGeometry args={[0.035, 0.26, 4, 4]} />
        <meshStandardMaterial color="#a87e52" />
      </mesh>
      {/* Right ear inner */}
      <mesh position={[0.052, 0.55, 0.205]} rotation={[0.2, 0, 0.15]} scale={[1.3, 1, 0.45]}>
        <capsuleGeometry args={[0.025, 0.2, 4, 4]} />
        <meshStandardMaterial color="#e8a0a8" />
      </mesh>
      {/* Front-left leg */}
      <group ref={flLegRef} position={[-0.08, 0.06, 0.1]}>
        <mesh castShadow>
          <boxGeometry args={[0.05, 0.12, 0.05]} />
          <meshStandardMaterial color="#a88560" />
        </mesh>
        <mesh position={[0, -0.07, 0.01]}>
          <sphereGeometry args={[0.028, 5, 5]} />
          <meshStandardMaterial color="#a88560" />
        </mesh>
      </group>
      {/* Front-right leg */}
      <group ref={frLegRef} position={[0.08, 0.06, 0.1]}>
        <mesh castShadow>
          <boxGeometry args={[0.05, 0.12, 0.05]} />
          <meshStandardMaterial color="#a88560" />
        </mesh>
        <mesh position={[0, -0.07, 0.01]}>
          <sphereGeometry args={[0.028, 5, 5]} />
          <meshStandardMaterial color="#a88560" />
        </mesh>
      </group>
      {/* Back-left leg */}
      <group ref={blLegRef} position={[-0.1, 0.08, -0.12]}>
        <mesh castShadow>
          <boxGeometry args={[0.07, 0.1, 0.08]} />
          <meshStandardMaterial color="#c49a6c" />
        </mesh>
        <mesh castShadow position={[0, -0.1, 0.02]}>
          <boxGeometry args={[0.05, 0.12, 0.055]} />
          <meshStandardMaterial color="#a88560" />
        </mesh>
        <mesh position={[0, -0.17, 0.04]}>
          <boxGeometry args={[0.05, 0.025, 0.08]} />
          <meshStandardMaterial color="#a88560" />
        </mesh>
      </group>
      {/* Back-right leg */}
      <group ref={brLegRef} position={[0.1, 0.08, -0.12]}>
        <mesh castShadow>
          <boxGeometry args={[0.07, 0.1, 0.08]} />
          <meshStandardMaterial color="#c49a6c" />
        </mesh>
        <mesh castShadow position={[0, -0.1, 0.02]}>
          <boxGeometry args={[0.05, 0.12, 0.055]} />
          <meshStandardMaterial color="#a88560" />
        </mesh>
        <mesh position={[0, -0.17, 0.04]}>
          <boxGeometry args={[0.05, 0.025, 0.08]} />
          <meshStandardMaterial color="#a88560" />
        </mesh>
      </group>
      {/* Tail - fluffy cotton ball */}
      <mesh position={[0, 0.26, -0.28]}>
        <sphereGeometry args={[0.065, 6, 6]} />
        <meshStandardMaterial color="#f0ebe5" />
      </mesh>
    </group>
  );
}
