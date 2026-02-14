import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

const FPS_WINDOW = 60
const LOW_FPS_THRESHOLD = 40
const HIGH_FPS_THRESHOLD = 55
const COOLDOWN = 3
const MIN_DPR = 1.0
const MAX_DPR = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1.5, 1.5)
const DPR_DOWN_STEP = 0.25
const DPR_UP_STEP = 0.1
const SUSTAIN_TIME = 2

export default function AdaptivePerformance() {
  const gl = useThree((s) => s.gl)
  const deltas = useRef(new Float32Array(FPS_WINDOW))
  const idx = useRef(0)
  const filled = useRef(false)
  const cooldown = useRef(0)
  const lowTimer = useRef(0)
  const highTimer = useRef(0)
  const currentDpr = useRef(gl.getPixelRatio())

  useFrame((_, delta) => {
    deltas.current[idx.current] = delta
    idx.current = (idx.current + 1) % FPS_WINDOW
    if (idx.current === 0) filled.current = true

    if (!filled.current) return

    if (cooldown.current > 0) {
      cooldown.current -= delta
      return
    }

    let sum = 0
    for (let i = 0; i < FPS_WINDOW; i++) sum += deltas.current[i]
    const avgFps = FPS_WINDOW / sum

    if (avgFps < LOW_FPS_THRESHOLD) {
      lowTimer.current += delta
      highTimer.current = 0
      if (lowTimer.current > SUSTAIN_TIME) {
        const newDpr = Math.max(MIN_DPR, currentDpr.current - DPR_DOWN_STEP)
        if (newDpr !== currentDpr.current) {
          currentDpr.current = newDpr
          gl.setPixelRatio(newDpr)
        }
        cooldown.current = COOLDOWN
        lowTimer.current = 0
      }
    } else if (avgFps > HIGH_FPS_THRESHOLD) {
      highTimer.current += delta
      lowTimer.current = 0
      if (highTimer.current > SUSTAIN_TIME) {
        const newDpr = Math.min(MAX_DPR, currentDpr.current + DPR_UP_STEP)
        if (newDpr !== currentDpr.current) {
          currentDpr.current = newDpr
          gl.setPixelRatio(newDpr)
        }
        cooldown.current = COOLDOWN
        highTimer.current = 0
      }
    } else {
      lowTimer.current = 0
      highTimer.current = 0
    }
  })

  return null
}
