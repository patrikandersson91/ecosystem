import { createContext, useContext, useRef, useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import type { EcosystemState } from '../types/ecosystem.ts'

export interface LogSnapshot {
  time: number
  rabbits: number
  foxes: number
  moose: number
  flowers: number
  avgRabbitHunger: number
  avgFoxHunger: number
  avgMooseHunger: number
  births: number    // since last snapshot
  starved: number   // since last snapshot
  eaten: number     // rabbits eaten by foxes since last snapshot
}

export interface LogEvent {
  time: number
  type: 'birth' | 'starve_rabbit' | 'starve_fox' | 'starve_moose' | 'eaten' | 'mate' | 'game_over'
  detail: string
}

interface SimulationLogState {
  snapshots: LogSnapshot[]
  events: LogEvent[]
  getFullLog: () => string
  reset: () => void
  recordSnapshot: (state: EcosystemState) => void
  recordEvent: (event: LogEvent) => void
}

const SimulationLogContext = createContext<SimulationLogState>({
  snapshots: [],
  events: [],
  getFullLog: () => '',
  reset: () => {},
  recordSnapshot: () => {},
  recordEvent: () => {},
})

const SNAPSHOT_INTERVAL = 5 // every 5 sim seconds

export function SimulationLogProvider({ children }: { children: ReactNode }) {
  const [snapshots, setSnapshots] = useState<LogSnapshot[]>([])
  const [events, setEvents] = useState<LogEvent[]>([])

  // Counters between snapshots
  const counters = useRef({ births: 0, starved: 0, eaten: 0 })
  const lastSnapshotTime = useRef(0)

  const reset = useCallback(() => {
    setSnapshots([])
    setEvents([])
    counters.current = { births: 0, starved: 0, eaten: 0 }
    lastSnapshotTime.current = 0
  }, [])

  const recordEvent = useCallback((event: LogEvent) => {
    setEvents(prev => [...prev, event])
    if (event.type === 'birth') counters.current.births++
    if (event.type === 'starve_rabbit' || event.type === 'starve_fox' || event.type === 'starve_moose') counters.current.starved++
    if (event.type === 'eaten') counters.current.eaten++
  }, [])

  const recordSnapshot = useCallback((state: EcosystemState) => {
    if (state.time - lastSnapshotTime.current < SNAPSHOT_INTERVAL) return
    lastSnapshotTime.current = state.time

    const avgRabbitHunger = state.rabbits.length > 0
      ? state.rabbits.reduce((sum, r) => sum + r.hunger, 0) / state.rabbits.length
      : 0
    const avgFoxHunger = state.foxes.length > 0
      ? state.foxes.reduce((sum, f) => sum + f.hunger, 0) / state.foxes.length
      : 0
    const avgMooseHunger = state.moose.length > 0
      ? state.moose.reduce((sum, m) => sum + m.hunger, 0) / state.moose.length
      : 0

    const snap: LogSnapshot = {
      time: Math.floor(state.time),
      rabbits: state.rabbits.length,
      foxes: state.foxes.length,
      moose: state.moose.length,
      flowers: state.flowers.filter(f => f.alive).length,
      avgRabbitHunger: Math.round(avgRabbitHunger * 100) / 100,
      avgFoxHunger: Math.round(avgFoxHunger * 100) / 100,
      avgMooseHunger: Math.round(avgMooseHunger * 100) / 100,
      births: counters.current.births,
      starved: counters.current.starved,
      eaten: counters.current.eaten,
    }
    setSnapshots(prev => [...prev, snap])
    counters.current = { births: 0, starved: 0, eaten: 0 }
  }, [])

  const getFullLog = useCallback(() => {
    const lines: string[] = []
    lines.push('=== ECOSYSTEM SIMULATION LOG ===')
    lines.push('')

    // Config summary from last snapshot
    if (snapshots.length > 0) {
      const last = snapshots[snapshots.length - 1]
      lines.push(`Duration: ${Math.floor(last.time / 60)}m ${last.time % 60}s`)
      lines.push(`Final: ${last.rabbits} rabbits, ${last.foxes} foxes, ${last.moose} moose, ${last.flowers} flowers`)
      lines.push('')
    }

    // Snapshot table
    lines.push('TIME  | RABBITS | FOXES | MOOSE | FLOWERS | AVG R.HUNGER | AVG F.HUNGER | AVG M.HUNGER | BIRTHS | STARVED | EATEN')
    lines.push('------|---------|-------|-------|---------|--------------|--------------|--------------|--------|---------|------')
    for (const s of snapshots) {
      lines.push(
        `${String(s.time).padStart(5)}` +
        ` | ${String(s.rabbits).padStart(7)}` +
        ` | ${String(s.foxes).padStart(5)}` +
        ` | ${String(s.moose).padStart(5)}` +
        ` | ${String(s.flowers).padStart(7)}` +
        ` | ${s.avgRabbitHunger.toFixed(2).padStart(12)}` +
        ` | ${s.avgFoxHunger.toFixed(2).padStart(12)}` +
        ` | ${s.avgMooseHunger.toFixed(2).padStart(12)}` +
        ` | ${String(s.births).padStart(6)}` +
        ` | ${String(s.starved).padStart(7)}` +
        ` | ${String(s.eaten).padStart(5)}`
      )
    }

    lines.push('')
    lines.push('--- EVENTS ---')
    for (const e of events) {
      const t = `${Math.floor(e.time / 60)}:${String(Math.floor(e.time % 60)).padStart(2, '0')}`
      lines.push(`[${t}] ${e.detail}`)
    }

    return lines.join('\n')
  }, [snapshots, events])

  return (
    <SimulationLogContext value={{ snapshots, events, getFullLog, reset, recordSnapshot, recordEvent }}>
      {children}
    </SimulationLogContext>
  )
}

export function useSimulationLog(): SimulationLogState {
  return useContext(SimulationLogContext)
}
