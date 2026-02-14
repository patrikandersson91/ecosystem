import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import { Vector3 } from 'three'
import type { Mesh, MeshBasicMaterial, Group } from 'three'

interface StatusBarProps {
  hungerRef: React.RefObject<number>
  thirstRef: React.RefObject<number>
  yOffset?: number
}

const BAR_WIDTH = 0.6
const BAR_HEIGHT = 0.05
const BAR_GAP = 0.02
const VISIBILITY_DISTANCE = 30

const _tempVec = new Vector3()

export default function StatusBar({ hungerRef, thirstRef, yOffset = 1.0 }: StatusBarProps) {
  const groupRef = useRef<Group>(null!)
  const hungerFillRef = useRef<Mesh>(null!)
  const thirstFillRef = useRef<Mesh>(null!)
  const hungerMatRef = useRef<MeshBasicMaterial>(null!)
  const camera = useThree((s) => s.camera)

  useFrame(() => {
    if (!groupRef.current) return

    // Distance-based visibility: hide when zoomed out
    groupRef.current.getWorldPosition(_tempVec)
    const dist = camera.position.distanceTo(_tempVec)
    const visible = dist < VISIBILITY_DISTANCE
    groupRef.current.visible = visible
    if (!visible) return

    const h = Math.max(0.001, hungerRef.current)
    const t = Math.max(0.001, thirstRef.current)

    // Hunger bar: scale and left-align
    hungerFillRef.current.scale.x = h
    hungerFillRef.current.position.x = (h - 1) * BAR_WIDTH / 2

    // Hunger color: green → yellow → red based on value
    hungerMatRef.current.color.setHSL(h * 0.33, 0.8, 0.5)

    // Thirst bar: scale and left-align
    thirstFillRef.current.scale.x = t
    thirstFillRef.current.position.x = (t - 1) * BAR_WIDTH / 2
  })

  const topY = BAR_GAP / 2 + BAR_HEIGHT / 2
  const bottomY = -(BAR_GAP / 2 + BAR_HEIGHT / 2)

  return (
    <Billboard ref={groupRef} position={[0, yOffset, 0]}>
      {/* Hunger background */}
      <mesh position={[0, topY, 0]}>
        <planeGeometry args={[BAR_WIDTH, BAR_HEIGHT]} />
        <meshBasicMaterial color="#333333" transparent opacity={0.5} />
      </mesh>
      {/* Hunger fill */}
      <mesh ref={hungerFillRef} position={[0, topY, 0.001]}>
        <planeGeometry args={[BAR_WIDTH, BAR_HEIGHT]} />
        <meshBasicMaterial ref={hungerMatRef} color="#4ade80" />
      </mesh>
      {/* Thirst background */}
      <mesh position={[0, bottomY, 0]}>
        <planeGeometry args={[BAR_WIDTH, BAR_HEIGHT]} />
        <meshBasicMaterial color="#333333" transparent opacity={0.5} />
      </mesh>
      {/* Thirst fill */}
      <mesh ref={thirstFillRef} position={[0, bottomY, 0.001]}>
        <planeGeometry args={[BAR_WIDTH, BAR_HEIGHT]} />
        <meshBasicMaterial color="#60a5fa" />
      </mesh>
    </Billboard>
  )
}
