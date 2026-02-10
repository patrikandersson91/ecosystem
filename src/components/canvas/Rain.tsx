import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BufferAttribute } from 'three'
import type { Points } from 'three'
import { useEcosystem } from '../../state/ecosystem-context.tsx'

const RAIN_COUNT = 3000
const RAIN_AREA = 80
const RAIN_HEIGHT = 40

export default function Rain() {
  const state = useEcosystem()
  const pointsRef = useRef<Points>(null!)
  const { camera } = useThree()

  const positions = useMemo(() => {
    const arr = new Float32Array(RAIN_COUNT * 3)
    for (let i = 0; i < RAIN_COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * RAIN_AREA
      arr[i * 3 + 1] = Math.random() * RAIN_HEIGHT
      arr[i * 3 + 2] = (Math.random() - 0.5) * RAIN_AREA
    }
    return arr
  }, [])

  const velocities = useMemo(() => {
    const arr = new Float32Array(RAIN_COUNT)
    for (let i = 0; i < RAIN_COUNT; i++) {
      arr[i] = 15 + Math.random() * 10 // fall speed
    }
    return arr
  }, [])

  useFrame((_, delta) => {
    if (state.weather.type !== 'rainy' || state.paused) {
      if (pointsRef.current) pointsRef.current.visible = false
      return
    }

    const pts = pointsRef.current
    if (!pts) return
    pts.visible = true

    const posAttr = pts.geometry.getAttribute('position') as BufferAttribute
    const arr = posAttr.array as Float32Array

    // Center rain around camera
    const cx = camera.position.x
    const cz = camera.position.z

    for (let i = 0; i < RAIN_COUNT; i++) {
      const i3 = i * 3
      arr[i3 + 1] -= velocities[i] * delta * state.weather.intensity

      // Reset drops that fall below ground
      if (arr[i3 + 1] < 0) {
        arr[i3] = cx + (Math.random() - 0.5) * RAIN_AREA
        arr[i3 + 1] = RAIN_HEIGHT + Math.random() * 5
        arr[i3 + 2] = cz + (Math.random() - 0.5) * RAIN_AREA
      }
    }

    posAttr.needsUpdate = true
  })

  return (
    <points ref={pointsRef} visible={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={RAIN_COUNT}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#aaccff"
        size={0.15}
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}
