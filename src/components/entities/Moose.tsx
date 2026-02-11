import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { Group } from 'three'
import type { MooseState } from '../../types/ecosystem.ts'
import {
  MAX_SPEED_MOOSE,
  NEED_THRESHOLD,
  WORLD_SIZE,
} from '../../types/ecosystem.ts'
import { ALL_OBSTACLES } from '../../data/obstacles.ts'
import { waterDepthAt } from '../../utils/river-path.ts'
import { groundHeightAt } from '../../utils/terrain-height.ts'
import { useSteering } from '../../hooks/useSteering.ts'
import { useEntityNeeds } from '../../hooks/useEntityNeeds.ts'
import { useEcosystem, useEcosystemDispatch } from '../../state/ecosystem-context.tsx'
import { findRandomAmongNearest, findNearestWaterPoint } from '../../state/ecosystem-selectors.ts'
import StatusBar from './StatusBar.tsx'
import IntentionOverlay from './IntentionOverlay.tsx'

interface MooseProps {
  data: MooseState
}

const MOOSE_HUNGER_RATE = 0.00025
const MOOSE_THIRST_RATE = 0.0015

export default function Moose({ data }: MooseProps) {
  const groupRef = useRef<Group>(null!)
  const state = useEcosystem()
  const dispatch = useEcosystemDispatch()

  const position = useRef(new Vector3(...data.position))
  const velocity = useRef(new Vector3(...data.velocity))
  const syncTimer = useRef(0)
  const targetFlowerIdRef = useRef<string | null>(null)

  const intentionRef = useRef('Wandering')
  const intentionTargetRef = useRef<Vector3 | null>(null)

  const { seek, wander, applyForces } = useSteering({
    maxSpeed: MAX_SPEED_MOOSE,
    maxForce: 3.5,
    mass: 2.1,
    wanderRadius: 1.5,
    wanderDistance: 3.5,
    wanderJitter: 0.18,
  })

  const { tick: tickNeeds, hungerRef, thirstRef } = useEntityNeeds({
    id: data.id,
    entityType: 'moose',
    hunger: data.hunger,
    thirst: data.thirst,
    hungerRate: MOOSE_HUNGER_RATE,
    thirstRate: MOOSE_THIRST_RATE,
  })

  const tempForce = useMemo(() => new Vector3(), [])
  const tempTarget = useMemo(() => new Vector3(), [])

  useFrame((_frameState, rawDelta) => {
    if (state.paused) return

    const delta = rawDelta * state.speed
    const needs = tickNeeds(delta)
    if (needs.dead) return

    const pos = position.current
    const vel = velocity.current
    tempForce.set(0, 0, 0)

    if (thirstRef.current < NEED_THRESHOLD) {
      const riverPt = findNearestWaterPoint([pos.x, pos.y, pos.z])
      tempTarget.set(...riverPt)
      tempForce.add(seek(pos, vel, tempTarget))
      intentionRef.current = 'Seeking water'
      intentionTargetRef.current = tempTarget.clone()

      if (pos.distanceTo(tempTarget) < 1.2) {
        dispatch({ type: 'DRINK', entityId: data.id, entityType: 'moose' })
      }
    } else {
      const aliveFlowers = state.flowers.filter(f => f.alive)
      let targetFlower = targetFlowerIdRef.current
        ? aliveFlowers.find(f => f.id === targetFlowerIdRef.current) ?? null
        : null

      if (!targetFlower) {
        const picked = findRandomAmongNearest([pos.x, pos.y, pos.z], aliveFlowers, 4)
        targetFlower = picked
        targetFlowerIdRef.current = picked ? picked.id : null
      }

      if (targetFlower) {
        tempTarget.set(...targetFlower.position)
        tempForce.add(seek(pos, vel, tempTarget))
        intentionRef.current = 'Seeking food'
        intentionTargetRef.current = tempTarget.clone()

        if (pos.distanceTo(tempTarget) < 1.1) {
          targetFlowerIdRef.current = null
          dispatch({ type: 'EAT_FLOWER', flowerId: targetFlower.id, entityId: data.id })
        }
      } else {
        tempForce.add(wander(pos, vel))
        intentionRef.current = 'Wandering'
        intentionTargetRef.current = null
      }
    }

    for (const obs of ALL_OBSTACLES) {
      const dx = pos.x - obs.position[0]
      const dz = pos.z - obs.position[2]
      const dist = Math.sqrt(dx * dx + dz * dz)
      const avoidR = obs.radius + 0.8
      if (dist < avoidR && dist > 0.01) {
        const strength = ((avoidR - dist) / avoidR) * 10
        tempForce.x += (dx / dist) * strength
        tempForce.z += (dz / dist) * strength
      }
    }

    applyForces(pos, vel, tempForce, delta)

    const bound = WORLD_SIZE * 0.95
    if (pos.x < -bound || pos.x > bound) {
      vel.x *= -1
      pos.x = Math.max(-bound, Math.min(bound, pos.x))
    }
    if (pos.z < -bound || pos.z > bound) {
      vel.z *= -1
      pos.z = Math.max(-bound, Math.min(bound, pos.z))
    }

    const terrainY = groundHeightAt(pos.x, pos.z)
    const depth = waterDepthAt(pos.x, pos.z)
    const sinkY = depth > 0 ? -depth * 0.75 : 0
    groupRef.current.position.set(pos.x, terrainY + 0.9 + sinkY, pos.z)

    const speed = vel.length()
    if (speed > 0.08) {
      groupRef.current.rotation.y = Math.atan2(vel.x, vel.z)
    }

    syncTimer.current += delta
    if (syncTimer.current > 0.5) {
      syncTimer.current = 0
      dispatch({
        type: 'UPDATE_ENTITY_POSITION',
        id: data.id,
        entityType: 'moose',
        position: [pos.x, 0.9, pos.z],
        velocity: [vel.x, vel.y, vel.z],
      })
    }
  })

  return (
    <>
      <group
        ref={groupRef}
        position={[
          data.position[0],
          groundHeightAt(data.position[0], data.position[2]) + data.position[1],
          data.position[2],
        ]}
      >
        <group scale={[2.2, 2.2, 2.2]}>
          <mesh castShadow>
            <boxGeometry args={[0.55, 0.38, 1.0]} />
            <meshStandardMaterial color="#5f4026" />
          </mesh>
          <mesh position={[0, 0.2, 0.65]} castShadow>
            <boxGeometry args={[0.33, 0.3, 0.42]} />
            <meshStandardMaterial color="#6f4a2d" />
          </mesh>
          <mesh position={[0, 0.08, 0.95]}>
            <boxGeometry args={[0.22, 0.17, 0.28]} />
            <meshStandardMaterial color="#7a5638" />
          </mesh>
          <mesh position={[-0.15, 0.48, 0.71]}>
            <boxGeometry args={[0.06, 0.34, 0.05]} />
            <meshStandardMaterial color="#d6c4a2" />
          </mesh>
          <mesh position={[-0.28, 0.62, 0.71]}>
            <boxGeometry args={[0.23, 0.06, 0.05]} />
            <meshStandardMaterial color="#d6c4a2" />
          </mesh>
          <mesh position={[0.15, 0.48, 0.71]}>
            <boxGeometry args={[0.06, 0.34, 0.05]} />
            <meshStandardMaterial color="#d6c4a2" />
          </mesh>
          <mesh position={[0.28, 0.62, 0.71]}>
            <boxGeometry args={[0.23, 0.06, 0.05]} />
            <meshStandardMaterial color="#d6c4a2" />
          </mesh>
          <mesh position={[-0.2, -0.28, 0.25]} castShadow>
            <boxGeometry args={[0.1, 0.34, 0.1]} />
            <meshStandardMaterial color="#4b311f" />
          </mesh>
          <mesh position={[0.2, -0.28, 0.25]} castShadow>
            <boxGeometry args={[0.1, 0.34, 0.1]} />
            <meshStandardMaterial color="#4b311f" />
          </mesh>
          <mesh position={[-0.2, -0.28, -0.3]} castShadow>
            <boxGeometry args={[0.1, 0.34, 0.1]} />
            <meshStandardMaterial color="#4b311f" />
          </mesh>
          <mesh position={[0.2, -0.28, -0.3]} castShadow>
            <boxGeometry args={[0.1, 0.34, 0.1]} />
            <meshStandardMaterial color="#4b311f" />
          </mesh>
          <mesh position={[0, 0.15, -0.64]} rotation={[0.5, 0, 0]}>
            <capsuleGeometry args={[0.06, 0.25, 4, 6]} />
            <meshStandardMaterial color="#5a3d25" />
          </mesh>
        </group>
        <StatusBar hungerRef={hungerRef} thirstRef={thirstRef} yOffset={2.1} />
      </group>
      <IntentionOverlay
        positionRef={position}
        targetRef={intentionTargetRef}
        intentionRef={intentionRef}
        labelY={2.4}
        color="#c9a86d"
      />
    </>
  )
}
