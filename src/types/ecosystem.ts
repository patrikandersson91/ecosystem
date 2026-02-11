import type { Vector3Tuple } from 'three';

// ─── World Constants ────────────────────────────────────────
export const BASE_WORLD_SIZE = 50;
export const WORLD_SIZE = BASE_WORLD_SIZE * 4;
export const WORLD_SCALE = WORLD_SIZE / BASE_WORLD_SIZE;

// ─── Weather & Time Constants ───────────────────────────────
export const DAY_DURATION = 600; // seconds for a full day cycle
export const WEATHER_CHANGE_INTERVAL = 30; // seconds between possible weather changes
export const RAIN_CHANCE = 0.35; // probability of rain each weather roll

// ─── Entity Constants ───────────────────────────────────────
export const FLEE_RADIUS = 11;
export const AGGRO_RADIUS = 24;
export const MAX_SPEED_RABBIT = 3.4;
export const MAX_SPEED_FOX = 7.2;
export const MAX_SPEED_MOOSE = 2.3;
export const MAX_RABBITS = 200;
export const MAX_FOXES = 16;
export const HUNGER_RATE = 0.02;
export const THIRST_RATE = 0.01;
export const NEED_THRESHOLD = 0.3;
export const JUMP_HEIGHT = 0.6;
export const JUMP_FREQUENCY = 3;
export const MATE_RADIUS = 15;
export const MATING_COOLDOWN = 6;
export const FOX_MATE_RADIUS = 12;
export const FOX_MATING_COOLDOWN = 8;
export const FOX_HUNT_THRESHOLD = 0.92;
export const NIGHT_SIGHT_MULTIPLIER = 0.6;

/** Returns a 0.6–1.0 multiplier for sight/aggro radius based on time of day */
export function getSightMultiplier(timeOfDay: number): number {
  const t = timeOfDay;
  const MIN = NIGHT_SIGHT_MULTIPLIER;
  const RANGE = 1 - MIN;
  if (t < 0.08) return MIN; // night
  if (t < 0.16) return MIN + ((t - 0.08) / 0.08) * RANGE; // dawn → day
  if (t < 0.62) return 1.0; // day
  if (t < 0.82) return 1.0 - ((t - 0.62) / 0.2) * RANGE; // dusk → night
  return MIN; // night
}

// ─── Weather Types ──────────────────────────────────────────
export type WeatherType = 'sunny' | 'rainy';

export interface WeatherState {
  type: WeatherType;
  intensity: number; // 0-1, used for rain intensity
  nextChangeAt: number; // simulation time when weather may change
}

// ─── Types ──────────────────────────────────────────────────
export type EntityType = 'rabbit' | 'fox' | 'moose';

export type BehaviorState =
  | 'wandering'
  | 'seeking_food'
  | 'seeking_water'
  | 'fleeing'
  | 'chasing'
  | 'eating'
  | 'drinking'
  | 'seeking_mate';

// ─── Entity Interfaces ─────────────────────────────────────
export interface EntityState {
  id: string;
  type: EntityType;
  position: Vector3Tuple;
  velocity: Vector3Tuple;
  hunger: number;
  thirst: number;
  behavior: BehaviorState;
  alive: boolean;
}

export interface RabbitState extends EntityState {
  type: 'rabbit';
  jumpPhase: number;
  sex: 'male' | 'female';
  isAdult: boolean;
  pregnant: boolean;
  mealsEaten: number;
}

export interface FoxState extends EntityState {
  type: 'fox';
  targetId: string | null;
  sex: 'male' | 'female';
  pregnant: boolean;
  mealsWhilePregnant: number;
  isAdult: boolean;
}

export interface MooseState extends EntityState {
  type: 'moose';
}

// ─── World Interfaces ───────────────────────────────────────
export interface FlowerState {
  id: string;
  position: Vector3Tuple;
  alive: boolean;
}

export interface SimulationConfig {
  initialRabbits: number;
  initialFoxes: number;
  initialMoose: number;
  initialFlowers: number;
}

/** Time (seconds) when a species went extinct. Undefined = not yet extinct. */
export type Extinctions = {
  rabbits?: number;
  foxes?: number;
  flowers?: number;
};

export interface EcosystemState {
  rabbits: RabbitState[];
  foxes: FoxState[];
  moose: MooseState[];
  flowers: FlowerState[];
  time: number;
  paused: boolean;
  config: SimulationConfig;
  weather: WeatherState;
  timeOfDay: number; // 0-1 representing progress through the day cycle (0=dawn, 0.25=noon, 0.5=dusk, 0.75=midnight)
  speed: number; // simulation speed multiplier (0.5, 1, 2, 3)
  extinctions: Extinctions; // elapsed time when each species went extinct
}
