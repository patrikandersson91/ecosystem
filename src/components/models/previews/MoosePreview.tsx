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
      {/* Main torso */}
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.22, 0.28, 5, 8]} />
        <meshStandardMaterial color="#5f4026" />
      </mesh>
      {/* Shoulder hump */}
      <mesh position={[0, 0.1, 0.08]} castShadow scale={[0.85, 0.8, 0.8]}>
        <sphereGeometry args={[0.18, 6, 6]} />
        <meshStandardMaterial color="#543822" />
      </mesh>
      {/* Hip / rump */}
      <mesh position={[0, 0.02, -0.2]} castShadow>
        <sphereGeometry args={[0.17, 6, 6]} />
        <meshStandardMaterial color="#5a3d25" />
      </mesh>
      {/* Lighter belly underside */}
      <mesh position={[0, -0.12, -0.02]}>
        <boxGeometry args={[0.26, 0.07, 0.4]} />
        <meshStandardMaterial color="#6b4e34" />
      </mesh>

      {/* Neck */}
      <mesh position={[0, 0.12, 0.3]} rotation={[0.7, 0, 0]} castShadow>
        <capsuleGeometry args={[0.1, 0.2, 4, 6]} />
        <meshStandardMaterial color="#5a3d25" />
      </mesh>

      {/* Head group (animated) */}
      <group ref={headRef} position={[0, 0.1, 0.52]}>
        {/* Skull */}
        <mesh castShadow>
          <sphereGeometry args={[0.12, 6, 6]} />
          <meshStandardMaterial color="#6f4a2d" />
        </mesh>
        {/* Muzzle */}
        <mesh position={[0, -0.05, 0.12]} scale={[0.9, 0.8, 1.15]} castShadow>
          <sphereGeometry args={[0.08, 6, 6]} />
          <meshStandardMaterial color="#7a5638" />
        </mesh>
        {/* Upper lip / nose pad */}
        <mesh position={[0, -0.09, 0.18]} scale={[1.05, 0.65, 0.8]}>
          <sphereGeometry args={[0.048, 6, 6]} />
          <meshStandardMaterial color="#8a6448" />
        </mesh>
        {/* Left nostril */}
        <mesh position={[-0.022, -0.1, 0.21]}>
          <sphereGeometry args={[0.012, 6, 6]} />
          <meshStandardMaterial color="#2a1a10" />
        </mesh>
        {/* Right nostril */}
        <mesh position={[0.022, -0.1, 0.21]}>
          <sphereGeometry args={[0.012, 6, 6]} />
          <meshStandardMaterial color="#2a1a10" />
        </mesh>
        {/* Left eye */}
        <mesh position={[-0.08, 0.04, 0.06]}>
          <sphereGeometry args={[0.02, 6, 6]} />
          <meshStandardMaterial color="#1a1000" />
        </mesh>
        {/* Right eye */}
        <mesh position={[0.08, 0.04, 0.06]}>
          <sphereGeometry args={[0.02, 6, 6]} />
          <meshStandardMaterial color="#1a1000" />
        </mesh>
        {/* Left ear */}
        <mesh position={[-0.09, 0.1, -0.03]} rotation={[0.25, 0, -0.35]}>
          <capsuleGeometry args={[0.025, 0.06, 3, 4]} />
          <meshStandardMaterial color="#5a3d25" />
        </mesh>
        {/* Left ear inner */}
        <mesh position={[-0.088, 0.1, -0.025]} rotation={[0.25, 0, -0.35]}>
          <capsuleGeometry args={[0.016, 0.04, 3, 4]} />
          <meshStandardMaterial color="#7a6048" />
        </mesh>
        {/* Right ear */}
        <mesh position={[0.09, 0.1, -0.03]} rotation={[0.25, 0, 0.35]}>
          <capsuleGeometry args={[0.025, 0.06, 3, 4]} />
          <meshStandardMaterial color="#5a3d25" />
        </mesh>
        {/* Right ear inner */}
        <mesh position={[0.088, 0.1, -0.025]} rotation={[0.25, 0, 0.35]}>
          <capsuleGeometry args={[0.016, 0.04, 3, 4]} />
          <meshStandardMaterial color="#7a6048" />
        </mesh>
        {/* Dewlap (bell) */}
        <mesh position={[0, -0.15, 0.03]} rotation={[0.3, 0, 0]}>
          <capsuleGeometry args={[0.03, 0.08, 3, 4]} />
          <meshStandardMaterial color="#6f4a2d" />
        </mesh>

        {/* Left antler beam */}
        <mesh position={[-0.07, 0.16, -0.02]} rotation={[0.1, 0, -0.45]}>
          <capsuleGeometry args={[0.016, 0.14, 3, 4]} />
          <meshStandardMaterial color="#d6c4a2" />
        </mesh>
        {/* Left palm */}
        <mesh position={[-0.19, 0.3, -0.02]} rotation={[0, 0, -0.25]} scale={[1.4, 0.25, 1]}>
          <sphereGeometry args={[0.08, 6, 6]} />
          <meshStandardMaterial color="#d6c4a2" />
        </mesh>
        {/* Left tine 1 */}
        <mesh position={[-0.14, 0.39, -0.02]} rotation={[0, 0, -0.15]}>
          <capsuleGeometry args={[0.009, 0.08, 3, 4]} />
          <meshStandardMaterial color="#c8b690" />
        </mesh>
        {/* Left tine 2 */}
        <mesh position={[-0.23, 0.37, 0]} rotation={[0, 0, -0.55]}>
          <capsuleGeometry args={[0.009, 0.06, 3, 4]} />
          <meshStandardMaterial color="#c8b690" />
        </mesh>
        {/* Left tine 3 */}
        <mesh position={[-0.28, 0.31, 0.02]} rotation={[0, 0, -0.75]}>
          <capsuleGeometry args={[0.009, 0.05, 3, 4]} />
          <meshStandardMaterial color="#c8b690" />
        </mesh>
        {/* Left brow tine */}
        <mesh position={[-0.1, 0.19, 0.05]} rotation={[0.3, 0, -0.7]}>
          <capsuleGeometry args={[0.009, 0.05, 3, 4]} />
          <meshStandardMaterial color="#c8b690" />
        </mesh>
        {/* Right antler beam */}
        <mesh position={[0.07, 0.16, -0.02]} rotation={[0.1, 0, 0.45]}>
          <capsuleGeometry args={[0.016, 0.14, 3, 4]} />
          <meshStandardMaterial color="#d6c4a2" />
        </mesh>
        {/* Right palm */}
        <mesh position={[0.19, 0.3, -0.02]} rotation={[0, 0, 0.25]} scale={[1.4, 0.25, 1]}>
          <sphereGeometry args={[0.08, 6, 6]} />
          <meshStandardMaterial color="#d6c4a2" />
        </mesh>
        {/* Right tine 1 */}
        <mesh position={[0.14, 0.39, -0.02]} rotation={[0, 0, 0.15]}>
          <capsuleGeometry args={[0.009, 0.08, 3, 4]} />
          <meshStandardMaterial color="#c8b690" />
        </mesh>
        {/* Right tine 2 */}
        <mesh position={[0.23, 0.37, 0]} rotation={[0, 0, 0.55]}>
          <capsuleGeometry args={[0.009, 0.06, 3, 4]} />
          <meshStandardMaterial color="#c8b690" />
        </mesh>
        {/* Right tine 3 */}
        <mesh position={[0.28, 0.31, 0.02]} rotation={[0, 0, 0.75]}>
          <capsuleGeometry args={[0.009, 0.05, 3, 4]} />
          <meshStandardMaterial color="#c8b690" />
        </mesh>
        {/* Right brow tine */}
        <mesh position={[0.1, 0.19, 0.05]} rotation={[0.3, 0, 0.7]}>
          <capsuleGeometry args={[0.009, 0.05, 3, 4]} />
          <meshStandardMaterial color="#c8b690" />
        </mesh>
      </group>

      {/* Front Left Leg */}
      <group ref={flLegRef} position={[-0.14, -0.14, 0.14]}>
        <mesh position={[0, -0.1, 0]} castShadow>
          <boxGeometry args={[0.09, 0.2, 0.1]} />
          <meshStandardMaterial color="#4b311f" />
        </mesh>
        <mesh position={[0, -0.25, 0]} castShadow>
          <boxGeometry args={[0.065, 0.14, 0.07]} />
          <meshStandardMaterial color="#8a7660" />
        </mesh>
        <mesh position={[0, -0.34, 0]}>
          <boxGeometry args={[0.075, 0.04, 0.085]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>
      {/* Front Right Leg */}
      <group ref={frLegRef} position={[0.14, -0.14, 0.14]}>
        <mesh position={[0, -0.1, 0]} castShadow>
          <boxGeometry args={[0.09, 0.2, 0.1]} />
          <meshStandardMaterial color="#4b311f" />
        </mesh>
        <mesh position={[0, -0.25, 0]} castShadow>
          <boxGeometry args={[0.065, 0.14, 0.07]} />
          <meshStandardMaterial color="#8a7660" />
        </mesh>
        <mesh position={[0, -0.34, 0]}>
          <boxGeometry args={[0.075, 0.04, 0.085]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>
      {/* Back Left Leg */}
      <group ref={blLegRef} position={[-0.14, -0.14, -0.2]}>
        <mesh position={[0, -0.1, 0]} castShadow>
          <boxGeometry args={[0.09, 0.2, 0.1]} />
          <meshStandardMaterial color="#4b311f" />
        </mesh>
        <mesh position={[0, -0.25, 0]} castShadow>
          <boxGeometry args={[0.065, 0.14, 0.07]} />
          <meshStandardMaterial color="#8a7660" />
        </mesh>
        <mesh position={[0, -0.34, 0]}>
          <boxGeometry args={[0.075, 0.04, 0.085]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>
      {/* Back Right Leg */}
      <group ref={brLegRef} position={[0.14, -0.14, -0.2]}>
        <mesh position={[0, -0.1, 0]} castShadow>
          <boxGeometry args={[0.09, 0.2, 0.1]} />
          <meshStandardMaterial color="#4b311f" />
        </mesh>
        <mesh position={[0, -0.25, 0]} castShadow>
          <boxGeometry args={[0.065, 0.14, 0.07]} />
          <meshStandardMaterial color="#8a7660" />
        </mesh>
        <mesh position={[0, -0.34, 0]}>
          <boxGeometry args={[0.075, 0.04, 0.085]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>

      {/* Short tail */}
      <mesh position={[0, 0.08, -0.35]} rotation={[0.6, 0, 0]}>
        <capsuleGeometry args={[0.035, 0.06, 3, 4]} />
        <meshStandardMaterial color="#5a3d25" />
      </mesh>
    </group>
  );
}
