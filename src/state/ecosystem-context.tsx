import { createContext, useContext, useReducer, useCallback } from 'react'
import type { ReactNode, Dispatch } from 'react'
import type { EcosystemState, RabbitState, FoxState, FlowerState, SimulationConfig, WeatherState } from '../types/ecosystem.ts'
import type { EcosystemAction } from './ecosystem-actions.ts'
import { WORLD_SIZE, WEATHER_CHANGE_INTERVAL } from '../types/ecosystem.ts'
import { isInRiver } from '../utils/river-path'
import { useSimulationLog } from './simulation-log.tsx'
import type { LogEvent } from './simulation-log.tsx'

// ─── Helpers ────────────────────────────────────────────────

let idCounter = 0
function uid(prefix: string): string {
  return `${prefix}_${++idCounter}`
}

function randomPosition(): [number, number, number] {
  const half = WORLD_SIZE * 0.9
  let x: number, z: number
  do {
    x = (Math.random() - 0.5) * half * 2
    z = (Math.random() - 0.5) * half * 2
  } while (isInRiver(x, z, 1))
  return [x, 0, z]
}

export function randomFlowerPosition(): [number, number, number] {
  const half = WORLD_SIZE * 0.85
  let x: number, z: number
  do {
    x = (Math.random() - 0.5) * half * 2
    z = (Math.random() - 0.5) * half * 2
  } while (isInRiver(x, z, 0.5))
  return [x, 0, z]
}

function generateRabbits(count: number): RabbitState[] {
  return Array.from({ length: count }, (_, i) => ({
    id: uid('rabbit'),
    type: 'rabbit' as const,
    position: randomPosition(),
    velocity: [0, 0, 0] as [number, number, number],
    hunger: 0.5 + Math.random() * 0.5,
    thirst: 0.5 + Math.random() * 0.5,
    behavior: 'wandering' as const,
    alive: true,
    jumpPhase: Math.random() * Math.PI * 2,
    sex: (i % 2 === 0 ? 'male' : 'female') as 'male' | 'female',
    isAdult: true,
    pregnant: false,
    mealsEaten: 0,
  }))
}

function generateFoxes(count: number): FoxState[] {
  return Array.from({ length: count }, (_, i) => ({
    id: uid('fox'),
    type: 'fox' as const,
    position: randomPosition(),
    velocity: [0, 0, 0] as [number, number, number],
    hunger: 0.8 + Math.random() * 0.2,
    thirst: 0.5 + Math.random() * 0.5,
    behavior: 'wandering' as const,
    alive: true,
    targetId: null,
    sex: (i % 2 === 0 ? 'male' : 'female') as 'male' | 'female',
    pregnant: false,
    mealsWhilePregnant: 0,
    isAdult: true,
  }))
}

function generateFlowers(count: number): FlowerState[] {
  return Array.from({ length: count }, () => ({
    id: uid('flower'),
    position: randomFlowerPosition(),
    alive: true,
  }))
}

// ─── Reducer ────────────────────────────────────────────────

