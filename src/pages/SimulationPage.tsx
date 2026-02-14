import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { NoToneMapping } from 'three'
import EcosystemScene from '../components/canvas/EcosystemScene.tsx'
import HUD from '../components/ui/HUD.tsx'
import Timeline from '../components/ui/Timeline.tsx'
import { useEcosystemUI, useEcosystemDispatch } from '../state/ecosystem-context.tsx'
import { DebugProvider } from '../state/debug-context.tsx'
import { FollowProvider } from '../state/follow-context.tsx'
import { WeatherRefsProvider } from '../state/weather-refs.tsx'
import { WORLD_SIZE } from '../types/ecosystem.ts'

export default function SimulationPage() {
  const ui = useEcosystemUI()
  const dispatch = useEcosystemDispatch()

  useEffect(() => {
    if (ui.rabbits === 0 && ui.foxes === 0 && ui.moose === 0) {
      dispatch({ type: 'INIT', config: ui.config })
    }
  }, [])

  return (
    <DebugProvider>
      <FollowProvider>
        <WeatherRefsProvider>
        <div style={{ position: 'fixed', inset: 0 }}>
          <Canvas
            camera={{ position: [0, WORLD_SIZE * 0.6, WORLD_SIZE * 0.8], fov: 60, near: 0.1, far: WORLD_SIZE * 12 }}
            shadows
            dpr={[1, 1.5]}
            style={{ width: '100%', height: '100%' }}
          >
            <Suspense fallback={null}>
              <EcosystemScene />
            </Suspense>
          </Canvas>
          <Timeline />
          <HUD />
        </div>
        </WeatherRefsProvider>
      </FollowProvider>
    </DebugProvider>
  )
}
