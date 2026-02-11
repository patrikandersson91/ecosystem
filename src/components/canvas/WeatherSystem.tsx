import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, Vector3 } from 'three'
import { Sky } from '@react-three/drei'
import type { DirectionalLight, AmbientLight } from 'three'
import { useEcosystem, useEcosystemDispatch } from '../../state/ecosystem-context.tsx'
import {
  DAY_DURATION,
  WORLD_SIZE,
} from '../../types/ecosystem.ts'
import SkyLife from './SkyLife.tsx'

// Color palettes for different times of day
const SKY_COLORS = {
  dawn: new Color('#ff9966'),
  morning: new Color('#87ceeb'),
  noon: new Color('#5ba3d9'),
  afternoon: new Color('#87ceeb'),
  dusk: new Color('#fd7e50'),
  night: new Color('#0a1628'),
}

const FOG_COLORS = {
  dawn: new Color('#ffc8a0'),
  day: new Color('#a8d5e2'),
  dusk: new Color('#e89070'),
  night: new Color('#101830'),
}

const AMBIENT_COLORS = {
  dawn: new Color('#ffb080'),
  day: new Color('#ffffff'),
  dusk: new Color('#ff9060'),
  night: new Color('#2040a0'),
}

const SUN_COLORS = {
  dawn: new Color('#ff8844'),
  day: new Color('#fffff0'),
  dusk: new Color('#ff6622'),
  night: new Color('#2244aa'),
}

const UI_CLOCK_SYNC_INTERVAL = 0.12

function lerpColor(a: Color, b: Color, t: number, out: Color): Color {
  out.r = a.r + (b.r - a.r) * t
  out.g = a.g + (b.g - a.g) * t
  out.b = a.b + (b.b - a.b) * t
  return out
}

// Get sky color based on time of day (0-1)
function getSkyColor(t: number, out: Color): Color {
  if (t < 0.08) {
    // night -> dawn
    return lerpColor(SKY_COLORS.night, SKY_COLORS.dawn, t / 0.08, out)
  } else if (t < 0.14) {
    // dawn -> morning
    return lerpColor(SKY_COLORS.dawn, SKY_COLORS.morning, (t - 0.08) / 0.06, out)
  } else if (t < 0.22) {
    // morning -> noon
    return lerpColor(SKY_COLORS.morning, SKY_COLORS.noon, (t - 0.14) / 0.08, out)
  } else if (t < 0.5) {
    // noon
    out.copy(SKY_COLORS.noon)
    return out
  } else if (t < 0.62) {
    // noon -> afternoon
    return lerpColor(SKY_COLORS.noon, SKY_COLORS.afternoon, (t - 0.5) / 0.12, out)
  } else if (t < 0.72) {
    // afternoon -> dusk
    return lerpColor(SKY_COLORS.afternoon, SKY_COLORS.dusk, (t - 0.62) / 0.1, out)
  } else if (t < 0.82) {
    // dusk -> night
    return lerpColor(SKY_COLORS.dusk, SKY_COLORS.night, (t - 0.72) / 0.1, out)
  } else {
    // night
    out.copy(SKY_COLORS.night)
    return out
  }
}

function getFogColor(t: number, out: Color): Color {
  if (t < 0.1) {
    return lerpColor(FOG_COLORS.night, FOG_COLORS.dawn, t / 0.1, out)
  } else if (t < 0.2) {
    return lerpColor(FOG_COLORS.dawn, FOG_COLORS.day, (t - 0.1) / 0.1, out)
  } else if (t < 0.62) {
    out.copy(FOG_COLORS.day)
    return out
  } else if (t < 0.72) {
    return lerpColor(FOG_COLORS.day, FOG_COLORS.dusk, (t - 0.62) / 0.1, out)
  } else if (t < 0.82) {
    return lerpColor(FOG_COLORS.dusk, FOG_COLORS.night, (t - 0.72) / 0.1, out)
  } else {
    out.copy(FOG_COLORS.night)
    return out
  }
}

function getAmbientColor(t: number, out: Color): Color {
  if (t < 0.1) {
    return lerpColor(AMBIENT_COLORS.night, AMBIENT_COLORS.dawn, t / 0.1, out)
  } else if (t < 0.2) {
    return lerpColor(AMBIENT_COLORS.dawn, AMBIENT_COLORS.day, (t - 0.1) / 0.1, out)
  } else if (t < 0.62) {
    out.copy(AMBIENT_COLORS.day)
    return out
  } else if (t < 0.72) {
    return lerpColor(AMBIENT_COLORS.day, AMBIENT_COLORS.dusk, (t - 0.62) / 0.1, out)
  } else if (t < 0.82) {
    return lerpColor(AMBIENT_COLORS.dusk, AMBIENT_COLORS.night, (t - 0.72) / 0.1, out)
  } else {
    out.copy(AMBIENT_COLORS.night)
    return out
  }
}

function getSunColor(t: number, out: Color): Color {
  if (t < 0.1) {
    return lerpColor(SUN_COLORS.night, SUN_COLORS.dawn, t / 0.1, out)
  } else if (t < 0.2) {
    return lerpColor(SUN_COLORS.dawn, SUN_COLORS.day, (t - 0.1) / 0.1, out)
  } else if (t < 0.62) {
    out.copy(SUN_COLORS.day)
    return out
  } else if (t < 0.72) {
    return lerpColor(SUN_COLORS.day, SUN_COLORS.dusk, (t - 0.62) / 0.1, out)
  } else if (t < 0.82) {
    return lerpColor(SUN_COLORS.dusk, SUN_COLORS.night, (t - 0.72) / 0.1, out)
  } else {
    out.copy(SUN_COLORS.night)
    return out
  }
}

