import { STONE_POSITIONS } from '../../data/obstacles.ts'

export default function Stones() {
  return (
    <group>
      {STONE_POSITIONS.map((pos, i) => {
        const scale = 0.6 + (((i * 11) % 17) / 17) * 0.6
        const rotation = ((i * 97.3) % 360) * (Math.PI / 180)
        // Alternate between grey shades
        const color = i % 3 === 0 ? '#8a8a8a' : i % 3 === 1 ? '#6e6e6e' : '#9c9590'
        return (
          <group key={i} position={[pos[0], 0, pos[2]]} rotation={[0, rotation, 0]}>
            {/* Main stone body */}
            <mesh
              position={[0, 0.18 * scale, 0]}
              scale={[1, 0.6, 0.85]}
              castShadow
              receiveShadow
            >
              <dodecahedronGeometry args={[0.4 * scale, 0]} />
              <meshStandardMaterial color={color} roughness={1} metalness={0.05} />
            </mesh>
            {/* Smaller accent stone */}
            {scale > 0.8 && (
              <mesh
                position={[0.3 * scale, 0.1 * scale, 0.15 * scale]}
                scale={[1, 0.55, 0.9]}
                castShadow
                receiveShadow
              >
                <dodecahedronGeometry args={[0.2 * scale, 0]} />
                <meshStandardMaterial color={color} roughness={1} metalness={0.05} />
              </mesh>
            )}
            {/* Shadow blob on ground */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
              <circleGeometry args={[0.45 * scale, 8]} />
              <meshBasicMaterial color="#000000" transparent opacity={0.15} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
