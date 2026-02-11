import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useEffect,
  useState,
} from 'react';
import type { ReactNode, Dispatch } from 'react';
import type {
  EcosystemState,
  Extinctions,
  RabbitState,
  FoxState,
  MooseState,
  FlowerState,
  SimulationConfig,
} from '../types/ecosystem.ts';
import type { EcosystemAction } from './ecosystem-actions.ts';
import {
  WORLD_SIZE,
  WORLD_SCALE,
  WEATHER_CHANGE_INTERVAL,
} from '../types/ecosystem.ts';
import { isInWater } from '../utils/river-path';
import { groundHeightAt } from '../utils/terrain-height.ts';
import { useSimulationLog } from './simulation-log.tsx';
import type { LogEvent } from './simulation-log.tsx';

// ─── Helpers ────────────────────────────────────────────────

const MAX_RABBITS = 200;
const FLOWER_MAX_SPAWN_HEIGHT = 18;
const UI_STATE_PUBLISH_INTERVAL_MS = 120;

let idCounter = 0;
function uid(prefix: string): string {
  return `${prefix}_${++idCounter}`;
}

function randomPosition(): [number, number, number] {
  const half = WORLD_SIZE * 0.9;
  let x: number, z: number;
  do {
    x = (Math.random() - 0.5) * half * 2;
    z = (Math.random() - 0.5) * half * 2;
  } while (isInWater(x, z, 1));
  return [x, 0, z];
}

export function randomFlowerPosition(): [number, number, number] {
  const half = WORLD_SIZE * 0.85;
  let x: number, z: number;
  do {
    x = (Math.random() - 0.5) * half * 2;
    z = (Math.random() - 0.5) * half * 2;
  } while (
    isInWater(x, z, 0.5) ||
    groundHeightAt(x, z) > FLOWER_MAX_SPAWN_HEIGHT
  );
  return [x, 0, z];
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
  }));
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
  }));
}

function generateMoose(count: number): MooseState[] {
  return Array.from({ length: count }, () => ({
    id: uid('moose'),
    type: 'moose' as const,
    position: randomPosition(),
    velocity: [0, 0, 0] as [number, number, number],
    hunger: 0.9,
    thirst: 0.9,
    behavior: 'wandering' as const,
    alive: true,
  }));
}

function generateFlowers(count: number): FlowerState[] {
  return Array.from({ length: count }, () => ({
    id: uid('flower'),
    position: randomFlowerPosition(),
    alive: true,
  }));
}

// ─── Reducer ────────────────────────────────────────────────

