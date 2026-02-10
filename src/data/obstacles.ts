import { WORLD_SIZE } from '../types/ecosystem.ts'
import { isInRiver } from '../utils/river-path'

export interface Obstacle {
  position: [number, number, number]
  radius: number // collision radius
}

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function generatePositions(
  count: number,
  spread: number,
  riverBuffer: number,
  existing: [number, number, number][],
  minDist: number,
  rng: () => number,
): [number, number, number][] {
  const pts: [number, number, number][] = []
  for (let i = 0; i < count; i++) {
    let x: number, z: number
    let attempts = 0
    do {
      x = (rng() - 0.5) * WORLD_SIZE * spread
      z = (rng() - 0.5) * WORLD_SIZE * spread
      attempts++
    } while (
      attempts < 100 &&
      (
        isInRiver(x, z, riverBuffer) ||
        [...existing, ...pts].some(
          p => Math.hypot(p[0] - x, p[2] - z) < minDist,
        )
      )
    )
    pts.push([x, 0, z])
  }
  return pts
}

// Use seeded RNG so positions are stable across renders and components
const rng = seededRandom(42)

export const TREE_POSITIONS = generatePositions(40, 1.8, 1, [], 2.5, rng)
export const STONE_POSITIONS = generatePositions(25, 1.6, 0.5, TREE_POSITIONS, 2, rng)
export const BUSH_POSITIONS = generatePositions(35, 1.7, 0.8, [...TREE_POSITIONS, ...STONE_POSITIONS], 1.8, rng)

// Flat list of all obstacles for collision avoidance
export const ALL_OBSTACLES: Obstacle[] = [
  ...TREE_POSITIONS.map(p => ({ position: p, radius: 1.0 })),
  ...STONE_POSITIONS.map(p => ({ position: p, radius: 0.8 })),
  ...BUSH_POSITIONS.map(p => ({ position: p, radius: 0.6 })),
]
