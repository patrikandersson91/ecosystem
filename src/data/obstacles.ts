import { WORLD_SIZE, WORLD_SCALE } from '../types/ecosystem.ts'
import { isInWater } from '../utils/river-path'

export interface Obstacle {
  position: [number, number, number]
  radius: number // collision radius
}

type ObstacleVisitor = (obstacle: Obstacle) => void

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
): { flat: [number, number, number][]; groves: [number, number, number][][] } {
  const allPts: [number, number, number][] = []
  const groves: [number, number, number][][] = []
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

    groves.push(grovePts)
    allPts.push(...grovePts)
    currentExisting = [...currentExisting, ...grovePts]
  }
  return { flat: allPts, groves }
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
const RANDOM_GROVE_RESULT = generateRandomGroves(
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
export const RANDOM_GROVE_POSITIONS = RANDOM_GROVE_RESULT.flat
/** Each sub-array is one grove – trees within a grove share the same type */
export const RANDOM_GROVES = RANDOM_GROVE_RESULT.groves

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

// Trees are handled separately so movement can block trunks, not full canopies.
// Trunk geometry uses ~0.25 max radius, so keep collider close to that size.
export const TREE_OBSTACLES: Obstacle[] = ALL_TREES.map(p => ({ position: p, radius: 0.28 }))
export const TREE_MAX_RADIUS = 0.28

// Flat list of all obstacles for steering avoidance
export const ALL_OBSTACLES: Obstacle[] = [
  ...TREE_OBSTACLES,
  ...STONE_POSITIONS.map(p => ({ position: p, radius: 0.8 })),
  ...BUSH_POSITIONS.map(p => ({ position: p, radius: 0.6 })),
]

const GRID_CELL_SIZE = 6
const GRID_INV_CELL_SIZE = 1 / GRID_CELL_SIZE

function gridKey(ix: number, iz: number): string {
  return `${ix},${iz}`
}

function gridIndex(v: number): number {
  return Math.floor(v * GRID_INV_CELL_SIZE)
}

function buildObstacleGrid(obstacles: Obstacle[]): Map<string, Obstacle[]> {
  const grid = new Map<string, Obstacle[]>()
  for (const obstacle of obstacles) {
    const ix = gridIndex(obstacle.position[0])
    const iz = gridIndex(obstacle.position[2])
    const key = gridKey(ix, iz)
    const bucket = grid.get(key)
    if (bucket) {
      bucket.push(obstacle)
    } else {
      grid.set(key, [obstacle])
    }
  }
  return grid
}

const OBSTACLE_GRID = buildObstacleGrid(ALL_OBSTACLES)
const TREE_GRID = buildObstacleGrid(TREE_OBSTACLES)

function forEachNearby(
  grid: Map<string, Obstacle[]>,
  x: number,
  z: number,
  searchRadius: number,
  visit: ObstacleVisitor,
): void {
  const minX = gridIndex(x - searchRadius)
  const maxX = gridIndex(x + searchRadius)
  const minZ = gridIndex(z - searchRadius)
  const maxZ = gridIndex(z + searchRadius)
  const searchRadiusSq = searchRadius * searchRadius

  for (let ix = minX; ix <= maxX; ix++) {
    for (let iz = minZ; iz <= maxZ; iz++) {
      const bucket = grid.get(gridKey(ix, iz))
      if (!bucket) continue

      for (const obstacle of bucket) {
        const dx = x - obstacle.position[0]
        const dz = z - obstacle.position[2]
        if (dx * dx + dz * dz <= searchRadiusSq) {
          visit(obstacle)
        }
      }
    }
  }
}

export function forEachNearbyObstacle(
  x: number,
  z: number,
  searchRadius: number,
  visit: ObstacleVisitor,
): void {
  forEachNearby(OBSTACLE_GRID, x, z, searchRadius, visit)
}

export function forEachNearbyTreeObstacle(
  x: number,
  z: number,
  searchRadius: number,
  visit: ObstacleVisitor,
): void {
  forEachNearby(TREE_GRID, x, z, searchRadius, visit)
}
