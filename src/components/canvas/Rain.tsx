import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useEcosystemRef } from '../../state/ecosystem-context.tsx'
import { useWeatherRefs } from '../../state/weather-refs.tsx'
import { groundHeightAt } from '../../utils/terrain-height.ts'

// ─── Configuration ──────────────────────────────────────────

const DROP_COUNT = 1500
const SPLASH_COUNT = 80
const RAIN_AREA = 70
const RAIN_HEIGHT = 30
const FALL_SPEED_MIN = 30
const FALL_SPEED_MAX = 45
const WIND_X = 3.5
const SPLASH_LIFE = 0.35

// ─── Raindrop shaders (elongated vertical streaks) ──────────

const dropVert = /* glsl */ `
  attribute float aSpeed;
  attribute float aAlpha;
  uniform float uIntensity;
  varying float vAlpha;

  void main() {
    vAlpha = aAlpha * uIntensity;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = (2.5 + aSpeed * 0.04) * (200.0 / -mv.z);
    gl_PointSize = clamp(gl_PointSize, 1.0, 8.0);
    gl_Position = projectionMatrix * mv;
  }
`

const dropFrag = /* glsl */ `
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    // Elongated vertically for a rain-streak look
    float d = uv.x * uv.x * 8.0 + uv.y * uv.y;
    if (d > 0.25) discard;
    float alpha = vAlpha * (1.0 - d * 4.0) * 0.55;
    vec3 color = vec3(0.72, 0.8, 0.9);
    gl_FragColor = vec4(color, alpha);
  }
`

// ─── Splash shaders (expanding ring on ground) ──────────────

const splashVert = /* glsl */ `
  attribute float aAge;
  attribute float aMaxAge;
  attribute float aSize;
  uniform float uIntensity;
  varying float vAlpha;

  void main() {
    float progress = clamp(aAge / aMaxAge, 0.0, 1.0);
    vAlpha = (1.0 - progress * progress) * 0.4 * uIntensity;
    float expand = 1.0 + progress * 2.5;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * expand * (140.0 / -mv.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 12.0);
    gl_Position = projectionMatrix * mv;
  }
`

const splashFrag = /* glsl */ `
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float ring = smoothstep(0.2, 0.32, d) * (1.0 - smoothstep(0.38, 0.5, d));
    float center = (1.0 - smoothstep(0.0, 0.15, d)) * 0.3;
    float alpha = (ring + center) * vAlpha;
    gl_FragColor = vec4(vec3(0.78, 0.84, 0.92), alpha);
  }
`

// ─── Types ──────────────────────────────────────────────────

interface DropState {
  x: number; y: number; z: number
  speed: number
  alpha: number
  groundY: number
}

interface SplashState {
  active: boolean
  age: number
  maxAge: number
  x: number; y: number; z: number
  size: number
}

function resetDrop(d: DropState, camX: number, camZ: number) {
  d.x = camX + (Math.random() - 0.5) * RAIN_AREA
  d.z = camZ + (Math.random() - 0.5) * RAIN_AREA
  d.groundY = groundHeightAt(d.x, d.z)
  d.y = d.groundY + 5 + Math.random() * RAIN_HEIGHT
  d.speed = FALL_SPEED_MIN + Math.random() * (FALL_SPEED_MAX - FALL_SPEED_MIN)
  d.alpha = 0.3 + Math.random() * 0.7
}

// ─── Component ──────────────────────────────────────────────

