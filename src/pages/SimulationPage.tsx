import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import EcosystemScene from '../components/canvas/EcosystemScene.tsx'
import HUD from '../components/ui/HUD.tsx'
import Timeline from '../components/ui/Timeline.tsx'
import { useEcosystem, useEcosystemDispatch } from '../state/ecosystem-context.tsx'
import { DebugProvider } from '../state/debug-context.tsx'

export default function SimulationPage() {
  const state = useEcosystem()
  const dispatch = useEcosystemDispatch()

  // Auto-init if navigated directly to /sim without going through landing page
  useEffect(() => {
    if (state.rabbits.length === 0 && state.foxes.length === 0) {
      dispatch({ type: 'INIT', config: state.config })
    }
  }, [])

  return (
    <DebugProvider>
      <div style={{ position: 'fixed', inset: 0 }}>
        <Canvas
          camera={{ position: [0, 30, 40], fov: 60, near: 0.1, far: 200 }}
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
