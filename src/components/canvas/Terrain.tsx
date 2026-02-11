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

    // Height + slope based coloring with muted tones for a more natural palette.
    const normal = geo.attributes.normal
    for (let i = 0; i < position.count; i++) {
      const y = position.getZ(i)
      const slope = 1 - Math.abs(normal.getZ(i))

      if (y > 38) {
        // Snow caps (adjusted for lower mountain)
        color.set('#ffffff')
      } else if (y > 18) {
        // Mountain rock (grey)
        color.set('#6f6a63')
      } else if (y > 5) {
        // Higher elevation grass: muted pine green
        color.set('#4f7250')
      } else if (y > 1.2) {
        // Midland grass: olive-leaning to reduce contrast with dirt
        color.set('#5e7d58')
      } else if (y > 0.0) {
        // Transitional lowland: grass-dirt blend close to shore
        color.set('#6a7d5f')
      } else if (y < 0.0) {
        // Underwater silt/sand, kept muted to avoid harsh yellow contrast
        color.set('#8d8363')
      } else {
        // Shoreline fallback
        color.set('#6c805f')
      }

      if (slope > 0.35) {
        // Rocky slopes blend with warm grey-brown
        color.lerp(new Color('#5a554d'), Math.min(0.55, (slope - 0.35) * 1.4))
      }

      // Slightly darken underwater parts for depth effect
      if (y < -0.5) {
        color.lerp(new Color('#3b3528'), Math.min(0.5, -y * 0.28))
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
