import { useState } from 'react'
import { useEcosystem, useEcosystemDispatch } from '../../state/ecosystem-context.tsx'
import { useDebug } from '../../state/debug-context.tsx'
import LogPanel from './LogPanel.tsx'

const SPEED_OPTIONS = [0.5, 1, 2, 20]

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function HUD() {
  const state = useEcosystem()
  const dispatch = useEcosystemDispatch()
  const { showIntentions, setShowIntentions } = useDebug()
  const [showLog, setShowLog] = useState(false)
  const [dismissedGameOver, setDismissedGameOver] = useState(false)

  const aliveFlowers = state.flowers.filter(f => f.alive).length

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="pointer-events-auto m-3 inline-flex flex-col gap-3 rounded-xl bg-black/40 p-4 backdrop-blur-md">
        {/* Prominent timer */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-white">
            {formatTime(state.time)}
          </span>
          <span className="text-xs text-white/50">elapsed</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Stat label="Rabbits" value={state.rabbits.length} color="text-amber-300" />
          <Stat label="Foxes" value={state.foxes.length} color="text-orange-400" />
          <Stat label="Flowers" value={aliveFlowers} color="text-pink-300" />
        </div>

        {/* Speed control */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-white/60">Speed</span>
          <div className="flex gap-1">
            {SPEED_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => dispatch({ type: 'SET_SPEED', speed: s })}
                className={`cursor-pointer rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  state.speed === s
                    ? 'bg-cyan-500 text-white'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={showIntentions}
            onChange={e => setShowIntentions(e.target.checked)}
            className="accent-cyan-400"
          />
          <span className="text-xs text-white/80">Show intentions</span>
        </label>

        <div className="flex gap-2">
          <button
            onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })}
            disabled={state.gameOver}
            className="cursor-pointer rounded bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {state.paused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={() => setShowLog(v => !v)}
            className={`cursor-pointer rounded px-3 py-1 text-xs text-white transition-colors ${
              showLog ? 'bg-cyan-500' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            Log
          </button>
          <button
            onClick={() => {
              setDismissedGameOver(false)
              dispatch({ type: 'INIT', config: state.config })
            }}
            className="cursor-pointer rounded bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20"
          >
            Restart
          </button>
        </div>
      </div>

      {/* Log panel */}
      {showLog && <LogPanel onClose={() => setShowLog(false)} />}

      {/* Game Over overlay */}
      {state.gameOver && !dismissedGameOver && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-black/60 px-10 py-8 backdrop-blur-md">
            <h2 className="text-3xl font-bold text-red-400">Simulation Over</h2>
            <p className="text-sm text-white/70">
              {state.rabbits.length === 0 && 'All rabbits have perished.'}
              {state.foxes.length === 0 && 'All foxes have perished.'}
              {state.flowers.filter(f => f.alive).length === 0 && 'All flowers have wilted.'}
            </p>
            <p className="text-lg text-white/90">
              Survived for <span className="font-bold text-white">{formatTime(state.time)}</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDismissedGameOver(false)
                  dispatch({ type: 'INIT', config: state.config })
                }}
                className="cursor-pointer rounded-lg bg-cyan-600 px-5 py-2 text-sm font-medium text-white hover:bg-cyan-500"
              >
                Restart
              </button>
              <button
                onClick={() => {
                  setDismissedGameOver(true)
                  setShowLog(true)
                }}
                className="cursor-pointer rounded-lg bg-white/10 px-5 py-2 text-sm text-white hover:bg-white/20"
              >
                View Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-xs font-medium ${color}`}>{label}</span>
      <span className="text-sm font-bold text-white">{value}</span>
    </div>
  )
}
