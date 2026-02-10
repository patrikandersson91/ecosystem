import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line, Html } from '@react-three/drei'
import { Vector3 } from 'three'
import { useDebug } from '../../state/debug-context.tsx'

interface IntentionOverlayProps {
  /** Ref to current world position of the entity */
  positionRef: React.RefObject<Vector3>
  /** Ref to current target world position (null when wandering) */
  targetRef: React.RefObject<Vector3 | null>
  /** Ref to current intention label string */
  intentionRef: React.RefObject<string>
  /** Y offset above the entity for the label */
  labelY?: number
  /** Line color */
  color?: string
  /** Base sight / aggro radius (used for initial geometry) */
  sightRadius?: number
  /** Ref to the effective (dynamic) sight radius — scales the ring each frame */
  sightRadiusRef?: React.RefObject<number>
}

export default function IntentionOverlay({
  positionRef,
  targetRef,
  intentionRef,
  labelY = 1.4,
  color = '#00ffff',
  sightRadius,
  sightRadiusRef,
}: IntentionOverlayProps) {
  const { showIntentions } = useDebug()
  const lineRef = useRef<{ geometry: { setPositions: (arr: number[]) => void } }>(null!)
  const htmlRef = useRef<HTMLDivElement>(null!)
  const groupRef = useRef<THREE.Group>(null!)
  const lineGroupRef = useRef<THREE.Group>(null!)
  const ringRef = useRef<THREE.Group>(null!)

  useFrame(() => {
    if (!showIntentions) return

    const pos = positionRef.current
    const target = targetRef.current
    const label = intentionRef.current

    // Update label position to follow entity
    if (groupRef.current) {
      groupRef.current.position.set(pos.x, labelY, pos.z)
    }

    // Update html text
    if (htmlRef.current) {
      htmlRef.current.textContent = label
    }

    // Update line
    if (lineRef.current && target) {
      lineRef.current.geometry.setPositions([
        pos.x, 0.3, pos.z,
        target.x, 0.3, target.z,
      ])
      lineGroupRef.current.visible = true
    } else if (lineGroupRef.current) {
      lineGroupRef.current.visible = false
    }

    // Update sight radius ring position and dynamic scale
    if (ringRef.current) {
      ringRef.current.position.set(pos.x, 0.05, pos.z)
      if (sightRadiusRef && sightRadius) {
        const scale = sightRadiusRef.current / sightRadius
        ringRef.current.scale.set(scale, scale, 1)
      }
    }
  })

  if (!showIntentions) return null

  return (
    <>
      {/* Label above head */}
      <group ref={groupRef}>
        <Html center distanceFactor={20} style={{ pointerEvents: 'none' }}>
          <div
            ref={htmlRef}
            style={{
              color,
              fontSize: '11px',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              textShadow: '0 0 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1)',
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}
          />
        </Html>
      </group>

      {/* Line to target */}
      <group ref={lineGroupRef}>
        <Line
          ref={lineRef as never}
          points={[[0, 0, 0], [0, 0, 0]]}
          color={color}
          lineWidth={1.5}
          transparent
          opacity={0.6}
          dashed
          dashSize={0.5}
          gapSize={0.3}
        />
      </group>

      {/* Sight / aggro radius circle */}
      {sightRadius != null && (
        <group ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh>
            <ringGeometry args={[sightRadius - 0.05, sightRadius, 64]} />
            <meshBasicMaterial color={color} transparent opacity={0.25} depthWrite={false} />
          </mesh>
        </group>
      )}
    </>
  )
}
