import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { Group } from 'three'
import type { FoxState } from '../../types/ecosystem.ts'
import {
  AGGRO_RADIUS,
  MAX_SPEED_FOX,
  NEED_THRESHOLD,
  WORLD_SIZE,
} from '../../types/ecosystem.ts'
import { ALL_OBSTACLES } from '../../data/obstacles.ts'
import { riverDepthAt } from '../../utils/river-path.ts'
import { useSteering } from '../../hooks/useSteering.ts'
import { useEntityNeeds } from '../../hooks/useEntityNeeds.ts'
import { useEcosystem, useEcosystemDispatch } from '../../state/ecosystem-context.tsx'
import { findNearest, findNearestRiverPoint, entitiesInRadius } from '../../state/ecosystem-selectors.ts'
import StatusBar from './StatusBar.tsx'
import IntentionOverlay from './IntentionOverlay.tsx'

interface FoxProps {
  data: FoxState
}

export default function Fox({ data }: FoxProps) {
  const groupRef = useRef<Group>(null!)
  const state = useEcosystem()
  const dispatch = useEcosystemDispatch()

  const position = useRef(new Vector3(...data.position))
  const velocity = useRef(new Vector3(...data.velocity))
  const syncTimer = useRef(0)

  // Debug intention tracking
  const intentionRef = useRef('Wandering')
  const intentionTargetRef = useRef<Vector3 | null>(null)

  const { seek, wander, applyForces } = useSteering({
    maxSpeed: MAX_SPEED_FOX,
    maxForce: 6,
    mass: 1.2,
    wanderRadius: 2,
    wanderDistance: 4,
    wanderJitter: 0.25,
  })

  const { tick: tickNeeds, hungerRef, thirstRef } = useEntityNeeds({
    id: data.id,
    entityType: 'fox',
    hunger: data.hunger,
    thirst: data.thirst,
  })

  const tempForce = useMemo(() => new Vector3(), [])
  const tempTarget = useMemo(() => new Vector3(), [])

  useFrame((_frameState, delta) => {
    if (state.paused) return

    const needs = tickNeeds(delta)
    if (needs.dead) return

    const pos = position.current
    const vel = velocity.current
    tempForce.set(0, 0, 0)

    // ── 1. CHASE: hunt rabbits in aggro radius ──
    const nearbyRabbits = entitiesInRadius(
      [pos.x, pos.y, pos.z],
      AGGRO_RADIUS,
      state.rabbits,
    )

    if (nearbyRabbits.length > 0 && hungerRef.current < 0.7) {
      const nearest = findNearest([pos.x, pos.y, pos.z], nearbyRabbits)
      if (nearest) {
        tempTarget.set(...nearest.position)
        const chaseForce = seek(pos, vel, tempTarget)
        tempForce.add(chaseForce.multiplyScalar(1.5))
        intentionRef.current = 'Chasing rabbit!'
        intentionTargetRef.current = tempTarget.clone()

        // Catch rabbit
        if (pos.distanceTo(tempTarget) < 0.5) {
          dispatch({ type: 'REMOVE_RABBIT', id: nearest.id })
          dispatch({
            type: 'UPDATE_ENTITY_NEEDS',
            id: data.id,
            entityType: 'fox',
            hunger: Math.min(1, hungerRef.current + 0.5),
            thirst: needs.thirst,
          })
        }
      }

    // ── 2. SEEK WATER: thirsty ──
    } else if (thirstRef.current < NEED_THRESHOLD) {
      const riverPt = findNearestRiverPoint([pos.x, pos.y, pos.z])
      tempTarget.set(...riverPt)
      tempForce.add(seek(pos, vel, tempTarget))
      intentionRef.current = 'Seeking water'
      intentionTargetRef.current = tempTarget.clone()

      if (pos.distanceTo(tempTarget) < 1.0) {
        dispatch({ type: 'DRINK', entityId: data.id, entityType: 'fox' })
      }

    // ── 3. WANDER ──
    } else {
      tempForce.add(wander(pos, vel))
      intentionRef.current = 'Wandering'
      intentionTargetRef.current = null
    }

    // Obstacle avoidance — push away from trees and stones
    for (const obs of ALL_OBSTACLES) {
      const dx = pos.x - obs.position[0]
      const dz = pos.z - obs.position[2]
      const dist = Math.sqrt(dx * dx + dz * dz)
      const avoidR = obs.radius + 0.5
      if (dist < avoidR && dist > 0.01) {
        const strength = ((avoidR - dist) / avoidR) * 8
        tempForce.x += (dx / dist) * strength
        tempForce.z += (dz / dist) * strength
      }
    }

    applyForces(pos, vel, tempForce, delta)

    // World bounds
    const bound = WORLD_SIZE * 0.95
    pos.x = Math.max(-bound, Math.min(bound, pos.x))
    pos.z = Math.max(-bound, Math.min(bound, pos.z))

    // River depth: sink to riverbed when walking in the river
    const depth = riverDepthAt(pos.x, pos.z)
    const sinkY = depth > 0 ? -depth * 0.85 : 0

    // Apply to mesh
    groupRef.current.position.set(pos.x, 0.5 + sinkY, pos.z)

    const speed = vel.length()
    if (speed > 0.1) {
      groupRef.current.rotation.y = Math.atan2(vel.x, vel.z)
      // Subtle forward lean when chasing
      groupRef.current.rotation.x = Math.min(speed / MAX_SPEED_FOX, 1) * 0.15
    } else {
      groupRef.current.rotation.x = 0
    }

    // Periodic state sync
    syncTimer.current += delta
    if (syncTimer.current > 0.5) {
      syncTimer.current = 0
      dispatch({
        type: 'UPDATE_ENTITY_POSITION',
        id: data.id,
        entityType: 'fox',
        position: [pos.x, 0.5, pos.z],
        velocity: [vel.x, vel.y, vel.z],
      })
    }
  })

  return (
    <>
    <group ref={groupRef} position={[...data.position]}>
      <group scale={[1.6, 1.6, 1.6]}>
        {/* Body */}
        <mesh castShadow>
          <boxGeometry args={[0.35, 0.32, 0.7]} />
          <meshStandardMaterial color="#c0561a" />
        </mesh>
        {/* Chest / belly lighter patch */}
        <mesh position={[0, -0.1, 0.15]}>
          <boxGeometry args={[0.28, 0.12, 0.4]} />
          <meshStandardMaterial color="#e8a060" />
        </mesh>
        {/* Head */}
        <mesh position={[0, 0.12, 0.45]} castShadow>
          <boxGeometry args={[0.3, 0.26, 0.32]} />
          <meshStandardMaterial color="#d4741a" />
        </mesh>
        {/* Snout */}
        <mesh position={[0, 0.06, 0.68]}>
          <boxGeometry args={[0.14, 0.12, 0.18]} />
          <meshStandardMaterial color="#e8a060" />
        </mesh>
        {/* Nose */}
        <mesh position={[0, 0.08, 0.78]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        {/* Left eye */}
        <mesh position={[-0.1, 0.18, 0.6]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color="#2a1a00" />
        </mesh>
        {/* Right eye */}
        <mesh position={[0.1, 0.18, 0.6]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color="#2a1a00" />
        </mesh>
        {/* Left ear */}
        <mesh position={[-0.1, 0.35, 0.4]} rotation={[0.2, 0, -0.3]}>
          <coneGeometry args={[0.07, 0.2, 4]} />
          <meshStandardMaterial color="#c0561a" />
        </mesh>
        {/* Left ear inner */}
        <mesh position={[-0.1, 0.34, 0.41]} rotation={[0.2, 0, -0.3]}>
          <coneGeometry args={[0.04, 0.14, 4]} />
          <meshStandardMaterial color="#e8a060" />
        </mesh>
        {/* Right ear */}
        <mesh position={[0.1, 0.35, 0.4]} rotation={[0.2, 0, 0.3]}>
          <coneGeometry args={[0.07, 0.2, 4]} />
          <meshStandardMaterial color="#c0561a" />
        </mesh>
        {/* Right ear inner */}
        <mesh position={[0.1, 0.34, 0.41]} rotation={[0.2, 0, 0.3]}>
          <coneGeometry args={[0.04, 0.14, 4]} />
          <meshStandardMaterial color="#e8a060" />
        </mesh>
        {/* Front left leg */}
        <mesh position={[-0.12, -0.22, 0.2]} castShadow>
          <boxGeometry args={[0.08, 0.2, 0.08]} />
          <meshStandardMaterial color="#a04510" />
        </mesh>
        {/* Front right leg */}
        <mesh position={[0.12, -0.22, 0.2]} castShadow>
          <boxGeometry args={[0.08, 0.2, 0.08]} />
          <meshStandardMaterial color="#a04510" />
        </mesh>
        {/* Back left leg */}
        <mesh position={[-0.12, -0.22, -0.22]} castShadow>
          <boxGeometry args={[0.08, 0.2, 0.08]} />
          <meshStandardMaterial color="#a04510" />
        </mesh>
        {/* Back right leg */}
        <mesh position={[0.12, -0.22, -0.22]} castShadow>
          <boxGeometry args={[0.08, 0.2, 0.08]} />
          <meshStandardMaterial color="#a04510" />
        </mesh>
        {/* Paws (white tips) */}
        <mesh position={[-0.12, -0.32, 0.2]}>
          <boxGeometry args={[0.09, 0.04, 0.09]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0.12, -0.32, 0.2]}>
          <boxGeometry args={[0.09, 0.04, 0.09]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[-0.12, -0.32, -0.22]}>
          <boxGeometry args={[0.09, 0.04, 0.09]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0.12, -0.32, -0.22]}>
          <boxGeometry args={[0.09, 0.04, 0.09]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        {/* Tail - bushy */}
        <mesh position={[0, 0.12, -0.55]} rotation={[0.6, 0, 0]} castShadow>
          <capsuleGeometry args={[0.06, 0.35, 6, 6]} />
          <meshStandardMaterial color="#c0561a" />
        </mesh>
        {/* Tail tip (white) */}
        <mesh position={[0, 0.28, -0.7]} rotation={[0.8, 0, 0]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial color="#f0e0d0" />
        </mesh>
      </group>
      <StatusBar hungerRef={hungerRef} thirstRef={thirstRef} yOffset={1.2} />
    </group>
    <IntentionOverlay
      positionRef={position}
      targetRef={intentionTargetRef}
      intentionRef={intentionRef}
      labelY={1.6}
      color="#ff9040"
    />
    </>
  )
}
