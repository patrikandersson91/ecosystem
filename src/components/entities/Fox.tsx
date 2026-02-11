import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { Group } from 'three';
import type { FoxState } from '../../types/ecosystem.ts';
import {
  AGGRO_RADIUS,
  MAX_SPEED_FOX,
  NEED_THRESHOLD,
  WORLD_SIZE,
  FOX_MATE_RADIUS,
  FOX_MATING_COOLDOWN,
  FOX_HUNT_THRESHOLD,
  MAX_FOXES,
  getSightMultiplier,
} from '../../types/ecosystem.ts';
import { forEachNearbyObstacle } from '../../data/obstacles.ts';
import { waterDepthAt } from '../../utils/river-path.ts';
import { groundHeightAt } from '../../utils/terrain-height.ts';
import { resolveTreeCollisions } from '../../utils/tree-collision.ts';
import { useSteering } from '../../hooks/useSteering.ts';
import { useEntityNeeds } from '../../hooks/useEntityNeeds.ts';
import {
  useEcosystem,
  useEcosystemDispatch,
} from '../../state/ecosystem-context.tsx';
import { useFollow } from '../../state/follow-context.tsx';
import {
  findNearest,
  findNearestWaterPoint,
  entitiesInRadius,
} from '../../state/ecosystem-selectors.ts';
import StatusBar from './StatusBar.tsx';
import IntentionOverlay from './IntentionOverlay.tsx';
import { useDebug } from '../../state/debug-context.tsx';

interface FoxProps {
  data: FoxState;
}

const MATING_PAUSE_DURATION = 2.5;
const FOX_HUNGER_RATE = 0.0022;
const FOX_THIRST_RATE = 0.01;
const FOX_OBSTACLE_QUERY_RADIUS = 1.4;