export default function Rain() {
  const stateRef = useEcosystemRef()
  const weatherRefs = useWeatherRefs()
  const { camera } = useThree()

  const wasRainingRef = useRef(false)
  const nextSplash = useRef(0)

  // Drop pool
  const drops = useRef<DropState[]>(
    Array.from({ length: DROP_COUNT }, () => ({
      x: 0, y: -1000, z: 0, speed: 35, alpha: 0.5, groundY: 0,
    })),
  )

  // Splash pool
  const splashes = useRef<SplashState[]>(
    Array.from({ length: SPLASH_COUNT }, () => ({
      active: false, age: 0, maxAge: SPLASH_LIFE,
      x: 0, y: -1000, z: 0, size: 0.4,
    })),
  )

  // ─── Drop geometry + material ─────────────────────────────

  const { dropGeo, dropMat } = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(DROP_COUNT * 3), 3))
    geo.setAttribute('aSpeed', new THREE.Float32BufferAttribute(new Float32Array(DROP_COUNT), 1))
    geo.setAttribute('aAlpha', new THREE.Float32BufferAttribute(new Float32Array(DROP_COUNT), 1))

    const mat = new THREE.ShaderMaterial({
      vertexShader: dropVert,
      fragmentShader: dropFrag,
      transparent: true,
      depthWrite: false,
      uniforms: { uIntensity: { value: 0 } },
    })

    return { dropGeo: geo, dropMat: mat }
  }, [])

  // ─── Splash geometry + material ───────────────────────────

  const { splashGeo, splashMat } = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(SPLASH_COUNT * 3), 3))
    geo.setAttribute('aAge', new THREE.Float32BufferAttribute(new Float32Array(SPLASH_COUNT), 1))
    geo.setAttribute('aMaxAge', new THREE.Float32BufferAttribute(new Float32Array(SPLASH_COUNT).fill(SPLASH_LIFE), 1))
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(new Float32Array(SPLASH_COUNT), 1))

    const mat = new THREE.ShaderMaterial({
      vertexShader: splashVert,
      fragmentShader: splashFrag,
      transparent: true,
      depthWrite: false,
      uniforms: { uIntensity: { value: 0 } },
    })

    return { splashGeo: geo, splashMat: mat }
  }, [])

  // ─── Frame loop ───────────────────────────────────────────

  useFrame((_, rawDelta) => {
    const state = stateRef.current
    if (state.paused) return
    const delta = rawDelta * state.speed
    const isRaining = weatherRefs.isRaining.current
    const intensity = weatherRefs.rainIntensity.current

    // Smooth intensity fade
    const target = isRaining ? intensity : 0
    const current = dropMat.uniforms.uIntensity.value
    dropMat.uniforms.uIntensity.value += (target - current) * Math.min(delta * 3, 1)
    splashMat.uniforms.uIntensity.value = dropMat.uniforms.uIntensity.value

    // Skip simulation when fully faded out
    if (!isRaining && dropMat.uniforms.uIntensity.value < 0.01) {
      wasRainingRef.current = false
      return
    }

    // Scatter all drops when rain begins
    if (isRaining && !wasRainingRef.current) {
      wasRainingRef.current = true
      for (let i = 0; i < DROP_COUNT; i++) {
        resetDrop(drops.current[i], camera.position.x, camera.position.z)
      }
    }

    const camX = camera.position.x
    const camZ = camera.position.z
    const halfArea = RAIN_AREA / 2

    // Number of visible drops scales with intensity
    const activeCount = Math.floor(DROP_COUNT * Math.min(intensity, 1))

    const dPos = dropGeo.attributes.position.array as Float32Array
    const dSpeeds = dropGeo.attributes.aSpeed.array as Float32Array
    const dAlphas = dropGeo.attributes.aAlpha.array as Float32Array

    for (let i = 0; i < DROP_COUNT; i++) {
      const d = drops.current[i]
      const i3 = i * 3

      // Hide inactive drops
      if (i >= activeCount) {
        dPos[i3 + 1] = -1000
        dAlphas[i] = 0
        continue
      }

      // Fall + wind drift
      d.y -= d.speed * delta
      d.x += WIND_X * delta

      // Wrap horizontally around camera
      if (d.x > camX + halfArea) { d.x -= RAIN_AREA; d.groundY = groundHeightAt(d.x, d.z) }
      else if (d.x < camX - halfArea) { d.x += RAIN_AREA; d.groundY = groundHeightAt(d.x, d.z) }
      if (d.z > camZ + halfArea) { d.z -= RAIN_AREA; d.groundY = groundHeightAt(d.x, d.z) }
      else if (d.z < camZ - halfArea) { d.z += RAIN_AREA; d.groundY = groundHeightAt(d.x, d.z) }

      // Hit ground → splash + reset
      if (d.y <= d.groundY) {
        if (Math.random() < 0.3) {
          const si = nextSplash.current % SPLASH_COUNT
          nextSplash.current++
          const s = splashes.current[si]
          s.active = true
          s.age = 0
          s.maxAge = SPLASH_LIFE * (0.7 + Math.random() * 0.6)
          s.x = d.x
          s.y = d.groundY + 0.05
          s.z = d.z
          s.size = 0.3 + Math.random() * 0.5
        }
        resetDrop(d, camX, camZ)
        d.y = d.groundY + RAIN_HEIGHT * (0.7 + Math.random() * 0.3)
      }

      dPos[i3] = d.x
      dPos[i3 + 1] = d.y
      dPos[i3 + 2] = d.z
      dSpeeds[i] = d.speed
      dAlphas[i] = d.alpha
    }

    dropGeo.attributes.position.needsUpdate = true
    dropGeo.attributes.aSpeed.needsUpdate = true
    dropGeo.attributes.aAlpha.needsUpdate = true

    // ─── Update splashes ──────────────────────────────────

    const sPos = splashGeo.attributes.position.array as Float32Array
    const sAges = splashGeo.attributes.aAge.array as Float32Array
    const sMaxAges = splashGeo.attributes.aMaxAge.array as Float32Array
    const sSizes = splashGeo.attributes.aSize.array as Float32Array

    for (let i = 0; i < SPLASH_COUNT; i++) {
      const s = splashes.current[i]
      if (s.active) {
        s.age += delta
        if (s.age >= s.maxAge) s.active = false
      }
      sPos[i * 3] = s.active ? s.x : 0
      sPos[i * 3 + 1] = s.active ? s.y : -1000
      sPos[i * 3 + 2] = s.active ? s.z : 0
      sAges[i] = s.active ? s.age : 0
      sMaxAges[i] = s.active ? s.maxAge : 1
      sSizes[i] = s.active ? s.size : 0
    }

    splashGeo.attributes.position.needsUpdate = true
    splashGeo.attributes.aAge.needsUpdate = true
    splashGeo.attributes.aMaxAge.needsUpdate = true
    splashGeo.attributes.aSize.needsUpdate = true
  })

  return (
    <>
      <points geometry={dropGeo} material={dropMat} frustumCulled={false} />
      <points geometry={splashGeo} material={splashMat} frustumCulled={false} />
    </>
  )
}
