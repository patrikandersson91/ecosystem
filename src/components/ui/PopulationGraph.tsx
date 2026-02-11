import { useMemo } from 'react'
import type { LogSnapshot } from '../../state/simulation-log.tsx'

interface PopulationGraphProps {
  snapshots: LogSnapshot[]
}

const GRAPH_W = 800
const GRAPH_H = 180
const PAD = { top: 12, right: 12, bottom: 22, left: 36 }
const PLOT_W = GRAPH_W - PAD.left - PAD.right
const PLOT_H = GRAPH_H - PAD.top - PAD.bottom

interface Series {
  label: string
  color: string
  values: number[]
  latest: number
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function PopulationGraph({ snapshots }: PopulationGraphProps) {
  const { series, times, yMax, yTicks, xTicks } = useMemo(() => {
    if (snapshots.length === 0) {
      return { series: [], times: [], yMax: 1, yTicks: [], xTicks: [] }
    }

    const times = snapshots.map(s => s.time)

    const allSeries: Series[] = [
      { label: 'Rabbits', color: '#fbbf24', values: snapshots.map(s => s.rabbits), latest: snapshots[snapshots.length - 1].rabbits },
      { label: 'Foxes', color: '#fb923c', values: snapshots.map(s => s.foxes), latest: snapshots[snapshots.length - 1].foxes },
      { label: 'Flowers', color: '#f9a8d4', values: snapshots.map(s => s.flowers), latest: snapshots[snapshots.length - 1].flowers },
    ]

    let maxVal = 0
    for (const s of allSeries) {
      for (const v of s.values) {
        if (v > maxVal) maxVal = v
      }
    }
    const yMax = maxVal <= 10 ? 10 : Math.ceil(maxVal / 10) * 10

    const yStep = yMax <= 20 ? 5 : yMax <= 50 ? 10 : yMax <= 100 ? 20 : Math.ceil(yMax / 5 / 10) * 10
    const yTicks: number[] = []
    for (let v = 0; v <= yMax; v += yStep) yTicks.push(v)

    const tMin = times[0]
    const tMax = times[times.length - 1]
    const tRange = tMax - tMin
    const xStep = tRange <= 60 ? 10 : tRange <= 120 ? 15 : tRange <= 300 ? 30 : tRange <= 600 ? 60 : 120
    const xTicks: number[] = []
    const xStart = Math.ceil(tMin / xStep) * xStep
    for (let t = xStart; t <= tMax; t += xStep) xTicks.push(t)

    return { series: allSeries, times, yMax, yTicks, xTicks }
  }, [snapshots])

  if (snapshots.length < 2) {
    return (
      <div className="mb-3 flex h-[180px] items-center justify-center rounded border border-white/10 bg-white/5">
        <span className="text-xs text-white/30">Graph will appear after 10 seconds...</span>
      </div>
    )
  }

  const tMin = times[0]
  const tMax = times[times.length - 1]
  const tRange = tMax - tMin || 1

  function x(t: number) {
    return PAD.left + ((t - tMin) / tRange) * PLOT_W
  }
  function y(v: number) {
    return PAD.top + PLOT_H - (v / yMax) * PLOT_H
  }

  return (
    <div className="mb-3">
      {/* Legend with live values */}
      <div className="mb-1 flex gap-4 px-1">
        {series.map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className="h-2 w-3 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-[11px] text-white/60">{s.label}</span>
            <span className="text-[11px] font-medium tabular-nums" style={{ color: s.color }}>{s.latest}</span>
          </div>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}
        className="w-full rounded border border-white/10 bg-white/5"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {yTicks.map(v => (
          <g key={`y-${v}`}>
            <line
              x1={PAD.left}
              y1={y(v)}
              x2={GRAPH_W - PAD.right}
              y2={y(v)}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 4}
              y={y(v) + 3}
              textAnchor="end"
              fill="rgba(255,255,255,0.35)"
              fontSize={10}
              fontFamily="monospace"
            >
              {v}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {xTicks.map(t => (
          <g key={`x-${t}`}>
            <line
              x1={x(t)}
              y1={PAD.top}
              x2={x(t)}
              y2={PAD.top + PLOT_H}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1}
            />
            <text
              x={x(t)}
              y={GRAPH_H - 4}
              textAnchor="middle"
              fill="rgba(255,255,255,0.35)"
              fontSize={10}
              fontFamily="monospace"
            >
              {formatTime(t)}
            </text>
          </g>
        ))}

        {/* Data lines */}
        {series.map(s => {
          const points = s.values.map((v, i) => `${x(times[i])},${y(v)}`).join(' ')
          return (
            <g key={s.label}>
              <polygon
                points={`${x(times[0])},${y(0)} ${points} ${x(times[times.length - 1])},${y(0)}`}
                fill={s.color}
                opacity={0.07}
              />
              <polyline
                points={points}
                fill="none"
                stroke={s.color}
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
              <circle
                cx={x(times[times.length - 1])}
                cy={y(s.values[s.values.length - 1])}
                r={3}
                fill={s.color}
              />
            </g>
          )
        })}
      </svg>

      {/* Birth/Death mini bar row */}
      {snapshots.length > 1 && (
        <div className="mt-1 flex gap-3 px-1">
          <span className="text-[10px] text-white/30">Last 5s:</span>
          <span className="text-[10px] text-green-400">
            +{snapshots[snapshots.length - 1].births} born
          </span>
          <span className="text-[10px] text-red-400">
            -{snapshots[snapshots.length - 1].starved} starved
          </span>
          <span className="text-[10px] text-red-300">
            -{snapshots[snapshots.length - 1].eaten} eaten
          </span>
        </div>
      )}
    </div>
  )
}
