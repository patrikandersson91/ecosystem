import { TREE_POSITIONS } from '../../data/obstacles.ts'

export default function Trees() {
  return (
    <group>
      {TREE_POSITIONS.map((pos, i) => (
        <group key={i} position={[pos[0], 0, pos[2]]}>
          {/* Trunk */}
          <mesh position={[0, 1, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.15, 0.25, 2, 6]} />
            <meshStandardMaterial color="#6b3e26" />
          </mesh>
          {/* Canopy */}
          <mesh position={[0, 3.2, 0]} castShadow receiveShadow>
            <coneGeometry args={[1.3, 2.8, 6]} />
            <meshStandardMaterial color="#2d6b1e" />
          </mesh>
          {/* Shadow blob on ground */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <circleGeometry args={[1.4, 12]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.18} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
