import { useMemo } from 'react'
import { DoubleSide } from 'three'
import { useEcosystem } from '../../state/ecosystem-context.tsx'
import { groundHeightAt } from '../../utils/terrain-height.ts'

const PETAL_COLORS = ['#e84393', '#fd79a8', '#fab1a0', '#ffeaa7', '#dfe6e9']
const CENTER_COLORS = ['#fdcb6e', '#f39c12', '#e17055', '#d63031', '#6c5ce7']

// Pre-compute petal angles
const PETAL_ANGLES = [0, 1, 2, 3, 4].map(i => (i / 5) * Math.PI * 2)

function stableHash(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function DaisyFlower({ petalColor, centerColor }: { petalColor: string; centerColor: string }) {
  return (
    <>
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
    </>
  )
}

function TulipFlower({ petalColor, centerColor }: { petalColor: string; centerColor: string }) {
  return (
    <>
      {[0, 1, 2].map(i => {
        const angle = (i / 3) * Math.PI * 2
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 0.05, 0.42, Math.sin(angle) * 0.05]}
            rotation={[0.1, angle, 0.15]}
            castShadow
          >
            <coneGeometry args={[0.06, 0.18, 6, 1, true]} />
            <meshStandardMaterial color={petalColor} side={DoubleSide} />
          </mesh>
        )
      })}
      <mesh position={[0, 0.37, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color={centerColor} />
      </mesh>
    </>
  )
}

function BellFlower({ petalColor, centerColor }: { petalColor: string; centerColor: string }) {
  return (
    <>
      <mesh position={[0, 0.39, 0]} rotation={[Math.PI, 0, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.09, 0.16, 7]} />
        <meshStandardMaterial color={petalColor} />
      </mesh>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.03, 6, 6]} />
        <meshStandardMaterial color={centerColor} />
      </mesh>
      {[0, 1, 2].map(i => {
        const angle = (i / 3) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(angle) * 0.03, 0.32, Math.sin(angle) * 0.03]} castShadow>
            <sphereGeometry args={[0.02, 5, 4]} />
            <meshStandardMaterial color={centerColor} />
          </mesh>
        )
      })}
    </>
  )
}

function Flower({
  position,
  colorIndex,
  modelIndex,
}: {
  position: [number, number, number]
  colorIndex: number
  modelIndex: number
}) {
  const petalColor = PETAL_COLORS[colorIndex % PETAL_COLORS.length]
  const centerColor = CENTER_COLORS[colorIndex % CENTER_COLORS.length]

  return (
    <group position={[position[0], groundHeightAt(position[0], position[2]), position[2]]}>
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
      {modelIndex === 0 && <DaisyFlower petalColor={petalColor} centerColor={centerColor} />}
      {modelIndex === 1 && <TulipFlower petalColor={petalColor} centerColor={centerColor} />}
      {modelIndex === 2 && <BellFlower petalColor={petalColor} centerColor={centerColor} />}
    </group>
  )
}

export default function Flowers() {
  const { flowers } = useEcosystem()
  const aliveFlowers = useMemo(() => flowers.filter(f => f.alive), [flowers])

  if (aliveFlowers.length === 0) return null

  return (
    <group>
      {aliveFlowers.map((flower) => {
        const hash = stableHash(flower.id)
        return (
          <Flower
            key={flower.id}
            position={flower.position}
            colorIndex={hash}
            modelIndex={hash % 3}
          />
        )
      })}
    </group>
  )
}
