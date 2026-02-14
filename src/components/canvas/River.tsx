import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useEcosystem } from '../../state/ecosystem-context'
import { useWeatherRefs } from '../../state/weather-refs.tsx'
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
    vec3 shallow = vec3(0.18, 0.16, 0.14);
    vec3 deep = vec3(0.05, 0.06, 0.08);
    float depthFactor = clamp(vDepth / 1.8, 0.0, 1.0);
    vec3 color = mix(shallow, deep, depthFactor);
    gl_FragColor = vec4(color, 1.0);
  }
`

// ─── Water surface shaders (enhanced with Fresnel, specular, sky reflection) ───

const waterVert = /* glsl */ `
  varying vec2 vUv;
  varying float vEdge;
  varying float vWaveHeight;
  varying float vViewDepth;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
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

    // Compute normal from wave derivatives
    float dWdx = cos(pos.x * 0.5 + uTime * 1.2) * 0.5 * 0.08
               + cos(pos.x * 0.8 + pos.z * 0.4 + uTime * 0.9) * 0.8 * 0.05
               - sin(pos.x * 1.5 - pos.z * 0.8 + uTime * 2.0) * 1.5 * 0.025;
    float dWdz = cos(pos.x * 0.8 + pos.z * 0.4 + uTime * 0.9) * 0.4 * 0.05
               + sin(pos.x * 1.5 - pos.z * 0.8 + uTime * 2.0) * 0.8 * 0.025;
    dWdx *= (1.0 - vEdge * 0.7);
    dWdz *= (1.0 - vEdge * 0.7);
    vNormal = normalize(vec3(-dWdx, 1.0, -dWdz));

    // Approximate world position (river group offset is small, pos ~= worldPos)
    vWorldPos = pos;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vViewDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const waterFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uFoamColor;
  uniform float uOpacity;
  uniform float uLightIntensity;
  uniform vec3 uSunPosition;
  uniform vec3 uSkyColor;
  uniform vec3 uCameraPosition;
  uniform vec3 uSunColor;

  varying vec2 vUv;
  varying float vEdge;
  varying float vWaveHeight;
  varying float vViewDepth;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    // Flow UVs
    float flowSpeed = 0.06;
    vec2 flow1 = vec2(vUv.x + uTime * flowSpeed, vUv.y);
    vec2 flow2 = vec2(vUv.x + uTime * flowSpeed * 0.7, vUv.y * 1.3 + uTime * 0.008);

    float r1 = sin(flow1.x * 20.0 + flow1.y * 8.0) * 0.5 + 0.5;
    float r2 = sin(flow2.x * 15.0 - flow2.y * 12.0 + 0.5) * 0.5 + 0.5;
    float ripple = r1 * r2;

    float depth = 1.0 - vEdge;
    float depthCurve = depth * depth;

    // Base water color
    vec3 color = mix(uShallowColor, uDeepColor, depthCurve * 0.8 + ripple * 0.1);
    float distFade = smoothstep(35.0, 170.0, vViewDepth);

    // ─── Fresnel effect ─────────────────────────
    vec3 viewDir = normalize(uCameraPosition - vWorldPos);
    vec3 normal = normalize(vNormal);
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
    fresnel = clamp(fresnel, 0.0, 1.0);

    // Mix sky reflection based on Fresnel
    vec3 reflectionColor = uSkyColor * 0.8 + vec3(0.1);
    color = mix(color, reflectionColor, fresnel * 0.55);

    // ─── Sun specular highlight ─────────────────
    vec3 lightDir = normalize(uSunPosition);
    vec3 halfVec = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfVec), 0.0), 128.0);
    // Broader secondary specular
    float spec2 = pow(max(dot(normal, halfVec), 0.0), 16.0);
    vec3 specColor = uSunColor * (spec * 1.8 + spec2 * 0.15) * uLightIntensity * depth;
    color += specColor;

    // Softer highlights at distance
    float specDistFade = 1.0 - distFade * 0.65;
    float baseSpec = pow(ripple, 8.0) * 0.12 * depth * specDistFade;
    color += vec3(baseSpec);

    // Foam at edges
    float foamMask = smoothstep(0.15, 0.0, depth - ripple * 0.1);
    color = mix(color, uFoamColor, foamMask * 0.3 * (1.0 - distFade * 0.6));

    // Whitecaps on wave crests
    float crest = smoothstep(0.06, 0.14, vWaveHeight);
    color = mix(color, uFoamColor, crest * 0.18 * (1.0 - distFade * 0.7));

    // Distant tint
    vec3 distantTint = mix(uShallowColor, uDeepColor, 0.5);
    color = mix(color, distantTint, distFade * 0.22);

    // Apply light intensity
    color *= uLightIntensity;

    // Opacity fade at edges
    float edgeFade = smoothstep(0.0, 0.1, depth);
    float alpha = uOpacity * edgeFade * mix(1.0, 0.72, distFade);

    // Boost alpha slightly where specular is strong (makes sun reflection pop)
    alpha = min(1.0, alpha + spec * 0.4);

    gl_FragColor = vec4(color, alpha);
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

  float getRiverCenterZ(float x) {
    return 6.0 * sin(x * 0.1) + 3.0 * sin(x * 0.17 + 1.2);
  }

  void main() {
    vAlpha = aAlpha;
    float xDist = aVelocity * uTime;
    float xBase = position.x;
    float x = mod(xBase - xDist + uRiverLength * 0.5, uRiverLength) - uRiverLength * 0.5;
    float cz = getRiverCenterZ(x);
    float z = cz + aOffsetZ;
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
    vec3 finalColor = uColor * uLightIntensity;
    gl_FragColor = vec4(finalColor, a);
  }
