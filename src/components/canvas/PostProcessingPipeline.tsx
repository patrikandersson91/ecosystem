import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  EffectComposer,
  Bloom,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing'
import { ToneMappingMode, BlendFunction } from 'postprocessing'
import { useWeatherRefs } from '../../state/weather-refs.tsx'

function getBloomIntensity(t: number): number {
  if (t < 0.06) return 0.12
  if (t < 0.10) return 0.12 + ((t - 0.06) / 0.04) * 0.68
  if (t < 0.18) return 0.8 - ((t - 0.10) / 0.08) * 0.5
  if (t < 0.58) return 0.3
  if (t < 0.66) return 0.3 + ((t - 0.58) / 0.08) * 0.5
  if (t < 0.76) return 0.8 - ((t - 0.66) / 0.10) * 0.68
  return 0.12
}

function getBloomThreshold(t: number, flash: number): number {
  if (flash > 0.01) return 0.1 + (1 - flash) * 0.5
  if (t < 0.06 || t > 0.78) return 0.85
  if (t < 0.16) return 0.6
  if (t > 0.64 && t < 0.78) return 0.6
  return 0.75
}

function getVignetteDarkness(t: number): number {
  if (t < 0.08 || t > 0.78) return 0.55
  if (t < 0.16) return 0.55 - ((t - 0.08) / 0.08) * 0.2
  if (t > 0.68) return 0.35 + ((t - 0.68) / 0.10) * 0.2
  return 0.35
}

export default function PostProcessingPipeline() {
  const weatherRefs = useWeatherRefs()
  const bloomRef = useRef<any>(null)
  const vignetteRef = useRef<any>(null)

  useFrame(() => {
    const t = weatherRefs.timeOfDay.current
    const flash = weatherRefs.lightningFlash.current

    if (bloomRef.current) {
      bloomRef.current.intensity = getBloomIntensity(t) + flash * 1.5
      bloomRef.current.luminanceThreshold = getBloomThreshold(t, flash)
    }

    if (vignetteRef.current) {
      vignetteRef.current.darkness = getVignetteDarkness(t)
    }

    // Decay lightning flash
    if (weatherRefs.lightningFlash.current > 0.001) {
      weatherRefs.lightningFlash.current *= 0.88
    } else {
      weatherRefs.lightningFlash.current = 0
    }
  })

  return (
    <EffectComposer multisampling={0}>
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Bloom
        ref={bloomRef}
        intensity={0.3}
        luminanceThreshold={0.75}
        luminanceSmoothing={0.3}
        mipmapBlur
      />
      <Vignette
        ref={vignetteRef}
        offset={0.35}
        darkness={0.35}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  )
}
