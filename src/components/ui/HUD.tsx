import { useNavigate } from 'react-router'
import { useEcosystem, useEcosystemDispatch } from '../../state/ecosystem-context.tsx'
import { useDebug } from '../../state/debug-context.tsx'

export default function HUD() {
  const state = useEcosystem()
  const dispatch = useEcosystemDispatch()
  const navigate = useNavigate()
  const { showIntentions, setShowIntentions } = useDebug()

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="pointer-events-auto m-3 inline-flex flex-col gap-3 rounded-xl bg-black/40 p-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold text-white">Ecosystem</h1>
          <span className="text-xs text-white/50">
            {Math.floor(state.time)}s
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Stat label="Rabbits" value={state.rabbits.length} color="text-amber-300" />
          <Stat label="Foxes" value={state.foxes.length} color="text-orange-400" />
          <Stat label="Flowers" value={state.flowers.filter(f => f.alive).length} color="text-pink-300" />
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
            className="cursor-pointer rounded bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20"
          >
            {state.paused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={() => navigate('/')}
            className="cursor-pointer rounded bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20"
          >
            Back
          </button>
        </div>
      </div>
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
