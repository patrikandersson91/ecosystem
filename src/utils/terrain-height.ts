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

  // A compact mountain ridge on the far side of the map (away from initial camera view).
  const mx = x - WORLD_SIZE * 0.22
  const mz = z + WORLD_SIZE * 0.82
  const mDist = Math.sqrt(mx * mx * 0.7 + mz * mz * 1.1)
  const mountainCore = Math.max(0, 1 - mDist / (WORLD_SIZE * 0.32))
  const mountainNoise = 0.75 + Math.sin(x * 0.12 + z * 0.08) * 0.25
  const mountainHeight = Math.pow(mountainCore, 2.2) * 22 * mountainNoise

  return broadWave + detailWave + ridgeWave + mountainHeight
}

const POND_BASE_HEIGHTS = WATER_PONDS.map((pond) => {
  const localNoise = terrainNoiseAt(pond.center[0], pond.center[1])
  return localNoise * 0.15
})

export function groundHeightAt(x: number, z: number): number {
  const rawHeight = terrainNoiseAt(x, z)

  const riverDistance = Math.abs(z - riverCenterZ(x))
  const riverFlatten = smoothstep(RIVER_WIDTH * 0.45, RIVER_WIDTH * 1.2, riverDistance)

  let height = rawHeight * riverFlatten
  for (let i = 0; i < WATER_PONDS.length; i++) {
    const pond = WATER_PONDS[i]
    const dx = x - pond.center[0]
    const dz = z - pond.center[1]
    const dist = Math.sqrt(dx * dx + dz * dz)
    const angle = Math.atan2(dz, dx)
    const edgeRadius = pondRadiusAtAngle(pond, angle)

    // Build a smooth local basin: flatter near center, gradual transition at shore.
    const shoreBlend = smoothstep(edgeRadius * 0.78, edgeRadius * 1.38, dist)
    const basinBase = POND_BASE_HEIGHTS[i]
    const shapedHeight = basinBase + (height - basinBase) * shoreBlend

    // Carve only downward so we never create artificial bumps around ponds.
    height = Math.min(height, shapedHeight)
  }

  return height
}
