/**
 * Shared river curve definition used by rendering, physics, and obstacle placement.
 * The river meanders along the x-axis with its center offset in z by two
 * overlapping sine waves to create a natural-looking curve.
 */

import { WORLD_SIZE } from '../types/ecosystem.ts'

export const RIVER_WIDTH = 10
export const RIVER_HALF_LENGTH = WORLD_SIZE

export interface WaterPond {
  center: [number, number] // [x, z]
  radius: number
  maxDepth: number
  shapePhase: number
  lobeA: number
  lobeB: number
  jitter: number
}

export const WATER_PONDS: WaterPond[] = [
  {
    // Far side of the map, well away from the river corridor.
    center: [-WORLD_SIZE * 0.72, -WORLD_SIZE * 0.68],
    radius: WORLD_SIZE * 0.11,
    maxDepth: 2.6,
    shapePhase: 0.8,
    lobeA: 0.2,
    lobeB: 0.13,
    jitter: 0.06,
  },
  {
    // Opposite side of the map.
    center: [WORLD_SIZE * 0.5, -WORLD_SIZE * 0.22],
    radius: WORLD_SIZE * 0.1,
    maxDepth: 2.4,
    shapePhase: 2.1,
    lobeA: 0.16,
    lobeB: 0.14,
    jitter: 0.07,
  },
]

/** Returns the z-center of the river at a given x position. */
export function riverCenterZ(x: number): number {
  return 6 * Math.sin(x * 0.1) + 3 * Math.sin(x * 0.17 + 1.2)
}

export function clampRiverX(x: number): number {
  return Math.max(-RIVER_HALF_LENGTH, Math.min(RIVER_HALF_LENGTH, x))
}

/** Returns true if the point (x, z) falls within the river (plus optional buffer). */
export function isInRiver(x: number, z: number, buffer = 0): boolean {
  if (x < -RIVER_HALF_LENGTH - buffer || x > RIVER_HALF_LENGTH + buffer) return false
  const center = riverCenterZ(x)
  const halfWidth = RIVER_WIDTH / 2 + buffer
  return Math.abs(z - center) < halfWidth
}

export function pondRadiusAtAngle(pond: WaterPond, angle: number): number {
  const shape =
    1 +
    Math.sin(angle * 2 + pond.shapePhase) * pond.lobeA +
    Math.cos(angle * 3 - pond.shapePhase * 1.3) * pond.lobeB +
    Math.sin(angle * 5 + pond.shapePhase * 0.7) * pond.jitter
  return pond.radius * Math.max(0.65, Math.min(1.45, shape))
}

export function pondOuterRadius(pond: WaterPond): number {
  return pond.radius * (1 + pond.lobeA + pond.lobeB + pond.jitter)
}

export function isInPond(x: number, z: number, buffer = 0): boolean {
  return WATER_PONDS.some((pond) => {
    const dx = x - pond.center[0]
    const dz = z - pond.center[1]
    const angle = Math.atan2(dz, dx)
    const r = pondRadiusAtAngle(pond, angle) + buffer
    return dx * dx + dz * dz < r * r
  })
}

export function isInWater(x: number, z: number, buffer = 0): boolean {
  return isInRiver(x, z, buffer) || isInPond(x, z, buffer)
}

/** Maximum depth at the center of the river. */
export const RIVER_MAX_DEPTH = 1.8

/**
 * Returns the river depth at a given (x, z) position.
 * Deepest in the center, zero at edges. Returns 0 if outside the river.
 */
export function riverDepthAt(x: number, z: number): number {
  if (x < -RIVER_HALF_LENGTH || x > RIVER_HALF_LENGTH) return 0
  const center = riverCenterZ(x)
  const halfWidth = RIVER_WIDTH / 2
  const distFromCenter = Math.abs(z - center)
  if (distFromCenter >= halfWidth) return 0
  // Smooth parabolic depth profile: deepest at center
  const t = 1 - distFromCenter / halfWidth
  return RIVER_MAX_DEPTH * t * t
}

export function pondDepthAt(x: number, z: number): number {
  let best = 0
  for (const pond of WATER_PONDS) {
    const dx = x - pond.center[0]
    const dz = z - pond.center[1]
    const angle = Math.atan2(dz, dx)
    const edgeRadius = pondRadiusAtAngle(pond, angle)
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist >= edgeRadius) continue
    const t = 1 - dist / edgeRadius
    const d = pond.maxDepth * t * t
    if (d > best) best = d
  }
  return best
}

export function waterDepthAt(x: number, z: number): number {
  return Math.max(riverDepthAt(x, z), pondDepthAt(x, z))
}
