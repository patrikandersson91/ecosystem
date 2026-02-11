import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import EcosystemScene from '../components/canvas/EcosystemScene.tsx'
import HUD from '../components/ui/HUD.tsx'
import Timeline from '../components/ui/Timeline.tsx'
import { useEcosystem, useEcosystemDispatch } from '../state/ecosystem-context.tsx'
import { DebugProvider } from '../state/debug-context.tsx'
import { WORLD_SIZE } from '../types/ecosystem.ts'

export default function SimulationPage() {
  const state = useEcosystem()
  const dispatch = useEcosystemDispatch()

  useEffect(() => {
    if (state.rabbits.length === 0 && state.foxes.length === 0 && state.moose.length === 0) {
      dispatch({ type: 'INIT', config: state.config })
    }
  }, [])

  return (
    <DebugProvider>
      <div style={{ position: 'fixed', inset: 0 }}>
        <Canvas
          camera={{ position: [0, WORLD_SIZE * 0.6, WORLD_SIZE * 0.8], fov: 60, near: 0.1, far: WORLD_SIZE * 12 }}
          shadows
          dpr={[1, 2]}
          style={{ width: '100%', height: '100%' }}
        >
          <Suspense fallback={null}>
            <EcosystemScene />
          </Suspense>
        </Canvas>
        <Timeline />
        <HUD />
      </div>
    </DebugProvider>
  )
}
