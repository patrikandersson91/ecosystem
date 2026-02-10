import { BUSH_POSITIONS } from '../../data/obstacles.ts'

export default function Bushes() {
  return (
    <group>
      {BUSH_POSITIONS.map((pos, i) => {
        // Vary bush size slightly per instance
        const scale = 0.8 + (((i * 7) % 13) / 13) * 0.5
        const rotation = ((i * 137.5) % 360) * (Math.PI / 180)
        return (
          <group key={i} position={[pos[0], 0, pos[2]]} rotation={[0, rotation, 0]}>
            {/* Main bush sphere */}
            <mesh position={[0, 0.35 * scale, 0]} castShadow receiveShadow>
              <sphereGeometry args={[0.55 * scale, 7, 6]} />
              <meshStandardMaterial color="#3a7d28" roughness={0.9} />
            </mesh>
            {/* Secondary lobe */}
            <mesh position={[0.25 * scale, 0.25 * scale, 0.15 * scale]} castShadow receiveShadow>
              <sphereGeometry args={[0.4 * scale, 6, 5]} />
              <meshStandardMaterial color="#2e6b1e" roughness={0.9} />
            </mesh>
            {/* Third lobe */}
            <mesh position={[-0.2 * scale, 0.28 * scale, -0.18 * scale]} castShadow receiveShadow>
              <sphereGeometry args={[0.38 * scale, 6, 5]} />
              <meshStandardMaterial color="#358a22" roughness={0.9} />
            </mesh>
            {/* Shadow blob on ground */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
              <circleGeometry args={[0.7 * scale, 10]} />
              <meshBasicMaterial color="#000000" transparent opacity={0.15} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
