import { createContext, useContext, useRef, type ReactNode } from 'react'
import { Vector3, Color } from 'three'
import type { Mesh } from 'three'

export interface WeatherRefs {
  sunMeshRef: React.RefObject<Mesh | null>
  sunPosition: React.RefObject<Vector3>
  sunColor: React.RefObject<Color>
  skyColor: React.RefObject<Color>
  lightningFlash: React.RefObject<number> // 0-1, decays over time
  timeOfDay: React.RefObject<number>
  isRaining: React.RefObject<boolean>
  rainIntensity: React.RefObject<number>
}

const WeatherRefsContext = createContext<WeatherRefs | null>(null)

export function WeatherRefsProvider({ children }: { children: ReactNode }) {
  const refs: WeatherRefs = {
    sunMeshRef: useRef<Mesh>(null),
    sunPosition: useRef(new Vector3(0, 35, -15)),
    sunColor: useRef(new Color('#fffff0')),
    skyColor: useRef(new Color('#87ceeb')),
    lightningFlash: useRef(0),
    timeOfDay: useRef(0),
    isRaining: useRef(false),
    rainIntensity: useRef(0),
  }

  return (
    <WeatherRefsContext.Provider value={refs}>
      {children}
    </WeatherRefsContext.Provider>
  )
}

export function useWeatherRefs(): WeatherRefs {
  const ctx = useContext(WeatherRefsContext)
  if (!ctx) throw new Error('useWeatherRefs must be used within WeatherRefsProvider')
  return ctx
}
