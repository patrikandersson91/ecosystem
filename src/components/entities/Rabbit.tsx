import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Group, Mesh } from 'three';
import { softShadowVert, softShadowFrag } from '../../utils/soft-shadow-material.ts';
import type { RabbitState } from '../../types/ecosystem.ts';
import {
  FLEE_RADIUS,
  MAX_SPEED_RABBIT,
  JUMP_HEIGHT,
  JUMP_FREQUENCY,
  NEED_THRESHOLD,
  WORLD_SIZE,
  MATE_RADIUS,
  MATING_COOLDOWN,
  MAX_RABBITS,
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
  findRandomAmongNearest,
  findNearestWaterPoint,
  entitiesInRadius,
} from '../../state/ecosystem-selectors.ts';
import { Billboard } from '@react-three/drei';
import StatusBar from './StatusBar.tsx';
import IntentionOverlay from './IntentionOverlay.tsx';

const MATING_PAUSE_DURATION = 2.0;
const BABY_SPEED_MULTIPLIER = 0.6;
const BABY_HUNGER_RATE = 0.012;
const ADULT_HUNGER_RATE = 0.006;
const RABBIT_BREED_THRESHOLD = 0.7;
const RABBIT_OBSTACLE_QUERY_RADIUS = 1.4;

// Heart shape geometry (created once, shared)
const heartShape = new THREE.Shape();
heartShape.moveTo(0, 0.3);
heartShape.bezierCurveTo(0, 0.45, -0.15, 0.6, -0.3, 0.6);
heartShape.bezierCurveTo(-0.55, 0.6, -0.55, 0.35, -0.55, 0.35);
heartShape.bezierCurveTo(-0.55, 0.2, -0.4, 0.0, 0, -0.3);
heartShape.bezierCurveTo(0.4, 0.0, 0.55, 0.2, 0.55, 0.35);
heartShape.bezierCurveTo(0.55, 0.35, 0.55, 0.6, 0.3, 0.6);
heartShape.bezierCurveTo(0.15, 0.6, 0, 0.45, 0, 0.3);
const heartGeo = new THREE.ShapeGeometry(heartShape);

interface RabbitProps {
  data: RabbitState;
}

