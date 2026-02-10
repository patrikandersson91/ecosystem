import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { riverCenterZ, RIVER_WIDTH, RIVER_MAX_DEPTH } from '../../utils/river-path'

const SEGMENTS_X = 128
const SEGMENTS_Z = 16
const RIVER_LENGTH = 110

const PARTICLE_COUNT = 1200

// ─── Riverbed shaders ─────────────────────────────────────────
const riverbedVert = /* glsl */ `
  varying float vDepth;

  void main() {
    vDepth = -position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const riverbedFrag = /* glsl */ `
  varying float vDepth;

  void main() {
    // Dark blue-brown riverbed, darker with depth
    vec3 shallow = vec3(0.18, 0.16, 0.14);
    vec3 deep = vec3(0.05, 0.06, 0.08);
    float depthFactor = clamp(vDepth / 1.8, 0.0, 1.0);
    vec3 color = mix(shallow, deep, depthFactor);
    gl_FragColor = vec4(color, 1.0);
  }
`

// ─── Water surface shaders ─────────────────────────────────────

const waterVert = /* glsl */ `
  varying vec2 vUv;
  varying float vEdge;
  varying float vWaveHeight;
  uniform float uTime;

  void main() {
    vUv = uv;
    vEdge = abs(uv.y - 0.5) * 2.0;

    vec3 pos = position;
    float wave1 = sin(pos.x * 0.5 + uTime * 1.2) * 0.08;
    float wave2 = sin(pos.x * 0.8 + pos.z * 0.4 + uTime * 0.9) * 0.05;
    float wave3 = cos(pos.x * 1.5 - pos.z * 0.8 + uTime * 2.0) * 0.025;
    float totalWave = (wave1 + wave2 + wave3) * (1.0 - vEdge * 0.7);
    pos.y += totalWave;
    vWaveHeight = totalWave;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const waterFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vEdge;
  varying float vWaveHeight;

  void main() {
    // Flow UVs — everything scrolls in one direction
    float flowSpeed = 0.06;
    vec2 flow1 = vec2(vUv.x + uTime * flowSpeed, vUv.y);
    vec2 flow2 = vec2(vUv.x + uTime * flowSpeed * 0.7, vUv.y * 1.3 + uTime * 0.008);

    float r1 = sin(flow1.x * 20.0 + flow1.y * 8.0) * 0.5 + 0.5;
    float r2 = sin(flow2.x * 15.0 - flow2.y * 12.0 + 0.5) * 0.5 + 0.5;
    float ripple = r1 * r2;

    float depth = 1.0 - vEdge;
    float depthCurve = depth * depth;

    // Pure blue palette — no green channel bias
    vec3 color = mix(uShallowColor, uDeepColor, depthCurve * 0.8 + ripple * 0.1);

    // Blue-white specular highlights
    float spec = pow(ripple, 8.0) * 0.25 * depth;
    color += vec3(spec * 0.7, spec * 0.75, spec);

    // Whitecaps on wave crests
    float crest = smoothstep(0.06, 0.14, vWaveHeight);
    color = mix(color, vec3(0.78, 0.85, 0.95), crest * 0.25);

    // Fully transparent at edges — no border visible at all
    float edgeFade = smoothstep(1.0, 0.45, vEdge);
    float alpha = uOpacity * edgeFade * (0.35 + depthCurve * 0.55);

    gl_FragColor = vec4(color, alpha);
  }
`

// ─── Particle shaders ──────────────────────────────────────────

const pointVert = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;

  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (80.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`

const pointFrag = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float a = vAlpha * (1.0 - smoothstep(0.1, 0.5, d));
    gl_FragColor = vec4(uColor, a);
  }
