import { WORLD_SIZE } from '../types/ecosystem.ts'
import { RIVER_WIDTH, WATER_PONDS, pondRadiusAtAngle, riverCenterZ } from './river-path'

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/**
 * Small, smooth world height variation.
 * River-adjacent terrain is flattened so water blends naturally.
 */
function terrainNoiseAt(x: number, z: number): number {
  const broadWave = Math.sin(x * 0.022) * 2.1 + Math.cos(z * 0.018) * 1.7
  const detailWave = Math.sin((x + z) * 0.04) * 0.9 + Math.cos((x - z) * 0.036) * 0.65
  const ridgeWave = Math.sin(x * 0.06 + z * 0.028) * 0.45

  // A massive mountain in the corner
  const mx = x - WORLD_SIZE * 0.7  // Moved to corner
  const mz = z - WORLD_SIZE * 0.7
  const mDist = Math.sqrt(mx * mx + mz * mz)
  const mountainCore = Math.max(0, 1 - mDist / (WORLD_SIZE * 0.8)) // Broader base
  const mountainNoise = 0.8 + Math.sin(x * 0.05 + z * 0.05) * 0.3 + Math.sin(x * 0.1 - z * 0.08) * 0.1
  const mountainHeight = Math.pow(mountainCore, 1.8) * 70 * mountainNoise // Lowered height, rounded top

  // A second smaller ridge for detail
  const mx2 = x + WORLD_SIZE * 0.4
  const mz2 = z - WORLD_SIZE * 0.55
  const mDist2 = Math.sqrt(mx2 * mx2 * 0.8 + mz2 * mz2 * 0.9)
  const mountainCore2 = Math.max(0, 1 - mDist2 / (WORLD_SIZE * 0.28))
  const mountainNoise2 = 0.8 + Math.sin(x * 0.15 - z * 0.1) * 0.2
  const mountainHeight2 = Math.pow(mountainCore2, 2.4) * 15 * mountainNoise2

  const baseOffset = 1.3 // Raise landscape to see more grass

  return baseOffset + broadWave + detailWave + ridgeWave + mountainHeight + mountainHeight2
}

const POND_BASE_HEIGHTS = WATER_PONDS.map((pond) => {
  const localNoise = terrainNoiseAt(pond.center[0], pond.center[1])
  return localNoise * 0.15
})

export function groundHeightAt(x: number, z: number): number {
  const rawHeight = terrainNoiseAt(x, z)

  const riverDistance = Math.abs(z - riverCenterZ(x))

  // Flatten hills near river
  const riverFlatten = smoothstep(RIVER_WIDTH * 0.4, RIVER_WIDTH * 1.4, riverDistance)

  // Carve the actual river channel downwards
  const channelFactor = smoothstep(RIVER_WIDTH * 0.9, RIVER_WIDTH * 0.2, riverDistance)
  const channelDepth = 2.0 * channelFactor

  let height = rawHeight * riverFlatten - channelDepth

  for (let i = 0; i < WATER_PONDS.length; i++) {
    const pond = WATER_PONDS[i]
    const dx = x - pond.center[0]
    const dz = z - pond.center[1]
    const dist = Math.sqrt(dx * dx + dz * dz)
    const angle = Math.atan2(dz, dx)
    const edgeRadius = pondRadiusAtAngle(pond, angle)

    // Build a smooth local basin: flatter near center, gradual transition at shore.
    const shoreBlend = smoothstep(edgeRadius * 0.6, edgeRadius * 1.2, dist)
    // Use the max depth of the pond to carve down
    const basinDepth = pond.maxDepth * (1 - shoreBlend)

    // Ensure the terrain goes down to form the pond bottom
    const currentBase = POND_BASE_HEIGHTS[i] * shoreBlend - basinDepth

    // Smoothly blend the existing height into the pond basin
    const shapedHeight = height * shoreBlend + currentBase * (1 - shoreBlend)

    // Carve only downward so we never create artificial bumps around ponds.
    height = Math.min(height, shapedHeight)
  }

  return height
}