`

// ─── Component ─────────────────────────────────────────────

export default function River() {
  const timeRef = useRef(0)
  const state = useEcosystem()
  const weatherRefs = useWeatherRefs()

  // --- riverbed mesh ---
  const { riverbedGeo, riverbedMat } = useMemo(() => {
    const BED_WIDTH_FACTOR = 0.75
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
        uOpacity: { value: 0.68 },
        uLightIntensity: { value: 1.0 },
        uSunPosition: { value: new THREE.Vector3(0, 35, -15) },
        uSkyColor: { value: new THREE.Color('#87ceeb') },
        uCameraPosition: { value: new THREE.Vector3() },
        uSunColor: { value: new THREE.Color('#fffff0') },
      },
      vertexShader: waterVert,
      fragmentShader: waterFrag,
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
        uLightIntensity: { value: 1.0 },
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
  useFrame(({ camera }, delta) => {
    timeRef.current += delta
    const t = timeRef.current

    waterMat.uniforms.uTime.value = t
    particleMat.uniforms.uTime.value = t

    // Light intensity from time of day
    const timeOfDay = state.timeOfDay
    let intensity = 0.25
    if (timeOfDay > 0.08 && timeOfDay < 0.2) {
      intensity = 0.25 + ((timeOfDay - 0.08) / 0.12) * 0.75
    } else if (timeOfDay >= 0.2 && timeOfDay < 0.7) {
      intensity = 1.0
    } else if (timeOfDay >= 0.7 && timeOfDay < 0.82) {
      intensity = 1.0 - ((timeOfDay - 0.7) / 0.12) * 0.75
    }

    waterMat.uniforms.uLightIntensity.value = intensity
    particleMat.uniforms.uLightIntensity.value = intensity

    // Update sun/sky/camera uniforms from weather refs
    waterMat.uniforms.uSunPosition.value.copy(weatherRefs.sunPosition.current)
    waterMat.uniforms.uSkyColor.value.copy(weatherRefs.skyColor.current)
    waterMat.uniforms.uSunColor.value.copy(weatherRefs.sunColor.current)
    waterMat.uniforms.uCameraPosition.value.copy(camera.position)
  })

  return (
    <group position={[0, 0.15, 0]}>
      <mesh geometry={riverbedGeo} material={riverbedMat} />
      <mesh geometry={geometry} material={waterMat} />
      <points geometry={particleGeo} material={particleMat} />
    </group>
  )
}
