import type { Vector3 } from 'three'
import { forEachNearbyTreeObstacle, TREE_MAX_RADIUS } from '../data/obstacles.ts'

const COLLISION_EPSILON = 0.0001
const RESOLVE_PASSES = 2
const COLLISION_QUERY_PADDING = 0.05

/**
 * Hard-resolve overlaps against tree colliders so entities cannot pass through trunks.
 * Returns true when at least one collision was resolved.
 */
export function resolveTreeCollisions(
  position: Vector3,
  velocity: Vector3,
  entityRadius: number,
): boolean {
  let collided = false
  const queryRadius = entityRadius + TREE_MAX_RADIUS + COLLISION_QUERY_PADDING

  for (let pass = 0; pass < RESOLVE_PASSES; pass++) {
    forEachNearbyTreeObstacle(position.x, position.z, queryRadius, (tree) => {
      const dx = position.x - tree.position[0]
      const dz = position.z - tree.position[2]
      const minDist = tree.radius + entityRadius
      const distSq = dx * dx + dz * dz
      if (distSq >= minDist * minDist) return

      let normalX = 1
      let normalZ = 0
      const dist = Math.sqrt(distSq)
      if (dist > COLLISION_EPSILON) {
        normalX = dx / dist
        normalZ = dz / dist
      } else {
        // Fallback when centered exactly in collider: push opposite travel direction.
        const speed = Math.hypot(velocity.x, velocity.z)
        if (speed > COLLISION_EPSILON) {
          normalX = -velocity.x / speed
          normalZ = -velocity.z / speed
        }
      }

      const overlap = minDist - dist + 0.001
      position.x += normalX * overlap
      position.z += normalZ * overlap

      // Remove inward velocity so entities slide around trees instead of tunneling through.
      const inwardSpeed = velocity.x * normalX + velocity.z * normalZ
      if (inwardSpeed < 0) {
        velocity.x -= inwardSpeed * normalX
        velocity.z -= inwardSpeed * normalZ
      }

      collided = true
    })
  }

  return collided
}