function ecosystemReducer(state: EcosystemState, action: EcosystemAction): EcosystemState {
  switch (action.type) {
    case 'INIT':
      return {
        ...state,
        config: action.config,
        rabbits: generateRabbits(action.config.initialRabbits),
        foxes: generateFoxes(action.config.initialFoxes),
        flowers: generateFlowers(action.config.initialFlowers),
        time: 0,
        paused: false,
        weather: { type: 'sunny', intensity: 0, nextChangeAt: WEATHER_CHANGE_INTERVAL },
        timeOfDay: 0.15,
        speed: state.speed,
        gameOver: false,
      }

    case 'TICK':
      return { ...state, time: state.time + action.delta }

    case 'TOGGLE_PAUSE':
      return { ...state, paused: !state.paused }

    case 'SPAWN_RABBIT':
      return { ...state, rabbits: [...state.rabbits, action.rabbit] }

    case 'REMOVE_RABBIT':
      return { ...state, rabbits: state.rabbits.filter(r => r.id !== action.id) }

    case 'SPAWN_FOX':
      return { ...state, foxes: [...state.foxes, action.fox] }

    case 'REMOVE_FOX':
      return { ...state, foxes: state.foxes.filter(f => f.id !== action.id) }

    case 'UPDATE_ENTITY_POSITION':
      if (action.entityType === 'rabbit') {
        return {
          ...state,
          rabbits: state.rabbits.map(r =>
            r.id === action.id ? { ...r, position: action.position, velocity: action.velocity } : r,
          ),
        }
      }
      return {
        ...state,
        foxes: state.foxes.map(f =>
          f.id === action.id ? { ...f, position: action.position, velocity: action.velocity } : f,
        ),
      }

    case 'UPDATE_ENTITY_NEEDS':
      if (action.entityType === 'rabbit') {
        return {
          ...state,
          rabbits: state.rabbits.map(r =>
            r.id === action.id ? { ...r, hunger: action.hunger, thirst: action.thirst } : r,
          ),
        }
      }
      return {
        ...state,
        foxes: state.foxes.map(f =>
          f.id === action.id ? { ...f, hunger: action.hunger, thirst: action.thirst } : f,
        ),
      }

    case 'UPDATE_ENTITY_BEHAVIOR':
      if (action.entityType === 'rabbit') {
        return {
          ...state,
          rabbits: state.rabbits.map(r =>
            r.id === action.id ? { ...r, behavior: action.behavior } : r,
          ),
        }
      }
      return {
        ...state,
        foxes: state.foxes.map(f =>
          f.id === action.id ? { ...f, behavior: action.behavior } : f,
        ),
      }

    case 'EAT_FLOWER': {
      return {
        ...state,
        flowers: state.flowers.filter(f => f.id !== action.flowerId),
        rabbits: state.rabbits.map(r => {
          if (r.id !== action.entityId) return r
          const newMeals = r.mealsEaten + 1
          return {
            ...r,
            hunger: Math.min(1, r.hunger + 0.6),
            behavior: 'eating' as const,
            pregnant: false,
            isAdult: r.isAdult || newMeals >= 2,
            mealsEaten: newMeals,
          }
        }),
      }
    }

    case 'DRINK':
      if (action.entityType === 'rabbit') {
        return {
          ...state,
          rabbits: state.rabbits.map(r =>
            r.id === action.entityId
              ? { ...r, thirst: Math.min(1, r.thirst + 0.4), behavior: 'drinking' as const }
              : r,
          ),
        }
      }
      return {
        ...state,
        foxes: state.foxes.map(f =>
          f.id === action.entityId
            ? { ...f, thirst: Math.min(1, f.thirst + 0.4), behavior: 'drinking' as const }
            : f,
        ),
      }

    case 'KILL_ENTITY':
      if (action.entityType === 'rabbit') {
        return { ...state, rabbits: state.rabbits.filter(r => r.id !== action.id) }
      }
      return { ...state, foxes: state.foxes.filter(f => f.id !== action.id) }

    case 'SPAWN_FLOWER':
      return { ...state, flowers: [...state.flowers, action.flower] }

    case 'RABBIT_MATE':
      return {
        ...state,
        rabbits: state.rabbits.map(r => {
          if (r.id === action.femaleId) {
            return { ...r, pregnant: true, hunger: Math.max(0, r.hunger - 0.08) }
          }
          if (r.id === action.maleId) {
            return { ...r, hunger: Math.max(0, r.hunger - 0.08) }
          }
          return r
        }),
      }

    case 'FOX_MATE':
      return {
        ...state,
        foxes: state.foxes.map(f => {
          if (f.id === action.femaleId) {
            return { ...f, pregnant: true, mealsWhilePregnant: 0, hunger: Math.max(0, f.hunger - 0.10) }
          }
          if (f.id === action.maleId) {
            return { ...f, hunger: Math.max(0, f.hunger - 0.10) }
          }
          return f
        }),
      }

    case 'FOX_PREGNANCY_MEAL':
      return {
        ...state,
        foxes: state.foxes.map(f =>
          f.id === action.id
            ? { ...f, mealsWhilePregnant: action.mealsWhilePregnant, pregnant: action.pregnant }
            : f,
        ),
      }

    case 'FOX_GROW_UP':
      return {
        ...state,
        foxes: state.foxes.map(f =>
          f.id === action.id ? { ...f, isAdult: true } : f,
        ),
      }

    case 'SET_WEATHER':
      return {
        ...state,
        weather: { type: action.weather, intensity: action.intensity, nextChangeAt: action.nextChangeAt },
      }

    case 'SET_TIME_OF_DAY':
      return { ...state, timeOfDay: action.timeOfDay }

    case 'SET_SPEED':
      return { ...state, speed: action.speed }

    case 'GAME_OVER':
      return { ...state, gameOver: true, paused: true }

    default:
      return state
  }
}

