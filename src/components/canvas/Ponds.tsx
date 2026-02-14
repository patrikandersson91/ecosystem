import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, Color, Shape } from 'three'
import type { Mesh, Points, ShaderMaterial } from 'three'
import { WATER_PONDS, pondRadiusAtAngle } from '../../utils/river-path.ts'
import { groundHeightAt } from '../../utils/terrain-height.ts'

function createPondShape(pond: (typeof WATER_PONDS)[number], scale = 1): Shape {
  const shape = new Shape()
  const segments = 72
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    const r = pondRadiusAtAngle(pond, a) * scale
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (i === 0) shape.moveTo(x, z)
    else shape.lineTo(x, z)
  }
  shape.closePath()
  return shape
}

export default function Ponds() {
  const surfaceRefs = useRef<Array<Mesh | null>>([])
  const particleRef = useRef<Points>(null!)
  const particleMatRef = useRef<ShaderMaterial>(null!)

  const pondShapes = useMemo(
    () =>
      WATER_PONDS.map((pond) => ({
        water: createPondShape(pond, 1),
        bed: createPondShape(pond, 0.95),
        shore: createPondShape(pond, 1.08),
      })),
    [],
  )

  const particleData = useMemo(() => {
    const perPond = 100
    const total = WATER_PONDS.length * perPond
    const positions = new Float32Array(total * 3)
    const size = new Float32Array(total)
    const alpha = new Float32Array(total)
    const pondIdx = new Uint8Array(total)
    const angle = new Float32Array(total)
    const radial = new Float32Array(total)
    const angularVel = new Float32Array(total)

    let k = 0
    for (let pi = 0; pi < WATER_PONDS.length; pi++) {
      for (let i = 0; i < perPond; i++, k++) {
        pondIdx[k] = pi
        angle[k] = Math.random() * Math.PI * 2
        radial[k] = Math.sqrt(Math.random()) * (0.2 + Math.random() * 0.8)
        angularVel[k] = (Math.random() * 2 - 1) * 0.22
        size[k] = 0.08 + Math.random() * 0.18
        alpha[k] = 0.08 + Math.random() * 0.14
      }
    }

    return { positions, size, alpha, pondIdx, angle, radial, angularVel, count: total }
  }, [])

  useFrame((_, delta) => {
    for (let i = 0; i < WATER_PONDS.length; i++) {
      const mesh = surfaceRefs.current[i]
      if (!mesh) continue
      const t = performance.now() * 0.001 + i * 0.9
      mesh.position.y = 0.02 + Math.sin(t * 0.55) * 0.012
    }

    if (particleMatRef.current) {
      particleMatRef.current.uniforms.uTime.value += delta
    }

    const pts = particleRef.current
    if (!pts) return
    const posAttr = pts.geometry.getAttribute('position') as BufferAttribute
    const arr = posAttr.array as Float32Array
    const t = performance.now() * 0.001

    for (let i = 0; i < particleData.count; i++) {
      const pond = WATER_PONDS[particleData.pondIdx[i]]
      const a = particleData.angle[i] + particleData.angularVel[i] * delta
      particleData.angle[i] = a
      const r = pondRadiusAtAngle(pond, a) * particleData.radial[i]
      const i3 = i * 3

      arr[i3] = pond.center[0] + Math.cos(a) * r
      arr[i3 + 2] = pond.center[1] + Math.sin(a) * r
      arr[i3 + 1] = groundHeightAt(arr[i3], arr[i3 + 2]) + 0.045 + Math.sin(t * 2.2 + i * 0.13) * 0.02
    }

    posAttr.needsUpdate = true
  })

  return (
    <group>
      {WATER_PONDS.map((pond, i) => {
        const [x, z] = pond.center
        // We place the pond visuals at absolute height relative to water table
        // Terrain is already carved down to form the bed.
        return (
          <group key={i} position={[x, 0, z]}>
            {/* Water surface with subtle, slow movement */}
            <mesh
              ref={(el) => { surfaceRefs.current[i] = el; }}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0.06, 0]}
            >
              <shapeGeometry args={[pondShapes[i].water]} />
              <meshPhysicalMaterial
                color="#4a8da0"
                transparent
                opacity={0.55}
                roughness={0.08}
                metalness={0.02}
                transmission={0.3}
                ior={1.33}
                thickness={1.5}
                envMapIntensity={1.2}
                depthWrite={false}
              />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
              <shapeGeometry args={[pondShapes[i].water]} />
              <meshBasicMaterial color="#9bc4cf" transparent opacity={0.09} depthWrite={false} />
            </mesh>
            {/* Soft shoreline tint */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.065, 0]}>
              <shapeGeometry args={[pondShapes[i].shore]} />
              <meshBasicMaterial color="#8ea68c" transparent opacity={0.1} depthWrite={false} />
            </mesh>
          </group>
        )
      })}

      {/* Fine floating particles for still-water motion */}
      <points ref={particleRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particleData.positions, 3]}
            count={particleData.count}
          />
          <bufferAttribute attach="attributes-aSize" args={[particleData.size, 1]} count={particleData.count} />
          <bufferAttribute attach="attributes-aAlpha" args={[particleData.alpha, 1]} count={particleData.count} />
        </bufferGeometry>
        <shaderMaterial
          ref={particleMatRef}
          transparent
          depthWrite={false}
          uniforms={{ uTime: { value: 0 }, uColor: { value: new Color('#d6edff') } }}
          vertexShader={/* glsl */ `
            attribute float aSize;
            attribute float aAlpha;
            varying float vAlpha;
            void main() {
              vAlpha = aAlpha;
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              gl_PointSize = aSize * (90.0 / -mv.z);
              gl_Position = projectionMatrix * mv;
            }
          `}
          fragmentShader={/* glsl */ `
            uniform vec3 uColor;
            varying float vAlpha;
            void main() {
              float d = length(gl_PointCoord - vec2(0.5));
              if (d > 0.5) discard;
              float a = vAlpha * (1.0 - smoothstep(0.05, 0.5, d));
              gl_FragColor = vec4(uColor, a);
            }
          `}
        />
      </points>
    </group>
  )
}
