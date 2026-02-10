import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Terrain from './Terrain.tsx'
import River from './River.tsx'
import Trees from './Trees.tsx'
import Bushes from './Bushes.tsx'
import Stones from './Stones.tsx'
import Flowers from './Flowers.tsx'
import WeatherSystem from './WeatherSystem.tsx'
import Rain from './Rain.tsx'
import WaterSplashes from './WaterSplashes.tsx'
import RabbitGroup from '../entities/RabbitGroup.tsx'
import FoxGroup from '../entities/FoxGroup.tsx'
import { useEcosystem, useEcosystemDispatch, randomFlowerPosition } from '../../state/ecosystem-context.tsx'

function FlowerRegrowth() {
  const state = useEcosystem()
  const dispatch = useEcosystemDispatch()
  const timer = useRef(0)

  useFrame((_, delta) => {
    if (state.paused) return
    timer.current += delta
    if (timer.current > 4) {
      timer.current = 0
      const aliveCount = state.flowers.filter(f => f.alive).length
      if (aliveCount < 100) {
        dispatch({
          type: 'SPAWN_FLOWER',
          flower: {
            id: `flower_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            position: randomFlowerPosition(),
            alive: true,
          },
        })
      }
    }
  })

  return null
}

export default function EcosystemScene() {
  return (
    <>
      <WeatherSystem />
      <Rain />
      <color attach="background" args={['#87ceeb']} />
      <OrbitControls
        maxPolarAngle={Math.PI / 2.1}
        minDistance={5}
        maxDistance={80}
      />
      <Terrain />
      <River />
      <WaterSplashes />
      <Trees />
      <Bushes />
      <Stones />
      <Flowers />
      <RabbitGroup />
      <FoxGroup />
      <FlowerRegrowth />
    </>
  )
}
