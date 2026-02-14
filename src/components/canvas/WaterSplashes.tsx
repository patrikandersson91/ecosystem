import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useEcosystemRef } from '../../state/ecosystem-context.tsx'
import { isInWater } from '../../utils/river-path.ts'

/** Max entities we track at once */
const MAX_TRACKED = 12
/** Ripple ring pool size */
const RIPPLE_POOL = 24
/** Splash particle pool size */
const SPLASH_POOL = 30
/** How often (seconds) each entity spawns a new ripple */
const RIPPLE_INTERVAL = 0.25
/** Ripple lifetime */
const RIPPLE_LIFE = 1.2
/** Splash lifetime */
const SPLASH_LIFE = 0.6

// ─── Ripple ring shaders ──────────────────────────────────────

const rippleVert = /* glsl */ `
  attribute float aAge;
  attribute float aMaxAge;
  attribute vec3 aOffset;
  varying float vAge;
  varying float vMaxAge;

  void main() {
    float progress = aAge / aMaxAge;
    // Expand from 0.2 to 1.5 radius
    float scale = 0.2 + progress * 1.3;
    vec3 pos = position * scale + aOffset;
    vAge = aAge;
    vMaxAge = aMaxAge;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const rippleFrag = /* glsl */ `
  uniform float uLightIntensity;
  varying float vAge;
  varying float vMaxAge;

  void main() {
    float progress = vAge / vMaxAge;
    // Fade out as ripple expands
    float alpha = (1.0 - progress) * 0.4;
    vec3 color = vec3(0.75, 0.85, 0.95) * uLightIntensity;
    gl_FragColor = vec4(color, alpha);
  }
`

// ─── Splash point shaders ─────────────────────────────────────

const splashVert = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;

  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (60.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`

const splashFrag = /* glsl */ `
  uniform float uLightIntensity;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float a = vAlpha * (1.0 - smoothstep(0.1, 0.5, d));
    vec3 color = vec3(0.82, 0.9, 0.98) * uLightIntensity;
    gl_FragColor = vec4(color, a);
  }
`

// ─── Types ────────────────────────────────────────────────────

interface RippleSlot {
  age: number
  maxAge: number
  x: number
  y: number
  z: number
  active: boolean
}

interface SplashSlot {
  age: number
  maxAge: number
  x: number
  y: number
  z: number
  vy: number
  active: boolean
}

// ─── Component ────────────────────────────────────────────────