export default function Rabbit({ data }: RabbitProps) {
  const groupRef = useRef<Group>(null!);
  const flLegRef = useRef<Group>(null!);
  const frLegRef = useRef<Group>(null!);
  const blLegRef = useRef<Group>(null!);
  const brLegRef = useRef<Group>(null!);
  const camera = useThree((threeState) => threeState.camera);
  const state = useEcosystem();
  const dispatch = useEcosystemDispatch();
  const { followTarget, setFollowTarget } = useFollow();
  const { getMovementInput } = useMovementInput();

  // Mutable refs for per-frame physics
  const position = useRef(new THREE.Vector3(...data.position));
  const velocity = useRef(new THREE.Vector3(...data.velocity));
  const jumpPhase = useRef(data.jumpPhase);
  const syncTimer = useRef(0);

  // Local reproductive state refs
  const pregnantRef = useRef(data.pregnant);
  const isAdultRef = useRef(data.isAdult);
  const matingCooldownRef = useRef(0);

  // Mating pause
  const matingPauseRef = useRef(0);
  const prevPregnantRef = useRef(data.pregnant);
  const heartRef = useRef<Mesh>(null!);

  // Drinking / eating pauses
  const drinkingTimerRef = useRef(0);
  const eatingTimerRef = useRef(0);
  const eatingFlowerIdRef = useRef<string | null>(null);

  // Committed flower target — stick with one until it disappears
  const targetFlowerIdRef = useRef<string | null>(null);

  // Idle wander timer — occasionally rabbits just roam
  const idleWanderRef = useRef(0);

  // Debug intention tracking
  const intentionRef = useRef('Wandering');
  const intentionTargetRef = useRef<THREE.Vector3 | null>(null);
  const effectiveSightRef = useRef(FLEE_RADIUS);

  // Sync from state on render
  pregnantRef.current = data.pregnant;
  isAdultRef.current = data.isAdult;

  // Detect female becoming pregnant → trigger mating pause
  if (data.pregnant && !prevPregnantRef.current) {
    matingPauseRef.current = MATING_PAUSE_DURATION;
  }
  prevPregnantRef.current = data.pregnant;

  // Steering
  const { seek, flee, wander, applyForces } = useSteering({
    maxSpeed: MAX_SPEED_RABBIT,
    maxForce: 5,
    mass: 1,
    wanderRadius: 1.2,
    wanderDistance: 2.5,
    wanderJitter: 0.4,
  });

  // Needs
  const {
    tick: tickNeeds,
    hungerRef,
    thirstRef,
  } = useEntityNeeds({
    id: data.id,
    entityType: 'rabbit',
    hunger: data.hunger,
    thirst: data.thirst,
    hungerRate: data.isAdult ? ADULT_HUNGER_RATE : BABY_HUNGER_RATE,
  });

  // Reusable temp vectors
  const tempForce = useMemo(() => new THREE.Vector3(), []);
  const tempTarget = useMemo(() => new THREE.Vector3(), []);
  const tempFoxPos = useMemo(() => new THREE.Vector3(), []);
  const tempForward = useMemo(() => new THREE.Vector3(), []);
  const tempRight = useMemo(() => new THREE.Vector3(), []);
  const tempMove = useMemo(() => new THREE.Vector3(), []);
  const upAxis = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame((_frameState, rawDelta) => {
    if (state.paused) return;

    const delta = rawDelta * state.speed;

    // Tick needs — may kill entity
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
      followTarget?.type === 'rabbit' && followTarget.id === data.id;
    const effectiveFleeRadius =
      FLEE_RADIUS * getSightMultiplier(state.timeOfDay);
    effectiveSightRef.current = effectiveFleeRadius;

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

      const manualMaxSpeed = MAX_SPEED_RABBIT * (input.sprint ? 1.35 : 1);
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
      resolveTreeCollisions(pos, vel, 0.42);

      const bound = WORLD_SIZE * 0.95;
      if (pos.x < -bound || pos.x > bound) {
        vel.x *= -1;
        pos.x = Math.max(-bound, Math.min(bound, pos.x));
      }
      if (pos.z < -bound || pos.z > bound) {
        vel.z *= -1;
        pos.z = Math.max(-bound, Math.min(bound, pos.z));
      }

      const speed = vel.length();
      const speedFactor = Math.min(speed / MAX_SPEED_RABBIT, 1);
      jumpPhase.current += JUMP_FREQUENCY * Math.PI * 2 * delta * speedFactor;
      const hopY =
        Math.max(0, Math.sin(jumpPhase.current)) * JUMP_HEIGHT * speedFactor;

      const terrainY = groundHeightAt(pos.x, pos.z);
      const depth = waterDepthAt(pos.x, pos.z);
      const sinkY = depth > 0 ? -depth * 0.85 : 0;
      groupRef.current.position.set(pos.x, terrainY + hopY + sinkY, pos.z);
      if (speed > 0.08) {
        groupRef.current.rotation.y = Math.atan2(vel.x, vel.z);
        const hopCycle = Math.sin(jumpPhase.current);
        if (flLegRef.current) flLegRef.current.rotation.x = hopCycle * 0.5 * speedFactor;
        if (frLegRef.current) frLegRef.current.rotation.x = hopCycle * 0.5 * speedFactor;
        if (blLegRef.current) blLegRef.current.rotation.x = -hopCycle * 0.7 * speedFactor;
        if (brLegRef.current) brLegRef.current.rotation.x = -hopCycle * 0.7 * speedFactor;
      } else {
        if (flLegRef.current) flLegRef.current.rotation.x = 0;
        if (frLegRef.current) frLegRef.current.rotation.x = 0;
        if (blLegRef.current) blLegRef.current.rotation.x = 0;
        if (brLegRef.current) brLegRef.current.rotation.x = 0;
      }

      intentionRef.current = input.hasInput ? 'Player control' : 'Standing by';
      intentionTargetRef.current = null;
      targetFlowerIdRef.current = null;
      drinkingTimerRef.current = 0;
      eatingTimerRef.current = 0;
      eatingFlowerIdRef.current = null;
      matingPauseRef.current = 0;

      syncTimer.current += delta;
      if (syncTimer.current > 0.2) {
        syncTimer.current = 0;
        dispatch({
          type: 'UPDATE_ENTITY_POSITION',
          id: data.id,
          entityType: 'rabbit',
          position: [pos.x, 0, pos.z],
          velocity: [vel.x, vel.y, vel.z],
        });
      }
      return;
    }

    // ── MATING PAUSE: stand still, show heart ──
    if (matingPauseRef.current > 0) {
      matingPauseRef.current -= delta;

      // Zero velocity — stand still
      vel.set(0, 0, 0);
      if (flLegRef.current) flLegRef.current.rotation.x = 0;
      if (frLegRef.current) frLegRef.current.rotation.x = 0;
      if (blLegRef.current) blLegRef.current.rotation.x = 0;
      if (brLegRef.current) brLegRef.current.rotation.x = 0;
      intentionRef.current = 'Mating';
      intentionTargetRef.current = null;

      // Animate heart: gentle pulse
      if (heartRef.current) {
        const t =
          (MATING_PAUSE_DURATION - matingPauseRef.current) /
          MATING_PAUSE_DURATION;
        const pulse = 1.0 + Math.sin(t * Math.PI * 4) * 0.1;
        heartRef.current.scale.set(pulse, pulse, pulse);
        heartRef.current.visible = true;
      }

      // River depth for position
      const terrainY = groundHeightAt(pos.x, pos.z);
      const depth = waterDepthAt(pos.x, pos.z);
      const sinkY = depth > 0 ? -depth * 0.85 : 0;
      groupRef.current.position.set(pos.x, terrainY + sinkY, pos.z);

      // Still sync position
      syncTimer.current += delta;
      if (syncTimer.current > 0.5) {
        syncTimer.current = 0;
        dispatch({
          type: 'UPDATE_ENTITY_POSITION',
          id: data.id,
          entityType: 'rabbit',
          position: [pos.x, 0, pos.z],
          velocity: [0, 0, 0],
        });
      }
      return;
    }

    // Hide heart when not mating
    if (heartRef.current) {
      heartRef.current.visible = false;
    }

    // ── Danger interrupts drinking/eating ──
    if (drinkingTimerRef.current > 0 || eatingTimerRef.current > 0) {
      const foxCheck = entitiesInRadius(
        [pos.x, pos.y, pos.z],
        effectiveFleeRadius,
        state.foxes,
      );
      if (foxCheck.length > 0) {
        drinkingTimerRef.current = 0;
        eatingTimerRef.current = 0;
        eatingFlowerIdRef.current = null;
      }
    }

    // ── DRINKING PAUSE: stay by water, fill thirst to full ──
    if (drinkingTimerRef.current > 0) {
      drinkingTimerRef.current -= delta;
      thirstRef.current = Math.min(1, thirstRef.current + delta / 3);
      vel.set(0, 0, 0);
      if (flLegRef.current) flLegRef.current.rotation.x = 0;
      if (frLegRef.current) frLegRef.current.rotation.x = 0;
      if (blLegRef.current) blLegRef.current.rotation.x = 0;
      if (brLegRef.current) brLegRef.current.rotation.x = 0;
      intentionRef.current = 'Drinking';
      intentionTargetRef.current = null;
      if (thirstRef.current >= 1 || drinkingTimerRef.current <= 0) {
        drinkingTimerRef.current = 0;
      }
      const terrainY = groundHeightAt(pos.x, pos.z);
      const depth = waterDepthAt(pos.x, pos.z);
      const sinkY = depth > 0 ? -depth * 0.85 : 0;
      groupRef.current.position.set(pos.x, terrainY + sinkY, pos.z);
      syncTimer.current += delta;
      if (syncTimer.current > 0.5) {
        syncTimer.current = 0;
        dispatch({
          type: 'UPDATE_ENTITY_POSITION',
          id: data.id,
          entityType: 'rabbit',
          position: [pos.x, 0, pos.z],
          velocity: [0, 0, 0],
        });
      }
      return;
    }

    // ── EATING PAUSE: stay by flower, consume after 2 seconds ──
    if (eatingTimerRef.current > 0) {
      eatingTimerRef.current -= delta;
      vel.set(0, 0, 0);
      if (flLegRef.current) flLegRef.current.rotation.x = 0;
      if (frLegRef.current) frLegRef.current.rotation.x = 0;
      if (blLegRef.current) blLegRef.current.rotation.x = 0;
      if (brLegRef.current) brLegRef.current.rotation.x = 0;
      intentionRef.current = 'Eating';
      intentionTargetRef.current = null;
      if (eatingTimerRef.current <= 0) {
        eatingTimerRef.current = 0;
        if (eatingFlowerIdRef.current) {
          if (pregnantRef.current && hungerRef.current > NEED_THRESHOLD) {
            pregnantRef.current = false;
            const litterSize = 3;
            for (let i = 0; i < litterSize; i++) {
              const babyPos: [number, number, number] = [
                pos.x + (Math.random() - 0.5) * 2,
                0,
                pos.z + (Math.random() - 0.5) * 2,
              ];
              dispatch({
                type: 'SPAWN_RABBIT',
                rabbit: {
                  id: `rabbit_${Date.now()}_${Math.floor(Math.random() * 10000)}_${i}`,
                  type: 'rabbit',
                  position: babyPos,
                  velocity: [0, 0, 0],
                  hunger: 0.9,
                  thirst: 0.9,
                  behavior: 'wandering',
                  alive: true,
                  jumpPhase: Math.random() * Math.PI * 2,
                  sex: Math.random() > 0.5 ? 'male' : 'female',
                  isAdult: false,
                  pregnant: false,
                  mealsEaten: 0,
                },
              });
            }
          }
          dispatch({
            type: 'EAT_FLOWER',
            flowerId: eatingFlowerIdRef.current,
            entityId: data.id,
          });
          eatingFlowerIdRef.current = null;
        }
      }
      const terrainY = groundHeightAt(pos.x, pos.z);
      const depth = waterDepthAt(pos.x, pos.z);
      const sinkY = depth > 0 ? -depth * 0.85 : 0;
      groupRef.current.position.set(pos.x, terrainY + sinkY, pos.z);
      syncTimer.current += delta;
      if (syncTimer.current > 0.5) {
        syncTimer.current = 0;
        dispatch({
          type: 'UPDATE_ENTITY_POSITION',
          id: data.id,
          entityType: 'rabbit',
          position: [pos.x, 0, pos.z],
          velocity: [0, 0, 0],
        });
      }
      return;
    }

    tempForce.set(0, 0, 0);

    // ── 1. FLEE: highest priority ──
    const nearbyFoxes = entitiesInRadius(
      [pos.x, pos.y, pos.z],
      effectiveFleeRadius,
      state.foxes,
    );

    if (nearbyFoxes.length > 0) {
      // Flee from nearest fox
      let closestDist = Infinity;
      let closestFoxPos = tempFoxPos;
      for (const fox of nearbyFoxes) {
        tempFoxPos.set(...fox.position);
        const d = pos.distanceTo(tempFoxPos);
        if (d < closestDist) {
          closestDist = d;
          closestFoxPos = tempFoxPos.clone();
        }
      }
      const fleeForce = flee(pos, vel, closestFoxPos, effectiveFleeRadius);
      tempForce.add(fleeForce.multiplyScalar(2.0));
      targetFlowerIdRef.current = null;
      idleWanderRef.current = 0; // drop flower commitment and wander when fleeing
      intentionRef.current = 'Fleeing!';
      intentionTargetRef.current = null;

      // ── 2. SEEK WATER: thirsty ──
    } else if (thirstRef.current < NEED_THRESHOLD) {
      const riverPt = findNearestWaterPoint([pos.x, pos.y, pos.z]);
      tempTarget.set(...riverPt);
      tempForce.add(seek(pos, vel, tempTarget));
      intentionRef.current = 'Seeking water';
      intentionTargetRef.current = tempTarget.clone();

      if (pos.distanceTo(tempTarget) < 1.0) {
        dispatch({ type: 'DRINK', entityId: data.id, entityType: 'rabbit' });
      }

      // ── 3. SEEK MATE: well-fed (>80%), adult, not pregnant, cooldown expired ──
    } else if (
      hungerRef.current > RABBIT_BREED_THRESHOLD &&
      thirstRef.current > NEED_THRESHOLD &&
      isAdultRef.current &&
      !pregnantRef.current &&
      matingCooldownRef.current <= 0 &&
      state.rabbits.length < MAX_RABBITS
    ) {
      // Find eligible mates: opposite sex, adult, not pregnant
      const eligibleMates = state.rabbits.filter(
        (r) =>
          r.id !== data.id &&
          r.alive &&
          r.isAdult &&
          !r.pregnant &&
          r.sex !== data.sex,
      );
      const nearbyMates = entitiesInRadius(
        [pos.x, pos.y, pos.z],
        MATE_RADIUS,
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
          if (pos.distanceTo(tempTarget) < 1.0 && data.sex === 'male') {
            matingCooldownRef.current = MATING_COOLDOWN;
            matingPauseRef.current = MATING_PAUSE_DURATION;
            dispatch({
              type: 'RABBIT_MATE',
              maleId: data.id,
              femaleId: nearestMate.id,
            });
          }
        }
      } else {
        // No mates nearby — eat or occasionally wander
        if (idleWanderRef.current > 0) {
          idleWanderRef.current -= delta;
          tempForce.add(wander(pos, vel));
          intentionRef.current = 'Wandering';
          intentionTargetRef.current = null;
        } else {
          // Check if committed flower target is still valid
          const aliveFlowers = state.flowers.filter((f) => f.alive);
          let targetFlower = targetFlowerIdRef.current
            ? (aliveFlowers.find((f) => f.id === targetFlowerIdRef.current) ??
              null)
            : null;
          if (!targetFlower) {
            if (Math.random() < 0.2) {
              idleWanderRef.current = 3 + Math.random() * 2;
              tempForce.add(wander(pos, vel));
              intentionRef.current = 'Wandering';
              intentionTargetRef.current = null;
            } else {
              const picked = findRandomAmongNearest(
                [pos.x, pos.y, pos.z],
                aliveFlowers,
                3,
              );
              targetFlower = picked;
              targetFlowerIdRef.current = picked ? picked.id : null;
            }
          }
          if (targetFlower) {
            tempTarget.set(...targetFlower.position);
            tempForce.add(seek(pos, vel, tempTarget));
            intentionRef.current = 'Seeking food';
            intentionTargetRef.current = tempTarget.clone();

            if (pos.distanceTo(tempTarget) < 0.8) {
              targetFlowerIdRef.current = null;
              if (pregnantRef.current && hungerRef.current > NEED_THRESHOLD) {
                pregnantRef.current = false;
                const litterSize = 3;
                for (let i = 0; i < litterSize; i++) {
                  const babyPos: [number, number, number] = [
                    pos.x + (Math.random() - 0.5) * 2,
                    0,
                    pos.z + (Math.random() - 0.5) * 2,
                  ];
                  dispatch({
                    type: 'SPAWN_RABBIT',
                    rabbit: {
                      id: `rabbit_${Date.now()}_${Math.floor(Math.random() * 10000)}_${i}`,
                      type: 'rabbit',
                      position: babyPos,
                      velocity: [0, 0, 0],
                      hunger: 0.9,
                      thirst: 0.9,
                      behavior: 'wandering',
                      alive: true,
                      jumpPhase: Math.random() * Math.PI * 2,
                      sex: Math.random() > 0.5 ? 'male' : 'female',
                      isAdult: false,
                      pregnant: false,
                      mealsEaten: 0,
                    },
                  });
                }
              }
              dispatch({
                type: 'EAT_FLOWER',
                flowerId: targetFlower.id,
                entityId: data.id,
              });
            }
          } else {
            tempForce.add(wander(pos, vel));
            intentionRef.current = 'Wandering';
            intentionTargetRef.current = null;
          }
        }
      }

      // ── 4. SEEK FOOD: eat most of the time, occasionally wander ──
    } else {
      if (idleWanderRef.current > 0) {
        idleWanderRef.current -= delta;
        tempForce.add(wander(pos, vel));
        intentionRef.current = 'Wandering';
        intentionTargetRef.current = null;
      } else {
        // Check if committed flower target is still valid
        const aliveFlowers = state.flowers.filter((f) => f.alive);
        let targetFlower = targetFlowerIdRef.current
          ? (aliveFlowers.find((f) => f.id === targetFlowerIdRef.current) ??
            null)
          : null;
        if (!targetFlower) {
          // ~20% chance to idle wander for 3-5s instead of picking a flower
          if (Math.random() < 0.2) {
            idleWanderRef.current = 3 + Math.random() * 2;
            tempForce.add(wander(pos, vel));
            intentionRef.current = 'Wandering';
            intentionTargetRef.current = null;
          } else {
            const picked = findRandomAmongNearest(
              [pos.x, pos.y, pos.z],
              aliveFlowers,
              3,
            );
            targetFlower = picked;
            targetFlowerIdRef.current = picked ? picked.id : null;
          }
        }
        if (targetFlower) {
          tempTarget.set(...targetFlower.position);
          tempForce.add(seek(pos, vel, tempTarget));
          intentionRef.current = 'Seeking food';
          intentionTargetRef.current = tempTarget.clone();

          if (pos.distanceTo(tempTarget) < 0.8) {
            targetFlowerIdRef.current = null;
            if (pregnantRef.current) {
              pregnantRef.current = false;
              const litterSize = 3;
              for (let i = 0; i < litterSize; i++) {
                const babyPos: [number, number, number] = [
                  pos.x + (Math.random() - 0.5) * 2,
                  0,
                  pos.z + (Math.random() - 0.5) * 2,
                ];
                dispatch({
                  type: 'SPAWN_RABBIT',
                  rabbit: {
                    id: `rabbit_${Date.now()}_${Math.floor(Math.random() * 10000)}_${i}`,
                    type: 'rabbit',
                    position: babyPos,
                    velocity: [0, 0, 0],
                    hunger: 0.9,
                    thirst: 0.9,
                    behavior: 'wandering',
                    alive: true,
                    jumpPhase: Math.random() * Math.PI * 2,
                    sex: Math.random() > 0.5 ? 'male' : 'female',
                    isAdult: false,
                    pregnant: false,
                    mealsEaten: 0,
                  },
                });
              }
            }
            dispatch({
              type: 'EAT_FLOWER',
              flowerId: targetFlower.id,
              entityId: data.id,
            });
          }
        }
      }
    }

    // Obstacle avoidance — push away from trees and stones
    forEachNearbyObstacle(pos.x, pos.z, RABBIT_OBSTACLE_QUERY_RADIUS, (obs) => {
      const dx = pos.x - obs.position[0];
      const dz = pos.z - obs.position[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      const avoidR = obs.radius + 0.5;
      if (dist < avoidR && dist > 0.01) {
        const strength = ((avoidR - dist) / avoidR) * 8;
        tempTarget.set((dx / dist) * strength, 0, (dz / dist) * strength);
        tempForce.add(tempTarget);
      }
    });

    // Snow avoidance — no walking on snow
    const [snowFx, snowFz] = heightCapForce(pos.x, pos.z, SNOW_HEIGHT, 5, 15);
    tempForce.x += snowFx;
    tempForce.z += snowFz;

    // Apply physics
    applyForces(pos, vel, tempForce, delta);
    resolveTreeCollisions(pos, vel, 0.42);

    // Baby rabbits are slower
    if (!isAdultRef.current) {
      vel.clampLength(0, MAX_SPEED_RABBIT * BABY_SPEED_MULTIPLIER);
    }

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

    // Jump animation
    const speed = vel.length();
    const speedFactor = Math.min(speed / MAX_SPEED_RABBIT, 1);
    jumpPhase.current += JUMP_FREQUENCY * Math.PI * 2 * delta * speedFactor;
    const hopY =
      Math.abs(Math.sin(jumpPhase.current)) * JUMP_HEIGHT * speedFactor;

    // River depth: sink to riverbed when walking in the river
    const terrainY = groundHeightAt(pos.x, pos.z);
    const depth = waterDepthAt(pos.x, pos.z);
    const sinkY = depth > 0 ? -depth * 0.85 : 0; // sink most of the way down

    // Apply to mesh
    groupRef.current.position.set(pos.x, terrainY + hopY + sinkY, pos.z);

    if (speed > 0.1) {
      groupRef.current.rotation.y = Math.atan2(vel.x, vel.z);
      const hopCycle = Math.sin(jumpPhase.current);
      if (flLegRef.current) flLegRef.current.rotation.x = hopCycle * 0.5 * speedFactor;
      if (frLegRef.current) frLegRef.current.rotation.x = hopCycle * 0.5 * speedFactor;
      if (blLegRef.current) blLegRef.current.rotation.x = -hopCycle * 0.7 * speedFactor;
      if (brLegRef.current) brLegRef.current.rotation.x = -hopCycle * 0.7 * speedFactor;
    } else {
      if (flLegRef.current) flLegRef.current.rotation.x = 0;
      if (frLegRef.current) frLegRef.current.rotation.x = 0;
      if (blLegRef.current) blLegRef.current.rotation.x = 0;
      if (brLegRef.current) brLegRef.current.rotation.x = 0;
    }

    // Periodic state sync
    syncTimer.current += delta;
    if (syncTimer.current > 0.5) {
      syncTimer.current = 0;
      dispatch({
        type: 'UPDATE_ENTITY_POSITION',
        id: data.id,
        entityType: 'rabbit',
        position: [pos.x, 0, pos.z],
        velocity: [vel.x, vel.y, vel.z],
      });
    }
  });

  const visualScale = data.isAdult ? 1 : 0.6;
  const barYOffset = data.isAdult ? 1.0 : 0.7;

  return (
    <>
      <group
        ref={groupRef}
        name={`animal-rabbit-${data.id}`}
        onClick={(event) => {
          event.stopPropagation();
          setFollowTarget({ id: data.id, type: 'rabbit' });
        }}
        position={[
          data.position[0],
          groundHeightAt(data.position[0], data.position[2]) + data.position[1],
          data.position[2],
        ]}
      >
        <group scale={visualScale}>
          {/* Body - elongated oval torso */}
          <mesh castShadow position={[0, 0.2, -0.02]} scale={[1, 0.9, 1.15]}>
            <sphereGeometry args={[0.22, 10, 10]} />
            <meshStandardMaterial color={data.pregnant ? '#dba0b8' : '#c49a6c'} />
          </mesh>
          {/* Rump - round backside */}
          <mesh castShadow position={[0, 0.24, -0.14]}>
            <sphereGeometry args={[0.17, 8, 8]} />
            <meshStandardMaterial color={data.pregnant ? '#dba0b8' : '#c49a6c'} />
          </mesh>
          {/* Belly - lighter underside */}
          <mesh position={[0, 0.12, 0.02]}>
            <boxGeometry args={[0.18, 0.07, 0.28]} />
            <meshStandardMaterial color="#dcc8a8" />
          </mesh>
          {/* Head */}
          <mesh castShadow position={[0, 0.32, 0.26]}>
            <sphereGeometry args={[0.14, 10, 10]} />
            <meshStandardMaterial color={data.pregnant ? '#dba0b8' : '#c49a6c'} />
          </mesh>
          {/* Muzzle - wider, softer */}
          <mesh position={[0, 0.26, 0.36]} scale={[1.3, 0.85, 1]}>
            <sphereGeometry args={[0.065, 8, 8]} />
            <meshStandardMaterial color="#dcc8a8" />
          </mesh>
          {/* Nose */}
          <mesh position={[0, 0.29, 0.40]}>
            <sphereGeometry args={[0.018, 6, 6]} />
            <meshStandardMaterial color="#e88a93" />
          </mesh>
          {/* Left eye */}
          <mesh position={[-0.1, 0.36, 0.32]}>
            <sphereGeometry args={[0.028, 6, 6]} />
            <meshStandardMaterial color="#1a1000" />
          </mesh>
          {/* Right eye */}
          <mesh position={[0.1, 0.36, 0.32]}>
            <sphereGeometry args={[0.028, 6, 6]} />
            <meshStandardMaterial color="#1a1000" />
          </mesh>
          {/* Left ear outer - wide, flat like real rabbit ears */}
          <mesh position={[-0.055, 0.55, 0.2]} rotation={[0.2, 0, -0.15]} scale={[1.4, 1, 0.5]}>
            <capsuleGeometry args={[0.035, 0.26, 5, 5]} />
            <meshStandardMaterial color={data.pregnant ? '#c8899a' : '#a87e52'} />
          </mesh>
          {/* Left ear inner */}
          <mesh position={[-0.052, 0.55, 0.205]} rotation={[0.2, 0, -0.15]} scale={[1.3, 1, 0.45]}>
            <capsuleGeometry args={[0.025, 0.2, 4, 4]} />
            <meshStandardMaterial color="#e8a0a8" />
          </mesh>
          {/* Right ear outer */}
          <mesh position={[0.055, 0.55, 0.2]} rotation={[0.2, 0, 0.15]} scale={[1.4, 1, 0.5]}>
            <capsuleGeometry args={[0.035, 0.26, 5, 5]} />
            <meshStandardMaterial color={data.pregnant ? '#c8899a' : '#a87e52'} />
          </mesh>
          {/* Right ear inner */}
          <mesh position={[0.052, 0.55, 0.205]} rotation={[0.2, 0, 0.15]} scale={[1.3, 1, 0.45]}>
            <capsuleGeometry args={[0.025, 0.2, 4, 4]} />
            <meshStandardMaterial color="#e8a0a8" />
          </mesh>
          {/* Front-left leg */}
          <group ref={flLegRef} position={[-0.08, 0.06, 0.1]}>
            <mesh castShadow>
              <boxGeometry args={[0.05, 0.12, 0.05]} />
              <meshStandardMaterial color={data.pregnant ? '#c8899a' : '#a88560'} />
            </mesh>
            <mesh position={[0, -0.07, 0.01]}>
              <sphereGeometry args={[0.028, 5, 5]} />
              <meshStandardMaterial color={data.pregnant ? '#c8899a' : '#a88560'} />
            </mesh>
          </group>
          {/* Front-right leg */}
          <group ref={frLegRef} position={[0.08, 0.06, 0.1]}>
            <mesh castShadow>
              <boxGeometry args={[0.05, 0.12, 0.05]} />
              <meshStandardMaterial color={data.pregnant ? '#c8899a' : '#a88560'} />
            </mesh>
            <mesh position={[0, -0.07, 0.01]}>
              <sphereGeometry args={[0.028, 5, 5]} />
              <meshStandardMaterial color={data.pregnant ? '#c8899a' : '#a88560'} />
            </mesh>
          </group>
          {/* Back-left leg (larger, powerful hind leg) */}
          <group ref={blLegRef} position={[-0.1, 0.08, -0.12]}>
            <mesh castShadow>
              <boxGeometry args={[0.07, 0.1, 0.08]} />
              <meshStandardMaterial color={data.pregnant ? '#dba0b8' : '#c49a6c'} />
            </mesh>
            <mesh castShadow position={[0, -0.1, 0.02]}>
              <boxGeometry args={[0.05, 0.12, 0.055]} />
              <meshStandardMaterial color={data.pregnant ? '#c8899a' : '#a88560'} />
            </mesh>
            <mesh position={[0, -0.17, 0.04]}>
              <boxGeometry args={[0.05, 0.025, 0.08]} />
              <meshStandardMaterial color={data.pregnant ? '#c8899a' : '#a88560'} />
            </mesh>
          </group>
          {/* Back-right leg (larger, powerful hind leg) */}
          <group ref={brLegRef} position={[0.1, 0.08, -0.12]}>
            <mesh castShadow>
              <boxGeometry args={[0.07, 0.1, 0.08]} />
              <meshStandardMaterial color={data.pregnant ? '#dba0b8' : '#c49a6c'} />
            </mesh>
            <mesh castShadow position={[0, -0.1, 0.02]}>
              <boxGeometry args={[0.05, 0.12, 0.055]} />
              <meshStandardMaterial color={data.pregnant ? '#c8899a' : '#a88560'} />
            </mesh>
            <mesh position={[0, -0.17, 0.04]}>
              <boxGeometry args={[0.05, 0.025, 0.08]} />
              <meshStandardMaterial color={data.pregnant ? '#c8899a' : '#a88560'} />
            </mesh>
          </group>
          {/* Tail - fluffy cotton ball */}
          <mesh position={[0, 0.26, -0.28]}>
            <sphereGeometry args={[0.065, 8, 8]} />
            <meshStandardMaterial color="#f0ebe5" />
          </mesh>
        </group>
        {/* Soft contact shadow on ground */}
        <mesh position={[0, -data.position[1] + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.35, 16]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            vertexShader={softShadowVert}
            fragmentShader={softShadowFrag}
            uniforms={{ uOpacity: { value: 0.25 } }}
          />
        </mesh>
        <StatusBar
          hungerRef={hungerRef}
          thirstRef={thirstRef}
          yOffset={barYOffset}
        />
        {/* Heart — shown during mating pause */}
        <Billboard position={[0, barYOffset + 0.3, 0]}>
          <mesh ref={heartRef} geometry={heartGeo} visible={false} scale={0.25}>
            <meshBasicMaterial
              color="#e85080"
              transparent
              opacity={0.7}
              side={THREE.DoubleSide}
            />
          </mesh>
        </Billboard>
      </group>
      <IntentionOverlay
        positionRef={position}
        targetRef={intentionTargetRef}
        intentionRef={intentionRef}
        labelY={barYOffset + 0.7}
        color="#90ee90"
      />
    </>
  );
}
