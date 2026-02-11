import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useEcosystem } from '../../state/ecosystem-context'
/* eslint-disable react-hooks/exhaustive-deps */
// @ts-ignore
/* eslint-disable */
import { riverCenterZ, RIVER_HALF_LENGTH, RIVER_WIDTH, RIVER_MAX_DEPTH } from '../../utils/river-path'
import { WORLD_SCALE } from '../../types/ecosystem.ts'

const SEGMENTS_X = Math.max(128, Math.floor(128 * WORLD_SCALE))
const SEGMENTS_Z = 16
const RIVER_LENGTH = RIVER_HALF_LENGTH * 2

const PARTICLE_COUNT = Math.floor(1500 * WORLD_SCALE)

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
  varying float vViewDepth;
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

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vViewDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`


// ─── Particle shaders ──────────────────────────────────────────

const pointVert = /* glsl */ `
  uniform float uTime;
  uniform float uRiverLength;

  attribute float aSize;
  attribute float aAlpha;
  attribute float aVelocity;
  attribute float aPhase;
  attribute float aOffsetZ;
  
  varying float vAlpha;

  // Function to calculate center Z (matches JS implementation)
  float getRiverCenterZ(float x) {
    return 6.0 * sin(x * 0.1) + 3.0 * sin(x * 0.17 + 1.2);
  }

  void main() {
    vAlpha = aAlpha;
    
    // Calculate X position with wrap-around
    float xDist = aVelocity * uTime;
    float xBase = position.x;
    float x = mod(xBase - xDist + uRiverLength * 0.5, uRiverLength) - uRiverLength * 0.5;
    
    // Calculate Z position based on river curve
    float cz = getRiverCenterZ(x);
    float z = cz + aOffsetZ;
    
    // Calculate Y (bobbing) above the new water level
    float y = 0.12 + sin(uTime * 2.0 + aPhase) * 0.025;
    
    vec4 mv = modelViewMatrix * vec4(x, y, z, 1.0);
    gl_PointSize = aSize * (80.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`

const pointFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uLightIntensity;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float a = vAlpha * (1.0 - smoothstep(0.1, 0.5, d));
    
    // Darken particles at night
    vec3 finalColor = uColor * uLightIntensity;
    gl_FragColor = vec4(finalColor, a);
  }
`

// ─── Component ─────────────────────────────────────────────

export default function River() {
  const timeRef = useRef(0)
  const state = useEcosystem()

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
        positions.push(x, 0.06, cz + (tz - 0.5) * RIVER_WIDTH)
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
        uDeepColor: { value: new THREE.Color('#2a5b70') },
        uShallowColor: { value: new THREE.Color('#5f96a7') },
        uFoamColor: { value: new THREE.Color('#dce8ec') },
        uOpacity: { value: 0.64 },
        uLightIntensity: { value: 1.0 },
      },
      vertexShader: waterVert,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uDeepColor;
        uniform vec3 uShallowColor;
        uniform vec3 uFoamColor;
        uniform float uOpacity;
        uniform float uLightIntensity;
        varying vec2 vUv;
        varying float vEdge;
        varying float vWaveHeight;
        varying float vViewDepth;

        void main() {
          // Flow UVs — everything scrolls in one direction
          float flowSpeed = 0.06;
          vec2 flow1 = vec2(vUv.x + uTime * flowSpeed, vUv.y);
          vec2 flow2 = vec2(vUv.x + uTime * flowSpeed * 0.7, vUv.y * 1.3 + uTime * 0.008);

          float r1 = sin(flow1.x * 20.0 + flow1.y * 8.0) * 0.5 + 0.5;
          float r2 = sin(flow2.x * 15.0 - flow2.y * 12.0 + 0.5) * 0.5 + 0.5;
          float ripple = r1 * r2;

          float depth = 1.0 - vEdge; // 1 at center, 0 at edge
          float depthCurve = depth * depth;

          // Base water color
          vec3 color = mix(uShallowColor, uDeepColor, depthCurve * 0.8 + ripple * 0.1);
          float distFade = smoothstep(35.0, 170.0, vViewDepth);

          // Softer highlights so distant water stays calm and transparent.
          float spec = pow(ripple, 8.0) * 0.16 * depth * (1.0 - distFade * 0.65);
          color += vec3(spec);

          // Foam at edges (where depth is low)
          float foamMask = smoothstep(0.15, 0.0, depth - ripple * 0.1); // High near edges
          color = mix(color, uFoamColor, foamMask * 0.3 * (1.0 - distFade * 0.6));

          // Whitecaps on wave crests
          float crest = smoothstep(0.06, 0.14, vWaveHeight);
          color = mix(color, uFoamColor, crest * 0.18 * (1.0 - distFade * 0.7));

          // Distant water shifts gently toward mid-tone and less saturation.
          vec3 distantTint = mix(uShallowColor, uDeepColor, 0.5);
          color = mix(color, distantTint, distFade * 0.22);

          // Apply light intensity (reaction to day/night)
          color *= uLightIntensity;

          // Opacity fade at very edges
          float edgeFade = smoothstep(0.0, 0.1, depth);
          float alpha = uOpacity * edgeFade * mix(1.0, 0.72, distFade);

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    return { geometry: geo, waterMat: mat }
  }, [])

  // --- flowing water particles (GPU animated) ---
  const { particleGeo, particleMat } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3)
    const sizes = new Float32Array(PARTICLE_COUNT)
    const alphas = new Float32Array(PARTICLE_COUNT)
    const vel = new Float32Array(PARTICLE_COUNT)
    const ph = new Float32Array(PARTICLE_COUNT)
    const offsetZ = new Float32Array(PARTICLE_COUNT)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const x = (Math.random() - 0.5) * RIVER_LENGTH
      // Position x holds the initial x. y, z unused for position input (z calc in shader)
      pos[i * 3] = x
      pos[i * 3 + 1] = 0 
      pos[i * 3 + 2] = 0 
      
      sizes[i] = 0.12 + Math.random() * 0.28
      alphas[i] = 0.06 + Math.random() * 0.12
      vel[i] = 1.0 + Math.random() * 2.5
      ph[i] = Math.random() * Math.PI * 2
      offsetZ[i] = (Math.random() - 0.5) * RIVER_WIDTH * 0.7
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1))
    geo.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alphas, 1))
    geo.setAttribute('aVelocity', new THREE.Float32BufferAttribute(vel, 1))
    geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(ph, 1))
    geo.setAttribute('aOffsetZ', new THREE.Float32BufferAttribute(offsetZ, 1))

    const mat = new THREE.ShaderMaterial({
      uniforms: { 
        uColor: { value: new THREE.Color('#ffffff') },
        uTime: { value: 0 },
        uRiverLength: { value: RIVER_LENGTH },
        uLightIntensity: { value: 1.0 }
      },
      vertexShader: pointVert,
      fragmentShader: pointFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })
    return { particleGeo: geo, particleMat: mat }
  }, [])

  // --- animation loop ---
  useFrame((_s, delta) => {
    timeRef.current += delta
    const t = timeRef.current

    waterMat.uniforms.uTime.value = t
    particleMat.uniforms.uTime.value = t

    // Calculate light intensity from time of day
    // Night: 0.2, Day: 1.0. Transitions at 0.1 and 0.7
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
    
    waterMat.uniforms.uLightIntensity.value = intensity
    particleMat.uniforms.uLightIntensity.value = intensity
  })

  return (
    <group position={[0, 0.15, 0]}>
      <mesh geometry={riverbedGeo} material={riverbedMat} />
      <mesh geometry={geometry} material={waterMat} />
      <points geometry={particleGeo} material={particleMat} />
    </group>
  )
}
