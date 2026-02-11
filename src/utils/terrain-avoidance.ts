import { groundHeightAt } from './terrain-height.ts'

/**
 * Height thresholds matching the Terrain shader bands:
 *   Snow:  y > 38
 *   Rock:  y > 18
 */
export const SNOW_HEIGHT = 38

/**
 * Compute the terrain gradient (uphill direction) at (x, z) via central
 * finite differences. Returns [dx, dz] — the direction of steepest ascent.
 */
function terrainGradient(x: number, z: number): [number, number] {
  const eps = 0.5
  const gx = groundHeightAt(x + eps, z) - groundHeightAt(x - eps, z)
  const gz = groundHeightAt(x, z + eps) - groundHeightAt(x, z - eps)
  return [gx, gz]
}

/**
 * Returns a 2D force (fx, fz) that pushes an entity DOWNHILL when it
 * exceeds `maxHeight`. The force ramps up smoothly starting at
 * `maxHeight - softMargin` and becomes very strong above `maxHeight`.
 *
 * @param x          World x position
 * @param z          World z position
 * @param maxHeight  Height above which the entity should NOT be
 * @param softMargin How many height units below maxHeight to start the soft push
 * @param strength   Base force multiplier
 * @returns [fx, fz] force components to add to the entity's steering force
 */
export function heightCapForce(
  x: number,
  z: number,
  maxHeight: number,
  softMargin: number = 4,
  strength: number = 12,
): [number, number] {
  const h = groundHeightAt(x, z)
  const threshold = maxHeight - softMargin

  if (h <= threshold) return [0, 0]

  // 0 → 1 as height goes from threshold to maxHeight, then keeps growing >1
  const t = (h - threshold) / softMargin
  const force = strength * t * t // quadratic ramp-up

  const [gx, gz] = terrainGradient(x, z)
  const gradLen = Math.sqrt(gx * gx + gz * gz)
  if (gradLen < 0.001) return [0, 0]

  // Push in the DOWNHILL direction (negative gradient)
  return [(-gx / gradLen) * force, (-gz / gradLen) * force]
}