export default function Fox({ data }: FoxProps) {
  const groupRef = useRef<Group>(null!);
  const flLegRef = useRef<Group>(null!);
  const frLegRef = useRef<Group>(null!);
  const blLegRef = useRef<Group>(null!);
  const brLegRef = useRef<Group>(null!);
  const state = useEcosystem();
  const dispatch = useEcosystemDispatch();
  const { setFollowTarget } = useFollow();
  const { spawnBlood } = useDebug();

  const position = useRef(new Vector3(...data.position));
  const velocity = useRef(new Vector3(...data.velocity));
  const syncTimer = useRef(0);

  // Reproductive state
  const pregnantRef = useRef(data.pregnant);
  const matingCooldownRef = useRef(0);
  const matingPauseRef = useRef(0);

  // Sync pregnancy from state
  pregnantRef.current = data.pregnant;

  // Debug intention tracking
  const intentionRef = useRef('Wandering');
  const intentionTargetRef = useRef<Vector3 | null>(null);
  const effectiveSightRef = useRef(AGGRO_RADIUS);

  const babySpeedScale = data.isAdult ? 1 : 0.65;
  const { seek, wander, applyForces } = useSteering({
    maxSpeed: MAX_SPEED_FOX * babySpeedScale,
    maxForce: 6,
    mass: 1.2,
    wanderRadius: 2,
    wanderDistance: 4,
    wanderJitter: 0.25,
  });

  const {
    tick: tickNeeds,
    hungerRef,
    thirstRef,
  } = useEntityNeeds({
    id: data.id,
    entityType: 'fox',
    hunger: data.hunger,
    thirst: data.thirst,
    hungerRate: FOX_HUNGER_RATE,
    thirstRate: FOX_THIRST_RATE,
  });

  const tempForce = useMemo(() => new Vector3(), []);
  const tempTarget = useMemo(() => new Vector3(), []);

  useFrame((_frameState, rawDelta) => {
    if (state.paused) return;

    const delta = rawDelta * state.speed;

    const needs = tickNeeds(delta);
    if (needs.dead) return;

    // Decrement mating cooldown
    if (matingCooldownRef.current > 0) {
      matingCooldownRef.current = Math.max(
        0,
        matingCooldownRef.current - delta,
      );
    }

    const pos = position.current;
    const vel = velocity.current;
    const effectiveAggroRadius =
      AGGRO_RADIUS * getSightMultiplier(state.timeOfDay);
    effectiveSightRef.current = effectiveAggroRadius;
    tempForce.set(0, 0, 0);

    // ── MATING PAUSE: stand still briefly ──
    if (matingPauseRef.current > 0) {
      matingPauseRef.current -= delta;
      vel.set(0, 0, 0);
      intentionRef.current = 'Mating';
      intentionTargetRef.current = null;
      const terrainY = groundHeightAt(pos.x, pos.z);
      const depth = waterDepthAt(pos.x, pos.z);
      const sinkY = depth > 0 ? -depth * 0.85 : 0;
      groupRef.current.position.set(pos.x, terrainY + 0.5 + sinkY, pos.z);
      syncTimer.current += delta;
      if (syncTimer.current > 0.5) {
        syncTimer.current = 0;
        dispatch({
          type: 'UPDATE_ENTITY_POSITION',
          id: data.id,
          entityType: 'fox',
          position: [pos.x, 0.5, pos.z],
          velocity: [0, 0, 0],
        });
      }
      return;
    }

    // ── 1. CHASE: hunt rabbits in aggro radius ──
    const nearbyRabbits = entitiesInRadius(
      [pos.x, pos.y, pos.z],
      effectiveAggroRadius,
      state.rabbits,
    );

    if (nearbyRabbits.length > 0 && hungerRef.current < FOX_HUNT_THRESHOLD) {
      const nearest = findNearest([pos.x, pos.y, pos.z], nearbyRabbits);
      if (nearest) {
        tempTarget.set(...nearest.position);
        const chaseForce = seek(pos, vel, tempTarget);
        tempForce.add(chaseForce.multiplyScalar(1.7));
        intentionRef.current = 'Chasing rabbit!';
        intentionTargetRef.current = tempTarget.clone();

        // Catch rabbit (larger catch radius = pounce)
        if (pos.distanceTo(tempTarget) < 1.0) {
          const terrainY = groundHeightAt(pos.x, pos.z);
          const depth = waterDepthAt(pos.x, pos.z);
          const sinkY = depth > 0 ? -depth * 0.85 : 0;
          spawnBlood(pos.x, terrainY + 0.5 + sinkY, pos.z);
          dispatch({ type: 'REMOVE_RABBIT', id: nearest.id });
          const mealValue = 0.5;
          hungerRef.current = Math.min(1, hungerRef.current + mealValue);
          dispatch({
            type: 'UPDATE_ENTITY_NEEDS',
            id: data.id,
            entityType: 'fox',
            hunger: hungerRef.current,
            thirst: needs.thirst,
          });

          // Baby fox grows up after first kill
          if (!data.isAdult) {
            dispatch({ type: 'FOX_GROW_UP', id: data.id });
          }

          // Pregnant female tracks meals — needs 2 kills to give birth
          if (pregnantRef.current && data.sex === 'female') {
            const newMeals = (data.mealsWhilePregnant || 0) + 1;
            if (newMeals >= 2) {
              pregnantRef.current = false;
              const foxLitterSize = state.foxes.length < MAX_FOXES ? 1 : 0;
              for (let i = 0; i < foxLitterSize; i++) {
                const babyPos: [number, number, number] = [
                  pos.x + (Math.random() - 0.5) * 3,
                  0,
                  pos.z + (Math.random() - 0.5) * 3,
                ];
                dispatch({
                  type: 'SPAWN_FOX',
                  fox: {
                    id: `fox_${Date.now()}_${Math.floor(Math.random() * 10000)}_${i}`,
                    type: 'fox',
                    position: babyPos,
                    velocity: [0, 0, 0],
                    hunger: 0.8,
                    thirst: 0.8,
                    behavior: 'wandering',
                    alive: true,
                    targetId: null,
                    sex: Math.random() > 0.5 ? 'male' : 'female',
                    pregnant: false,
                    mealsWhilePregnant: 0,
                    isAdult: false,
                  },
                });
              }
            }
            // Update meal count in state
            dispatch({
              type: 'UPDATE_ENTITY_NEEDS',
              id: data.id,
              entityType: 'fox',
              hunger: hungerRef.current,
              thirst: needs.thirst,
            });
            dispatch({
              type: 'FOX_PREGNANCY_MEAL',
              id: data.id,
              mealsWhilePregnant: newMeals >= 2 ? 0 : newMeals,
              pregnant: newMeals < 2,
            });
          }
        }
      }

      // ── 2. SEEK WATER: thirsty ──
    } else if (thirstRef.current < NEED_THRESHOLD) {
      const riverPt = findNearestWaterPoint([pos.x, pos.y, pos.z]);
      tempTarget.set(...riverPt);
      tempForce.add(seek(pos, vel, tempTarget));
      intentionRef.current = 'Seeking water';
      intentionTargetRef.current = tempTarget.clone();

      if (pos.distanceTo(tempTarget) < 1.0) {
        dispatch({ type: 'DRINK', entityId: data.id, entityType: 'fox' });
      }

      // ── 3. SEEK MATE: well-fed, adult, not pregnant, cooldown expired ──
    } else if (
      data.isAdult &&
      !pregnantRef.current &&
      matingCooldownRef.current <= 0 &&
      hungerRef.current > 0.65 &&
      thirstRef.current > NEED_THRESHOLD &&
      state.foxes.length < MAX_FOXES
    ) {
      const eligibleMates = state.foxes.filter(
        (f) =>
          f.id !== data.id &&
          f.alive &&
          f.isAdult &&
          !f.pregnant &&
          f.sex !== data.sex,
      );
      const nearbyMates = entitiesInRadius(
        [pos.x, pos.y, pos.z],
        FOX_MATE_RADIUS,
        eligibleMates,
      );

      if (nearbyMates.length > 0) {
        const nearestMate = findNearest([pos.x, pos.y, pos.z], nearbyMates);
        if (nearestMate) {
          tempTarget.set(...nearestMate.position);
          tempForce.add(seek(pos, vel, tempTarget));
          intentionRef.current = 'Seeking mate';
          intentionTargetRef.current = tempTarget.clone();

          // Close enough to mate — only males initiate
          if (pos.distanceTo(tempTarget) < 1.2 && data.sex === 'male') {
            matingCooldownRef.current = FOX_MATING_COOLDOWN;
            matingPauseRef.current = MATING_PAUSE_DURATION;
            dispatch({
              type: 'FOX_MATE',
              maleId: data.id,
              femaleId: nearestMate.id,
            });
          }
        }
      } else {
        tempForce.add(wander(pos, vel));
        intentionRef.current = 'Wandering';
        intentionTargetRef.current = null;
      }

      // ── 4. WANDER ──
    } else {
      tempForce.add(wander(pos, vel));
      intentionRef.current = 'Wandering';
      intentionTargetRef.current = null;
    }

    // Obstacle avoidance — push away from trees and stones
    forEachNearbyObstacle(pos.x, pos.z, FOX_OBSTACLE_QUERY_RADIUS, (obs) => {
      const dx = pos.x - obs.position[0];
      const dz = pos.z - obs.position[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      const avoidR = obs.radius + 0.5;
      if (dist < avoidR && dist > 0.01) {
        const strength = ((avoidR - dist) / avoidR) * 8;
        tempForce.x += (dx / dist) * strength;
        tempForce.z += (dz / dist) * strength;
      }
    });

    applyForces(pos, vel, tempForce, delta);
    resolveTreeCollisions(pos, vel, 0.55);

    // World bounds – reflect velocity on wall collision
    const bound = WORLD_SIZE * 0.95;
    if (pos.x < -bound || pos.x > bound) {
      vel.x *= -1;
      pos.x = Math.max(-bound, Math.min(bound, pos.x));
    }
    if (pos.z < -bound || pos.z > bound) {
      vel.z *= -1;
      pos.z = Math.max(-bound, Math.min(bound, pos.z));
    }

    // River depth: sink to riverbed when walking in the river
    const terrainY = groundHeightAt(pos.x, pos.z);
    const depth = waterDepthAt(pos.x, pos.z);
    const sinkY = depth > 0 ? -depth * 0.85 : 0;

    // Apply to mesh
    groupRef.current.position.set(pos.x, terrainY + 0.5 + sinkY, pos.z);

    const speed = vel.length();
    if (speed > 0.1) {
      groupRef.current.rotation.y = Math.atan2(vel.x, vel.z);
      // Subtle forward lean when chasing
      groupRef.current.rotation.x = Math.min(speed / MAX_SPEED_FOX, 1) * 0.15;

      // Animate legs (faster than moose)
      const t = state.time * 30;
      const legAngle = Math.sin(t) * 0.6;

      if (flLegRef.current) flLegRef.current.rotation.x = legAngle;
      if (brLegRef.current) brLegRef.current.rotation.x = legAngle;
      if (frLegRef.current) frLegRef.current.rotation.x = -legAngle;
      if (blLegRef.current) blLegRef.current.rotation.x = -legAngle;
    } else {
      groupRef.current.rotation.x = 0;

      // Idle pose
      if (flLegRef.current) flLegRef.current.rotation.x = 0;
      if (brLegRef.current) brLegRef.current.rotation.x = 0;
      if (frLegRef.current) frLegRef.current.rotation.x = 0;
      if (blLegRef.current) blLegRef.current.rotation.x = 0;
    }

    // Periodic state sync
    syncTimer.current += delta;
    if (syncTimer.current > 0.5) {
      syncTimer.current = 0;
      dispatch({
        type: 'UPDATE_ENTITY_POSITION',
        id: data.id,
        entityType: 'fox',
        position: [pos.x, 0.5, pos.z],
        velocity: [vel.x, vel.y, vel.z],
      });
    }
  });

  return (
    <>
      <group
        ref={groupRef}
        name={`animal-fox-${data.id}`}
        onClick={(event) => {
          event.stopPropagation();
          setFollowTarget({ id: data.id, type: 'fox' });
        }}
        position={[
          data.position[0],
          groundHeightAt(data.position[0], data.position[2]) + data.position[1],
          data.position[2],
        ]}
      >
        <group scale={data.isAdult ? [1.6, 1.6, 1.6] : [1.0, 1.0, 1.0]}>
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
          {/* Front Left Leg Group */}
          <group ref={flLegRef} position={[-0.12, -0.12, 0.2]}>
            <mesh position={[0, -0.1, 0]} castShadow>
              <boxGeometry args={[0.08, 0.2, 0.08]} />
              <meshStandardMaterial color="#a04510" />
            </mesh>
            <mesh position={[0, -0.2, 0]}>
              <boxGeometry args={[0.09, 0.04, 0.09]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
          </group>

          {/* Front Right Leg Group */}
          <group ref={frLegRef} position={[0.12, -0.12, 0.2]}>
            <mesh position={[0, -0.1, 0]} castShadow>
              <boxGeometry args={[0.08, 0.2, 0.08]} />
              <meshStandardMaterial color="#a04510" />
            </mesh>
            <mesh position={[0, -0.2, 0]}>
              <boxGeometry args={[0.09, 0.04, 0.09]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
          </group>

          {/* Back Left Leg Group */}
          <group ref={blLegRef} position={[-0.12, -0.12, -0.22]}>
            <mesh position={[0, -0.1, 0]} castShadow>
              <boxGeometry args={[0.08, 0.2, 0.08]} />
              <meshStandardMaterial color="#a04510" />
            </mesh>
            <mesh position={[0, -0.2, 0]}>
              <boxGeometry args={[0.09, 0.04, 0.09]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
          </group>

          {/* Back Right Leg Group */}
          <group ref={brLegRef} position={[0.12, -0.12, -0.22]}>
            <mesh position={[0, -0.1, 0]} castShadow>
              <boxGeometry args={[0.08, 0.2, 0.08]} />
              <meshStandardMaterial color="#a04510" />
            </mesh>
            <mesh position={[0, -0.2, 0]}>
              <boxGeometry args={[0.09, 0.04, 0.09]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
          </group>
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
        labelY={2.0}
        color="#ff9040"
      />
    </>
  );
}
