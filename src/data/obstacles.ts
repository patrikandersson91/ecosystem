import { WORLD_SIZE, WORLD_SCALE } from '../types/ecosystem.ts'
import { isInWater } from '../utils/river-path'

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
  const maxAttempts = count * 200
  let attempts = 0
  while (pts.length < count && attempts < maxAttempts) {
    const x = (rng() - 0.5) * WORLD_SIZE * spread
    const z = (rng() - 0.5) * WORLD_SIZE * spread
    attempts++

    const tooClose = [...existing, ...pts].some(
      p => Math.hypot(p[0] - x, p[2] - z) < minDist,
    )
    if (isInWater(x, z, riverBuffer) || tooClose) continue

    pts.push([x, 0, z])
  }
  return pts
}

function generateClusteredPositions(
  count: number,
  center: [number, number],
  radius: number,
  riverBuffer: number,
  existing: [number, number, number][],
  minDist: number,
  rng: () => number,
): [number, number, number][] {
  const pts: [number, number, number][] = []
  const maxAttempts = count * 240
  let attempts = 0
  while (pts.length < count && attempts < maxAttempts) {
    const a = rng() * Math.PI * 2
    const r = Math.sqrt(rng()) * radius
    const x = center[0] + Math.cos(a) * r
    const z = center[1] + Math.sin(a) * r
    attempts++

    const tooClose = [...existing, ...pts].some(
      p => Math.hypot(p[0] - x, p[2] - z) < minDist,
    )
    if (isInWater(x, z, riverBuffer) || tooClose) continue

    pts.push([x, 0, z])
  }
  return pts
}

function generateCornerForestPositions(
  count: number,
  center: [number, number],
  halfWidth: number,
  halfHeight: number,
  zSkew: number,
  riverBuffer: number,
  existing: [number, number, number][],
  minDist: number,
  rng: () => number,
): [number, number, number][] {
  const pts: [number, number, number][] = []
  const maxAttempts = count * 300
  let attempts = 0

  while (pts.length < count && attempts < maxAttempts) {
    const nx = rng() * 2 - 1 // -1..1
    const tapered = 1 - Math.abs(nx) * 0.45 // taper shape so it is not circular
    const x = center[0] + nx * halfWidth
    const z = center[1] + (rng() * 2 - 1) * halfHeight * tapered + nx * zSkew
    attempts++

    const tooClose = [...existing, ...pts].some(
      p => Math.hypot(p[0] - x, p[2] - z) < minDist,
    )
    if (isInWater(x, z, riverBuffer) || tooClose) continue

    pts.push([x, 0, z])
  }

  return pts
}
function generateRandomGroves(
  numGroves: number,
  treesPerGrove: number,
  groveRadius: number,
  riverBuffer: number,
  existing: [number, number, number][],
  minDist: number,
  rng: () => number,
): [number, number, number][] {
  const allPts: [number, number, number][] = []
  let currentExisting = [...existing]

  for (let i = 0; i < numGroves; i++) {
    // Pick a random center for the grove
    const cx = (rng() - 0.5) * WORLD_SIZE * 1.5
    const cz = (rng() - 0.5) * WORLD_SIZE * 1.5

    // Generate trees for this grove
    // We use a derived existing array so trees within a grove check against previous groves
    const grovePts = generateClusteredPositions(
      treesPerGrove,
      [cx, cz],
      groveRadius,
      riverBuffer,
      currentExisting,
      minDist,
      rng
    )

    allPts.push(...grovePts)
    currentExisting = [...currentExisting, ...grovePts]
  }
  return allPts
}

// Use seeded RNG so positions are stable across renders and components
const rng = seededRandom(42)
const DENSITY_SCALE = Math.max(1, WORLD_SCALE)
const TREE_WATER_BUFFER = 3
const FOREST_CENTER: [number, number] = [-WORLD_SIZE * 0.36, WORLD_SIZE * 0.06]
const FOREST_EDGE_CENTER: [number, number] = [-WORLD_SIZE * 0.18, WORLD_SIZE * 0.18]
const CORNER_FOREST_CENTER: [number, number] = [WORLD_SIZE * 0.62, -WORLD_SIZE * 0.62]

export const TREE_POSITIONS = generatePositions(
  Math.floor(60 * DENSITY_SCALE), // Increased from 32
  1.8,
  TREE_WATER_BUFFER,
  [],
  2.5,
  rng,
)
export const DENSE_FOREST_TREE_POSITIONS = generateClusteredPositions(
  Math.floor(120 * DENSITY_SCALE), // Increased from 42
  FOREST_CENTER,
  WORLD_SIZE * 0.22, // Slightly larger radius
  TREE_WATER_BUFFER,
  TREE_POSITIONS,
  2.2,
  rng,
)
export const FOREST_EDGE_TREE_POSITIONS = generateClusteredPositions(
  Math.floor(50 * DENSITY_SCALE), // Increased from 24
  FOREST_EDGE_CENTER,
  WORLD_SIZE * 0.16,
  TREE_WATER_BUFFER,
  [...TREE_POSITIONS, ...DENSE_FOREST_TREE_POSITIONS],
  2.2, // Slightly closer
  rng,
)
export const CORNER_FOREST_TREE_POSITIONS = generateCornerForestPositions(
  Math.floor(60 * DENSITY_SCALE), // Increased from 28
  CORNER_FOREST_CENTER,
  WORLD_SIZE * 0.16,
  WORLD_SIZE * 0.09,
  -WORLD_SIZE * 0.04,
  TREE_WATER_BUFFER,
  [...TREE_POSITIONS, ...DENSE_FOREST_TREE_POSITIONS, ...FOREST_EDGE_TREE_POSITIONS],
  2.2,
  rng,
)

// Generate 12 random groves with ~15 trees each
export const RANDOM_GROVE_POSITIONS = generateRandomGroves(
  12,
  Math.floor(15 * DENSITY_SCALE),
  WORLD_SIZE * 0.08,
  TREE_WATER_BUFFER,
  [
    ...TREE_POSITIONS,
    ...DENSE_FOREST_TREE_POSITIONS,
    ...FOREST_EDGE_TREE_POSITIONS,
    ...CORNER_FOREST_TREE_POSITIONS
  ],
  2.0,
  rng
)

const ALL_TREES = [
  ...TREE_POSITIONS,
  ...DENSE_FOREST_TREE_POSITIONS,
  ...FOREST_EDGE_TREE_POSITIONS,
  ...CORNER_FOREST_TREE_POSITIONS,
  ...RANDOM_GROVE_POSITIONS,
]

export const STONE_POSITIONS = generatePositions(Math.floor(35 * DENSITY_SCALE), 1.6, 0.5, ALL_TREES, 2, rng)
export const BUSH_POSITIONS = generatePositions(
  Math.floor(50 * DENSITY_SCALE),
  1.7,
  0.8,
  [...ALL_TREES, ...STONE_POSITIONS],
  1.8,
  rng,
)

// Flat list of all obstacles for collision avoidance
export const ALL_OBSTACLES: Obstacle[] = [
  ...ALL_TREES.map(p => ({ position: p, radius: 1.0 })),
  ...STONE_POSITIONS.map(p => ({ position: p, radius: 0.8 })),
  ...BUSH_POSITIONS.map(p => ({ position: p, radius: 0.6 })),
]
