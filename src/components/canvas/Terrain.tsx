import { useMemo } from 'react'
import { Color, Float32BufferAttribute, PlaneGeometry } from 'three'
import { WORLD_SIZE } from '../../types/ecosystem.ts'
import { groundHeightAt } from '../../utils/terrain-height.ts'

const TERRAIN_SEGMENTS = 220

export default function Terrain() {
  const geometry = useMemo(() => {
    const size = WORLD_SIZE * 2
    const geo = new PlaneGeometry(size, size, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS)
    const position = geo.attributes.position
    const color = new Color()
    const colors: number[] = []

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i)
      const z = -position.getY(i) // plane Y maps to world Z after mesh rotation
      position.setZ(i, groundHeightAt(x, z))
    }

    position.needsUpdate = true
    geo.computeVertexNormals()

    // Height + slope based coloring gives clearer readable elevation.
    const normal = geo.attributes.normal
    for (let i = 0; i < position.count; i++) {
      const y = position.getZ(i)
      const slope = 1 - Math.abs(normal.getZ(i))

      // Blend grass -> dry grass -> rocky tint with elevation and slope.
      if (y > 2.8) {
        color.set('#778067')
      } else if (y > 1.2) {
        color.set('#5f7e46')
      } else {
        color.set('#4a7c3f')
      }

      if (slope > 0.35) {
        color.lerp(new Color('#6f6a5c'), Math.min(0.45, (slope - 0.35) * 0.9))
      }

      colors.push(color.r, color.g, color.b)
    }

    geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
    return geo
  }, [])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow geometry={geometry}>
      <meshStandardMaterial vertexColors roughness={0.96} metalness={0.02} />
    </mesh>
  )
}
