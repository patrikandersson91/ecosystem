import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, Vector3 } from 'three'
import type { DirectionalLight, AmbientLight } from 'three'
import { useEcosystem, useEcosystemDispatch } from '../../state/ecosystem-context.tsx'
import {
  DAY_DURATION,
  WEATHER_CHANGE_INTERVAL,
  RAIN_CHANCE,
} from '../../types/ecosystem.ts'

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

function lerpColor(a: Color, b: Color, t: number, out: Color): Color {
  out.r = a.r + (b.r - a.r) * t
  out.g = a.g + (b.g - a.g) * t
  out.b = a.b + (b.b - a.b) * t
  return out
}

// Get sky color based on time of day (0-1)
function getSkyColor(t: number, out: Color): Color {
  if (t < 0.1) {
    // night -> dawn
    return lerpColor(SKY_COLORS.night, SKY_COLORS.dawn, t / 0.1, out)
  } else if (t < 0.2) {
    // dawn -> morning
    return lerpColor(SKY_COLORS.dawn, SKY_COLORS.morning, (t - 0.1) / 0.1, out)
  } else if (t < 0.3) {
    // morning -> noon
    return lerpColor(SKY_COLORS.morning, SKY_COLORS.noon, (t - 0.2) / 0.1, out)
  } else if (t < 0.45) {
    // noon
    out.copy(SKY_COLORS.noon)
    return out
  } else if (t < 0.55) {
    // noon -> afternoon
    return lerpColor(SKY_COLORS.noon, SKY_COLORS.afternoon, (t - 0.45) / 0.1, out)
  } else if (t < 0.65) {
    // afternoon -> dusk
    return lerpColor(SKY_COLORS.afternoon, SKY_COLORS.dusk, (t - 0.55) / 0.1, out)
  } else if (t < 0.75) {
    // dusk -> night
    return lerpColor(SKY_COLORS.dusk, SKY_COLORS.night, (t - 0.65) / 0.1, out)
  } else {
    // night
    out.copy(SKY_COLORS.night)
    return out
  }
}

function getFogColor(t: number, out: Color): Color {
  if (t < 0.15) {
    return lerpColor(FOG_COLORS.night, FOG_COLORS.dawn, t / 0.15, out)
  } else if (t < 0.25) {
    return lerpColor(FOG_COLORS.dawn, FOG_COLORS.day, (t - 0.15) / 0.1, out)
  } else if (t < 0.55) {
    out.copy(FOG_COLORS.day)
    return out
  } else if (t < 0.65) {
    return lerpColor(FOG_COLORS.day, FOG_COLORS.dusk, (t - 0.55) / 0.1, out)
  } else if (t < 0.75) {
    return lerpColor(FOG_COLORS.dusk, FOG_COLORS.night, (t - 0.65) / 0.1, out)
  } else {
    out.copy(FOG_COLORS.night)
    return out
  }
}

function getAmbientColor(t: number, out: Color): Color {
  if (t < 0.15) {
    return lerpColor(AMBIENT_COLORS.night, AMBIENT_COLORS.dawn, t / 0.15, out)
  } else if (t < 0.25) {
    return lerpColor(AMBIENT_COLORS.dawn, AMBIENT_COLORS.day, (t - 0.15) / 0.1, out)
  } else if (t < 0.55) {
    out.copy(AMBIENT_COLORS.day)
    return out
  } else if (t < 0.65) {
    return lerpColor(AMBIENT_COLORS.day, AMBIENT_COLORS.dusk, (t - 0.55) / 0.1, out)
  } else if (t < 0.75) {
    return lerpColor(AMBIENT_COLORS.dusk, AMBIENT_COLORS.night, (t - 0.65) / 0.1, out)
  } else {
    out.copy(AMBIENT_COLORS.night)
    return out
  }
}

function getSunColor(t: number, out: Color): Color {
  if (t < 0.15) {
    return lerpColor(SUN_COLORS.night, SUN_COLORS.dawn, t / 0.15, out)
  } else if (t < 0.25) {
    return lerpColor(SUN_COLORS.dawn, SUN_COLORS.day, (t - 0.15) / 0.1, out)
  } else if (t < 0.55) {
    out.copy(SUN_COLORS.day)
    return out
  } else if (t < 0.65) {
    return lerpColor(SUN_COLORS.day, SUN_COLORS.dusk, (t - 0.55) / 0.1, out)
  } else if (t < 0.75) {
    return lerpColor(SUN_COLORS.dusk, SUN_COLORS.night, (t - 0.65) / 0.1, out)
  } else {
    out.copy(SUN_COLORS.night)
    return out
  }
}

