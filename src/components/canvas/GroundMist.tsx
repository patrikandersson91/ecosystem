import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { WORLD_SIZE } from '../../types/ecosystem.ts'
import { useWeatherRefs } from '../../state/weather-refs.tsx'

const mistVert = /* glsl */ `
  varying vec2 vUv;
  varying float vViewDist;

  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDist = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const mistFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uDensity;
  uniform float uRainBoost;

  varying vec2 vUv;
  varying float vViewDist;

  // Simple noise for mist variation
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    v += noise(p * 1.0) * 0.5;
    v += noise(p * 2.0 + uTime * 0.02) * 0.25;
    v += noise(p * 4.0 - uTime * 0.015) * 0.125;
    return v;
  }

  void main() {
    // Distance-based alpha: transparent up close, visible at medium range, fade far
    float nearFade = smoothstep(5.0, 40.0, vViewDist);
    float farFade = 1.0 - smoothstep(150.0, 300.0, vViewDist);

    // Edge fade — stronger toward edges of the plane
    vec2 centered = (vUv - 0.5) * 2.0;
    float edgeDist = 1.0 - length(centered);
    float edgeFade = smoothstep(0.0, 0.3, edgeDist);

    // Noise-based mist pattern
    vec2 worldUv = vUv * 8.0;
    float mistPattern = fbm(worldUv);

    float density = uDensity + uRainBoost * 0.3;
    float alpha = mistPattern * density * nearFade * farFade * edgeFade * 0.25;

    gl_FragColor = vec4(uColor, alpha);
  }
`

export default function GroundMist() {
  const weatherRefs = useWeatherRefs()
  const matRef = useRef<THREE.ShaderMaterial>(null!)

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#c8d8e4') },
    uDensity: { value: 0.6 },
    uRainBoost: { value: 0 },
  }), [])

  useFrame((_, delta) => {
    uniforms.uTime.value += delta

    const t = weatherRefs.timeOfDay.current
    // Mist denser at dawn/dusk and night
    let density = 0.4
    if (t < 0.10) density = 0.8
    else if (t < 0.18) density = 0.8 - ((t - 0.10) / 0.08) * 0.4
    else if (t > 0.66 && t < 0.78) density = 0.4 + ((t - 0.66) / 0.12) * 0.4
    else if (t >= 0.78) density = 0.8

    uniforms.uDensity.value = density
    uniforms.uRainBoost.value = weatherRefs.isRaining.current ? weatherRefs.rainIntensity.current : 0

    // Tint mist by sky color
    uniforms.uColor.value.copy(weatherRefs.skyColor.current)
    uniforms.uColor.value.lerp(new THREE.Color('#ffffff'), 0.5)
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.8, 0]}>
      <planeGeometry args={[WORLD_SIZE * 2, WORLD_SIZE * 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={mistVert}
        fragmentShader={mistFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
