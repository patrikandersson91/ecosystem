import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Group, Mesh } from 'three'
import type { RabbitState } from '../../types/ecosystem.ts'
import {
  FLEE_RADIUS,
  MAX_SPEED_RABBIT,
  JUMP_HEIGHT,
  JUMP_FREQUENCY,
  NEED_THRESHOLD,
  WORLD_SIZE,
  MATE_RADIUS,
  MATING_COOLDOWN,
  getSightMultiplier,
} from '../../types/ecosystem.ts'
import { ALL_OBSTACLES } from '../../data/obstacles.ts'
import { riverDepthAt } from '../../utils/river-path.ts'
import { useSteering } from '../../hooks/useSteering.ts'
import { useEntityNeeds } from '../../hooks/useEntityNeeds.ts'
import { useEcosystem, useEcosystemDispatch } from '../../state/ecosystem-context.tsx'
import { findNearest, findNearestRiverPoint, entitiesInRadius } from '../../state/ecosystem-selectors.ts'
import { Billboard } from '@react-three/drei'
import StatusBar from './StatusBar.tsx'
import IntentionOverlay from './IntentionOverlay.tsx'

const MATING_PAUSE_DURATION = 2.0
const BABY_SPEED_MULTIPLIER = 0.6
const PREGNANT_HUNGER_THRESHOLD = 0.6
const RABBIT_HUNGER_THRESHOLD = 0.45

// Heart shape geometry (created once, shared)
const heartShape = new THREE.Shape()
heartShape.moveTo(0, 0.3)
heartShape.bezierCurveTo(0, 0.45, -0.15, 0.6, -0.3, 0.6)
heartShape.bezierCurveTo(-0.55, 0.6, -0.55, 0.35, -0.55, 0.35)
heartShape.bezierCurveTo(-0.55, 0.2, -0.4, 0.0, 0, -0.3)
heartShape.bezierCurveTo(0.4, 0.0, 0.55, 0.2, 0.55, 0.35)
heartShape.bezierCurveTo(0.55, 0.35, 0.55, 0.6, 0.3, 0.6)
heartShape.bezierCurveTo(0.15, 0.6, 0, 0.45, 0, 0.3)
const heartGeo = new THREE.ShapeGeometry(heartShape)

interface RabbitProps {
  data: RabbitState
}