function getAmbientIntensity(t: number): number {
  // Night: 0.08, Dawn/Dusk: 0.3, Day: 0.5
  if (t < 0.1) return 0.08 + (t / 0.1) * 0.22
  if (t < 0.25) return 0.3 + ((t - 0.1) / 0.15) * 0.2
  if (t < 0.55) return 0.5
  if (t < 0.65) return 0.5 - ((t - 0.55) / 0.1) * 0.2
  if (t < 0.75) return 0.3 - ((t - 0.65) / 0.1) * 0.22
  return 0.08
}

function getSunIntensity(t: number): number {
  // Night: 0.0, Dawn/Dusk: 0.5, Day: 1.2
  if (t < 0.1) return (t / 0.1) * 0.5
  if (t < 0.25) return 0.5 + ((t - 0.1) / 0.15) * 0.7
  if (t < 0.55) return 1.2
  if (t < 0.65) return 1.2 - ((t - 0.55) / 0.1) * 0.7
  if (t < 0.75) return 0.5 - ((t - 0.65) / 0.1) * 0.5
  return 0
}

export default function WeatherSystem() {
  const state = useEcosystem()
  const dispatch = useEcosystemDispatch()
  const { scene } = useThree()

  const sunRef = useRef<DirectionalLight>(null!)
  const ambientRef = useRef<AmbientLight>(null!)

  const sunPos = useMemo(() => new Vector3(), [])
  const tempColor = useMemo(() => new Color(), [])

  useFrame((_, delta) => {
    if (state.paused) return

    // Update time of day
    const newTimeOfDay = (state.timeOfDay + delta / DAY_DURATION) % 1
    dispatch({ type: 'SET_TIME_OF_DAY', timeOfDay: newTimeOfDay })

    const t = newTimeOfDay

    // Weather auto-change
    if (state.time >= state.weather.nextChangeAt) {
      const isRaining = Math.random() < RAIN_CHANCE
      dispatch({
        type: 'SET_WEATHER',
        weather: isRaining ? 'rainy' : 'sunny',
        intensity: isRaining ? 0.4 + Math.random() * 0.6 : 0,
        nextChangeAt: state.time + WEATHER_CHANGE_INTERVAL,
      })
    }

    const isRainy = state.weather.type === 'rainy'
    const rainDim = isRainy ? 0.6 : 1.0 // dim lights during rain

    // Sun position - realistic east-to-west arc
    // t=0.15 sunrise (east), t=0.375 noon (top), t=0.65 sunset (west)
    // Map daytime portion to a 0-PI arc, nighttime sun goes below horizon
    const dayStart = 0.1
    const dayEnd = 0.7
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

    // Sun intensity & color
    const sunIntensity = getSunIntensity(t) * rainDim
    sunRef.current.intensity = sunIntensity
    getSunColor(t, tempColor)
    sunRef.current.color.copy(tempColor)

    // Ambient
    ambientRef.current.intensity = getAmbientIntensity(t) * (isRainy ? 0.8 : 1.0)
    getAmbientColor(t, tempColor)
    ambientRef.current.color.copy(tempColor)

    // Sky color
    getSkyColor(t, tempColor)
    if (isRainy) {
      // Darken and desaturate sky during rain
      tempColor.lerp(new Color('#4a5568'), state.weather.intensity * 0.5)
    }
    scene.background = tempColor.clone()

    // Fog
    getFogColor(t, tempColor)
    if (isRainy) {
      tempColor.lerp(new Color('#667788'), state.weather.intensity * 0.4)
    }
    if (scene.fog && 'color' in scene.fog) {
      (scene.fog as any).color.copy(tempColor)
      // Tighter fog at night and during rain
      const isNight = t > 0.7 || t < 0.1
      ;(scene.fog as any).near = isRainy ? 30 : isNight ? 40 : 60
      ;(scene.fog as any).far = isRainy ? 80 : isNight ? 90 : 130
    }
  })

  return (
    <>
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
      <fog attach="fog" args={['#a8d5e2', 60, 130]} />
    </>
  )
}
