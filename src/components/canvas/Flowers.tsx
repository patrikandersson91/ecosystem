import { useMemo } from 'react'
import { useEcosystem } from '../../state/ecosystem-context.tsx'

const PETAL_COLORS = ['#e84393', '#fd79a8', '#fab1a0', '#ffeaa7', '#dfe6e9']
const CENTER_COLORS = ['#fdcb6e', '#f39c12', '#e17055', '#d63031', '#6c5ce7']

// Pre-compute petal angles
const PETAL_ANGLES = [0, 1, 2, 3, 4].map(i => (i / 5) * Math.PI * 2)

function Flower({ position, colorIndex }: { position: [number, number, number]; colorIndex: number }) {
  const petalColor = PETAL_COLORS[colorIndex % PETAL_COLORS.length]
  const centerColor = CENTER_COLORS[colorIndex % CENTER_COLORS.length]

  return (
    <group position={[position[0], 0, position[2]]}>
      {/* Stem */}
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.02, 0.025, 0.4, 4]} />
        <meshStandardMaterial color="#3d8b37" />
      </mesh>
      {/* Leaf */}
      <mesh position={[0.06, 0.15, 0]} rotation={[0, 0, 0.6]} castShadow>
        <sphereGeometry args={[0.06, 4, 3]} />
        <meshStandardMaterial color="#4caf50" />
      </mesh>
      {/* Petals */}
      {PETAL_ANGLES.map((angle, i) => (
        <mesh
          key={i}
          position={[
            Math.cos(angle) * 0.08,
            0.42,
            Math.sin(angle) * 0.08,
          ]}
          rotation={[0.3 * Math.cos(angle), 0, 0.3 * Math.sin(angle)]}
          castShadow
        >
          <sphereGeometry args={[0.07, 6, 4]} />
          <meshStandardMaterial color={petalColor} />
        </mesh>
      ))}
      {/* Center */}
      <mesh position={[0, 0.43, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.055, 6, 6]} />
        <meshStandardMaterial color={centerColor} />
      </mesh>
    </group>
  )
}

export default function Flowers() {
  const { flowers } = useEcosystem()
  const aliveFlowers = useMemo(() => flowers.filter(f => f.alive), [flowers])

  if (aliveFlowers.length === 0) return null

  return (
    <group>
      {aliveFlowers.map((flower, i) => (
        <Flower
          key={flower.id}
          position={flower.position}
          colorIndex={i}
        />
      ))}
    </group>
  )
}