function ecosystemReducer(
  state: EcosystemState,
  action: EcosystemAction,
): EcosystemState {
  switch (action.type) {
    case 'INIT':
      return {
        ...state,
        config: action.config,
        rabbits: generateRabbits(
          Math.min(action.config.initialRabbits, MAX_RABBITS),
        ),
        foxes: generateFoxes(action.config.initialFoxes),
        moose: generateMoose(action.config.initialMoose),
        flowers: generateFlowers(action.config.initialFlowers),
        time: 0,
        paused: false,
        weather: {
          type: 'sunny',
          intensity: 0,
          nextChangeAt: WEATHER_CHANGE_INTERVAL,
        },
        timeOfDay: 0.15,
        speed: state.speed,
        extinctions: {},
      };

    case 'RECORD_EXTINCTION': {
      const key = action.species;
      if (state.extinctions[key] !== undefined) return state;
      return {
        ...state,
        extinctions: { ...state.extinctions, [key]: action.time },
      };
    }

    case 'TICK':
      return { ...state, time: state.time + action.delta };

    case 'ADVANCE_CLOCK':
      return {
        ...state,
        time: state.time + action.delta,
        timeOfDay: action.timeOfDay,
      };

    case 'TOGGLE_PAUSE':
      return { ...state, paused: !state.paused };

    case 'SPAWN_RABBIT':
      if (state.rabbits.length >= MAX_RABBITS) return state;
      return { ...state, rabbits: [...state.rabbits, action.rabbit] };

    case 'REMOVE_RABBIT':
      return {
        ...state,
        rabbits: state.rabbits.filter((r) => r.id !== action.id),
      };

    case 'SPAWN_FOX':
      return { ...state, foxes: [...state.foxes, action.fox] };

    case 'REMOVE_FOX':
      return { ...state, foxes: state.foxes.filter((f) => f.id !== action.id) };

    case 'SPAWN_MOOSE':
      return { ...state, moose: [...state.moose, action.moose] };

    case 'REMOVE_MOOSE':
      return { ...state, moose: state.moose.filter((m) => m.id !== action.id) };

    case 'UPDATE_ENTITY_POSITION':
      if (action.entityType === 'rabbit') {
        return {
          ...state,
          rabbits: state.rabbits.map((r) =>
            r.id === action.id
              ? { ...r, position: action.position, velocity: action.velocity }
              : r,
          ),
        };
      }
      return {
        ...state,
        ...(action.entityType === 'fox'
          ? {
              foxes: state.foxes.map((f) =>
                f.id === action.id
                  ? {
                      ...f,
                      position: action.position,
                      velocity: action.velocity,
                    }
                  : f,
              ),
            }
          : {
              moose: state.moose.map((m) =>
                m.id === action.id
                  ? {
                      ...m,
                      position: action.position,
                      velocity: action.velocity,
                    }
                  : m,
              ),
            }),
      };

    case 'UPDATE_ENTITY_NEEDS':
      if (action.entityType === 'rabbit') {
        return {
          ...state,
          rabbits: state.rabbits.map((r) =>
            r.id === action.id
              ? { ...r, hunger: action.hunger, thirst: action.thirst }
              : r,
          ),
        };
      }
      return {
        ...state,
        ...(action.entityType === 'fox'
          ? {
              foxes: state.foxes.map((f) =>
                f.id === action.id
                  ? { ...f, hunger: action.hunger, thirst: action.thirst }
                  : f,
              ),
            }
          : {
              moose: state.moose.map((m) =>
                m.id === action.id
                  ? { ...m, hunger: action.hunger, thirst: action.thirst }
                  : m,
              ),
            }),
      };

    case 'UPDATE_ENTITY_BEHAVIOR':
      if (action.entityType === 'rabbit') {
        return {
          ...state,
          rabbits: state.rabbits.map((r) =>
            r.id === action.id ? { ...r, behavior: action.behavior } : r,
          ),
        };
      }
      return {
        ...state,
        ...(action.entityType === 'fox'
          ? {
              foxes: state.foxes.map((f) =>
                f.id === action.id ? { ...f, behavior: action.behavior } : f,
              ),
            }
          : {
              moose: state.moose.map((m) =>
                m.id === action.id ? { ...m, behavior: action.behavior } : m,
              ),
            }),
      };

    case 'EAT_FLOWER': {
      return {
        ...state,
        flowers: state.flowers.filter((f) => f.id !== action.flowerId),
        rabbits: state.rabbits.map((r) => {
          if (r.id !== action.entityId) return r;
          const newMeals = r.mealsEaten + 1;
          return {
            ...r,
            hunger: Math.min(1, r.hunger + 0.5),
            behavior: 'eating' as const,
            pregnant: false,
            isAdult: r.isAdult || newMeals >= 2,
            mealsEaten: newMeals,
          };
        }),
        moose: state.moose.map((m) =>
          m.id === action.entityId
            ? {
                ...m,
                hunger: Math.min(1, m.hunger + 0.35),
                behavior: 'eating' as const,
              }
            : m,
        ),
      };
    }

    case 'DRINK':
      if (action.entityType === 'rabbit') {
        return {
          ...state,
          rabbits: state.rabbits.map((r) =>
            r.id === action.entityId
              ? {
                  ...r,
                  thirst: Math.min(1, r.thirst + 0.4),
                  behavior: 'drinking' as const,
                }
              : r,
          ),
        };
      }
      if (action.entityType === 'moose') {
        return {
          ...state,
          moose: state.moose.map((m) =>
            m.id === action.entityId
              ? {
                  ...m,
                  thirst: Math.min(1, m.thirst + 0.4),
                  behavior: 'drinking' as const,
                }
              : m,
          ),
        };
      }
      return {
        ...state,
        foxes: state.foxes.map((f) =>
          f.id === action.entityId
            ? {
                ...f,
                thirst: Math.min(1, f.thirst + 0.4),
                behavior: 'drinking' as const,
              }
            : f,
        ),
      };

    case 'KILL_ENTITY':
      if (action.entityType === 'rabbit') {
        return {
          ...state,
          rabbits: state.rabbits.filter((r) => r.id !== action.id),
        };
      }
      if (action.entityType === 'moose') {
        return {
          ...state,
          moose: state.moose.filter((m) => m.id !== action.id),
        };
      }
      return { ...state, foxes: state.foxes.filter((f) => f.id !== action.id) };

    case 'SPAWN_FLOWER':
      return { ...state, flowers: [...state.flowers, action.flower] };

    case 'RABBIT_MATE':
      return {
        ...state,
        rabbits: state.rabbits.map((r) => {
          if (r.id === action.femaleId) {
            return {
              ...r,
              pregnant: true,
              hunger: Math.max(0, r.hunger - 0.08),
            };
          }
          if (r.id === action.maleId) {
            return { ...r, hunger: Math.max(0, r.hunger - 0.08) };
          }
          return r;
        }),
      };

    case 'FOX_MATE':
      return {
        ...state,
        foxes: state.foxes.map((f) => {
          if (f.id === action.femaleId) {
            return {
              ...f,
              pregnant: true,
              mealsWhilePregnant: 0,
              hunger: Math.max(0, f.hunger - 0.1),
            };
          }
          if (f.id === action.maleId) {
            return { ...f, hunger: Math.max(0, f.hunger - 0.1) };
          }
          return f;
        }),
      };

    case 'FOX_PREGNANCY_MEAL':
      return {
        ...state,
        foxes: state.foxes.map((f) =>
          f.id === action.id
            ? {
                ...f,
                mealsWhilePregnant: action.mealsWhilePregnant,
                pregnant: action.pregnant,
              }
            : f,
        ),
      };

    case 'FOX_GROW_UP':
      return {
        ...state,
        foxes: state.foxes.map((f) =>
          f.id === action.id ? { ...f, isAdult: true } : f,
        ),
      };

    case 'SET_WEATHER':
      return {
        ...state,
        weather: {
          type: action.weather,
          intensity: action.intensity,
          nextChangeAt: action.nextChangeAt,
        },
      };

    case 'SET_TIME_OF_DAY':
      return { ...state, timeOfDay: action.timeOfDay };

    case 'SET_SPEED':
      return { ...state, speed: action.speed };

    default:
      return state;
  }
}

