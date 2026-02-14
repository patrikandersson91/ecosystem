import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { Group } from 'three';
import { softShadowVert, softShadowFrag } from '../../utils/soft-shadow-material.ts';
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
import { heightCapForce, SNOW_HEIGHT } from '../../utils/terrain-avoidance.ts';
import { useSteering } from '../../hooks/useSteering.ts';
import { useEntityNeeds } from '../../hooks/useEntityNeeds.ts';
import { useMovementInput } from '../../hooks/useMovementInput.ts';
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
const FOX_HUNGER_RATE = 0.0011;
const FOX_THIRST_RATE = 0.01;
const FOX_OBSTACLE_QUERY_RADIUS = 1.4;

export default function Fox({ data }: FoxProps) {
  const groupRef = useRef<Group>(null!);
  const tailRef = useRef<Group>(null!);
  const camera = useThree((threeState) => threeState.camera);
  const flLegRef = useRef<Group>(null!);
  const frLegRef = useRef<Group>(null!);
  const blLegRef = useRef<Group>(null!);
  const brLegRef = useRef<Group>(null!);
  const state = useEcosystem();
  const dispatch = useEcosystemDispatch();
  const { followTarget, setFollowTarget } = useFollow();
  const { getMovementInput } = useMovementInput();
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
  const tempForward = useMemo(() => new Vector3(), []);
  const tempRight = useMemo(() => new Vector3(), []);
  const tempMove = useMemo(() => new Vector3(), []);
  const upAxis = useMemo(() => new Vector3(0, 1, 0), []);

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
    const isPlayerControlled =
      followTarget?.type === 'fox' && followTarget.id === data.id;
    const effectiveAggroRadius =
      AGGRO_RADIUS * getSightMultiplier(state.timeOfDay);
    effectiveSightRef.current = effectiveAggroRadius;
    tempForce.set(0, 0, 0);

    if (isPlayerControlled) {
      const input = getMovementInput();
      tempForward.copy(camera.getWorldDirection(tempForward));
      tempForward.y = 0;
      if (tempForward.lengthSq() < 0.0001) {
        tempForward.set(0, 0, 1);
      } else {
        tempForward.normalize();
      }
      tempRight.crossVectors(tempForward, upAxis).normalize();
      tempMove
        .copy(tempForward)
        .multiplyScalar(input.forward)
        .addScaledVector(tempRight, input.right);

      if (tempMove.lengthSq() > 1) {
        tempMove.normalize();
      }

      const manualMaxSpeed = MAX_SPEED_FOX * (input.sprint ? 1.35 : 1);
      const steerBlend = 1 - Math.exp(-delta * 10);
      if (input.hasInput) {
        vel.lerp(tempMove.multiplyScalar(manualMaxSpeed), steerBlend);
      } else {
        vel.multiplyScalar(Math.exp(-delta * 8));
      }

      const [snowFx, snowFz] = heightCapForce(pos.x, pos.z, SNOW_HEIGHT, 5, 15);
      vel.x += snowFx * delta;
      vel.z += snowFz * delta;

      pos.addScaledVector(vel, delta);
      resolveTreeCollisions(pos, vel, 0.55);

      const bound = WORLD_SIZE * 0.95;
      if (pos.x < -bound || pos.x > bound) {
        vel.x *= -1;
        pos.x = Math.max(-bound, Math.min(bound, pos.x));
      }
      if (pos.z < -bound || pos.z > bound) {
        vel.z *= -1;
        pos.z = Math.max(-bound, Math.min(bound, pos.z));
      }

      const terrainY = groundHeightAt(pos.x, pos.z);
      const depth = waterDepthAt(pos.x, pos.z);
      const sinkY = depth > 0 ? -depth * 0.85 : 0;
      groupRef.current.position.set(pos.x, terrainY + 0.5 + sinkY, pos.z);

      const speed = vel.length();
      if (speed > 0.08) {
        groupRef.current.rotation.y = Math.atan2(vel.x, vel.z);
        groupRef.current.rotation.x = Math.min(speed / MAX_SPEED_FOX, 1) * 0.15;
        const t = state.time * 30;
        const legAngle = Math.sin(t) * 0.6;
        if (flLegRef.current) flLegRef.current.rotation.x = legAngle;
        if (brLegRef.current) brLegRef.current.rotation.x = legAngle;
        if (frLegRef.current) frLegRef.current.rotation.x = -legAngle;
        if (blLegRef.current) blLegRef.current.rotation.x = -legAngle;
        if (tailRef.current) tailRef.current.rotation.y = Math.sin(state.time * 8) * 0.3;
      } else {
        groupRef.current.rotation.x = 0;
        if (flLegRef.current) flLegRef.current.rotation.x = 0;
        if (brLegRef.current) brLegRef.current.rotation.x = 0;
        if (frLegRef.current) frLegRef.current.rotation.x = 0;
        if (blLegRef.current) blLegRef.current.rotation.x = 0;
        if (tailRef.current) tailRef.current.rotation.y = Math.sin(state.time * 3) * 0.15;
      }

      intentionRef.current = input.hasInput ? 'Player control' : 'Standing by';
      intentionTargetRef.current = null;
      matingPauseRef.current = 0;

      syncTimer.current += delta;
      if (syncTimer.current > 0.2) {
        syncTimer.current = 0;
        dispatch({
          type: 'UPDATE_ENTITY_POSITION',
          id: data.id,
          entityType: 'fox',
          position: [pos.x, 0.5, pos.z],
          velocity: [vel.x, vel.y, vel.z],
        });
      }
      return;
    }

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
        tempForce.add(chaseForce.multiplyScalar(2.2));
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
              const foxLitterSize =
                state.foxes.length >= MAX_FOXES
                  ? 0
                  : state.foxes.length < 10
                    ? 2
                    : 1;
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

    // Snow avoidance — no walking on snow
    const [snowFx, snowFz] = heightCapForce(pos.x, pos.z, SNOW_HEIGHT, 5, 15);
    tempForce.x += snowFx;
    tempForce.z += snowFz;

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
      if (tailRef.current) tailRef.current.rotation.y = Math.sin(state.time * 8) * 0.3;
    } else {
      groupRef.current.rotation.x = 0;

      // Idle pose
      if (flLegRef.current) flLegRef.current.rotation.x = 0;
      if (brLegRef.current) brLegRef.current.rotation.x = 0;
      if (frLegRef.current) frLegRef.current.rotation.x = 0;
      if (blLegRef.current) blLegRef.current.rotation.x = 0;
      if (tailRef.current) tailRef.current.rotation.y = Math.sin(state.time * 3) * 0.15;
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
          {/* Body - sleek torso */}
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.15, 0.36, 6, 8]} />
            <meshStandardMaterial color="#c85a1c" />
          </mesh>
          {/* Chest / underbelly - cream */}
          <mesh position={[0, -0.07, 0.1]} scale={[0.85, 0.6, 1]}>
            <sphereGeometry args={[0.14, 8, 8]} />
            <meshStandardMaterial color="#f0c890" />
          </mesh>
          {/* Head */}
          <mesh castShadow position={[0, 0.1, 0.42]}>
            <sphereGeometry args={[0.14, 10, 10]} />
            <meshStandardMaterial color="#d06820" />
          </mesh>
          {/* Cheek ruff - left */}
          <mesh position={[-0.08, 0.04, 0.46]}>
            <sphereGeometry args={[0.06, 6, 6]} />
            <meshStandardMaterial color="#f0c890" />
          </mesh>
          {/* Cheek ruff - right */}
          <mesh position={[0.08, 0.04, 0.46]}>
            <sphereGeometry args={[0.06, 6, 6]} />
            <meshStandardMaterial color="#f0c890" />
          </mesh>
          {/* Snout - rounded */}
          <mesh position={[0, 0.04, 0.56]} rotation={[Math.PI / 2, 0, 0]} scale={[0.8, 1, 0.7]}>
            <capsuleGeometry args={[0.06, 0.14, 5, 8]} />
            <meshStandardMaterial color="#e0a060" />
          </mesh>
          {/* Nose */}
          <mesh position={[0, 0.06, 0.65]}>
            <sphereGeometry args={[0.025, 6, 6]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
          {/* Left eye */}
          <mesh position={[-0.09, 0.16, 0.52]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial color="#1a1000" />
          </mesh>
          {/* Right eye */}
          <mesh position={[0.09, 0.16, 0.52]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial color="#1a1000" />
          </mesh>
          {/* Left ear outer */}
          <mesh position={[-0.09, 0.32, 0.38]} rotation={[0.15, 0, -0.2]}>
            <capsuleGeometry args={[0.04, 0.12, 4, 6]} />
            <meshStandardMaterial color="#c85a1c" />
          </mesh>
          {/* Left ear inner */}
          <mesh position={[-0.087, 0.31, 0.385]} rotation={[0.15, 0, -0.2]}>
            <capsuleGeometry args={[0.025, 0.08, 4, 5]} />
            <meshStandardMaterial color="#e8a060" />
          </mesh>
          {/* Right ear outer */}
          <mesh position={[0.09, 0.32, 0.38]} rotation={[0.15, 0, 0.2]}>
            <capsuleGeometry args={[0.04, 0.12, 4, 6]} />
            <meshStandardMaterial color="#c85a1c" />
          </mesh>
          {/* Right ear inner */}
          <mesh position={[0.087, 0.31, 0.385]} rotation={[0.15, 0, 0.2]}>
            <capsuleGeometry args={[0.025, 0.08, 4, 5]} />
            <meshStandardMaterial color="#e8a060" />
          </mesh>
          {/* Front Left Leg */}
          <group ref={flLegRef} position={[-0.1, -0.1, 0.18]}>
            <mesh position={[0, -0.09, 0]} castShadow>
              <boxGeometry args={[0.06, 0.18, 0.06]} />
              <meshStandardMaterial color="#a04510" />
            </mesh>
            <mesh position={[0, -0.19, 0]}>
              <boxGeometry args={[0.065, 0.04, 0.065]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
          </group>
          {/* Front Right Leg */}
          <group ref={frLegRef} position={[0.1, -0.1, 0.18]}>
            <mesh position={[0, -0.09, 0]} castShadow>
              <boxGeometry args={[0.06, 0.18, 0.06]} />
              <meshStandardMaterial color="#a04510" />
            </mesh>
            <mesh position={[0, -0.19, 0]}>
              <boxGeometry args={[0.065, 0.04, 0.065]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
          </group>
          {/* Back Left Leg */}
          <group ref={blLegRef} position={[-0.1, -0.1, -0.2]}>
            <mesh position={[0, -0.09, 0]} castShadow>
              <boxGeometry args={[0.06, 0.18, 0.06]} />
              <meshStandardMaterial color="#a04510" />
            </mesh>
            <mesh position={[0, -0.19, 0]}>
              <boxGeometry args={[0.065, 0.04, 0.065]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
          </group>
          {/* Back Right Leg */}
          <group ref={brLegRef} position={[0.1, -0.1, -0.2]}>
            <mesh position={[0, -0.09, 0]} castShadow>
              <boxGeometry args={[0.06, 0.18, 0.06]} />
              <meshStandardMaterial color="#a04510" />
            </mesh>
            <mesh position={[0, -0.19, 0]}>
              <boxGeometry args={[0.065, 0.04, 0.065]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
          </group>
          {/* Tail group - animated wiggle */}
          <group ref={tailRef} position={[0, 0.05, -0.26]}>
            {/* Base - thick root, dark */}
            <mesh position={[0, 0.02, 0]} castShadow>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial color="#a04818" />
            </mesh>
            {/* Mid - bushiest section, rich orange */}
            <mesh position={[0, 0, -0.12]} castShadow scale={[1.15, 0.85, 1.1]}>
              <sphereGeometry args={[0.1, 8, 8]} />
              <meshStandardMaterial color="#c85a1c" />
            </mesh>
            {/* Taper - lighter orange */}
            <mesh position={[0, -0.02, -0.22]} scale={[1, 0.85, 1]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial color="#d88030" />
            </mesh>
            {/* Tip - white */}
            <mesh position={[0, -0.04, -0.3]}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshStandardMaterial color="#f5f0e8" />
            </mesh>
          </group>
        </group>
        {/* Soft contact shadow on ground */}
        <mesh position={[0, -data.position[1] + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.8, 16]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            vertexShader={softShadowVert}
            fragmentShader={softShadowFrag}
            uniforms={{ uOpacity: { value: 0.3 } }}
          />
        </mesh>
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