// ─── Initial State ──────────────────────────────────────────

const defaultConfig: SimulationConfig = {
  initialRabbits: 20,
  initialFoxes: 6,
  initialFlowers: 90,
}

const initialState: EcosystemState = {
  rabbits: [],
  foxes: [],
  flowers: [],
  time: 0,
  paused: false,
  config: defaultConfig,
  weather: { type: 'sunny', intensity: 0, nextChangeAt: WEATHER_CHANGE_INTERVAL },
  timeOfDay: 0.15,
  speed: 1,
  gameOver: false,
}

// ─── Context ────────────────────────────────────────────────

const EcosystemContext = createContext<EcosystemState>(initialState)
const EcosystemDispatchContext = createContext<Dispatch<EcosystemAction>>(() => {})

export function EcosystemProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(ecosystemReducer, initialState)
  const { recordEvent, recordSnapshot, reset } = useSimulationLog()

  const dispatch: Dispatch<EcosystemAction> = useCallback((action) => {
    rawDispatch(action)

    const t = state.time
    let event: LogEvent | null = null

    switch (action.type) {
      case 'INIT':
        reset()
        break
      case 'SPAWN_RABBIT':
        event = { time: t, type: 'birth', detail: `Rabbit born (${action.rabbit.sex})` }
        break
      case 'REMOVE_RABBIT':
        event = { time: t, type: 'eaten', detail: 'Rabbit eaten by fox' }
        break
      case 'KILL_ENTITY':
        if (action.entityType === 'rabbit') {
          event = { time: t, type: 'starve_rabbit', detail: 'Rabbit starved' }
        } else {
          event = { time: t, type: 'starve_fox', detail: 'Fox starved' }
        }
        break
      case 'RABBIT_MATE':
        event = { time: t, type: 'mate', detail: 'Rabbits mated' }
        break
      case 'SPAWN_FOX':
        event = { time: t, type: 'birth', detail: `Fox born (${action.fox.sex})` }
        break
      case 'FOX_MATE':
        event = { time: t, type: 'mate', detail: 'Foxes mated' }
        break
      case 'GAME_OVER':
        event = { time: t, type: 'game_over', detail: 'Simulation ended — a population reached 0' }
        break
      case 'TICK':
        recordSnapshot(state)
        break
    }

    if (event) recordEvent(event)
  }, [state.time, recordEvent, recordSnapshot, reset])

  return (
    <EcosystemContext value={state}>
      <EcosystemDispatchContext value={dispatch}>
        {children}
      </EcosystemDispatchContext>
    </EcosystemContext>
  )
}

export function useEcosystem(): EcosystemState {
  return useContext(EcosystemContext)
}

export function useEcosystemDispatch(): Dispatch<EcosystemAction> {
  return useContext(EcosystemDispatchContext)
}
