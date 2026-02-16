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
    leftWingRef.current.rotation.x = -flap;
    rightWingRef.current.rotation.x = flap;

    groupRef.current.position.y = 0.8 + Math.sin(phase.current * 0.5) * 0.1;
    groupRef.current.rotation.y += delta * 0.3;
  });

  return (
    <group ref={groupRef} position={[0, 0.8, 0]}>
      {/* === BODY === */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.17, 0.48, 6, 10]} />
        <meshStandardMaterial color="#6b5a48" roughness={0.82} metalness={0.02} />
      </mesh>
      <mesh position={[0.04, -0.05, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.14, 0.34, 6, 8]} />
        <meshStandardMaterial color="#c4b49a" roughness={0.8} metalness={0.01} />
      </mesh>
      <mesh position={[-0.02, 0.07, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.13, 0.3, 6, 8]} />
        <meshStandardMaterial color="#5a4a3a" roughness={0.84} metalness={0.02} />
      </mesh>

      {/* === FLANK FEATHERS (8 rows) === */}
      <mesh position={[0.08, 0.005, 0.14]} rotation={[0.12, 0, 0]}>
        <boxGeometry args={[0.24, 0.008, 0.08]} />
        <meshStandardMaterial color="#8a7a66" roughness={0.86} metalness={0.01} />
      </mesh>
      <mesh position={[0, 0.01, 0.15]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.32, 0.008, 0.08]} />
        <meshStandardMaterial color="#7a6a56" roughness={0.86} metalness={0.01} />
      </mesh>
      <mesh position={[-0.06, -0.015, 0.14]} rotation={[0.32, 0, 0]}>
        <boxGeometry args={[0.28, 0.008, 0.07]} />
        <meshStandardMaterial color="#8a7a66" roughness={0.86} metalness={0.01} />
      </mesh>
      <mesh position={[-0.12, -0.04, 0.12]} rotation={[0.45, 0, 0]}>
        <boxGeometry args={[0.22, 0.008, 0.06]} />
        <meshStandardMaterial color="#7a6a56" roughness={0.86} metalness={0.01} />
      </mesh>
      <mesh position={[0.08, 0.005, -0.14]} rotation={[-0.12, 0, 0]}>
        <boxGeometry args={[0.24, 0.008, 0.08]} />
        <meshStandardMaterial color="#8a7a66" roughness={0.86} metalness={0.01} />
      </mesh>
      <mesh position={[0, 0.01, -0.15]} rotation={[-0.2, 0, 0]}>
        <boxGeometry args={[0.32, 0.008, 0.08]} />
        <meshStandardMaterial color="#7a6a56" roughness={0.86} metalness={0.01} />
      </mesh>
      <mesh position={[-0.06, -0.015, -0.14]} rotation={[-0.32, 0, 0]}>
        <boxGeometry args={[0.28, 0.008, 0.07]} />
        <meshStandardMaterial color="#8a7a66" roughness={0.86} metalness={0.01} />
      </mesh>
      <mesh position={[-0.12, -0.04, -0.12]} rotation={[-0.45, 0, 0]}>
        <boxGeometry args={[0.22, 0.008, 0.06]} />
        <meshStandardMaterial color="#7a6a56" roughness={0.86} metalness={0.01} />
      </mesh>

      {/* === NECK & HEAD === */}
      <mesh position={[0.46, 0.0, 0]} rotation={[0, 0, Math.PI / 2 + 0.1]} castShadow>
        <capsuleGeometry args={[0.042, 0.34, 6, 8]} />
        <meshStandardMaterial color="#1a1c20" roughness={0.78} metalness={0.03} />
      </mesh>
      <mesh position={[0.64, 0.03, 0]} castShadow>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color="#1a1c20" roughness={0.76} metalness={0.03} />
      </mesh>
      {/* White chinstrap patches */}
      <mesh position={[0.635, 0.025, 0.05]} scale={[0.75, 0.95, 0.35]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#f0ede8" roughness={0.78} metalness={0.01} />
      </mesh>
      <mesh position={[0.635, 0.025, -0.05]} scale={[0.75, 0.95, 0.35]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#f0ede8" roughness={0.78} metalness={0.01} />
      </mesh>
      {/* White chin underside */}
      <mesh position={[0.62, -0.015, 0]} scale={[0.8, 0.5, 0.7]}>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshStandardMaterial color="#f5f2ed" roughness={0.78} metalness={0.01} />
      </mesh>
      {/* Beak */}
      <mesh position={[0.74, 0.02, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.025, 0.1, 8]} />
        <meshStandardMaterial color="#222222" roughness={0.9} metalness={0} />
      </mesh>
      {/* Eyes */}
      <mesh position={[0.67, 0.055, 0.05]}>
        <sphereGeometry args={[0.009, 6, 6]} />
        <meshStandardMaterial color="#111111" roughness={0.5} metalness={0.1} />
      </mesh>
      <mesh position={[0.67, 0.055, -0.05]}>
        <sphereGeometry args={[0.009, 6, 6]} />
        <meshStandardMaterial color="#111111" roughness={0.5} metalness={0.1} />
      </mesh>
      {/* White rump patch */}
      <mesh position={[-0.28, -0.02, 0]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#f0ede8" roughness={0.82} metalness={0.01} />
      </mesh>

      {/* === LEFT WING === */}
      <group ref={leftWingRef} position={[-0.02, 0.04, 0.16]} rotation={[0, 0.03, 0.04]}>
        {/* Coverts - 3 overlapping rows with barring edges */}
        <mesh position={[0.05, 0.014, 0.02]} castShadow>
          <boxGeometry args={[0.26, 0.016, 0.16]} />
          <meshStandardMaterial color="#8a7560" roughness={0.84} metalness={0.01} />
        </mesh>
        <mesh position={[0.05, 0.022, -0.04]}>
          <boxGeometry args={[0.24, 0.004, 0.018]} />
          <meshStandardMaterial color="#b8a68e" roughness={0.82} metalness={0.01} />
        </mesh>
        <mesh position={[0.03, 0.01, 0.12]} castShadow>
          <boxGeometry args={[0.30, 0.014, 0.16]} />
          <meshStandardMaterial color="#7e6a54" roughness={0.86} metalness={0.01} />
        </mesh>
        <mesh position={[0.03, 0.017, 0.05]}>
          <boxGeometry args={[0.28, 0.004, 0.018]} />
          <meshStandardMaterial color="#b0a086" roughness={0.82} metalness={0.01} />
        </mesh>
        <mesh position={[0.01, 0.007, 0.22]} castShadow>
          <boxGeometry args={[0.32, 0.012, 0.14]} />
          <meshStandardMaterial color="#756348" roughness={0.86} metalness={0.01} />
        </mesh>
        <mesh position={[0.01, 0.013, 0.16]}>
          <boxGeometry args={[0.30, 0.004, 0.016]} />
          <meshStandardMaterial color="#a89878" roughness={0.82} metalness={0.01} />
        </mesh>
        {/* Secondary feathers - 6 overlapping */}
        <mesh position={[0.06, 0.001, 0.17]} rotation={[0, -0.02, 0.02]} castShadow>
          <boxGeometry args={[0.26, 0.01, 0.06]} />
          <meshStandardMaterial color="#6b5a48" roughness={0.88} metalness={0.01} />
        </mesh>
        <mesh position={[0.04, 0, 0.21]} rotation={[0, -0.02, 0.015]} castShadow>
          <boxGeometry args={[0.28, 0.01, 0.06]} />
          <meshStandardMaterial color="#665644" roughness={0.88} metalness={0.01} />
        </mesh>
        <mesh position={[0.03, -0.001, 0.25]} rotation={[0, -0.01, 0.01]} castShadow>
          <boxGeometry args={[0.29, 0.009, 0.058]} />
          <meshStandardMaterial color="#625242" roughness={0.88} metalness={0.01} />
        </mesh>
        <mesh position={[0.01, -0.001, 0.29]} castShadow>
          <boxGeometry args={[0.30, 0.009, 0.056]} />
          <meshStandardMaterial color="#5e4e3e" roughness={0.88} metalness={0} />
        </mesh>
        <mesh position={[-0.01, -0.002, 0.33]} rotation={[0, 0.02, -0.01]} castShadow>
          <boxGeometry args={[0.31, 0.008, 0.054]} />
          <meshStandardMaterial color="#5a4a3a" roughness={0.88} metalness={0} />
        </mesh>
        <mesh position={[-0.03, -0.002, 0.37]} rotation={[0, 0.03, -0.015]} castShadow>
          <boxGeometry args={[0.32, 0.008, 0.052]} />
          <meshStandardMaterial color="#564838" roughness={0.88} metalness={0} />
        </mesh>
        {/* Primary feathers - 7 fanned, dark */}
        <mesh position={[0.02, -0.004, 0.40]} rotation={[0, 0.02, 0.01]} castShadow>
          <boxGeometry args={[0.34, 0.008, 0.048]} />
          <meshStandardMaterial color="#3a3530" roughness={0.9} metalness={0} />
        </mesh>
        <mesh position={[0.0, -0.005, 0.43]} rotation={[0, 0.04, 0]} castShadow>
          <boxGeometry args={[0.37, 0.008, 0.046]} />
          <meshStandardMaterial color="#353028" roughness={0.9} metalness={0} />
        </mesh>
        <mesh position={[-0.02, -0.006, 0.46]} rotation={[0, 0.07, -0.01]} castShadow>
          <boxGeometry args={[0.40, 0.007, 0.044]} />
          <meshStandardMaterial color="#332e2a" roughness={0.9} metalness={0} />
        </mesh>
        <mesh position={[-0.04, -0.007, 0.49]} rotation={[0, 0.10, -0.02]} castShadow>
          <boxGeometry args={[0.42, 0.007, 0.042]} />
          <meshStandardMaterial color="#2c2824" roughness={0.92} metalness={0} />
        </mesh>
        <mesh position={[-0.06, -0.008, 0.52]} rotation={[0, 0.13, -0.04]} castShadow>
          <boxGeometry args={[0.40, 0.006, 0.040]} />
          <meshStandardMaterial color="#252220" roughness={0.92} metalness={0} />
        </mesh>
        <mesh position={[-0.08, -0.009, 0.55]} rotation={[0, 0.17, -0.06]} castShadow>
          <boxGeometry args={[0.36, 0.006, 0.038]} />
          <meshStandardMaterial color="#1e1e22" roughness={0.94} metalness={0} />
        </mesh>
        <mesh position={[-0.10, -0.010, 0.58]} rotation={[0, 0.21, -0.08]} castShadow>
          <boxGeometry args={[0.30, 0.006, 0.034]} />
          <meshStandardMaterial color="#1a1a1e" roughness={0.94} metalness={0} />
        </mesh>
      </group>

      {/* === RIGHT WING === */}
      <group ref={rightWingRef} position={[-0.02, 0.04, -0.16]} rotation={[0, -0.03, -0.04]}>
        {/* Coverts - 3 overlapping rows with barring edges */}
        <mesh position={[0.05, 0.014, -0.02]} castShadow>
          <boxGeometry args={[0.26, 0.016, 0.16]} />
          <meshStandardMaterial color="#8a7560" roughness={0.84} metalness={0.01} />
        </mesh>
        <mesh position={[0.05, 0.022, 0.04]}>
          <boxGeometry args={[0.24, 0.004, 0.018]} />
          <meshStandardMaterial color="#b8a68e" roughness={0.82} metalness={0.01} />
        </mesh>
        <mesh position={[0.03, 0.01, -0.12]} castShadow>
          <boxGeometry args={[0.30, 0.014, 0.16]} />
          <meshStandardMaterial color="#7e6a54" roughness={0.86} metalness={0.01} />
        </mesh>
        <mesh position={[0.03, 0.017, -0.05]}>
          <boxGeometry args={[0.28, 0.004, 0.018]} />
          <meshStandardMaterial color="#b0a086" roughness={0.82} metalness={0.01} />
        </mesh>
        <mesh position={[0.01, 0.007, -0.22]} castShadow>
          <boxGeometry args={[0.32, 0.012, 0.14]} />
          <meshStandardMaterial color="#756348" roughness={0.86} metalness={0.01} />
        </mesh>
        <mesh position={[0.01, 0.013, -0.16]}>
          <boxGeometry args={[0.30, 0.004, 0.016]} />
          <meshStandardMaterial color="#a89878" roughness={0.82} metalness={0.01} />
        </mesh>
        {/* Secondary feathers - 6 overlapping */}
        <mesh position={[0.06, 0.001, -0.17]} rotation={[0, 0.02, -0.02]} castShadow>
          <boxGeometry args={[0.26, 0.01, 0.06]} />
          <meshStandardMaterial color="#6b5a48" roughness={0.88} metalness={0.01} />
        </mesh>
        <mesh position={[0.04, 0, -0.21]} rotation={[0, 0.02, -0.015]} castShadow>
          <boxGeometry args={[0.28, 0.01, 0.06]} />
          <meshStandardMaterial color="#665644" roughness={0.88} metalness={0.01} />
        </mesh>
        <mesh position={[0.03, -0.001, -0.25]} rotation={[0, 0.01, -0.01]} castShadow>
          <boxGeometry args={[0.29, 0.009, 0.058]} />
          <meshStandardMaterial color="#625242" roughness={0.88} metalness={0.01} />
        </mesh>
        <mesh position={[0.01, -0.001, -0.29]} castShadow>
          <boxGeometry args={[0.30, 0.009, 0.056]} />
          <meshStandardMaterial color="#5e4e3e" roughness={0.88} metalness={0} />
        </mesh>
        <mesh position={[-0.01, -0.002, -0.33]} rotation={[0, -0.02, 0.01]} castShadow>
          <boxGeometry args={[0.31, 0.008, 0.054]} />
          <meshStandardMaterial color="#5a4a3a" roughness={0.88} metalness={0} />
        </mesh>
        <mesh position={[-0.03, -0.002, -0.37]} rotation={[0, -0.03, 0.015]} castShadow>
          <boxGeometry args={[0.32, 0.008, 0.052]} />
          <meshStandardMaterial color="#564838" roughness={0.88} metalness={0} />
        </mesh>
        {/* Primary feathers - 7 fanned */}
        <mesh position={[0.02, -0.004, -0.40]} rotation={[0, -0.02, -0.01]} castShadow>
          <boxGeometry args={[0.34, 0.008, 0.048]} />
          <meshStandardMaterial color="#3a3530" roughness={0.9} metalness={0} />
        </mesh>
        <mesh position={[0.0, -0.005, -0.43]} rotation={[0, -0.04, 0]} castShadow>
          <boxGeometry args={[0.37, 0.008, 0.046]} />
          <meshStandardMaterial color="#353028" roughness={0.9} metalness={0} />
        </mesh>
        <mesh position={[-0.02, -0.006, -0.46]} rotation={[0, -0.07, 0.01]} castShadow>
          <boxGeometry args={[0.40, 0.007, 0.044]} />
          <meshStandardMaterial color="#332e2a" roughness={0.9} metalness={0} />
        </mesh>
        <mesh position={[-0.04, -0.007, -0.49]} rotation={[0, -0.10, 0.02]} castShadow>
          <boxGeometry args={[0.42, 0.007, 0.042]} />
          <meshStandardMaterial color="#2c2824" roughness={0.92} metalness={0} />
        </mesh>
        <mesh position={[-0.06, -0.008, -0.52]} rotation={[0, -0.13, 0.04]} castShadow>
          <boxGeometry args={[0.40, 0.006, 0.040]} />
          <meshStandardMaterial color="#252220" roughness={0.92} metalness={0} />
        </mesh>
        <mesh position={[-0.08, -0.009, -0.55]} rotation={[0, -0.17, 0.06]} castShadow>
          <boxGeometry args={[0.36, 0.006, 0.038]} />
          <meshStandardMaterial color="#1e1e22" roughness={0.94} metalness={0} />
        </mesh>
        <mesh position={[-0.10, -0.010, -0.58]} rotation={[0, -0.21, 0.08]} castShadow>
          <boxGeometry args={[0.30, 0.006, 0.034]} />
          <meshStandardMaterial color="#1a1a1e" roughness={0.94} metalness={0} />
        </mesh>
      </group>

      {/* === TAIL FAN (7 feathers) === */}
      <mesh position={[-0.36, 0.01, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <boxGeometry args={[0.2, 0.008, 0.05]} />
        <meshStandardMaterial color="#1a1c20" roughness={0.88} metalness={0.02} />
      </mesh>
      <mesh position={[-0.355, 0.01, 0.03]} rotation={[0.06, 0, Math.PI / 2]} castShadow>
        <boxGeometry args={[0.19, 0.007, 0.048]} />
        <meshStandardMaterial color="#1e1e22" roughness={0.88} metalness={0.02} />
      </mesh>
      <mesh position={[-0.355, 0.01, -0.03]} rotation={[-0.06, 0, Math.PI / 2]} castShadow>
        <boxGeometry args={[0.19, 0.007, 0.048]} />
        <meshStandardMaterial color="#1e1e22" roughness={0.88} metalness={0.02} />
      </mesh>
      <mesh position={[-0.35, 0.01, 0.06]} rotation={[0.12, 0, Math.PI / 2]} castShadow>
        <boxGeometry args={[0.18, 0.006, 0.044]} />
        <meshStandardMaterial color="#222226" roughness={0.9} metalness={0.02} />
      </mesh>
      <mesh position={[-0.35, 0.01, -0.06]} rotation={[-0.12, 0, Math.PI / 2]} castShadow>
        <boxGeometry args={[0.18, 0.006, 0.044]} />
        <meshStandardMaterial color="#222226" roughness={0.9} metalness={0.02} />
      </mesh>
      <mesh position={[-0.34, 0.01, 0.09]} rotation={[0.20, 0, Math.PI / 2]} castShadow>
        <boxGeometry args={[0.16, 0.006, 0.04]} />
        <meshStandardMaterial color="#262628" roughness={0.9} metalness={0.02} />
      </mesh>
      <mesh position={[-0.34, 0.01, -0.09]} rotation={[-0.20, 0, Math.PI / 2]} castShadow>
        <boxGeometry args={[0.16, 0.006, 0.04]} />
        <meshStandardMaterial color="#262628" roughness={0.9} metalness={0.02} />
      </mesh>
    </group>
  );
}
