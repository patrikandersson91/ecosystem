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
      {/* Body */}
      <mesh castShadow>
        <capsuleGeometry args={[0.17, 0.56, 6, 10]} />
        <meshStandardMaterial color="#3e3f46" roughness={0.84} metalness={0.03} />
      </mesh>
      {/* Chest */}
      <mesh position={[0.03, 0.02, 0]} castShadow>
        <sphereGeometry args={[0.19, 12, 10]} />
        <meshStandardMaterial color="#585b66" roughness={0.86} metalness={0.02} />
      </mesh>
      {/* Head */}
      <mesh position={[0.35, 0.1, 0]} castShadow>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshStandardMaterial color="#484a54" roughness={0.84} metalness={0.03} />
      </mesh>
      {/* Beak */}
      <mesh position={[0.5, 0.09, 0]}>
        <coneGeometry args={[0.05, 0.2, 8]} />
        <meshStandardMaterial color="#cda678" roughness={0.9} metalness={0} />
      </mesh>
      {/* Rump */}
      <mesh position={[-0.15, -0.02, 0]}>
        <sphereGeometry args={[0.11, 10, 10]} />
        <meshStandardMaterial color="#686b75" roughness={0.9} metalness={0.02} />
      </mesh>

      {/* Left Wing */}
      <group ref={leftWingRef} position={[0.02, 0.04, 0.23]} rotation={[0.05, 0.05, 0.08]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.016, 0.05, 0.32, 8]} />
          <meshStandardMaterial color="#4d525e" roughness={0.86} metalness={0.03} />
        </mesh>
        <mesh position={[0.05, 0, 0.17]} rotation={[0, 0, 0.2]} castShadow>
          <boxGeometry args={[0.5, 0.012, 0.095]} />
          <meshStandardMaterial color="#5f6470" roughness={0.9} metalness={0.01} />
        </mesh>
        <mesh position={[0.03, 0, 0.3]} rotation={[0, 0, 0.08]} castShadow>
          <boxGeometry args={[0.62, 0.01, 0.07]} />
          <meshStandardMaterial color="#636a76" roughness={0.9} metalness={0.01} />
        </mesh>
        <mesh position={[-0.02, 0, 0.42]} rotation={[0, 0, -0.03]} castShadow>
          <boxGeometry args={[0.7, 0.009, 0.052]} />
          <meshStandardMaterial color="#6c7380" roughness={0.92} metalness={0} />
        </mesh>
        <mesh position={[-0.08, 0, 0.52]} rotation={[0, 0, -0.12]} castShadow>
          <boxGeometry args={[0.76, 0.008, 0.042]} />
          <meshStandardMaterial color="#757d8b" roughness={0.94} metalness={0} />
        </mesh>
      </group>

      {/* Right Wing */}
      <group ref={rightWingRef} position={[0.02, 0.04, -0.23]} rotation={[-0.05, -0.05, -0.08]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.016, 0.05, 0.32, 8]} />
          <meshStandardMaterial color="#4d525e" roughness={0.86} metalness={0.03} />
        </mesh>
        <mesh position={[0.05, 0, -0.17]} rotation={[0, 0, -0.2]} castShadow>
          <boxGeometry args={[0.5, 0.012, 0.095]} />
          <meshStandardMaterial color="#5f6470" roughness={0.9} metalness={0.01} />
        </mesh>
        <mesh position={[0.03, 0, -0.3]} rotation={[0, 0, -0.08]} castShadow>
          <boxGeometry args={[0.62, 0.01, 0.07]} />
          <meshStandardMaterial color="#636a76" roughness={0.9} metalness={0.01} />
        </mesh>
        <mesh position={[-0.02, 0, -0.42]} rotation={[0, 0, 0.03]} castShadow>
          <boxGeometry args={[0.7, 0.009, 0.052]} />
          <meshStandardMaterial color="#6c7380" roughness={0.92} metalness={0} />
        </mesh>
        <mesh position={[-0.08, 0, -0.52]} rotation={[0, 0, 0.12]} castShadow>
          <boxGeometry args={[0.76, 0.008, 0.042]} />
          <meshStandardMaterial color="#757d8b" roughness={0.94} metalness={0} />
        </mesh>
      </group>

      {/* Tail feathers */}
      <mesh position={[-0.32, 0.03, 0.09]} rotation={[0.2, 0.16, -0.45]} castShadow>
        <coneGeometry args={[0.032, 0.24, 7]} />
        <meshStandardMaterial color="#343740" roughness={0.9} metalness={0.02} />
      </mesh>
      <mesh position={[-0.32, 0.03, -0.09]} rotation={[-0.2, -0.16, -0.45]} castShadow>
        <coneGeometry args={[0.032, 0.24, 7]} />
        <meshStandardMaterial color="#343740" roughness={0.9} metalness={0.02} />
      </mesh>
    </group>
  );
}