`

// ─── Component ─────────────────────────────────────────────

export default function River() {
  const timeRef = useRef(0)

  // --- riverbed mesh — narrower than the water so edges never show ---
  const { riverbedGeo, riverbedMat } = useMemo(() => {
    const BED_WIDTH_FACTOR = 0.75 // only 75% of river width
    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    for (let ix = 0; ix <= SEGMENTS_X; ix++) {
      const tx = ix / SEGMENTS_X
      const x = (tx - 0.5) * RIVER_LENGTH
      const cz = riverCenterZ(x)
      for (let iz = 0; iz <= SEGMENTS_Z; iz++) {
        const tz = iz / SEGMENTS_Z
        const z = cz + (tz - 0.5) * RIVER_WIDTH * BED_WIDTH_FACTOR
        const edgeDist = Math.abs(tz - 0.5) * 2
        const depthT = 1 - edgeDist
        // Edges sit well below surface so nothing pokes through
        const y = -RIVER_MAX_DEPTH * depthT * depthT - 0.1
        positions.push(x, y, z)
        uvs.push(tx * 10, tz)
      }
    }
    for (let ix = 0; ix < SEGMENTS_X; ix++) {
      for (let iz = 0; iz < SEGMENTS_Z; iz++) {
        const a = ix * (SEGMENTS_Z + 1) + iz
        const b = a + 1
        const c = (ix + 1) * (SEGMENTS_Z + 1) + iz
        const d = c + 1
        indices.push(a, c, b, b, c, d)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geo.setIndex(indices)
    geo.computeVertexNormals()

    const mat = new THREE.ShaderMaterial({
      vertexShader: riverbedVert,
      fragmentShader: riverbedFrag,
      side: THREE.DoubleSide,
    })
    return { riverbedGeo: geo, riverbedMat: mat }
  }, [])

  // --- water surface mesh ---
  const { geometry, waterMat } = useMemo(() => {
    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    for (let ix = 0; ix <= SEGMENTS_X; ix++) {
      const tx = ix / SEGMENTS_X
      const x = (tx - 0.5) * RIVER_LENGTH
      const cz = riverCenterZ(x)
      for (let iz = 0; iz <= SEGMENTS_Z; iz++) {
        const tz = iz / SEGMENTS_Z
        positions.push(x, 0.02, cz + (tz - 0.5) * RIVER_WIDTH)
        uvs.push(tx * 10, tz)
      }
    }
    for (let ix = 0; ix < SEGMENTS_X; ix++) {
      for (let iz = 0; iz < SEGMENTS_Z; iz++) {
        const a = ix * (SEGMENTS_Z + 1) + iz
        const b = a + 1
        const c = (ix + 1) * (SEGMENTS_Z + 1) + iz
        const d = c + 1
        indices.push(a, c, b, b, c, d)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geo.setIndex(indices)
    geo.computeVertexNormals()

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDeepColor: { value: new THREE.Color('#0a3a6a') },
        uShallowColor: { value: new THREE.Color('#2a7ab8') },
        uOpacity: { value: 0.82 },
      },
      vertexShader: waterVert,
      fragmentShader: waterFrag,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    return { geometry: geo, waterMat: mat }
  }, [])

  // --- flowing water particles (no additive blending — pure white/blue) ---
  const { particleGeo, particleMat, pVelocities, pPhases } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3)
    const sizes = new Float32Array(PARTICLE_COUNT)
    const alphas = new Float32Array(PARTICLE_COUNT)
    const vel = new Float32Array(PARTICLE_COUNT)
    const ph = new Float32Array(PARTICLE_COUNT)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const x = (Math.random() - 0.5) * RIVER_LENGTH
      const cz = riverCenterZ(x)
      pos[i * 3] = x
      pos[i * 3 + 1] = 0.05 + Math.random() * 0.04
      pos[i * 3 + 2] = cz + (Math.random() - 0.5) * RIVER_WIDTH * 0.7
      sizes[i] = 0.12 + Math.random() * 0.28
      alphas[i] = 0.06 + Math.random() * 0.12
      vel[i] = 1.0 + Math.random() * 2.5
      ph[i] = Math.random() * Math.PI * 2
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1))
    geo.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alphas, 1))

    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color('#ffffff') } },
      vertexShader: pointVert,
      fragmentShader: pointFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })
    return { particleGeo: geo, particleMat: mat, pVelocities: vel, pPhases: ph }
  }, [])

  // --- animation loop ---
  useFrame((_s, delta) => {
    timeRef.current += delta
    const t = timeRef.current

    waterMat.uniforms.uTime.value = t

    // flowing particles: drift along -X, bob, stay in river
    const pp = particleGeo.attributes.position as THREE.BufferAttribute
    const pArr = pp.array as Float32Array
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3
      pArr[i3] -= pVelocities[i] * delta
      if (pArr[i3] < -RIVER_LENGTH / 2) {
        pArr[i3] = RIVER_LENGTH / 2
        const cz = riverCenterZ(pArr[i3])
        pArr[i3 + 2] = cz + (Math.random() - 0.5) * RIVER_WIDTH * 0.7
      }
      const cz = riverCenterZ(pArr[i3])
      const dz = pArr[i3 + 2] - cz
      if (Math.abs(dz) > RIVER_WIDTH * 0.35) {
        pArr[i3 + 2] = cz + Math.sign(dz) * RIVER_WIDTH * 0.35
      }
      pArr[i3 + 1] = 0.05 + Math.sin(t * 2 + pPhases[i]) * 0.025
    }
    pp.needsUpdate = true
  })

  return (
    <group position={[0, 0.15, 0]}>
      <mesh geometry={riverbedGeo} material={riverbedMat} />
      <mesh geometry={geometry} material={waterMat} />
      <points geometry={particleGeo} material={particleMat} />
    </group>
  )
}
