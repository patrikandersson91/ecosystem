import {
  CORNER_FOREST_TREE_POSITIONS,
  DENSE_FOREST_TREE_POSITIONS,
  FOREST_EDGE_TREE_POSITIONS,
  TREE_POSITIONS,
} from '../../data/obstacles.ts'
import { groundHeightAt } from '../../utils/terrain-height.ts'
import { isInWater } from '../../utils/river-path.ts'

export default function Trees() {
  const TREE_WATER_CLEARANCE = 3
  const allTrees = [
    ...TREE_POSITIONS,
    ...DENSE_FOREST_TREE_POSITIONS,
    ...FOREST_EDGE_TREE_POSITIONS,
    ...CORNER_FOREST_TREE_POSITIONS,
  ].filter(pos => !isInWater(pos[0], pos[2], TREE_WATER_CLEARANCE))

  return (
    <group>
      {allTrees.map((pos, i) => (
        <group key={i} position={[pos[0], groundHeightAt(pos[0], pos[2]), pos[2]]}>
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
