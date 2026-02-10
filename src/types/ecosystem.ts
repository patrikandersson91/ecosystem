import type { Vector3Tuple } from 'three'

// ─── World Constants ────────────────────────────────────────
export const WORLD_SIZE = 50

// ─── Weather & Time Constants ───────────────────────────────
export const DAY_DURATION = 300 // seconds for a full day cycle
export const WEATHER_CHANGE_INTERVAL = 30 // seconds between possible weather changes
export const RAIN_CHANCE = 0.35 // probability of rain each weather roll

// ─── Entity Constants ───────────────────────────────────────
export const FLEE_RADIUS = 10
export const AGGRO_RADIUS = 12
export const MAX_SPEED_RABBIT = 3.2
export const MAX_SPEED_FOX = 4
export const HUNGER_RATE = 0.02
export const THIRST_RATE = 0.03
export const NEED_THRESHOLD = 0.3
export const JUMP_HEIGHT = 0.6
export const JUMP_FREQUENCY = 3
export const MATE_RADIUS = 15
export const MATING_COOLDOWN = 8
export const NIGHT_SIGHT_MULTIPLIER = 0.4

/** Returns a 0.4–1.0 multiplier for sight/aggro radius based on time of day */
export function getSightMultiplier(timeOfDay: number): number {
  const t = timeOfDay
  const MIN = NIGHT_SIGHT_MULTIPLIER
  const RANGE = 1 - MIN
  if (t < 0.1) return MIN                                        // night
  if (t < 0.2) return MIN + ((t - 0.1) / 0.1) * RANGE           // dawn → day
  if (t < 0.55) return 1.0                                       // day
  if (t < 0.75) return 1.0 - ((t - 0.55) / 0.2) * RANGE         // dusk → night
  return MIN                                                      // night
}

// ─── Weather Types ──────────────────────────────────────────
export type WeatherType = 'sunny' | 'rainy'

export interface WeatherState {
  type: WeatherType
  intensity: number // 0-1, used for rain intensity
  nextChangeAt: number // simulation time when weather may change
}

// ─── Types ──────────────────────────────────────────────────
export type EntityType = 'rabbit' | 'fox'

export type BehaviorState =
  | 'wandering'
  | 'seeking_food'
  | 'seeking_water'
  | 'fleeing'
  | 'chasing'
  | 'eating'
  | 'drinking'
  | 'seeking_mate'

// ─── Entity Interfaces ─────────────────────────────────────
export interface EntityState {
  id: string
  type: EntityType
  position: Vector3Tuple
  velocity: Vector3Tuple
  hunger: number
  thirst: number
  behavior: BehaviorState
  alive: boolean
}

export interface RabbitState extends EntityState {
  type: 'rabbit'
  jumpPhase: number
  sex: 'male' | 'female'
  isAdult: boolean
  pregnant: boolean
  mealsEaten: number
}

export interface FoxState extends EntityState {
  type: 'fox'
  targetId: string | null
}

// ─── World Interfaces ───────────────────────────────────────
export interface FlowerState {
  id: string
  position: Vector3Tuple
  alive: boolean
}

export interface SimulationConfig {
  initialRabbits: number
  initialFoxes: number
  initialFlowers: number
}

export interface EcosystemState {
  rabbits: RabbitState[]
  foxes: FoxState[]
  flowers: FlowerState[]
  time: number
  paused: boolean
  config: SimulationConfig
  weather: WeatherState
  timeOfDay: number // 0-1 representing progress through the day cycle (0=dawn, 0.25=noon, 0.5=dusk, 0.75=midnight)
  speed: number // simulation speed multiplier (0.5, 1, 2, 3)
  gameOver: boolean // true when any population reaches 0
}
