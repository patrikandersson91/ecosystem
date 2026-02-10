import type { Vector3Tuple } from 'three'
import { riverCenterZ, RIVER_WIDTH } from '../utils/river-path'

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

export function findNearestRiverPoint(pos: Vector3Tuple): Vector3Tuple {
  const [px, , pz] = pos
  const center = riverCenterZ(px)
  const halfW = RIVER_WIDTH / 2
  const clampedZ = Math.max(center - halfW, Math.min(center + halfW, pz))
  return [px, 0, clampedZ]
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
