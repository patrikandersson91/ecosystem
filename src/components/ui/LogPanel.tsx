import { useRef } from 'react'
import { motion } from 'framer-motion'
import { useSimulationLog } from '../../state/simulation-log.tsx'
import PopulationGraph from './PopulationGraph.tsx'

interface LogPanelProps {
  onClose: () => void
}

export default function LogPanel({ onClose }: LogPanelProps) {
  const { snapshots, events, getFullLog } = useSimulationLog()
  const preRef = useRef<HTMLPreElement>(null)

  const handleCopy = () => {
    const text = getFullLog()
    navigator.clipboard.writeText(text)
  }

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="pointer-events-auto absolute right-0 top-0 bottom-0 flex w-1/2 flex-col bg-black/70 backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-bold text-white">Simulation Log</h2>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="cursor-pointer rounded bg-cyan-600 px-3 py-1 text-xs text-white hover:bg-cyan-500"
          >
            Copy All
          </button>
          <button
            onClick={onClose}
            className="cursor-pointer rounded bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20"
          >
            Close
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex min-h-0 flex-1">
        {/* Left column: Events */}
        <div className="flex w-[260px] shrink-0 flex-col border-r border-white/10">
          <div className="border-b border-white/10 px-3 py-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Events ({events.length})
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {events.length === 0 ? (
              <p className="text-xs text-white/30">No events yet...</p>
            ) : (
              <div className="space-y-0.5">
                {events.slice(-200).map((e, i) => {
                  const t = `${Math.floor(e.time / 60)}:${String(Math.floor(e.time % 60)).padStart(2, '0')}`
                  let color = 'text-white/60'
                  if (e.type === 'birth') color = 'text-green-400'
                  if (e.type === 'eaten' || e.type === 'starve_rabbit' || e.type === 'starve_fox' || e.type === 'starve_moose') color = 'text-red-400'
                  if (e.type === 'mate') color = 'text-pink-400'
                  if (e.type === 'game_over') color = 'text-red-500 font-bold'

                  return (
                    <div key={i} className={`text-[11px] leading-tight ${color}`}>
                      <span className="text-white/30 tabular-nums">[{t}]</span> {e.detail}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Graph + Snapshots */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-4">
          {/* Live population graph */}
          <PopulationGraph snapshots={snapshots} />

          {/* Snapshot table */}
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
            Population Snapshots (every 5s)
          </h3>
          {snapshots.length === 0 ? (
            <p className="mb-4 text-xs text-white/30">No data yet...</p>
          ) : (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-xs text-white/80">
                <thead>
                  <tr className="border-b border-white/10 text-left text-white/50">
                    <th className="pb-1 pr-3">Time</th>
                    <th className="pb-1 pr-3">Rab</th>
                    <th className="pb-1 pr-3">Fox</th>
                    <th className="pb-1 pr-3">Mse</th>
                    <th className="pb-1 pr-3">Flwr</th>
                    <th className="pb-1 pr-3">R.Hgr</th>
                    <th className="pb-1 pr-3">F.Hgr</th>
                    <th className="pb-1 pr-3">M.Hgr</th>
                    <th className="pb-1 pr-3">Born</th>
                    <th className="pb-1 pr-3">Strvd</th>
                    <th className="pb-1">Eaten</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((s, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-0.5 pr-3 tabular-nums">{Math.floor(s.time / 60)}:{String(s.time % 60).padStart(2, '0')}</td>
                      <td className="py-0.5 pr-3 tabular-nums text-amber-300">{s.rabbits}</td>
                      <td className="py-0.5 pr-3 tabular-nums text-orange-400">{s.foxes}</td>
                      <td className="py-0.5 pr-3 tabular-nums text-yellow-200">{s.moose}</td>
                      <td className="py-0.5 pr-3 tabular-nums text-pink-300">{s.flowers}</td>
                      <td className="py-0.5 pr-3 tabular-nums">{s.avgRabbitHunger.toFixed(2)}</td>
                      <td className="py-0.5 pr-3 tabular-nums">{s.avgFoxHunger.toFixed(2)}</td>
                      <td className="py-0.5 pr-3 tabular-nums">{s.avgMooseHunger.toFixed(2)}</td>
                      <td className="py-0.5 pr-3 tabular-nums text-green-400">+{s.births}</td>
                      <td className="py-0.5 pr-3 tabular-nums text-red-400">{s.starved}</td>
                      <td className="py-0.5 tabular-nums text-red-300">{s.eaten}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Hidden pre for full text */}
          <pre ref={preRef} className="hidden">{getFullLog()}</pre>
        </div>
      </div>
    </motion.div>
  )
}
