import type { Vector3Tuple } from 'three'
import { clampRiverX, riverCenterZ, RIVER_WIDTH, WATER_PONDS, pondRadiusAtAngle } from '../utils/river-path'

export function distanceBetween(a: Vector3Tuple, b: Vector3Tuple): number {
  const dx = a[0] - b[0]
  const dz = a[2] - b[2]
  return Math.sqrt(dx * dx + dz * dz)
}

export function findNearest<T extends { position: Vector3Tuple }>(
  pos: Vector3Tuple,
  entities: T[],
): T | null {
  let best: T | null = null
  let bestDist = Infinity
  for (const e of entities) {
    const d = distanceBetween(pos, e.position)
    if (d < bestDist) {
      bestDist = d
      best = e
    }
  }
  return best
}

export function findNearestWaterPoint(pos: Vector3Tuple): Vector3Tuple {
  const [px, , pz] = pos

  // Candidate 1: nearest point on river strip.
  const riverX = clampRiverX(px)
  const center = riverCenterZ(riverX)
  const halfW = RIVER_WIDTH / 2
  const clampedZ = Math.max(center - halfW, Math.min(center + halfW, pz))
  let best: Vector3Tuple = [riverX, 0, clampedZ]
  let bestDist = distanceBetween(pos, best)

  // Candidate 2+: nearest point on each pond edge/inside area.
  for (const pond of WATER_PONDS) {
    const dx = px - pond.center[0]
    const dz = pz - pond.center[1]
    const dist = Math.sqrt(dx * dx + dz * dz)
    const angle = Math.atan2(dz, dx)
    const edgeRadius = pondRadiusAtAngle(pond, angle)

    let candidate: Vector3Tuple
    if (dist <= edgeRadius) {
      candidate = [px, 0, pz]
    } else if (dist < 1e-6) {
      const r = pondRadiusAtAngle(pond, 0)
      candidate = [pond.center[0] + r, 0, pond.center[1]]
    } else {
      const ux = dx / dist
      const uz = dz / dist
      candidate = [pond.center[0] + ux * edgeRadius, 0, pond.center[1] + uz * edgeRadius]
    }

    const d = distanceBetween(pos, candidate)
    if (d < bestDist) {
      bestDist = d
      best = candidate
    }
  }

  return best
}

export function findRandomAmongNearest<T extends { position: Vector3Tuple }>(
  pos: Vector3Tuple,
  entities: T[],
  count: number,
): T | null {
  if (entities.length === 0) return null
  if (entities.length <= count) {
    return entities[Math.floor(Math.random() * entities.length)]
  }
  const sorted = entities
    .map(e => ({ e, d: distanceBetween(pos, e.position) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
  return sorted[Math.floor(Math.random() * sorted.length)].e
}

export function entitiesInRadius<T extends { position: Vector3Tuple }>(
  pos: Vector3Tuple,
  radius: number,
  entities: T[],
): T[] {
  return entities.filter(e => distanceBetween(pos, e.position) < radius)
}
