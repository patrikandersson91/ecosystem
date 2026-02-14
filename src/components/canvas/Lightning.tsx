import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useEcosystem } from '../../state/ecosystem-context.tsx'
import { useWeatherRefs } from '../../state/weather-refs.tsx'
import { WORLD_SIZE } from '../../types/ecosystem.ts'

const MIN_INTERVAL = 6
const MAX_INTERVAL = 18
const BOLT_DURATION = 0.18

function generateBolt(
  startX: number,
  startZ: number,
): Float32Array {
  const segments: number[] = []
  const startY = WORLD_SIZE * 0.6 + Math.random() * WORLD_SIZE * 0.2
  const endY = Math.random() * 5
  const endX = startX + (Math.random() - 0.5) * 30
  const endZ = startZ + (Math.random() - 0.5) * 30

  const segCount = 8 + Math.floor(Math.random() * 6)
  const points: THREE.Vector3[] = []

  for (let i = 0; i <= segCount; i++) {
    const t = i / segCount
    const x = startX + (endX - startX) * t + (Math.random() - 0.5) * 18 * (1 - t * 0.6)
    const y = startY + (endY - startY) * t
    const z = startZ + (endZ - startZ) * t + (Math.random() - 0.5) * 18 * (1 - t * 0.6)
    points.push(new THREE.Vector3(x, y, z))
  }

  // Main bolt
  for (let i = 0; i < points.length - 1; i++) {
    segments.push(
      points[i].x, points[i].y, points[i].z,
      points[i + 1].x, points[i + 1].y, points[i + 1].z,
    )

    // Random branches
    if (i > 1 && Math.random() < 0.35) {
      const branchLen = 2 + Math.floor(Math.random() * 3)
      let bx = points[i].x
      let by = points[i].y
      let bz = points[i].z
      for (let j = 0; j < branchLen; j++) {
        const nbx = bx + (Math.random() - 0.5) * 14
        const nby = by - (4 + Math.random() * 8)
        const nbz = bz + (Math.random() - 0.5) * 14
        segments.push(bx, by, bz, nbx, nby, nbz)
        bx = nbx
        by = nby
        bz = nbz
      }
    }
  }

  return new Float32Array(segments)
}

export default function Lightning() {
  const state = useEcosystem()
  const weatherRefs = useWeatherRefs()

  const lineRef = useRef<THREE.LineSegments>(null)
  const flashLightRef = useRef<THREE.PointLight>(null)

  const timerRef = useRef(0)
  const nextStrikeRef = useRef(MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL))
  const boltActiveRef = useRef(0) // countdown
  const boltPositionRef = useRef(new THREE.Vector3())

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    // Pre-allocate with empty positions (will be replaced on strike)
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(600), 3))
    return geo
  }, [])

  const material = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: '#e8e0ff',
      transparent: true,
      opacity: 1,
      linewidth: 2,
    })
  }, [])

  useFrame((_, rawDelta) => {
    if (state.paused) return
    const delta = rawDelta * state.speed
    const isRaining = state.weather.type === 'rainy'

    if (!isRaining) {
      // Hide bolt and light when not raining
      if (lineRef.current) lineRef.current.visible = false
      if (flashLightRef.current) flashLightRef.current.intensity = 0
      timerRef.current = 0
      return
    }

    timerRef.current += delta

    // Active bolt rendering
    if (boltActiveRef.current > 0) {
      boltActiveRef.current -= delta
      const fade = Math.max(0, boltActiveRef.current / BOLT_DURATION)

      if (lineRef.current) {
        lineRef.current.visible = fade > 0.01
        material.opacity = fade
      }

      if (flashLightRef.current) {
        flashLightRef.current.intensity = fade * 25
        flashLightRef.current.position.copy(boltPositionRef.current)
      }

      // Keep bloom flash decaying
      if (fade > 0.01) {
        weatherRefs.lightningFlash.current = fade
      }
    } else {
      if (lineRef.current) lineRef.current.visible = false
      if (flashLightRef.current) flashLightRef.current.intensity = 0
    }

    // Trigger new bolt
    if (timerRef.current >= nextStrikeRef.current) {
      timerRef.current = 0
      // More frequent strikes with higher rain intensity
      const intensityMul = 0.5 + (1 - state.weather.intensity) * 0.5
      nextStrikeRef.current = (MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL)) * intensityMul

      // Generate bolt at random position
      const boltX = (Math.random() - 0.5) * WORLD_SIZE * 1.2
      const boltZ = (Math.random() - 0.5) * WORLD_SIZE * 1.2

      const positions = generateBolt(boltX, boltZ)

      // Update geometry
      const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
      const arr = posAttr.array as Float32Array

      // Clear old positions
      arr.fill(0)

      // Copy new bolt (up to buffer limit)
      const copyLen = Math.min(positions.length, arr.length)
      for (let i = 0; i < copyLen; i++) {
        arr[i] = positions[i]
      }
      posAttr.needsUpdate = true
      geometry.setDrawRange(0, copyLen / 3)

      boltActiveRef.current = BOLT_DURATION
      boltPositionRef.current.set(boltX, WORLD_SIZE * 0.5, boltZ)

      // Trigger bloom flash
      weatherRefs.lightningFlash.current = 1.0
    }
  })

  return (
    <>
      <lineSegments ref={lineRef} geometry={geometry} material={material} visible={false} />
      <pointLight
        ref={flashLightRef}
        color="#d4c8ff"
        intensity={0}
        distance={WORLD_SIZE * 2}
        decay={1.5}
      />
    </>
  )
}