function getAmbientIntensity(t: number): number {
  // Night: 0.24, Dawn/Dusk: 0.5, Day: 0.74
  if (t < 0.08) return 0.24 + (t / 0.08) * 0.26
  if (t < 0.16) return 0.5 + ((t - 0.08) / 0.08) * 0.24
  if (t < 0.62) return 0.74
  if (t < 0.72) return 0.74 - ((t - 0.62) / 0.1) * 0.24
  if (t < 0.82) return 0.5 - ((t - 0.72) / 0.1) * 0.26
  return 0.24
}

function getSunIntensity(t: number): number {
  // Night: 0.18, Dawn/Dusk: 0.95, Day: 1.55
  if (t < 0.08) return 0.18 + (t / 0.08) * 0.77
  if (t < 0.16) return 0.95 + ((t - 0.08) / 0.08) * 0.6
  if (t < 0.62) return 1.55
  if (t < 0.72) return 1.55 - ((t - 0.62) / 0.1) * 0.6
  if (t < 0.82) return 0.95 - ((t - 0.72) / 0.1) * 0.77
  return 0.18
}

export default function WeatherSystem() {
  const state = useEcosystem()
  const dispatch = useEcosystemDispatch()
  const { scene } = useThree()

  const sunRef = useRef<DirectionalLight>(null!)
  const ambientRef = useRef<AmbientLight>(null!)
  const skyRef = useRef<any>(null)

  const sunPos = useMemo(() => new Vector3(), [])
  const tempColor = useMemo(() => new Color(), [])
  const simTimeRef = useRef(state.time)
  const timeOfDayRef = useRef(state.timeOfDay)
  const uiSyncTimerRef = useRef(0)
  const pendingTickDeltaRef = useRef(0)

  useEffect(() => {
    simTimeRef.current = state.time
  }, [state.time])

  useEffect(() => {
    timeOfDayRef.current = state.timeOfDay
  }, [state.timeOfDay])

  useFrame((_, rawDelta) => {
    if (state.paused) return

    const delta = rawDelta * state.speed
    simTimeRef.current += delta
    timeOfDayRef.current = (timeOfDayRef.current + delta / DAY_DURATION) % 1
    pendingTickDeltaRef.current += delta
    uiSyncTimerRef.current += delta

    // Publish throttled clock updates to React state.
    if (uiSyncTimerRef.current >= UI_CLOCK_SYNC_INTERVAL) {
      dispatch({
        type: 'ADVANCE_CLOCK',
        delta: pendingTickDeltaRef.current,
        timeOfDay: timeOfDayRef.current,
      })
      uiSyncTimerRef.current = 0
      pendingTickDeltaRef.current = 0
    }

    const t = timeOfDayRef.current

    const rainDim = 1.0

    // Sun position - realistic east-to-west arc
    // t=0.08 sunrise (east), t~0.35 noon (top), t=0.72 sunset (west)
    // Map daytime portion to a 0-PI arc, nighttime sun goes below horizon
    const dayStart = 0.08
    const dayEnd = 0.72
    const isDay = t >= dayStart && t <= dayEnd
    if (isDay) {
      const dayProgress = (t - dayStart) / (dayEnd - dayStart) // 0→1 across daytime
      const sunArc = dayProgress * Math.PI // 0→PI, east to west
      sunPos.set(
        -Math.cos(sunArc) * 40,   // east(-40) → west(+40)
        Math.sin(sunArc) * 35 + 2, // rises to 37 at noon, 2 at horizon
        -15,                        // slightly south for angled shadows
      )
    } else {
      // Below horizon at night
      sunPos.set(0, -20, -15)
    }
    sunRef.current.position.copy(sunPos)
    sunRef.current.target.position.set(0, 0, 0)
    sunRef.current.target.updateMatrixWorld()

    if (skyRef.current?.material?.uniforms) {
      const uniforms = skyRef.current.material.uniforms
      uniforms.sunPosition.value.copy(sunPos)
      uniforms.rayleigh.value = isDay ? 2.2 : 0.52
      uniforms.turbidity.value = isDay ? 8.5 : 11
      uniforms.mieCoefficient.value = 0.005
      uniforms.mieDirectionalG.value = 0.84
    }

    // Sun intensity & color
    const sunIntensity = getSunIntensity(t) * rainDim
    sunRef.current.intensity = sunIntensity
    getSunColor(t, tempColor)
    sunRef.current.color.copy(tempColor)

    // Ambient
    ambientRef.current.intensity = getAmbientIntensity(t)
    getAmbientColor(t, tempColor)
    ambientRef.current.color.copy(tempColor)

    // Sky color
    getSkyColor(t, tempColor)
    scene.background = tempColor

    // Fog
    getFogColor(t, tempColor)
    if (scene.fog && 'color' in scene.fog) {
      (scene.fog as any).color.copy(tempColor)
      // Keep fog subtle so far-away terrain remains visible.
      const isNight = t > 0.72 || t < 0.08
      ;(scene.fog as any).near = isNight ? WORLD_SIZE * 1.2 : WORLD_SIZE * 1.6
      ;(scene.fog as any).far = isNight ? WORLD_SIZE * 3.2 : WORLD_SIZE * 4.2
    }
  })

  return (
    <>
      <Sky
        ref={skyRef}
        distance={WORLD_SIZE * 8}
        sunPosition={[0, 1, 0]}
        turbidity={8.5}
        rayleigh={2.2}
        mieCoefficient={0.005}
        mieDirectionalG={0.84}
      />
      <SkyLife />
      <ambientLight ref={ambientRef} intensity={0.5} />
      <directionalLight
        ref={sunRef}
        position={[15, 35, -15]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={120}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
      />
      <fog attach="fog" args={['#a8d5e2', WORLD_SIZE * 1.6, WORLD_SIZE * 4.2]} />
    </>
  )
}