// ─── Initial State ──────────────────────────────────────────

const defaultConfig: SimulationConfig = {
  initialRabbits: 30,
  initialFoxes: 8,
  initialMoose: 3,
  initialFlowers: Math.floor(55 * WORLD_SCALE),
};

const initialState: EcosystemState = {
  rabbits: [],
  foxes: [],
  moose: [],
  flowers: [],
  time: 0,
  paused: false,
  config: defaultConfig,
  weather: {
    type: 'sunny',
    intensity: 0,
    nextChangeAt: WEATHER_CHANGE_INTERVAL,
  },
  timeOfDay: 0.15,
  speed: 1,
  extinctions: {},
};

export type EcosystemUIState = {
  time: number;
  timeOfDay: number;
  paused: boolean;
  speed: number;
  weatherType: EcosystemState['weather']['type'];
  config: SimulationConfig;
  rabbits: number;
  rabbitAdults: number;
  rabbitBabies: number;
  foxes: number;
  foxAdults: number;
  foxBabies: number;
  moose: number;
  aliveFlowers: number;
  extinctions: Extinctions;
};

function buildEcosystemUIState(state: EcosystemState): EcosystemUIState {
  const rabbitAdults = state.rabbits.filter((r) => r.isAdult).length;
  const foxAdults = state.foxes.filter((f) => f.isAdult).length;
  const aliveFlowers = state.flowers.filter((f) => f.alive).length;
  return {
    time: state.time,
    timeOfDay: state.timeOfDay,
    paused: state.paused,
    speed: state.speed,
    weatherType: state.weather.type,
    config: state.config,
    rabbits: state.rabbits.length,
    rabbitAdults,
    rabbitBabies: state.rabbits.length - rabbitAdults,
    foxes: state.foxes.length,
    foxAdults,
    foxBabies: state.foxes.length - foxAdults,
    moose: state.moose.length,
    aliveFlowers,
    extinctions: state.extinctions,
  };
}