export default function Rabbit({ data }: RabbitProps) {
  const groupRef = useRef<Group>(null!)
  const state = useEcosystem()
  const dispatch = useEcosystemDispatch()

  // Mutable refs for per-frame physics
  const position = useRef(new THREE.Vector3(...data.position))
  const velocity = useRef(new THREE.Vector3(...data.velocity))
  const jumpPhase = useRef(data.jumpPhase)
  const syncTimer = useRef(0)

  // Local reproductive state refs
  const pregnantRef = useRef(data.pregnant)
  const isAdultRef = useRef(data.isAdult)
  const matingCooldownRef = useRef(0)

  // Mating pause
  const matingPauseRef = useRef(0)
  const prevPregnantRef = useRef(data.pregnant)
  const heartRef = useRef<Mesh>(null!)

  // Drinking / eating pauses
  const drinkingTimerRef = useRef(0)
  const eatingTimerRef = useRef(0)
  const eatingFlowerIdRef = useRef<string | null>(null)

  // Debug intention tracking
  const intentionRef = useRef('Wandering')
  const intentionTargetRef = useRef<THREE.Vector3 | null>(null)
  const effectiveSightRef = useRef(FLEE_RADIUS)

  // Sync from state on render
  pregnantRef.current = data.pregnant
  isAdultRef.current = data.isAdult

  // Detect female becoming pregnant → trigger mating pause
  if (data.pregnant && !prevPregnantRef.current) {
    matingPauseRef.current = MATING_PAUSE_DURATION
  }
  prevPregnantRef.current = data.pregnant

  // Steering
  const { seek, flee, wander, applyForces } = useSteering({
    maxSpeed: MAX_SPEED_RABBIT,
    maxForce: 5,
    mass: 1,
    wanderRadius: 1.2,
    wanderDistance: 2.5,
    wanderJitter: 0.4,
  })

  // Needs
  const { tick: tickNeeds, hungerRef, thirstRef } = useEntityNeeds({
    id: data.id,
    entityType: 'rabbit',
    hunger: data.hunger,
    thirst: data.thirst,
    hungerRate: 0.035,
  })

  // Reusable temp vectors
  const tempForce = useMemo(() => new THREE.Vector3(), [])
  const tempTarget = useMemo(() => new THREE.Vector3(), [])
  const tempFoxPos = useMemo(() => new THREE.Vector3(), [])

  useFrame((_frameState, delta) => {
    if (state.paused) return

    // Tick needs — may kill entity
    const needs = tickNeeds(delta)
    if (needs.dead) return

    // Decrement mating cooldown
    if (matingCooldownRef.current > 0) {
      matingCooldownRef.current = Math.max(0, matingCooldownRef.current - delta)
    }

    const pos = position.current
    const vel = velocity.current
    const effectiveFleeRadius = FLEE_RADIUS * getSightMultiplier(state.timeOfDay)
    effectiveSightRef.current = effectiveFleeRadius

    // ── MATING PAUSE: stand still, show heart ──
    if (matingPauseRef.current > 0) {
      matingPauseRef.current -= delta

      // Zero velocity — stand still
      vel.set(0, 0, 0)
      intentionRef.current = 'Mating'
      intentionTargetRef.current = null

      // Animate heart: gentle pulse
      if (heartRef.current) {
        const t = (MATING_PAUSE_DURATION - matingPauseRef.current) / MATING_PAUSE_DURATION
        const pulse = 1.0 + Math.sin(t * Math.PI * 4) * 0.1
        heartRef.current.scale.set(pulse, pulse, pulse)
        heartRef.current.visible = true
      }

      // River depth for position
      const depth = riverDepthAt(pos.x, pos.z)
      const sinkY = depth > 0 ? -depth * 0.85 : 0
      groupRef.current.position.set(pos.x, sinkY, pos.z)

      // Still sync position
      syncTimer.current += delta
      if (syncTimer.current > 0.5) {
        syncTimer.current = 0
        dispatch({
          type: 'UPDATE_ENTITY_POSITION',
          id: data.id,
          entityType: 'rabbit',
          position: [pos.x, 0, pos.z],
          velocity: [0, 0, 0],
        })
      }
      return
    }

    // Hide heart when not mating
    if (heartRef.current) {
      heartRef.current.visible = false
    }

    // ── Danger interrupts drinking/eating ──
    if (drinkingTimerRef.current > 0 || eatingTimerRef.current > 0) {
      const foxCheck = entitiesInRadius([pos.x, pos.y, pos.z], effectiveFleeRadius, state.foxes)
      if (foxCheck.length > 0) {
        drinkingTimerRef.current = 0
        eatingTimerRef.current = 0
        eatingFlowerIdRef.current = null
      }
    }

    // ── DRINKING PAUSE: stay by water, fill thirst to full ──
    if (drinkingTimerRef.current > 0) {
      drinkingTimerRef.current -= delta
      thirstRef.current = Math.min(1, thirstRef.current + delta / 3)
      vel.set(0, 0, 0)
      intentionRef.current = 'Drinking'
      intentionTargetRef.current = null
      if (thirstRef.current >= 1 || drinkingTimerRef.current <= 0) {
        drinkingTimerRef.current = 0
      }
      const depth = riverDepthAt(pos.x, pos.z)
      const sinkY = depth > 0 ? -depth * 0.85 : 0
      groupRef.current.position.set(pos.x, sinkY, pos.z)
      syncTimer.current += delta
      if (syncTimer.current > 0.5) {
        syncTimer.current = 0
        dispatch({
          type: 'UPDATE_ENTITY_POSITION',
          id: data.id,
          entityType: 'rabbit',
          position: [pos.x, 0, pos.z],
          velocity: [0, 0, 0],
        })
      }
      return
    }

    // ── EATING PAUSE: stay by flower, consume after 2 seconds ──
    if (eatingTimerRef.current > 0) {
      eatingTimerRef.current -= delta
      vel.set(0, 0, 0)
      intentionRef.current = 'Eating'
      intentionTargetRef.current = null
      if (eatingTimerRef.current <= 0) {
        eatingTimerRef.current = 0
        if (eatingFlowerIdRef.current) {
          if (pregnantRef.current) {
            pregnantRef.current = false
            const babyPos: [number, number, number] = [
              pos.x + (Math.random() - 0.5) * 2,
              0,
              pos.z + (Math.random() - 0.5) * 2,
            ]
            dispatch({
              type: 'SPAWN_RABBIT',
              rabbit: {
                id: `rabbit_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                type: 'rabbit',
                position: babyPos,
                velocity: [0, 0, 0],
                hunger: 0.7,
                thirst: 0.7,
                behavior: 'wandering',
                alive: true,
                jumpPhase: Math.random() * Math.PI * 2,
                sex: Math.random() > 0.5 ? 'male' : 'female',
                isAdult: false,
                pregnant: false,
                mealsEaten: 0,
              },
            })
          }
          dispatch({ type: 'EAT_FLOWER', flowerId: eatingFlowerIdRef.current, entityId: data.id })
          eatingFlowerIdRef.current = null
        }
      }
      const depth = riverDepthAt(pos.x, pos.z)
      const sinkY = depth > 0 ? -depth * 0.85 : 0
      groupRef.current.position.set(pos.x, sinkY, pos.z)
      syncTimer.current += delta
      if (syncTimer.current > 0.5) {
        syncTimer.current = 0
        dispatch({
          type: 'UPDATE_ENTITY_POSITION',
          id: data.id,
          entityType: 'rabbit',
          position: [pos.x, 0, pos.z],
          velocity: [0, 0, 0],
        })
      }
      return
    }

    tempForce.set(0, 0, 0)

    // Pregnant rabbits get hungry sooner
    const hungerThreshold = pregnantRef.current ? PREGNANT_HUNGER_THRESHOLD : RABBIT_HUNGER_THRESHOLD

    // ── 1. FLEE: highest priority ──
    const nearbyFoxes = entitiesInRadius(
      [pos.x, pos.y, pos.z],
      effectiveFleeRadius,
      state.foxes,
    )

    if (nearbyFoxes.length > 0) {
      // Flee from nearest fox
      let closestDist = Infinity
      let closestFoxPos = tempFoxPos
      for (const fox of nearbyFoxes) {
        tempFoxPos.set(...fox.position)
        const d = pos.distanceTo(tempFoxPos)
        if (d < closestDist) {
          closestDist = d
          closestFoxPos = tempFoxPos.clone()
        }
      }
      const fleeForce = flee(pos, vel, closestFoxPos, effectiveFleeRadius)
      tempForce.add(fleeForce.multiplyScalar(2.0))
      intentionRef.current = 'Fleeing!'
      intentionTargetRef.current = null

    // ── 2. SEEK FOOD: hungry (pregnant rabbits eat sooner) ──
    } else if (hungerRef.current < hungerThreshold) {
      const aliveFlowers = state.flowers.filter(f => f.alive)
      const nearest = findNearest([pos.x, pos.y, pos.z], aliveFlowers)
      if (nearest) {
        tempTarget.set(...nearest.position)
        tempForce.add(seek(pos, vel, tempTarget))
        intentionRef.current = 'Seeking food'
        intentionTargetRef.current = tempTarget.clone()

        if (pos.distanceTo(tempTarget) < 0.8) {
          // Spawn baby if pregnant
          if (pregnantRef.current) {
            pregnantRef.current = false
            const babyPos: [number, number, number] = [
              pos.x + (Math.random() - 0.5) * 2,
              0,
              pos.z + (Math.random() - 0.5) * 2,
            ]
            dispatch({
              type: 'SPAWN_RABBIT',
              rabbit: {
                id: `rabbit_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                type: 'rabbit',
                position: babyPos,
                velocity: [0, 0, 0],
                hunger: 0.7,
                thirst: 0.7,
                behavior: 'wandering',
                alive: true,
                jumpPhase: Math.random() * Math.PI * 2,
                sex: Math.random() > 0.5 ? 'male' : 'female',
                isAdult: false,
                pregnant: false,
                mealsEaten: 0,
              },
            })
          }
          dispatch({ type: 'EAT_FLOWER', flowerId: nearest.id, entityId: data.id })
        }
      } else {
        tempForce.add(wander(pos, vel))
        intentionRef.current = 'Wandering'
        intentionTargetRef.current = null
      }

    // ── 3. SEEK WATER: thirsty ──
    } else if (thirstRef.current < NEED_THRESHOLD) {
      const riverPt = findNearestRiverPoint([pos.x, pos.y, pos.z])
      tempTarget.set(...riverPt)
      tempForce.add(seek(pos, vel, tempTarget))
      intentionRef.current = 'Seeking water'
      intentionTargetRef.current = tempTarget.clone()

      if (pos.distanceTo(tempTarget) < 1.0) {
        dispatch({ type: 'DRINK', entityId: data.id, entityType: 'rabbit' })
      }

    // ── 4. SEEK MATE: adult, not pregnant, cooldown expired, not too hungry ──
    } else if (
      isAdultRef.current &&
      !pregnantRef.current &&
      matingCooldownRef.current <= 0 &&
      hungerRef.current > NEED_THRESHOLD &&
      thirstRef.current > NEED_THRESHOLD
    ) {
      // Find eligible mates: opposite sex, adult, not pregnant
      const eligibleMates = state.rabbits.filter(
        r =>
          r.id !== data.id &&
          r.alive &&
          r.isAdult &&
          !r.pregnant &&
          r.sex !== data.sex,
      )
      const nearbyMates = entitiesInRadius(
        [pos.x, pos.y, pos.z],
        MATE_RADIUS,
        eligibleMates,
      )

      if (nearbyMates.length > 0) {
        const nearestMate = findNearest([pos.x, pos.y, pos.z], nearbyMates)
        if (nearestMate) {
          tempTarget.set(...nearestMate.position)
          tempForce.add(seek(pos, vel, tempTarget))
          intentionRef.current = 'Seeking mate'
          intentionTargetRef.current = tempTarget.clone()

          // Close enough to mate — only males initiate
          if (pos.distanceTo(tempTarget) < 1.0 && data.sex === 'male') {
            matingCooldownRef.current = MATING_COOLDOWN
            matingPauseRef.current = MATING_PAUSE_DURATION
            dispatch({
              type: 'RABBIT_MATE',
              maleId: data.id,
              femaleId: nearestMate.id,
            })
          }
        }
      } else {
        tempForce.add(wander(pos, vel))
        intentionRef.current = 'Wandering'
        intentionTargetRef.current = null
      }

    // ── 5. WANDER ──
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

    // Apply physics
    applyForces(pos, vel, tempForce, delta)

    // Baby rabbits are slower
    if (!isAdultRef.current) {
      vel.clampLength(0, MAX_SPEED_RABBIT * BABY_SPEED_MULTIPLIER)
    }

    // World bounds
    const bound = WORLD_SIZE * 0.95
    pos.x = Math.max(-bound, Math.min(bound, pos.x))
    pos.z = Math.max(-bound, Math.min(bound, pos.z))

    // Jump animation
    const speed = vel.length()
    const speedFactor = Math.min(speed / MAX_SPEED_RABBIT, 1)
    jumpPhase.current += JUMP_FREQUENCY * Math.PI * 2 * delta * speedFactor
    const hopY = Math.abs(Math.sin(jumpPhase.current)) * JUMP_HEIGHT * speedFactor

    // River depth: sink to riverbed when walking in the river
    const depth = riverDepthAt(pos.x, pos.z)
    const sinkY = depth > 0 ? -depth * 0.85 : 0 // sink most of the way down

    // Apply to mesh
    groupRef.current.position.set(pos.x, hopY + sinkY, pos.z)

    if (speed > 0.1) {
      groupRef.current.rotation.y = Math.atan2(vel.x, vel.z)
    }

    // Periodic state sync
    syncTimer.current += delta
    if (syncTimer.current > 0.5) {
      syncTimer.current = 0
      dispatch({
        type: 'UPDATE_ENTITY_POSITION',
        id: data.id,
        entityType: 'rabbit',
        position: [pos.x, 0, pos.z],
        velocity: [vel.x, vel.y, vel.z],
      })
    }
  })

  const visualScale = data.isAdult ? 1 : 0.6
  const barYOffset = data.isAdult ? 1.0 : 0.7

  return (
    <>
      <group ref={groupRef} position={[...data.position]}>
        <group scale={visualScale}>
          {/* Body */}
          <mesh castShadow>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshStandardMaterial color={data.pregnant ? '#e8a0c0' : '#d4a574'} />
          </mesh>
          {/* Head */}
          <mesh position={[0, 0.25, 0.2]} castShadow>
            <sphereGeometry args={[0.18, 8, 8]} />
            <meshStandardMaterial color={data.pregnant ? '#e8a0c0' : '#d4a574'} />
          </mesh>
          {/* Left ear */}
          <mesh position={[-0.08, 0.5, 0.18]} rotation={[0.3, 0, -0.15]}>
            <capsuleGeometry args={[0.03, 0.2, 4, 4]} />
            <meshStandardMaterial color="#c49466" />
          </mesh>
          {/* Right ear */}
          <mesh position={[0.08, 0.5, 0.18]} rotation={[0.3, 0, 0.15]}>
            <capsuleGeometry args={[0.03, 0.2, 4, 4]} />
            <meshStandardMaterial color="#c49466" />
          </mesh>
          {/* Tail */}
          <mesh position={[0, 0.1, -0.3]}>
            <sphereGeometry args={[0.08, 6, 6]} />
            <meshStandardMaterial color="white" />
          </mesh>
        </group>
        <StatusBar hungerRef={hungerRef} thirstRef={thirstRef} yOffset={barYOffset} />
        {/* Heart — shown during mating pause */}
        <Billboard position={[0, barYOffset + 0.3, 0]}>
          <mesh ref={heartRef} geometry={heartGeo} visible={false} scale={0.25}>
            <meshBasicMaterial color="#e85080" transparent opacity={0.7} side={THREE.DoubleSide} />
          </mesh>
        </Billboard>
      </group>
      <IntentionOverlay
        positionRef={position}
        targetRef={intentionTargetRef}
        intentionRef={intentionRef}
        labelY={barYOffset + 0.4}
        color="#90ee90"
        sightRadius={FLEE_RADIUS}
        sightRadiusRef={effectiveSightRef}
      />
    </>
  )
}
