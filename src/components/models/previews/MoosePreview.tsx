import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

export default function MoosePreview() {
  const groupRef = useRef<Group>(null!);
  const headRef = useRef<Group>(null!);
  const flLegRef = useRef<Group>(null!);
  const frLegRef = useRef<Group>(null!);
  const blLegRef = useRef<Group>(null!);
  const brLegRef = useRef<Group>(null!);
  const phase = useRef(0);

  useFrame((_, delta) => {
    phase.current += delta * 1.8;
    const walk = Math.sin(phase.current);

    flLegRef.current.rotation.x = walk * 0.2;
    brLegRef.current.rotation.x = walk * 0.2;
    frLegRef.current.rotation.x = -walk * 0.2;
    blLegRef.current.rotation.x = -walk * 0.2;

    headRef.current.rotation.x = Math.sin(phase.current * 0.5) * 0.1;

    groupRef.current.rotation.y += delta * 0.25;
  });

  return (
    <group ref={groupRef} position={[0, 1.1, 0]} scale={[2.2, 2.2, 2.2]}>
      {/* === BODY === */}
      {/* Main torso - massive barrel chest */}
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.26, 0.38, 6, 10]} />
        <meshStandardMaterial color="#4a3120" roughness={0.9} />
      </mesh>
      {/* Upper back ridge */}
      <mesh position={[0, 0.14, -0.02]} castShadow rotation={[Math.PI / 2, 0, 0]} scale={[0.9, 0.7, 0.7]}>
        <capsuleGeometry args={[0.18, 0.28, 5, 8]} />
        <meshStandardMaterial color="#3e2918" roughness={0.95} />
      </mesh>
      {/* Shoulder hump - very prominent */}
      <mesh position={[0, 0.22, 0.1]} castShadow scale={[0.9, 1, 0.85]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color="#3a2415" roughness={0.95} />
      </mesh>
      {/* Shoulder hump peak */}
      <mesh position={[0, 0.28, 0.06]} castShadow scale={[0.7, 0.6, 0.65]}>
        <sphereGeometry args={[0.14, 6, 6]} />
        <meshStandardMaterial color="#352010" roughness={0.95} />
      </mesh>
      {/* Ribcage sides - left */}
      <mesh position={[-0.15, -0.02, -0.02]} castShadow rotation={[Math.PI / 2, 0, 0]} scale={[0.6, 0.8, 0.9]}>
        <capsuleGeometry args={[0.16, 0.22, 4, 6]} />
        <meshStandardMaterial color="#4e3422" roughness={0.9} />
      </mesh>
      {/* Ribcage sides - right */}
      <mesh position={[0.15, -0.02, -0.02]} castShadow rotation={[Math.PI / 2, 0, 0]} scale={[0.6, 0.8, 0.9]}>
        <capsuleGeometry args={[0.16, 0.22, 4, 6]} />
        <meshStandardMaterial color="#4e3422" roughness={0.9} />
      </mesh>
      {/* Hip / rump */}
      <mesh position={[0, 0.06, -0.24]} castShadow scale={[0.95, 0.9, 0.9]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial color="#4a3120" roughness={0.9} />
      </mesh>
      {/* Belly underside - deep chest */}
      <mesh position={[0, -0.16, 0.0]} scale={[0.9, 1, 1]}>
        <boxGeometry args={[0.3, 0.08, 0.5]} />
        <meshStandardMaterial color="#55381f" roughness={0.9} />
      </mesh>
      {/* Chest brisket */}
      <mesh position={[0, -0.08, 0.2]} castShadow scale={[0.8, 0.7, 0.6]}>
        <sphereGeometry args={[0.16, 6, 6]} />
        <meshStandardMaterial color="#4a3120" roughness={0.9} />
      </mesh>

      {/* === NECK === */}
      <mesh position={[0, 0.14, 0.32]} rotation={[0.55, 0, 0]} castShadow>
        <capsuleGeometry args={[0.14, 0.22, 5, 8]} />
        <meshStandardMaterial color="#4a3120" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.2, 0.4]} rotation={[0.4, 0, 0]} castShadow>
        <capsuleGeometry args={[0.11, 0.14, 4, 6]} />
        <meshStandardMaterial color="#4e3422" roughness={0.9} />
      </mesh>
      {/* Neck mane */}
      <mesh position={[0, 0.04, 0.32]} rotation={[0.6, 0, 0]} scale={[0.5, 0.4, 0.8]}>
        <capsuleGeometry args={[0.1, 0.18, 3, 4]} />
        <meshStandardMaterial color="#3a2415" roughness={1} />
      </mesh>

      {/* === HEAD GROUP (animated) === */}
      <group ref={headRef} position={[0, 0.18, 0.54]}>
        {/* Skull */}
        <mesh castShadow scale={[1, 0.9, 1.15]}>
          <sphereGeometry args={[0.13, 8, 8]} />
          <meshStandardMaterial color="#5a3d25" roughness={0.9} />
        </mesh>
        {/* Forehead bridge */}
        <mesh position={[0, 0.04, 0.08]} castShadow scale={[0.85, 0.7, 1]}>
          <sphereGeometry args={[0.09, 6, 6]} />
          <meshStandardMaterial color="#55381f" roughness={0.9} />
        </mesh>
        {/* Muzzle */}
        <mesh position={[0, -0.07, 0.14]} scale={[1, 0.85, 1.3]} castShadow>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshStandardMaterial color="#6b4a30" roughness={0.85} />
        </mesh>
        {/* Overhanging upper lip */}
        <mesh position={[0, -0.12, 0.2]} scale={[1.15, 0.7, 0.9]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#7a5838" roughness={0.8} />
        </mesh>
        {/* Nose pad */}
        <mesh position={[0, -0.1, 0.23]} scale={[1.1, 0.6, 0.7]}>
          <sphereGeometry args={[0.04, 6, 6]} />
          <meshStandardMaterial color="#8a6448" roughness={0.7} />
        </mesh>
        {/* Lower jaw */}
        <mesh position={[0, -0.14, 0.12]} scale={[0.75, 0.45, 1.1]}>
          <sphereGeometry args={[0.07, 6, 6]} />
          <meshStandardMaterial color="#5a3d25" roughness={0.9} />
        </mesh>
        {/* Chin tuft */}
        <mesh position={[0, -0.16, 0.1]} scale={[0.5, 0.4, 0.6]}>
          <sphereGeometry args={[0.04, 4, 4]} />
          <meshStandardMaterial color="#3a2415" roughness={1} />
        </mesh>
        {/* Left nostril */}
        <mesh position={[-0.025, -0.11, 0.26]}>
          <sphereGeometry args={[0.015, 6, 6]} />
          <meshStandardMaterial color="#1a0e08" />
        </mesh>
        {/* Right nostril */}
        <mesh position={[0.025, -0.11, 0.26]}>
          <sphereGeometry args={[0.015, 6, 6]} />
          <meshStandardMaterial color="#1a0e08" />
        </mesh>
        {/* Left eye */}
        <mesh position={[-0.09, 0.03, 0.06]}>
          <sphereGeometry args={[0.022, 6, 6]} />
          <meshStandardMaterial color="#1a1000" />
        </mesh>
        {/* Left brow ridge */}
        <mesh position={[-0.085, 0.06, 0.06]} scale={[1.2, 0.5, 0.8]}>
          <sphereGeometry args={[0.025, 4, 4]} />
          <meshStandardMaterial color="#4a3120" roughness={0.95} />
        </mesh>
        {/* Right eye */}
        <mesh position={[0.09, 0.03, 0.06]}>
          <sphereGeometry args={[0.022, 6, 6]} />
          <meshStandardMaterial color="#1a1000" />
        </mesh>
        {/* Right brow ridge */}
        <mesh position={[0.085, 0.06, 0.06]} scale={[1.2, 0.5, 0.8]}>
          <sphereGeometry args={[0.025, 4, 4]} />
          <meshStandardMaterial color="#4a3120" roughness={0.95} />
        </mesh>
        {/* Left ear */}
        <mesh position={[-0.1, 0.1, -0.04]} rotation={[0.25, 0, -0.4]} scale={[1, 1, 0.6]}>
          <capsuleGeometry args={[0.028, 0.07, 3, 5]} />
          <meshStandardMaterial color="#4e3422" roughness={0.9} />
        </mesh>
        {/* Left ear inner */}
        <mesh position={[-0.098, 0.1, -0.035]} rotation={[0.25, 0, -0.4]} scale={[1, 1, 0.5]}>
          <capsuleGeometry args={[0.018, 0.045, 3, 4]} />
          <meshStandardMaterial color="#6b5540" />
        </mesh>
        {/* Right ear */}
        <mesh position={[0.1, 0.1, -0.04]} rotation={[0.25, 0, 0.4]} scale={[1, 1, 0.6]}>
          <capsuleGeometry args={[0.028, 0.07, 3, 5]} />
          <meshStandardMaterial color="#4e3422" roughness={0.9} />
        </mesh>
        {/* Right ear inner */}
        <mesh position={[0.098, 0.1, -0.035]} rotation={[0.25, 0, 0.4]} scale={[1, 1, 0.5]}>
          <capsuleGeometry args={[0.018, 0.045, 3, 4]} />
          <meshStandardMaterial color="#6b5540" />
        </mesh>
        {/* Dewlap (bell) */}
        <mesh position={[0, -0.18, 0.06]} rotation={[0.2, 0, 0]}>
          <capsuleGeometry args={[0.035, 0.1, 4, 5]} />
          <meshStandardMaterial color="#5a3d25" roughness={0.9} />
        </mesh>
        {/* Dewlap tip */}
        <mesh position={[0, -0.26, 0.04]} scale={[0.8, 0.6, 0.7]}>
          <sphereGeometry args={[0.03, 4, 4]} />
          <meshStandardMaterial color="#4a3120" roughness={0.9} />
        </mesh>

        {/* === LEFT ANTLER (palmate, connected) === */}
        {/* Left pedicle - base on skull */}
        <mesh position={[-0.03, 0.13, -0.01]} rotation={[0, 0, -0.15]}>
          <capsuleGeometry args={[0.024, 0.05, 3, 4]} />
          <meshStandardMaterial color="#c4b08a" roughness={0.7} />
        </mesh>
        {/* Left beam - long, connects pedicle to palm */}
        <mesh position={[-0.07, 0.24, -0.02]} rotation={[0.05, 0, -0.25]}>
          <capsuleGeometry args={[0.02, 0.28, 4, 5]} />
          <meshStandardMaterial color="#d6c4a2" roughness={0.65} />
        </mesh>
        {/* Left palm - flat paddle, overlaps beam top */}
        <mesh position={[-0.13, 0.34, -0.02]} rotation={[0.05, 0.1, -0.15]} scale={[1.6, 0.25, 1.1]}>
          <sphereGeometry args={[0.1, 8, 6]} />
          <meshStandardMaterial color="#d6c4a2" roughness={0.65} />
        </mesh>
        {/* Left palm outer extension */}
        <mesh position={[-0.2, 0.32, -0.02]} rotation={[0.05, 0.1, -0.35]} scale={[1.2, 0.22, 1]}>
          <sphereGeometry args={[0.07, 6, 5]} />
          <meshStandardMaterial color="#ccb896" roughness={0.65} />
        </mesh>
        {/* Left tine 1 */}
        <mesh position={[-0.07, 0.42, -0.01]} rotation={[0, 0, 0.05]}>
          <capsuleGeometry args={[0.012, 0.08, 3, 4]} />
          <meshStandardMaterial color="#c8b690" roughness={0.7} />
        </mesh>
        {/* Left tine 2 */}
        <mesh position={[-0.12, 0.43, -0.02]} rotation={[0, 0, -0.15]}>
          <capsuleGeometry args={[0.011, 0.08, 3, 4]} />
          <meshStandardMaterial color="#c8b690" roughness={0.7} />
        </mesh>
        {/* Left tine 3 */}
        <mesh position={[-0.17, 0.42, -0.02]} rotation={[0, 0, -0.3]}>
          <capsuleGeometry args={[0.011, 0.07, 3, 4]} />
          <meshStandardMaterial color="#c8b690" roughness={0.7} />
        </mesh>
        {/* Left tine 4 */}
        <mesh position={[-0.22, 0.39, -0.01]} rotation={[0, 0, -0.55]}>
          <capsuleGeometry args={[0.01, 0.06, 3, 4]} />
          <meshStandardMaterial color="#c8b690" roughness={0.7} />
        </mesh>
        {/* Left tine 5 */}
        <mesh position={[-0.25, 0.35, 0]} rotation={[0, 0, -0.75]}>
          <capsuleGeometry args={[0.009, 0.05, 3, 4]} />
          <meshStandardMaterial color="#c8b690" roughness={0.7} />
        </mesh>
        {/* Left brow tine */}
        <mesh position={[-0.06, 0.19, 0.04]} rotation={[0.4, 0, -0.4]}>
          <capsuleGeometry args={[0.013, 0.06, 3, 4]} />
          <meshStandardMaterial color="#c8b690" roughness={0.7} />
        </mesh>

        {/* === RIGHT ANTLER (palmate, connected) === */}
        {/* Right pedicle */}
        <mesh position={[0.03, 0.13, -0.01]} rotation={[0, 0, 0.15]}>
          <capsuleGeometry args={[0.024, 0.05, 3, 4]} />
          <meshStandardMaterial color="#c4b08a" roughness={0.7} />
        </mesh>
        {/* Right beam */}
        <mesh position={[0.07, 0.24, -0.02]} rotation={[0.05, 0, 0.25]}>
          <capsuleGeometry args={[0.02, 0.28, 4, 5]} />
          <meshStandardMaterial color="#d6c4a2" roughness={0.65} />
        </mesh>
        {/* Right palm */}
        <mesh position={[0.13, 0.34, -0.02]} rotation={[0.05, -0.1, 0.15]} scale={[1.6, 0.25, 1.1]}>
          <sphereGeometry args={[0.1, 8, 6]} />
          <meshStandardMaterial color="#d6c4a2" roughness={0.65} />
        </mesh>
        {/* Right palm outer extension */}
        <mesh position={[0.2, 0.32, -0.02]} rotation={[0.05, -0.1, 0.35]} scale={[1.2, 0.22, 1]}>
          <sphereGeometry args={[0.07, 6, 5]} />
          <meshStandardMaterial color="#ccb896" roughness={0.65} />
        </mesh>
        {/* Right tine 1 */}
        <mesh position={[0.07, 0.42, -0.01]} rotation={[0, 0, -0.05]}>
          <capsuleGeometry args={[0.012, 0.08, 3, 4]} />
          <meshStandardMaterial color="#c8b690" roughness={0.7} />
        </mesh>
        {/* Right tine 2 */}
        <mesh position={[0.12, 0.43, -0.02]} rotation={[0, 0, 0.15]}>
          <capsuleGeometry args={[0.011, 0.08, 3, 4]} />
          <meshStandardMaterial color="#c8b690" roughness={0.7} />
        </mesh>
        {/* Right tine 3 */}
        <mesh position={[0.17, 0.42, -0.02]} rotation={[0, 0, 0.3]}>
          <capsuleGeometry args={[0.011, 0.07, 3, 4]} />
          <meshStandardMaterial color="#c8b690" roughness={0.7} />
        </mesh>
        {/* Right tine 4 */}
        <mesh position={[0.22, 0.39, -0.01]} rotation={[0, 0, 0.55]}>
          <capsuleGeometry args={[0.01, 0.06, 3, 4]} />
          <meshStandardMaterial color="#c8b690" roughness={0.7} />
        </mesh>
        {/* Right tine 5 */}
        <mesh position={[0.25, 0.35, 0]} rotation={[0, 0, 0.75]}>
          <capsuleGeometry args={[0.009, 0.05, 3, 4]} />
          <meshStandardMaterial color="#c8b690" roughness={0.7} />
        </mesh>
        {/* Right brow tine */}
        <mesh position={[0.06, 0.19, 0.04]} rotation={[0.4, 0, 0.4]}>
          <capsuleGeometry args={[0.013, 0.06, 3, 4]} />
          <meshStandardMaterial color="#c8b690" roughness={0.7} />
        </mesh>
      </group>

      {/* === LEGS === */}
      {/* Front Left Leg */}
      <group ref={flLegRef} position={[-0.14, -0.18, 0.16]}>
        <mesh position={[0, -0.07, 0]} castShadow>
          <boxGeometry args={[0.1, 0.18, 0.12]} />
          <meshStandardMaterial color="#4b311f" roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.17, 0]} castShadow>
          <sphereGeometry args={[0.04, 5, 5]} />
          <meshStandardMaterial color="#5a4030" roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.28, 0]} castShadow>
          <boxGeometry args={[0.065, 0.18, 0.07]} />
          <meshStandardMaterial color="#8a7660" roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.39, 0]}>
          <boxGeometry args={[0.075, 0.04, 0.09]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
        </mesh>
      </group>
      {/* Front Right Leg */}
      <group ref={frLegRef} position={[0.14, -0.18, 0.16]}>
        <mesh position={[0, -0.07, 0]} castShadow>
          <boxGeometry args={[0.1, 0.18, 0.12]} />
          <meshStandardMaterial color="#4b311f" roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.17, 0]} castShadow>
          <sphereGeometry args={[0.04, 5, 5]} />
          <meshStandardMaterial color="#5a4030" roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.28, 0]} castShadow>
          <boxGeometry args={[0.065, 0.18, 0.07]} />
          <meshStandardMaterial color="#8a7660" roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.39, 0]}>
          <boxGeometry args={[0.075, 0.04, 0.09]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
        </mesh>
      </group>
      {/* Back Left Leg */}
      <group ref={blLegRef} position={[-0.14, -0.18, -0.22]}>
        <mesh position={[0, -0.07, 0]} castShadow>
          <boxGeometry args={[0.1, 0.18, 0.12]} />
          <meshStandardMaterial color="#4b311f" roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.17, 0]} castShadow>
          <sphereGeometry args={[0.04, 5, 5]} />
          <meshStandardMaterial color="#5a4030" roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.28, 0]} castShadow>
          <boxGeometry args={[0.065, 0.18, 0.07]} />
          <meshStandardMaterial color="#8a7660" roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.39, 0]}>
          <boxGeometry args={[0.075, 0.04, 0.09]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
        </mesh>
      </group>
      {/* Back Right Leg */}
      <group ref={brLegRef} position={[0.14, -0.18, -0.22]}>
        <mesh position={[0, -0.07, 0]} castShadow>
          <boxGeometry args={[0.1, 0.18, 0.12]} />
          <meshStandardMaterial color="#4b311f" roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.17, 0]} castShadow>
          <sphereGeometry args={[0.04, 5, 5]} />
          <meshStandardMaterial color="#5a4030" roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.28, 0]} castShadow>
          <boxGeometry args={[0.065, 0.18, 0.07]} />
          <meshStandardMaterial color="#8a7660" roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.39, 0]}>
          <boxGeometry args={[0.075, 0.04, 0.09]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
        </mesh>
      </group>

      {/* Short tail */}
      <mesh position={[0, 0.1, -0.4]} rotation={[0.5, 0, 0]}>
        <capsuleGeometry args={[0.04, 0.06, 3, 4]} />
        <meshStandardMaterial color="#4a3120" roughness={0.9} />
      </mesh>
    </group>
  );
}