function isSameEcosystemUIState(
  a: EcosystemUIState,
  b: EcosystemUIState,
): boolean {
  return (
    a.time === b.time &&
    a.timeOfDay === b.timeOfDay &&
    a.paused === b.paused &&
    a.speed === b.speed &&
    a.weatherType === b.weatherType &&
    a.config === b.config &&
    a.rabbits === b.rabbits &&
    a.rabbitAdults === b.rabbitAdults &&
    a.rabbitBabies === b.rabbitBabies &&
    a.foxes === b.foxes &&
    a.foxAdults === b.foxAdults &&
    a.foxBabies === b.foxBabies &&
    a.moose === b.moose &&
    a.aliveFlowers === b.aliveFlowers &&
    a.extinctions?.rabbits === b.extinctions?.rabbits &&
    a.extinctions?.foxes === b.extinctions?.foxes &&
    a.extinctions?.flowers === b.extinctions?.flowers
  );
}

// ─── Context ────────────────────────────────────────────────

const EcosystemContext = createContext<EcosystemState>(initialState);
const EcosystemUIContext = createContext<EcosystemUIState>(
  buildEcosystemUIState(initialState),
);
const EcosystemDispatchContext = createContext<Dispatch<EcosystemAction>>(
  () => {},
);

export function EcosystemProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(ecosystemReducer, initialState);
  const [uiState, setUiState] = useState<EcosystemUIState>(() =>
    buildEcosystemUIState(initialState),
  );
  const { recordEvent, recordSnapshot, reset } = useSimulationLog();
  const latestStateRef = useRef(state);

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const next = buildEcosystemUIState(latestStateRef.current);
      setUiState((prev) => (isSameEcosystemUIState(prev, next) ? prev : next));
    }, UI_STATE_PUBLISH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const dispatch: Dispatch<EcosystemAction> = useCallback(
    (action) => {
      rawDispatch(action);

      const latestState = latestStateRef.current;
      const t = latestState.time;
      let event: LogEvent | null = null;

      switch (action.type) {
        case 'INIT':
          reset();
          break;
        case 'SPAWN_RABBIT':
          if (latestState.rabbits.length < MAX_RABBITS) {
            event = {
              time: t,
              type: 'birth',
              detail: `Rabbit born (${action.rabbit.sex})`,
            };
          }
          break;
        case 'REMOVE_RABBIT':
          event = { time: t, type: 'eaten', detail: 'Rabbit eaten by fox' };
          break;
        case 'KILL_ENTITY':
          if (action.entityType === 'rabbit') {
            event = {
              time: t,
              type: 'starve_rabbit',
              detail: 'Rabbit starved',
            };
          } else if (action.entityType === 'moose') {
            event = { time: t, type: 'starve_moose', detail: 'Moose starved' };
          } else {
            event = { time: t, type: 'starve_fox', detail: 'Fox starved' };
          }
          break;
        case 'RABBIT_MATE':
          event = { time: t, type: 'mate', detail: 'Rabbits mated' };
          break;
        case 'SPAWN_FOX':
          event = {
            time: t,
            type: 'birth',
            detail: `Fox born (${action.fox.sex})`,
          };
          break;
        case 'FOX_MATE':
          event = { time: t, type: 'mate', detail: 'Foxes mated' };
          break;
        case 'RECORD_EXTINCTION': {
          const speciesLabel =
            action.species.charAt(0).toUpperCase() + action.species.slice(1);
          const m = Math.floor(action.time / 60);
          const s = Math.floor(action.time % 60);
          event = {
            time: t,
            type: 'extinction',
            detail: `${speciesLabel} went extinct at ${m}:${s.toString().padStart(2, '0')}`,
          };
          break;
        }
        case 'TICK':
        case 'ADVANCE_CLOCK':
          recordSnapshot(latestState);
          break;
      }

      if (event) recordEvent(event);
    },
    [recordEvent, recordSnapshot, reset],
  );

  return (
    <EcosystemContext value={state}>
      <EcosystemUIContext value={uiState}>
        <EcosystemDispatchContext value={dispatch}>
          {children}
        </EcosystemDispatchContext>
      </EcosystemUIContext>
    </EcosystemContext>
  );
}

export function useEcosystem(): EcosystemState {
  return useContext(EcosystemContext);
}

export function useEcosystemDispatch(): Dispatch<EcosystemAction> {
  return useContext(EcosystemDispatchContext);
}

export function useEcosystemUI(): EcosystemUIState {
  return useContext(EcosystemUIContext);
}