export default function WaterSplashes() {
  const stateRef = useEcosystemRef()

  // Track per-entity ripple spawn timers
  const entityTimers = useRef<Map<string, number>>(new Map())

  // Ripple pool
  const ripples = useRef<RippleSlot[]>(
    Array.from({ length: RIPPLE_POOL }, () => ({
      age: 0, maxAge: RIPPLE_LIFE, x: 0, y: 0, z: 0, active: false,
    })),
  )
  const nextRipple = useRef(0)

  // Splash pool
  const splashes = useRef<SplashSlot[]>(
    Array.from({ length: SPLASH_POOL }, () => ({
      age: 0, maxAge: SPLASH_LIFE, x: 0, y: 0, z: 0, vy: 0, active: false,
    })),
  )
  const nextSplash = useRef(0)

  // ─── Ripple ring geometry (instanced via merged attribute buffers) ───
  const { rippleGeo, rippleMat } = useMemo(() => {
    // Build a flat ring in the XZ plane
    const innerR = 0.9
    const outerR = 1.0
    const segs = 24
    const verts: number[] = []
    const idx: number[] = []
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2
      const cos = Math.cos(a)
      const sin = Math.sin(a)
      verts.push(cos * innerR, 0, sin * innerR)
      verts.push(cos * outerR, 0, sin * outerR)
    }
    for (let i = 0; i < segs; i++) {
      const b = i * 2
      idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2)
    }

    // Duplicate for each pool slot
    const allVerts: number[] = []
    const allIdx: number[] = []
    const ageAttr: number[] = []
    const maxAgeAttr: number[] = []
    const offsetAttr: number[] = []
    const vertsPerRing = verts.length / 3
    const idxPerRing = idx.length

    for (let r = 0; r < RIPPLE_POOL; r++) {
      const baseVert = r * vertsPerRing
      for (let v = 0; v < verts.length; v += 3) {
        allVerts.push(verts[v], verts[v + 1], verts[v + 2])
        ageAttr.push(0)
        maxAgeAttr.push(RIPPLE_LIFE)
        offsetAttr.push(0, 0, 0)
      }
      for (let j = 0; j < idxPerRing; j++) {
        allIdx.push(idx[j] + baseVert)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(allVerts, 3))
    geo.setAttribute('aAge', new THREE.Float32BufferAttribute(ageAttr, 1))
    geo.setAttribute('aMaxAge', new THREE.Float32BufferAttribute(maxAgeAttr, 1))
    geo.setAttribute('aOffset', new THREE.Float32BufferAttribute(offsetAttr, 3))
    geo.setIndex(allIdx)

    const mat = new THREE.ShaderMaterial({
      uniforms: { uLightIntensity: { value: 1.0 } },
      vertexShader: rippleVert,
      fragmentShader: rippleFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })

    return { rippleGeo: geo, rippleMat: mat }
  }, [])

  // ─── Splash point geometry ──────────────────────────────────
  const { splashGeo, splashMat } = useMemo(() => {
    const pos = new Float32Array(SPLASH_POOL * 3)
    const sizes = new Float32Array(SPLASH_POOL)
    const alphas = new Float32Array(SPLASH_POOL)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1))
    geo.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alphas, 1))

    const mat = new THREE.ShaderMaterial({
      uniforms: { uLightIntensity: { value: 1.0 } },
      vertexShader: splashVert,
      fragmentShader: splashFrag,
      transparent: true,
      depthWrite: false,
    })

    return { splashGeo: geo, splashMat: mat }
  }, [])

  useFrame((_s, delta) => {
    const state = stateRef.current
    if (state.paused) return

    // Update time of day lighting
    const timeOfDay = state.timeOfDay
    let intensity = 0.25
    if (timeOfDay > 0.08 && timeOfDay < 0.2) {
      // Dawn
      intensity = 0.25 + ((timeOfDay - 0.08) / 0.12) * 0.75
    } else if (timeOfDay >= 0.2 && timeOfDay < 0.7) {
      // Day
      intensity = 1.0
    } else if (timeOfDay >= 0.7 && timeOfDay < 0.82) {
      // Dusk
      intensity = 1.0 - ((timeOfDay - 0.7) / 0.12) * 0.75
    }
    rippleMat.uniforms.uLightIntensity.value = intensity
    splashMat.uniforms.uLightIntensity.value = intensity

    // Collect entities currently in water
    const inWater: { id: string; x: number; z: number; speed: number }[] = []

    for (const r of state.rabbits) {
      if (!r.alive) continue
      if (isInWater(r.position[0], r.position[2])) {
        const spd = Math.sqrt(r.velocity[0] ** 2 + r.velocity[2] ** 2)
        inWater.push({ id: r.id, x: r.position[0], z: r.position[2], speed: spd })
      }
    }
    for (const f of state.foxes) {
      if (!f.alive) continue
      if (isInWater(f.position[0], f.position[2])) {
        const spd = Math.sqrt(f.velocity[0] ** 2 + f.velocity[2] ** 2)
        inWater.push({ id: f.id, x: f.position[0], z: f.position[2], speed: spd })
      }
    }
    for (const m of state.moose) {
      if (!m.alive) continue
      if (isInWater(m.position[0], m.position[2])) {
        const spd = Math.sqrt(m.velocity[0] ** 2 + m.velocity[2] ** 2)
        inWater.push({ id: m.id, x: m.position[0], z: m.position[2], speed: spd })
      }
    }

    // Limit tracked entities
    const tracked = inWater.slice(0, MAX_TRACKED)

    // Spawn ripples & splashes for entities in water
    const timers = entityTimers.current
    for (const ent of tracked) {
      if (ent.speed < 0.15) continue // standing still — no splash

      const prev = timers.get(ent.id) ?? 0
      const next = prev + delta
      timers.set(ent.id, next)

      if (next >= RIPPLE_INTERVAL) {
        timers.set(ent.id, 0)

        // Spawn ripple
        const ri = nextRipple.current % RIPPLE_POOL
        nextRipple.current++
        const slot = ripples.current[ri]
        slot.active = true
        slot.age = 0
        slot.maxAge = RIPPLE_LIFE + Math.random() * 0.3
        slot.x = ent.x + (Math.random() - 0.5) * 0.4
        slot.y = 0.18 // just above water surface (river group is at y=0.15, water at y=0.02)
        slot.z = ent.z + (Math.random() - 0.5) * 0.4

        // Spawn 2-3 splash particles per ripple
        const splashCount = 2 + Math.floor(Math.random() * 2)
        for (let s = 0; s < splashCount; s++) {
          const si = nextSplash.current % SPLASH_POOL
          nextSplash.current++
          const ss = splashes.current[si]
          ss.active = true
          ss.age = 0
          ss.maxAge = SPLASH_LIFE + Math.random() * 0.2
          ss.x = ent.x + (Math.random() - 0.5) * 0.6
          ss.y = 0.2
          ss.z = ent.z + (Math.random() - 0.5) * 0.6
          ss.vy = 1.0 + Math.random() * 1.5 + ent.speed * 0.3
        }
      }
    }

    // Clean up timers for entities no longer in water
    const activeIds = new Set(tracked.map(e => e.id))
    for (const key of timers.keys()) {
      if (!activeIds.has(key)) timers.delete(key)
    }

    // ─── Update ripple ring attributes ──────────────────────
    const ageArr = rippleGeo.attributes.aAge.array as Float32Array
    const maxAgeArr = rippleGeo.attributes.aMaxAge.array as Float32Array
    const offsetArr = rippleGeo.attributes.aOffset.array as Float32Array
    const vertsPerRing = (rippleGeo.attributes.position.count) / RIPPLE_POOL

    for (let r = 0; r < RIPPLE_POOL; r++) {
      const slot = ripples.current[r]
      if (slot.active) {
        slot.age += delta
        if (slot.age >= slot.maxAge) {
          slot.active = false
        }
      }
      const base = r * vertsPerRing
      for (let v = 0; v < vertsPerRing; v++) {
        const i = base + v
        ageArr[i] = slot.active ? slot.age : 0
        maxAgeArr[i] = slot.active ? slot.maxAge : 1
        offsetArr[i * 3] = slot.active ? slot.x : 0
        offsetArr[i * 3 + 1] = slot.active ? slot.y : -10 // hide inactive below ground
        offsetArr[i * 3 + 2] = slot.active ? slot.z : 0
      }
    }
    rippleGeo.attributes.aAge.needsUpdate = true
    rippleGeo.attributes.aMaxAge.needsUpdate = true
    rippleGeo.attributes.aOffset.needsUpdate = true

    // ─── Update splash point attributes ─────────────────────
    const sPos = splashGeo.attributes.position.array as Float32Array
    const sSizes = splashGeo.attributes.aSize.array as Float32Array
    const sAlphas = splashGeo.attributes.aAlpha.array as Float32Array

    for (let i = 0; i < SPLASH_POOL; i++) {
      const ss = splashes.current[i]
      if (ss.active) {
        ss.age += delta
        ss.vy -= 6.0 * delta // gravity
        ss.y += ss.vy * delta
        if (ss.age >= ss.maxAge || ss.y < 0.1) {
          ss.active = false
        }
      }
      const i3 = i * 3
      if (ss.active) {
        const p = ss.age / ss.maxAge
        sPos[i3] = ss.x
        sPos[i3 + 1] = ss.y
        sPos[i3 + 2] = ss.z
        sSizes[i] = 0.15 + (1 - p) * 0.15
        sAlphas[i] = (1 - p) * 0.5
      } else {
        sPos[i3 + 1] = -10 // hide
        sAlphas[i] = 0
      }
    }
    splashGeo.attributes.position.needsUpdate = true
    splashGeo.attributes.aSize.needsUpdate = true
    splashGeo.attributes.aAlpha.needsUpdate = true
  })

  return (
    <group>
      <mesh geometry={rippleGeo} material={rippleMat} />
      <points geometry={splashGeo} material={splashMat} />
    </group>
  )
}
