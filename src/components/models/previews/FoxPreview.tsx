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
      {/* === BODY (sleek, elongated) === */}
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.11, 0.48, 5, 8]} />
        <meshStandardMaterial color="#c8651e" roughness={0.8} />
      </mesh>
      {/* Back/spine - darker */}
      <mesh position={[0, 0.08, -0.04]} rotation={[Math.PI / 2, 0, 0]} scale={[0.6, 0.82, 0.4]}>
        <capsuleGeometry args={[0.09, 0.38, 4, 6]} />
        <meshStandardMaterial color="#a04818" roughness={0.85} />
      </mesh>
      {/* Chest bib - prominent white */}
      <mesh position={[0, -0.03, 0.16]} scale={[0.7, 0.7, 1.1]}>
        <sphereGeometry args={[0.12, 7, 7]} />
        <meshStandardMaterial color="#f5ede0" roughness={0.8} />
      </mesh>
      {/* Upper chest white */}
      <mesh position={[0, 0.02, 0.22]} scale={[0.55, 0.55, 0.7]}>
        <sphereGeometry args={[0.1, 6, 6]} />
        <meshStandardMaterial color="#f5ede0" roughness={0.8} />
      </mesh>
      {/* Underbelly */}
      <mesh position={[0, -0.1, -0.02]} rotation={[Math.PI / 2, 0, 0]} scale={[0.5, 0.65, 0.3]}>
        <capsuleGeometry args={[0.09, 0.3, 4, 6]} />
        <meshStandardMaterial color="#ecd8c0" roughness={0.8} />
      </mesh>
      {/* Left shoulder */}
      <mesh position={[-0.06, -0.01, 0.14]} scale={[0.6, 0.55, 0.75]}>
        <sphereGeometry args={[0.09, 6, 6]} />
        <meshStandardMaterial color="#be5a1a" roughness={0.8} />
      </mesh>
      {/* Right shoulder */}
      <mesh position={[0.06, -0.01, 0.14]} scale={[0.6, 0.55, 0.75]}>
        <sphereGeometry args={[0.09, 6, 6]} />
        <meshStandardMaterial color="#be5a1a" roughness={0.8} />
      </mesh>
      {/* Left hip */}
      <mesh position={[-0.05, -0.02, -0.18]} scale={[0.55, 0.5, 0.65]}>
        <sphereGeometry args={[0.09, 6, 6]} />
        <meshStandardMaterial color="#b45418" roughness={0.8} />
      </mesh>
      {/* Right hip */}
      <mesh position={[0.05, -0.02, -0.18]} scale={[0.55, 0.5, 0.65]}>
        <sphereGeometry args={[0.09, 6, 6]} />
        <meshStandardMaterial color="#b45418" roughness={0.8} />
      </mesh>

      {/* === NECK === */}
      <mesh position={[0, 0.06, 0.28]} rotation={[0.35, 0, 0]} scale={[0.7, 0.7, 1]}>
        <capsuleGeometry args={[0.08, 0.08, 4, 6]} />
        <meshStandardMaterial color="#c8651e" roughness={0.8} />
      </mesh>
      {/* Throat white */}
      <mesh position={[0, -0.01, 0.28]} rotation={[0.3, 0, 0]} scale={[0.45, 0.4, 0.65]}>
        <capsuleGeometry args={[0.06, 0.06, 4, 6]} />
        <meshStandardMaterial color="#f5ede0" roughness={0.8} />
      </mesh>

      {/* === HEAD (smaller, wedge-shaped) === */}
      <mesh castShadow position={[0, 0.13, 0.42]}>
        <sphereGeometry args={[0.11, 7, 7]} />
        <meshStandardMaterial color="#cc6420" roughness={0.75} />
      </mesh>
      {/* Forehead */}
      <mesh position={[0, 0.18, 0.39]} scale={[0.75, 0.4, 0.6]}>
        <sphereGeometry args={[0.09, 6, 6]} />
        <meshStandardMaterial color="#b85a1c" roughness={0.8} />
      </mesh>
      {/* Left cheek - white */}
      <mesh position={[-0.06, 0.09, 0.46]} scale={[0.45, 0.4, 0.5]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#f5ede0" roughness={0.8} />
      </mesh>
      {/* Right cheek - white */}
      <mesh position={[0.06, 0.09, 0.46]} scale={[0.45, 0.4, 0.5]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#f5ede0" roughness={0.8} />
      </mesh>
      {/* Chin */}
      <mesh position={[0, 0.05, 0.48]} scale={[0.32, 0.22, 0.35]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#f5ede0" roughness={0.8} />
      </mesh>

      {/* === SNOUT (wedge taper, overlapping spheres) === */}
      {/* Snout base - wide, overlaps head */}
      <mesh position={[0, 0.08, 0.51]} scale={[0.65, 0.5, 0.65]}>
        <sphereGeometry args={[0.075, 7, 7]} />
        <meshStandardMaterial color="#cc6e2e" roughness={0.75} />
      </mesh>
      {/* Snout mid */}
      <mesh position={[0, 0.07, 0.56]} scale={[0.5, 0.42, 0.55]}>
        <sphereGeometry args={[0.06, 7, 7]} />
        <meshStandardMaterial color="#d07838" roughness={0.75} />
      </mesh>
      {/* Snout front */}
      <mesh position={[0, 0.06, 0.60]} scale={[0.4, 0.35, 0.45]}>
        <sphereGeometry args={[0.045, 6, 6]} />
        <meshStandardMaterial color="#d8884a" roughness={0.75} />
      </mesh>

      {/* Nose */}
      <mesh position={[0, 0.06, 0.625]}>
        <sphereGeometry args={[0.015, 6, 6]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.3} />
      </mesh>

      {/* === EYES === */}
      <mesh position={[-0.065, 0.16, 0.50]}>
        <sphereGeometry args={[0.018, 6, 6]} />
        <meshStandardMaterial color="#3a2818" roughness={0.4} />
      </mesh>
      <mesh position={[-0.069, 0.164, 0.516]}>
        <sphereGeometry args={[0.005, 4, 4]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0.065, 0.16, 0.50]}>
        <sphereGeometry args={[0.018, 6, 6]} />
        <meshStandardMaterial color="#3a2818" roughness={0.4} />
      </mesh>
      <mesh position={[0.069, 0.164, 0.516]}>
        <sphereGeometry args={[0.005, 4, 4]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
      </mesh>

      {/* === EARS (tall, triangular, prominent) === */}
      <mesh position={[-0.055, 0.26, 0.38]} rotation={[0.15, 0, -0.1]}>
        <capsuleGeometry args={[0.03, 0.1, 4, 5]} />
        <meshStandardMaterial color="#2a1e12" roughness={0.85} />
      </mesh>
      <mesh position={[-0.05, 0.265, 0.385]} rotation={[0.15, 0, -0.1]}>
        <capsuleGeometry args={[0.018, 0.065, 3, 4]} />
        <meshStandardMaterial color="#d8a878" roughness={0.7} />
      </mesh>
      <mesh position={[0.055, 0.26, 0.38]} rotation={[0.15, 0, 0.1]}>
        <capsuleGeometry args={[0.03, 0.1, 4, 5]} />
        <meshStandardMaterial color="#2a1e12" roughness={0.85} />
      </mesh>
      <mesh position={[0.05, 0.265, 0.385]} rotation={[0.15, 0, 0.1]}>
        <capsuleGeometry args={[0.018, 0.065, 3, 4]} />
        <meshStandardMaterial color="#d8a878" roughness={0.7} />
      </mesh>

      {/* === LEGS (slender, longer, dark stockings) === */}
      <group ref={flLegRef} position={[-0.07, -0.08, 0.16]}>
        <mesh position={[0, -0.05, 0]} castShadow>
          <capsuleGeometry args={[0.03, 0.1, 3, 5]} />
          <meshStandardMaterial color="#c8651e" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.16, 0]} castShadow>
          <capsuleGeometry args={[0.022, 0.1, 3, 5]} />
          <meshStandardMaterial color="#2a1e12" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.24, 0.01]}>
          <boxGeometry args={[0.045, 0.025, 0.055]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
        </mesh>
      </group>
      <group ref={frLegRef} position={[0.07, -0.08, 0.16]}>
        <mesh position={[0, -0.05, 0]} castShadow>
          <capsuleGeometry args={[0.03, 0.1, 3, 5]} />
          <meshStandardMaterial color="#c8651e" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.16, 0]} castShadow>
          <capsuleGeometry args={[0.022, 0.1, 3, 5]} />
          <meshStandardMaterial color="#2a1e12" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.24, 0.01]}>
          <boxGeometry args={[0.045, 0.025, 0.055]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
        </mesh>
      </group>
      <group ref={blLegRef} position={[-0.06, -0.08, -0.2]}>
        <mesh position={[0, -0.05, 0]} castShadow>
          <capsuleGeometry args={[0.03, 0.1, 3, 5]} />
          <meshStandardMaterial color="#b45418" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.16, 0]} castShadow>
          <capsuleGeometry args={[0.022, 0.1, 3, 5]} />
          <meshStandardMaterial color="#2a1e12" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.24, 0.01]}>
          <boxGeometry args={[0.045, 0.025, 0.055]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
        </mesh>
      </group>
      <group ref={brLegRef} position={[0.06, -0.08, -0.2]}>
        <mesh position={[0, -0.05, 0]} castShadow>
          <capsuleGeometry args={[0.03, 0.1, 3, 5]} />
          <meshStandardMaterial color="#b45418" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.16, 0]} castShadow>
          <capsuleGeometry args={[0.022, 0.1, 3, 5]} />
          <meshStandardMaterial color="#2a1e12" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.24, 0.01]}>
          <boxGeometry args={[0.045, 0.025, 0.055]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
        </mesh>
      </group>

      {/* === TAIL (very bushy, long, white-tipped) === */}
      <group ref={tailRef} position={[0, 0.02, -0.28]}>
        <mesh position={[0, 0.01, 0]} castShadow>
          <sphereGeometry args={[0.065, 6, 6]} />
          <meshStandardMaterial color="#a04818" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.01, -0.1]} castShadow scale={[1.15, 0.9, 1.1]}>
          <sphereGeometry args={[0.085, 6, 6]} />
          <meshStandardMaterial color="#c8651e" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.03, -0.2]} castShadow scale={[1.2, 0.95, 1.15]}>
          <sphereGeometry args={[0.09, 6, 6]} />
          <meshStandardMaterial color="#c8651e" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.05, -0.3]} scale={[1.1, 0.85, 1.05]}>
          <sphereGeometry args={[0.08, 6, 6]} />
          <meshStandardMaterial color="#d88030" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.07, -0.38]}>
          <sphereGeometry args={[0.065, 6, 6]} />
          <meshStandardMaterial color="#f5f0e8" roughness={0.75} />
        </mesh>
      </group>
    </group>
  );
}
