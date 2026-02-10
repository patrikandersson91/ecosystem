/**
 * Shared river curve definition used by rendering, physics, and obstacle placement.
 * The river meanders along the x-axis with its center offset in z by two
 * overlapping sine waves to create a natural-looking curve.
 */

export const RIVER_WIDTH = 10

/** Returns the z-center of the river at a given x position. */
export function riverCenterZ(x: number): number {
  return 6 * Math.sin(x * 0.1) + 3 * Math.sin(x * 0.17 + 1.2)
}

/** Returns true if the point (x, z) falls within the river (plus optional buffer). */
export function isInRiver(x: number, z: number, buffer = 0): boolean {
  const center = riverCenterZ(x)
  const halfWidth = RIVER_WIDTH / 2 + buffer
  return Math.abs(z - center) < halfWidth
}

/** Maximum depth at the center of the river. */
export const RIVER_MAX_DEPTH = 1.8

/**
 * Returns the river depth at a given (x, z) position.
 * Deepest in the center, zero at edges. Returns 0 if outside the river.
 */
export function riverDepthAt(x: number, z: number): number {
  const center = riverCenterZ(x)
  const halfWidth = RIVER_WIDTH / 2
  const distFromCenter = Math.abs(z - center)
  if (distFromCenter >= halfWidth) return 0
  // Smooth parabolic depth profile: deepest at center
  const t = 1 - distFromCenter / halfWidth
  return RIVER_MAX_DEPTH * t * t
}
