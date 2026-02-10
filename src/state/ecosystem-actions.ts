import type { Vector3Tuple } from 'three'
import type { RabbitState, FoxState, FlowerState, SimulationConfig, BehaviorState, WeatherType } from '../types/ecosystem.ts'

export type EcosystemAction =
  | { type: 'INIT'; config: SimulationConfig }
  | { type: 'TICK'; delta: number }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'SPAWN_RABBIT'; rabbit: RabbitState }
  | { type: 'REMOVE_RABBIT'; id: string }
  | { type: 'SPAWN_FOX'; fox: FoxState }
  | { type: 'REMOVE_FOX'; id: string }
  | { type: 'UPDATE_ENTITY_POSITION'; id: string; entityType: 'rabbit' | 'fox'; position: Vector3Tuple; velocity: Vector3Tuple }
  | { type: 'UPDATE_ENTITY_NEEDS'; id: string; entityType: 'rabbit' | 'fox'; hunger: number; thirst: number }
  | { type: 'UPDATE_ENTITY_BEHAVIOR'; id: string; entityType: 'rabbit' | 'fox'; behavior: BehaviorState }
  | { type: 'EAT_FLOWER'; flowerId: string; entityId: string }
  | { type: 'DRINK'; entityId: string; entityType: 'rabbit' | 'fox' }
  | { type: 'KILL_ENTITY'; id: string; entityType: 'rabbit' | 'fox' }
  | { type: 'SPAWN_FLOWER'; flower: FlowerState }
  | { type: 'RABBIT_MATE'; maleId: string; femaleId: string }
  | { type: 'FOX_MATE'; maleId: string; femaleId: string }
  | { type: 'SET_WEATHER'; weather: WeatherType; intensity: number; nextChangeAt: number }
  | { type: 'SET_TIME_OF_DAY'; timeOfDay: number }
  | { type: 'SET_SPEED'; speed: number }
  | { type: 'GAME_OVER' }
