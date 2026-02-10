import { useRef, useCallback } from 'react'
import { useEcosystem, useEcosystemDispatch } from '../../state/ecosystem-context.tsx'

function getTimeLabel(t: number): string {
  const hours = ((t * 24) + 6) % 24
  const h = Math.floor(hours)
  const m = Math.floor((hours - h) * 60)
  const period = h >= 12 ? 'PM' : 'AM'
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`
}

function getPeriodLabel(t: number): string {
  if (t < 0.08) return 'Night'
  if (t < 0.18) return 'Dawn'
  if (t < 0.3) return 'Morning'
  if (t < 0.5) return 'Noon'
  if (t < 0.6) return 'Afternoon'
  if (t < 0.7) return 'Dusk'
  return 'Night'
}

function getWeatherIcon(weather: string): string {
  return weather === 'rainy' ? '\u2602' : '\u2600'
}

export default function Timeline() {
  const state = useEcosystem()
  const dispatch = useEcosystemDispatch()
  const t = state.timeOfDay
  const isNight = t > 0.7 || t < 0.08

  const barRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const wasPausedBeforeDrag = useRef(false)

  const setTimeFromPointer = useCallback((clientX: number) => {
    const bar = barRef.current
    if (!bar) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    dispatch({ type: 'SET_TIME_OF_DAY', timeOfDay: ratio })
  }, [dispatch])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true
    wasPausedBeforeDrag.current = state.paused
    if (!state.paused) dispatch({ type: 'TOGGLE_PAUSE' })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setTimeFromPointer(e.clientX)
  }, [setTimeFromPointer, state.paused, dispatch])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    setTimeFromPointer(e.clientX)
  }, [setTimeFromPointer])

  const onPointerUp = useCallback(() => {
    if (dragging.current && !wasPausedBeforeDrag.current) {
      dispatch({ type: 'TOGGLE_PAUSE' })
    }
    dragging.current = false
  }, [dispatch])

  return (
    <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center pt-3 gap-1.5">
      {/* Time label */}
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/40 px-4 py-1.5 backdrop-blur-md">
        <span className="text-base" style={{ filter: state.weather.type === 'rainy' ? 'none' : 'drop-shadow(0 0 4px rgba(255,200,50,0.6))' }}>
          {getWeatherIcon(state.weather.type)}
        </span>
        <span className="text-sm font-bold text-white tabular-nums">
          {getTimeLabel(t)}
        </span>
        <span className="text-xs text-white/50">
          {getPeriodLabel(t)}
        </span>
      </div>

      {/* Timeline bar - draggable */}
      <div
        ref={barRef}
        className="pointer-events-auto relative w-72 h-5 rounded-full bg-black/30 backdrop-blur-md overflow-hidden border border-white/10 cursor-pointer select-none touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Gradient background representing day cycle */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: 'linear-gradient(to right, #1a1a40 0%, #ff9966 10%, #87ceeb 25%, #5ba3d9 45%, #87ceeb 55%, #fd7e50 65%, #1a1a40 75%, #0a1628 100%)',
          }}
        />

        {/* Tick marks for key times */}
        <div className="absolute inset-0 flex items-end justify-between px-1 pb-0.5 pointer-events-none">
          {[0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].map((tick) => (
            <div key={tick} className="w-px h-1.5 bg-white/30" />
          ))}
        </div>

        {/* Current time indicator */}
        <div
          className="absolute top-0 h-full flex items-center pointer-events-none"
          style={{
            left: `${t * 100}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="relative">
            <div
              className="w-4 h-4 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[8px]"
              style={{
                backgroundColor: isNight ? '#c0c8e0' : '#ffdd44',
                boxShadow: isNight
                  ? '0 0 8px rgba(192,200,224,0.6)'
                  : '0 0 8px rgba(255,221,68,0.8)',
              }}
            >
              {isNight ? '\u263E' : '\u2600'}
            </div>
          </div>
        </div>
      </div>

      {/* Time labels under the bar */}
      <div className="flex justify-between w-72 px-1 pointer-events-none">
        <span className="text-[9px] text-white/40">12AM</span>
        <span className="text-[9px] text-white/40">6AM</span>
        <span className="text-[9px] text-white/40">12PM</span>
        <span className="text-[9px] text-white/40">6PM</span>
        <span className="text-[9px] text-white/40">12AM</span>
      </div>
    </div>
  )
}
