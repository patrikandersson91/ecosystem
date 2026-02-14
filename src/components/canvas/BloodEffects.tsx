import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useDebug } from '../../state/debug-context.tsx'
import { useEcosystemRef } from '../../state/ecosystem-context.tsx'

// ─── Particle pool sizes ─────────────────────────────────────
const DROPLET_POOL = 50
const SPLAT_POOL = 10
const DROPLETS_PER_KILL = 15
const SPLATS_PER_KILL = 3
const DROPLET_LIFE = 1.2
const SPLAT_LIFE = 2.0

// ─── Blood droplet shaders ──────────────────────────────────

const dropletVert = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (100.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`

const dropletFrag = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    // Soft circle with darker edge for a goopy look
    float edge = smoothstep(0.2, 0.5, d);
    vec3 col = mix(vColor, vColor * 0.4, edge);
    float a = vAlpha * (1.0 - smoothstep(0.3, 0.5, d));
    gl_FragColor = vec4(col, a);
  }
`

// ─── Ground splat shaders ───────────────────────────────────

const splatVert = /* glsl */ `
  attribute float aAge;
  attribute float aMaxAge;
  attribute vec3 aOffset;
  attribute float aScale;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    float progress = aAge / aMaxAge;
    // Splat grows quickly then stays
    float growScale = min(progress * 8.0, 1.0) * aScale;
    vec3 pos = position * growScale + aOffset;
    // Fade out in last 30% of life
    vAlpha = progress < 0.7 ? 0.9 : (1.0 - (progress - 0.7) / 0.3) * 0.9;
    vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const splatFrag = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float a = vAlpha * (1.0 - smoothstep(0.3, 0.5, d));
    gl_FragColor = vec4(vColor * 0.6, a);
  }
`

// ─── Types ───────────────────────────────────────────────────

interface DropletSlot {
  active: boolean
  age: number
  maxAge: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  size: number
  r: number
  g: number
  b: number
  bounced: boolean
}

interface SplatSlot {
  active: boolean
  age: number
  maxAge: number
  x: number
  y: number
  z: number
  scale: number
  r: number
  g: number
  b: number
}

// ─── Blood color palette ─────────────────────────────────────

const BLOOD_COLORS = [
  [0.7, 0.05, 0.05],   // dark crimson
  [0.85, 0.08, 0.08],  // bright red
  [0.6, 0.0, 0.0],     // deep burgundy
  [0.95, 0.15, 0.1],   // arterial spray
  [0.5, 0.02, 0.02],   // nearly black blood
  [0.8, 0.0, 0.05],    // classic gore red
]

function randomBloodColor(): [number, number, number] {
  const c = BLOOD_COLORS[Math.floor(Math.random() * BLOOD_COLORS.length)]
  return [
    c[0] + (Math.random() - 0.5) * 0.1,
    c[1] + (Math.random() - 0.5) * 0.03,
    c[2] + (Math.random() - 0.5) * 0.03,
  ]
}

// ─── Component ───────────────────────────────────────────────

export default function BloodEffects() {
  const { bloodSpawnRef } = useDebug()
  const stateRef = useEcosystemRef()

  // ─── Droplet pool ──────────────────────────────────────────
  const droplets = useRef<DropletSlot[]>(
    Array.from({ length: DROPLET_POOL }, () => ({
      active: false, age: 0, maxAge: DROPLET_LIFE,
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      size: 0.2, r: 0.8, g: 0.05, b: 0.05, bounced: false,
    })),
  )
  const nextDroplet = useRef(0)

  // ─── Splat pool ────────────────────────────────────────────
  const splats = useRef<SplatSlot[]>(
    Array.from({ length: SPLAT_POOL }, () => ({
      active: false, age: 0, maxAge: SPLAT_LIFE,
      x: 0, y: 0, z: 0, scale: 1,
      r: 0.6, g: 0.02, b: 0.02,
    })),
  )
  const nextSplat = useRef(0)

  // ─── Kill event queue ──────────────────────────────────────
  const killQueue = useRef<[number, number, number][]>([])

  useEffect(() => {
    bloodSpawnRef.current = (x: number, y: number, z: number) => {
      killQueue.current.push([x, y, z])
    }
    return () => {
      bloodSpawnRef.current = null
    }
  }, [bloodSpawnRef])

  // ─── Droplet geometry ──────────────────────────────────────
  const { dropletGeo, dropletMat } = useMemo(() => {
    const pos = new Float32Array(DROPLET_POOL * 3)
    const sizes = new Float32Array(DROPLET_POOL)
    const alphas = new Float32Array(DROPLET_POOL)
    const colors = new Float32Array(DROPLET_POOL * 3)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1))
    geo.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alphas, 1))
    geo.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3))

    const mat = new THREE.ShaderMaterial({
      vertexShader: dropletVert,
      fragmentShader: dropletFrag,
      transparent: true,
      depthWrite: false,
    })

    return { dropletGeo: geo, dropletMat: mat }
  }, [])

  // ─── Splat geometry (flat discs on the ground) ─────────────
  const { splatGeo, splatMat } = useMemo(() => {
    const segs = 12
    const verts: number[] = []
    const idx: number[] = []

    verts.push(0, 0, 0)
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2
      verts.push(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5)
    }
    for (let i = 1; i <= segs; i++) {
      idx.push(0, i, i + 1)
    }

    const allVerts: number[] = []
    const allIdx: number[] = []
    const ageAttr: number[] = []
    const maxAgeAttr: number[] = []
    const offsetAttr: number[] = []
    const scaleAttr: number[] = []
    const colorAttr: number[] = []
    const vertsPerDisc = verts.length / 3
    const idxPerDisc = idx.length

    for (let s = 0; s < SPLAT_POOL; s++) {
      const base = s * vertsPerDisc
      for (let v = 0; v < verts.length; v += 3) {
        allVerts.push(verts[v], verts[v + 1], verts[v + 2])
        ageAttr.push(0)
        maxAgeAttr.push(SPLAT_LIFE)
        offsetAttr.push(0, -10, 0)
        scaleAttr.push(1)
        colorAttr.push(0.6, 0.02, 0.02)
      }
      for (let j = 0; j < idxPerDisc; j++) {
        allIdx.push(idx[j] + base)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(allVerts, 3))
    geo.setAttribute('aAge', new THREE.Float32BufferAttribute(ageAttr, 1))
    geo.setAttribute('aMaxAge', new THREE.Float32BufferAttribute(maxAgeAttr, 1))
    geo.setAttribute('aOffset', new THREE.Float32BufferAttribute(offsetAttr, 3))
    geo.setAttribute('aScale', new THREE.Float32BufferAttribute(scaleAttr, 1))
    geo.setAttribute('aColor', new THREE.Float32BufferAttribute(colorAttr, 3))
    geo.setIndex(allIdx)

    const mat = new THREE.ShaderMaterial({
      vertexShader: splatVert,
      fragmentShader: splatFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })

    return { splatGeo: geo, splatMat: mat }
  }, [])

  useFrame((_s, delta) => {
    const state = stateRef.current
    if (state.paused) return

    // ─── Process kill queue ────────────────────────────────
    while (killQueue.current.length > 0) {
      const [kx, ky, kz] = killQueue.current.shift()!

      // Small puff of particles
      for (let i = 0; i < DROPLETS_PER_KILL; i++) {
        const di = nextDroplet.current % DROPLET_POOL
        nextDroplet.current++
        const d = droplets.current[di]
        d.active = true
        d.bounced = false
        d.age = 0
        d.maxAge = DROPLET_LIFE * (0.4 + Math.random())

        d.x = kx + (Math.random() - 0.5) * 0.3
        d.y = ky + Math.random() * 0.3
        d.z = kz + (Math.random() - 0.5) * 0.3

        const theta = Math.random() * Math.PI * 2
        const phi = Math.random() * Math.PI * 0.6
        const speed = 1 + Math.random() * 3
        d.vx = Math.sin(phi) * Math.cos(theta) * speed
        d.vy = Math.cos(phi) * speed * 0.6 + Math.random() * 2
        d.vz = Math.sin(phi) * Math.sin(theta) * speed

        d.size = 0.08 + Math.random() * 0.2

        const [cr, cg, cb] = randomBloodColor()
        d.r = cr
        d.g = cg
        d.b = cb
      }

      // Small ground marks
      for (let i = 0; i < SPLATS_PER_KILL; i++) {
        const si = nextSplat.current % SPLAT_POOL
        nextSplat.current++
        const s = splats.current[si]
        s.active = true
        s.age = 0
        s.maxAge = SPLAT_LIFE * (0.5 + Math.random() * 0.5)
        s.x = kx + (Math.random() - 0.5) * 1.5
        s.y = 0.02
        s.z = kz + (Math.random() - 0.5) * 1.5
        s.scale = 0.15 + Math.random() * 0.4
        const [cr, cg, cb] = randomBloodColor()
        s.r = cr
        s.g = cg
        s.b = cb
      }
    }

    // ─── Update droplet physics ────────────────────────────
    const dPos = dropletGeo.attributes.position.array as Float32Array
    const dSizes = dropletGeo.attributes.aSize.array as Float32Array
    const dAlphas = dropletGeo.attributes.aAlpha.array as Float32Array
    const dColors = dropletGeo.attributes.aColor.array as Float32Array

    for (let i = 0; i < DROPLET_POOL; i++) {
      const d = droplets.current[i]
      if (d.active) {
        d.age += delta
        d.vy -= 12.0 * delta
        d.vx *= 0.995
        d.vz *= 0.995
        d.x += d.vx * delta
        d.y += d.vy * delta
        d.z += d.vz * delta

        if (d.y <= 0.02) {
          if (!d.bounced && Math.abs(d.vy) > 1.5) {
            d.bounced = true
            d.y = 0.02
            d.vy = Math.abs(d.vy) * 0.25
            d.vx *= 0.5
            d.vz *= 0.5

            // Secondary ground splat from droplet impact
            const si = nextSplat.current % SPLAT_POOL
            nextSplat.current++
            const s = splats.current[si]
            s.active = true
            s.age = 0
            s.maxAge = SPLAT_LIFE * (0.3 + Math.random() * 0.5)
            s.x = d.x
            s.y = 0.02
            s.z = d.z
            s.scale = 0.15 + Math.random() * 0.6
            s.r = d.r * 0.7
            s.g = d.g * 0.7
            s.b = d.b * 0.7
          } else {
            d.active = false
          }
        }

        if (d.age >= d.maxAge) {
          d.active = false
        }
      }

      const i3 = i * 3
      if (d.active) {
        const progress = d.age / d.maxAge
        dPos[i3] = d.x
        dPos[i3 + 1] = d.y
        dPos[i3 + 2] = d.z
        dSizes[i] = d.size * (1.0 + progress * 0.5)
        dAlphas[i] = (1 - progress * progress) * 0.9
        dColors[i3] = d.r
        dColors[i3 + 1] = d.g
        dColors[i3 + 2] = d.b
      } else {
        dPos[i3 + 1] = -10
        dAlphas[i] = 0
      }
    }
    dropletGeo.attributes.position.needsUpdate = true
    dropletGeo.attributes.aSize.needsUpdate = true
    dropletGeo.attributes.aAlpha.needsUpdate = true
    dropletGeo.attributes.aColor.needsUpdate = true

    // ─── Update splat attributes ───────────────────────────
    const sAgeArr = splatGeo.attributes.aAge.array as Float32Array
    const sMaxAgeArr = splatGeo.attributes.aMaxAge.array as Float32Array
    const sOffsetArr = splatGeo.attributes.aOffset.array as Float32Array
    const sScaleArr = splatGeo.attributes.aScale.array as Float32Array
    const sColorArr = splatGeo.attributes.aColor.array as Float32Array
    const vertsPerDisc = splatGeo.attributes.position.count / SPLAT_POOL

    for (let s = 0; s < SPLAT_POOL; s++) {
      const slot = splats.current[s]
      if (slot.active) {
        slot.age += delta
        if (slot.age >= slot.maxAge) {
          slot.active = false
        }
      }
      const base = s * vertsPerDisc
      for (let v = 0; v < vertsPerDisc; v++) {
        const i = base + v
        sAgeArr[i] = slot.active ? slot.age : 0
        sMaxAgeArr[i] = slot.active ? slot.maxAge : 1
        sOffsetArr[i * 3] = slot.active ? slot.x : 0
        sOffsetArr[i * 3 + 1] = slot.active ? slot.y : -10
        sOffsetArr[i * 3 + 2] = slot.active ? slot.z : 0
        sScaleArr[i] = slot.active ? slot.scale : 0
        sColorArr[i * 3] = slot.r
        sColorArr[i * 3 + 1] = slot.g
        sColorArr[i * 3 + 2] = slot.b
      }
    }
    splatGeo.attributes.aAge.needsUpdate = true
    splatGeo.attributes.aMaxAge.needsUpdate = true
    splatGeo.attributes.aOffset.needsUpdate = true
    splatGeo.attributes.aScale.needsUpdate = true
    splatGeo.attributes.aColor.needsUpdate = true
  })

  return (
    <group>
      <points geometry={dropletGeo} material={dropletMat} />
      <mesh geometry={splatGeo} material={splatMat} />
    </group>
  )
}
