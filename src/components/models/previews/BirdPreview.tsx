import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

export default function BirdPreview() {
  const groupRef = useRef<Group>(null!);
  const leftWingRef = useRef<Group>(null!);
  const rightWingRef = useRef<Group>(null!);
  const phase = useRef(0);

  useFrame((_, delta) => {
    phase.current += delta * 4;
    const flap = Math.sin(phase.current) * 0.66;
    leftWingRef.current.rotation.z = flap;
    rightWingRef.current.rotation.z = -flap;

    groupRef.current.position.y = 0.8 + Math.sin(phase.current * 0.5) * 0.1;
    groupRef.current.rotation.y += delta * 0.3;
  });

  return (
    <group ref={groupRef} position={[0, 0.8, 0]}>
      {/* Main torso - horizontal brown capsule */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.17, 0.48, 6, 10]} />
        <meshStandardMaterial color="#6b5a48" roughness={0.82} metalness={0.02} />
      </mesh>
      {/* Belly - lighter tan underside */}
      <mesh position={[0.04, -0.05, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.14, 0.34, 6, 8]} />
        <meshStandardMaterial color="#c4b49a" roughness={0.8} metalness={0.01} />
      </mesh>
      {/* Back - darker brown upper plumage */}
      <mesh position={[-0.02, 0.07, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.13, 0.3, 6, 8]} />
        <meshStandardMaterial color="#5a4a3a" roughness={0.84} metalness={0.02} />
      </mesh>

      {/* Neck - black, horizontal */}
      <mesh position={[0.46, 0.0, 0]} rotation={[0, 0, Math.PI / 2 + 0.1]} castShadow>
        <capsuleGeometry args={[0.042, 0.34, 6, 8]} />
        <meshStandardMaterial color="#1a1c20" roughness={0.78} metalness={0.03} />
      </mesh>
      {/* Head - black */}
      <mesh position={[0.64, 0.03, 0]} castShadow>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color="#1a1c20" roughness={0.76} metalness={0.03} />
      </mesh>
      {/* White chinstrap - left cheek */}
      <mesh position={[0.635, 0.025, 0.05]} scale={[0.75, 0.95, 0.35]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#f0ede8" roughness={0.78} metalness={0.01} />
      </mesh>
      {/* White chinstrap - right cheek */}
      <mesh position={[0.635, 0.025, -0.05]} scale={[0.75, 0.95, 0.35]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#f0ede8" roughness={0.78} metalness={0.01} />
      </mesh>
      {/* Beak - black, pointing forward */}
      <mesh position={[0.74, 0.02, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.025, 0.1, 8]} />
        <meshStandardMaterial color="#222222" roughness={0.9} metalness={0} />
      </mesh>
      {/* Left eye */}
      <mesh position={[0.67, 0.055, 0.05]}>
        <sphereGeometry args={[0.009, 6, 6]} />
        <meshStandardMaterial color="#111111" roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Right eye */}
      <mesh position={[0.67, 0.055, -0.05]}>
        <sphereGeometry args={[0.009, 6, 6]} />
        <meshStandardMaterial color="#111111" roughness={0.5} metalness={0.1} />
      </mesh>
      {/* White rump/undertail coverts */}
      <mesh position={[-0.28, -0.02, 0]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#f0ede8" roughness={0.82} metalness={0.01} />
      </mesh>

      {/* Left Wing - wide overlapping panels */}
      <group ref={leftWingRef} position={[-0.02, 0.03, 0.17]} rotation={[0.04, 0.03, 0.06]}>
        {/* Wing root/shoulder */}
        <mesh position={[0.02, 0, 0.06]} castShadow>
          <boxGeometry args={[0.4, 0.022, 0.2]} />
          <meshStandardMaterial color="#8a7560" roughness={0.84} metalness={0.01} />
        </mesh>
        {/* Mid coverts */}
        <mesh position={[0, 0.003, 0.22]} rotation={[0, 0, 0.05]} castShadow>
          <boxGeometry args={[0.5, 0.018, 0.2]} />
          <meshStandardMaterial color="#7a6952" roughness={0.86} metalness={0.01} />
        </mesh>
        {/* Secondaries */}
        <mesh position={[-0.03, 0.005, 0.38]} rotation={[0, 0, -0.02]} castShadow>
          <boxGeometry args={[0.56, 0.014, 0.16]} />
          <meshStandardMaterial color="#5a4a3a" roughness={0.88} metalness={0} />
        </mesh>
        {/* Primaries / wingtips - dark */}
        <mesh position={[-0.06, 0.006, 0.52]} rotation={[0, 0, -0.08]} castShadow>
          <boxGeometry args={[0.44, 0.01, 0.14]} />
          <meshStandardMaterial color="#2a2420" roughness={0.92} metalness={0} />
        </mesh>
      </group>

      {/* Right Wing - wide overlapping panels */}
      <group ref={rightWingRef} position={[-0.02, 0.03, -0.17]} rotation={[-0.04, -0.03, -0.06]}>
        {/* Wing root/shoulder */}
        <mesh position={[0.02, 0, -0.06]} castShadow>
          <boxGeometry args={[0.4, 0.022, 0.2]} />
          <meshStandardMaterial color="#8a7560" roughness={0.84} metalness={0.01} />
        </mesh>
        {/* Mid coverts */}
        <mesh position={[0, 0.003, -0.22]} rotation={[0, 0, -0.05]} castShadow>
          <boxGeometry args={[0.5, 0.018, 0.2]} />
          <meshStandardMaterial color="#7a6952" roughness={0.86} metalness={0.01} />
        </mesh>
        {/* Secondaries */}
        <mesh position={[-0.03, 0.005, -0.38]} rotation={[0, 0, 0.02]} castShadow>
          <boxGeometry args={[0.56, 0.014, 0.16]} />
          <meshStandardMaterial color="#5a4a3a" roughness={0.88} metalness={0} />
        </mesh>
        {/* Primaries / wingtips - dark */}
        <mesh position={[-0.06, 0.006, -0.52]} rotation={[0, 0, 0.08]} castShadow>
          <boxGeometry args={[0.44, 0.01, 0.14]} />
          <meshStandardMaterial color="#2a2420" roughness={0.92} metalness={0} />
        </mesh>
      </group>

      {/* Tail feathers - black, pointing backward */}
      <mesh position={[-0.35, 0.01, 0.05]} rotation={[0.12, 0, Math.PI / 2]} castShadow>
        <coneGeometry args={[0.022, 0.18, 7]} />
        <meshStandardMaterial color="#1e1e22" roughness={0.88} metalness={0.02} />
      </mesh>
      <mesh position={[-0.36, 0.01, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <coneGeometry args={[0.024, 0.2, 7]} />
        <meshStandardMaterial color="#1a1c20" roughness={0.88} metalness={0.02} />
      </mesh>
      <mesh position={[-0.35, 0.01, -0.05]} rotation={[-0.12, 0, Math.PI / 2]} castShadow>
        <coneGeometry args={[0.022, 0.18, 7]} />
        <meshStandardMaterial color="#1e1e22" roughness={0.88} metalness={0.02} />
      </mesh>
    </group>
  );
}
