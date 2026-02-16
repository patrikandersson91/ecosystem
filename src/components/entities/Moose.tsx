import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { Group } from 'three';
import { softShadowVert, softShadowFrag } from '../../utils/soft-shadow-material.ts';
import {
  MAX_SPEED_MOOSE,
  NEED_THRESHOLD,
  WORLD_SIZE,
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
  useEcosystemRef,
  useEcosystemDispatch,
} from '../../state/ecosystem-context.tsx';
import { useFollow } from '../../state/follow-context.tsx';
import {
  findRandomAmongNearest,
  findNearestWaterPoint,
} from '../../state/ecosystem-selectors.ts';
import StatusBar from './StatusBar.tsx';
import IntentionOverlay from './IntentionOverlay.tsx';

interface MooseProps {
  id: string;
}

const MOOSE_HUNGER_RATE = 0.00025;
const MOOSE_THIRST_RATE = 0.001;
const MOOSE_OBSTACLE_QUERY_RADIUS = 1.7;

export default function Moose({ id }: MooseProps) {
  const groupRef = useRef<Group>(null!);
  const camera = useThree((threeState) => threeState.camera);
  const flLegRef = useRef<Group>(null!);
  const frLegRef = useRef<Group>(null!);
  const blLegRef = useRef<Group>(null!);
  const brLegRef = useRef<Group>(null!);
  const headRef = useRef<Group>(null!);
  const stateRef = useEcosystemRef();
  const dispatch = useEcosystemDispatch();
  const { followTarget, setFollowTarget } = useFollow();
  const { getMovementInput } = useMovementInput();

  // Snapshot initial data (stable, won't re-render)
  const initData = useMemo(() => stateRef.current.moose.find(m => m.id === id)!, []);

  const position = useRef(new Vector3(...initData.position));
  const velocity = useRef(new Vector3(...initData.velocity));
  const syncTimer = useRef(0);
  const targetFlowerIdRef = useRef<string | null>(null);

  const intentionRef = useRef('Wandering');
  const intentionTargetRef = useRef<Vector3 | null>(null);

  const { seek, wander, applyForces } = useSteering({
    maxSpeed: MAX_SPEED_MOOSE,
    maxForce: 3.5,
    mass: 2.1,
    wanderRadius: 1.5,
    wanderDistance: 3.5,
    wanderJitter: 0.18,
  });

  const {
    tick: tickNeeds,
    hungerRef,
    thirstRef,
  } = useEntityNeeds({
    id: id,
    entityType: 'moose',
    hunger: initData.hunger,
    thirst: initData.thirst,
    hungerRate: MOOSE_HUNGER_RATE,
    thirstRate: MOOSE_THIRST_RATE,
  });

  const tempForce = useMemo(() => new Vector3(), []);
  const tempTarget = useMemo(() => new Vector3(), []);
  const tempForward = useMemo(() => new Vector3(), []);
  const tempRight = useMemo(() => new Vector3(), []);
  const tempMove = useMemo(() => new Vector3(), []);
  const upAxis = useMemo(() => new Vector3(0, 1, 0), []);

  useFrame((_frameState, rawDelta) => {
    const state = stateRef.current;
    if (state.paused) return;

    const delta = rawDelta * state.speed;
    const needs = tickNeeds(delta);
    if (needs.dead) return;

    const pos = position.current;
    const vel = velocity.current;
    const isPlayerControlled =
      followTarget?.type === 'moose' && followTarget.id === id;
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

      const manualMaxSpeed = MAX_SPEED_MOOSE * (input.sprint ? 1.35 : 1);
      const steerBlend = 1 - Math.exp(-delta * 9);
      if (input.hasInput) {
        vel.lerp(tempMove.multiplyScalar(manualMaxSpeed), steerBlend);
      } else {
        vel.multiplyScalar(Math.exp(-delta * 7));
      }

      const [snowFx, snowFz] = heightCapForce(pos.x, pos.z, SNOW_HEIGHT, 5, 15);
      vel.x += snowFx * delta;
      vel.z += snowFz * delta;

      pos.addScaledVector(vel, delta);
      resolveTreeCollisions(pos, vel, 0.85);

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
      const sinkY = depth > 0 ? -depth * 0.75 : 0;
      groupRef.current.position.set(pos.x, terrainY + 1.1 + sinkY, pos.z);

      const speed = vel.length();
      if (speed > 0.08) {
        groupRef.current.rotation.y = Math.atan2(vel.x, vel.z);
        const t = state.time * 20;
        const leg1Angle = Math.sin(t) * 0.4;
        if (flLegRef.current) flLegRef.current.rotation.x = leg1Angle;
        if (brLegRef.current) brLegRef.current.rotation.x = leg1Angle;
        if (frLegRef.current) frLegRef.current.rotation.x = -leg1Angle;
        if (blLegRef.current) blLegRef.current.rotation.x = -leg1Angle;
        if (headRef.current) headRef.current.rotation.x = Math.sin(t * 0.5) * 0.06;
      } else {
        if (flLegRef.current) flLegRef.current.rotation.x = 0;
        if (brLegRef.current) brLegRef.current.rotation.x = 0;
        if (frLegRef.current) frLegRef.current.rotation.x = 0;
        if (blLegRef.current) blLegRef.current.rotation.x = 0;
        if (headRef.current) headRef.current.rotation.x = 0;
      }

      intentionRef.current = input.hasInput ? 'Player control' : 'Standing by';
      intentionTargetRef.current = null;
      targetFlowerIdRef.current = null;

      syncTimer.current += delta;
      if (syncTimer.current > 0.2) {
        syncTimer.current = 0;
        dispatch({
          type: 'UPDATE_ENTITY_POSITION',
          id: id,
          entityType: 'moose',
          position: [pos.x, 1.1, pos.z],
          velocity: [vel.x, vel.y, vel.z],
        });
      }
      return;
    }

    if (thirstRef.current < NEED_THRESHOLD) {
      const riverPt = findNearestWaterPoint([pos.x, pos.y, pos.z]);
      tempTarget.set(...riverPt);
      tempForce.add(seek(pos, vel, tempTarget));
      intentionRef.current = 'Seeking water';
      intentionTargetRef.current = tempTarget.clone();

      if (pos.distanceTo(tempTarget) < 1.2) {
        dispatch({ type: 'DRINK', entityId: id, entityType: 'moose' });
      }
    } else {
      const aliveFlowers = state.flowers.filter((f) => f.alive);
      let targetFlower = targetFlowerIdRef.current
        ? (aliveFlowers.find((f) => f.id === targetFlowerIdRef.current) ?? null)
        : null;

      if (!targetFlower) {
        const picked = findRandomAmongNearest(
          [pos.x, pos.y, pos.z],
          aliveFlowers,
          4,
        );
        targetFlower = picked;
        targetFlowerIdRef.current = picked ? picked.id : null;
      }

      if (targetFlower) {
        tempTarget.set(...targetFlower.position);
        tempForce.add(seek(pos, vel, tempTarget));
        intentionRef.current = 'Seeking food';
        intentionTargetRef.current = tempTarget.clone();

        if (pos.distanceTo(tempTarget) < 1.1) {
          targetFlowerIdRef.current = null;
          dispatch({
            type: 'EAT_FLOWER',
            flowerId: targetFlower.id,
            entityId: id,
          });
        }
      } else {
        tempForce.add(wander(pos, vel));
        intentionRef.current = 'Wandering';
        intentionTargetRef.current = null;
      }
    }

    forEachNearbyObstacle(pos.x, pos.z, MOOSE_OBSTACLE_QUERY_RADIUS, (obs) => {
      const dx = pos.x - obs.position[0];
      const dz = pos.z - obs.position[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      const avoidR = obs.radius + 0.8;
      if (dist < avoidR && dist > 0.01) {
        const strength = ((avoidR - dist) / avoidR) * 10;
        tempForce.x += (dx / dist) * strength;
        tempForce.z += (dz / dist) * strength;
      }
    });

    // Snow avoidance — no walking on snow
    const [snowFx, snowFz] = heightCapForce(pos.x, pos.z, SNOW_HEIGHT, 5, 15);
    tempForce.x += snowFx;
    tempForce.z += snowFz;

    applyForces(pos, vel, tempForce, delta);
    resolveTreeCollisions(pos, vel, 0.85);

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
    const sinkY = depth > 0 ? -depth * 0.75 : 0;
    groupRef.current.position.set(pos.x, terrainY + 1.1 + sinkY, pos.z);

    const speed = vel.length();
    if (speed > 0.08) {
      groupRef.current.rotation.y = Math.atan2(vel.x, vel.z);

      const t = state.time * 20;
      const leg1Angle = Math.sin(t) * 0.4;

      if (flLegRef.current) flLegRef.current.rotation.x = leg1Angle;
      if (brLegRef.current) brLegRef.current.rotation.x = leg1Angle;
      if (frLegRef.current) frLegRef.current.rotation.x = -leg1Angle;
      if (blLegRef.current) blLegRef.current.rotation.x = -leg1Angle;
      if (headRef.current) headRef.current.rotation.x = Math.sin(t * 0.5) * 0.06;
    } else {
      if (flLegRef.current) flLegRef.current.rotation.x = 0;
      if (brLegRef.current) brLegRef.current.rotation.x = 0;
      if (frLegRef.current) frLegRef.current.rotation.x = 0;
      if (blLegRef.current) blLegRef.current.rotation.x = 0;
      if (headRef.current) headRef.current.rotation.x = 0;
    }

    syncTimer.current += delta;
    if (syncTimer.current > 0.5) {
      syncTimer.current = 0;
      dispatch({
        type: 'UPDATE_ENTITY_POSITION',
        id: id,
        entityType: 'moose',
        position: [pos.x, 1.1, pos.z],
        velocity: [vel.x, vel.y, vel.z],
      });
    }
  });

  return (
    <>
      <group
        ref={groupRef}
        name={`animal-moose-${id}`}
        onClick={(event) => {
          event.stopPropagation();
          setFollowTarget({ id: id, type: 'moose' });
        }}
        position={[
          initData.position[0],
          groundHeightAt(initData.position[0], initData.position[2]) + initData.position[1],
          initData.position[2],
        ]}
      >
        <group scale={[2.2, 2.2, 2.2]}>
          {/* === BODY === */}
          {/* Main torso - massive barrel chest */}
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.26, 0.38, 6, 10]} />
            <meshStandardMaterial color="#4a3120" roughness={0.9} />
          </mesh>
          {/* Upper back ridge */}
          <mesh position={[0, 0.14, -0.02]} castShadow rotation={[Math.PI / 2, 0, 0]} scale={[0.9, 0.7, 0.7]}>
            <capsuleGeometry args={[0.18, 0.28, 5, 8]} />
            <meshStandardMaterial color="#3e2918" roughness={0.95} />
          </mesh>
          {/* Shoulder hump - very prominent */}
          <mesh position={[0, 0.22, 0.1]} castShadow scale={[0.9, 1, 0.85]}>
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshStandardMaterial color="#3a2415" roughness={0.95} />
          </mesh>
          {/* Shoulder hump peak */}
          <mesh position={[0, 0.28, 0.06]} castShadow scale={[0.7, 0.6, 0.65]}>
            <sphereGeometry args={[0.14, 6, 6]} />
            <meshStandardMaterial color="#352010" roughness={0.95} />
          </mesh>
          {/* Ribcage sides - left */}
          <mesh position={[-0.15, -0.02, -0.02]} castShadow rotation={[Math.PI / 2, 0, 0]} scale={[0.6, 0.8, 0.9]}>
            <capsuleGeometry args={[0.16, 0.22, 4, 6]} />
            <meshStandardMaterial color="#4e3422" roughness={0.9} />
          </mesh>
          {/* Ribcage sides - right */}
          <mesh position={[0.15, -0.02, -0.02]} castShadow rotation={[Math.PI / 2, 0, 0]} scale={[0.6, 0.8, 0.9]}>
            <capsuleGeometry args={[0.16, 0.22, 4, 6]} />
            <meshStandardMaterial color="#4e3422" roughness={0.9} />
          </mesh>
          {/* Hip / rump */}
          <mesh position={[0, 0.06, -0.24]} castShadow scale={[0.95, 0.9, 0.9]}>
            <sphereGeometry args={[0.22, 8, 8]} />
            <meshStandardMaterial color="#4a3120" roughness={0.9} />
          </mesh>
          {/* Belly underside - deep chest */}
          <mesh position={[0, -0.16, 0.0]} scale={[0.9, 1, 1]}>
            <boxGeometry args={[0.3, 0.08, 0.5]} />
            <meshStandardMaterial color="#55381f" roughness={0.9} />
          </mesh>
          {/* Chest brisket - front */}
          <mesh position={[0, -0.08, 0.2]} castShadow scale={[0.8, 0.7, 0.6]}>
            <sphereGeometry args={[0.16, 6, 6]} />
            <meshStandardMaterial color="#4a3120" roughness={0.9} />
          </mesh>

          {/* === NECK === */}
          {/* Lower neck - thick, muscular */}
          <mesh position={[0, 0.14, 0.32]} rotation={[0.55, 0, 0]} castShadow>
            <capsuleGeometry args={[0.14, 0.22, 5, 8]} />
            <meshStandardMaterial color="#4a3120" roughness={0.9} />
          </mesh>
          {/* Upper neck */}
          <mesh position={[0, 0.2, 0.4]} rotation={[0.4, 0, 0]} castShadow>
            <capsuleGeometry args={[0.11, 0.14, 4, 6]} />
            <meshStandardMaterial color="#4e3422" roughness={0.9} />
          </mesh>
          {/* Neck mane - shaggy fur along throat */}
          <mesh position={[0, 0.04, 0.32]} rotation={[0.6, 0, 0]} scale={[0.5, 0.4, 0.8]}>
            <capsuleGeometry args={[0.1, 0.18, 3, 4]} />
            <meshStandardMaterial color="#3a2415" roughness={1} />
          </mesh>

          {/* === HEAD GROUP (animated) === */}
          <group ref={headRef} position={[0, 0.18, 0.54]}>
            {/* Skull - elongated */}
            <mesh castShadow scale={[1, 0.9, 1.15]}>
              <sphereGeometry args={[0.13, 8, 8]} />
              <meshStandardMaterial color="#5a3d25" roughness={0.9} />
            </mesh>
            {/* Forehead bridge */}
            <mesh position={[0, 0.04, 0.08]} castShadow scale={[0.85, 0.7, 1]}>
              <sphereGeometry args={[0.09, 6, 6]} />
              <meshStandardMaterial color="#55381f" roughness={0.9} />
            </mesh>
            {/* Muzzle - long, drooping moose nose */}
            <mesh position={[0, -0.07, 0.14]} scale={[1, 0.85, 1.3]} castShadow>
              <sphereGeometry args={[0.09, 8, 8]} />
              <meshStandardMaterial color="#6b4a30" roughness={0.85} />
            </mesh>
            {/* Overhanging upper lip - characteristic moose feature */}
            <mesh position={[0, -0.12, 0.2]} scale={[1.15, 0.7, 0.9]}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshStandardMaterial color="#7a5838" roughness={0.8} />
            </mesh>
            {/* Nose pad - large, bulbous */}
            <mesh position={[0, -0.1, 0.23]} scale={[1.1, 0.6, 0.7]}>
              <sphereGeometry args={[0.04, 6, 6]} />
              <meshStandardMaterial color="#8a6448" roughness={0.7} />
            </mesh>
            {/* Lower jaw */}
            <mesh position={[0, -0.14, 0.12]} scale={[0.75, 0.45, 1.1]}>
              <sphereGeometry args={[0.07, 6, 6]} />
              <meshStandardMaterial color="#5a3d25" roughness={0.9} />
            </mesh>
            {/* Chin tuft */}
            <mesh position={[0, -0.16, 0.1]} scale={[0.5, 0.4, 0.6]}>
              <sphereGeometry args={[0.04, 4, 4]} />
              <meshStandardMaterial color="#3a2415" roughness={1} />
            </mesh>
            {/* Left nostril */}
            <mesh position={[-0.025, -0.11, 0.26]}>
              <sphereGeometry args={[0.015, 6, 6]} />
              <meshStandardMaterial color="#1a0e08" />
            </mesh>
            {/* Right nostril */}
            <mesh position={[0.025, -0.11, 0.26]}>
              <sphereGeometry args={[0.015, 6, 6]} />
              <meshStandardMaterial color="#1a0e08" />
            </mesh>
            {/* Left eye */}
            <mesh position={[-0.09, 0.03, 0.06]}>
              <sphereGeometry args={[0.022, 6, 6]} />
              <meshStandardMaterial color="#1a1000" />
            </mesh>
            {/* Left eye brow ridge */}
            <mesh position={[-0.085, 0.06, 0.06]} scale={[1.2, 0.5, 0.8]}>
              <sphereGeometry args={[0.025, 4, 4]} />
              <meshStandardMaterial color="#4a3120" roughness={0.95} />
            </mesh>
            {/* Right eye */}
            <mesh position={[0.09, 0.03, 0.06]}>
              <sphereGeometry args={[0.022, 6, 6]} />
              <meshStandardMaterial color="#1a1000" />
            </mesh>
            {/* Right eye brow ridge */}
            <mesh position={[0.085, 0.06, 0.06]} scale={[1.2, 0.5, 0.8]}>
              <sphereGeometry args={[0.025, 4, 4]} />
              <meshStandardMaterial color="#4a3120" roughness={0.95} />
            </mesh>
            {/* Left ear */}
            <mesh position={[-0.1, 0.1, -0.04]} rotation={[0.25, 0, -0.4]} scale={[1, 1, 0.6]}>
              <capsuleGeometry args={[0.028, 0.07, 3, 5]} />
              <meshStandardMaterial color="#4e3422" roughness={0.9} />
            </mesh>
            {/* Left ear inner */}
            <mesh position={[-0.098, 0.1, -0.035]} rotation={[0.25, 0, -0.4]} scale={[1, 1, 0.5]}>
              <capsuleGeometry args={[0.018, 0.045, 3, 4]} />
              <meshStandardMaterial color="#6b5540" />
            </mesh>
            {/* Right ear */}
            <mesh position={[0.1, 0.1, -0.04]} rotation={[0.25, 0, 0.4]} scale={[1, 1, 0.6]}>
              <capsuleGeometry args={[0.028, 0.07, 3, 5]} />
              <meshStandardMaterial color="#4e3422" roughness={0.9} />
            </mesh>
            {/* Right ear inner */}
            <mesh position={[0.098, 0.1, -0.035]} rotation={[0.25, 0, 0.4]} scale={[1, 1, 0.5]}>
              <capsuleGeometry args={[0.018, 0.045, 3, 4]} />
              <meshStandardMaterial color="#6b5540" />
            </mesh>
            {/* Dewlap (bell) - prominent hanging throat skin */}
            <mesh position={[0, -0.18, 0.06]} rotation={[0.2, 0, 0]}>
              <capsuleGeometry args={[0.035, 0.1, 4, 5]} />
              <meshStandardMaterial color="#5a3d25" roughness={0.9} />
            </mesh>
            {/* Dewlap tip */}
            <mesh position={[0, -0.26, 0.04]} scale={[0.8, 0.6, 0.7]}>
              <sphereGeometry args={[0.03, 4, 4]} />
              <meshStandardMaterial color="#4a3120" roughness={0.9} />
            </mesh>

            {/* === LEFT ANTLER (palmate, connected) === */}
            {/* Left pedicle - base on skull */}
            <mesh position={[-0.03, 0.13, -0.01]} rotation={[0, 0, -0.15]}>
              <capsuleGeometry args={[0.024, 0.05, 3, 4]} />
              <meshStandardMaterial color="#c4b08a" roughness={0.7} />
            </mesh>
            {/* Left beam - long, connects pedicle to palm */}
            <mesh position={[-0.07, 0.24, -0.02]} rotation={[0.05, 0, -0.25]}>
              <capsuleGeometry args={[0.02, 0.28, 4, 5]} />
              <meshStandardMaterial color="#d6c4a2" roughness={0.65} />
            </mesh>
            {/* Left palm - flat paddle, overlaps beam top */}
            <mesh position={[-0.13, 0.34, -0.02]} rotation={[0.05, 0.1, -0.15]} scale={[1.6, 0.25, 1.1]}>
              <sphereGeometry args={[0.1, 8, 6]} />
              <meshStandardMaterial color="#d6c4a2" roughness={0.65} />
            </mesh>
            {/* Left palm outer extension - overlaps main palm */}
            <mesh position={[-0.2, 0.32, -0.02]} rotation={[0.05, 0.1, -0.35]} scale={[1.2, 0.22, 1]}>
              <sphereGeometry args={[0.07, 6, 5]} />
              <meshStandardMaterial color="#ccb896" roughness={0.65} />
            </mesh>
            {/* Left tine 1 - top inner, from palm edge */}
            <mesh position={[-0.07, 0.42, -0.01]} rotation={[0, 0, 0.05]}>
              <capsuleGeometry args={[0.012, 0.08, 3, 4]} />
              <meshStandardMaterial color="#c8b690" roughness={0.7} />
            </mesh>
            {/* Left tine 2 - top middle */}
            <mesh position={[-0.12, 0.43, -0.02]} rotation={[0, 0, -0.15]}>
              <capsuleGeometry args={[0.011, 0.08, 3, 4]} />
              <meshStandardMaterial color="#c8b690" roughness={0.7} />
            </mesh>
            {/* Left tine 3 - top outer */}
            <mesh position={[-0.17, 0.42, -0.02]} rotation={[0, 0, -0.3]}>
              <capsuleGeometry args={[0.011, 0.07, 3, 4]} />
              <meshStandardMaterial color="#c8b690" roughness={0.7} />
            </mesh>
            {/* Left tine 4 - outer edge */}
            <mesh position={[-0.22, 0.39, -0.01]} rotation={[0, 0, -0.55]}>
              <capsuleGeometry args={[0.01, 0.06, 3, 4]} />
              <meshStandardMaterial color="#c8b690" roughness={0.7} />
            </mesh>
            {/* Left tine 5 - outermost */}
            <mesh position={[-0.25, 0.35, 0]} rotation={[0, 0, -0.75]}>
              <capsuleGeometry args={[0.009, 0.05, 3, 4]} />
              <meshStandardMaterial color="#c8b690" roughness={0.7} />
            </mesh>
            {/* Left brow tine - forward, from lower beam */}
            <mesh position={[-0.06, 0.19, 0.04]} rotation={[0.4, 0, -0.4]}>
              <capsuleGeometry args={[0.013, 0.06, 3, 4]} />
              <meshStandardMaterial color="#c8b690" roughness={0.7} />
            </mesh>

            {/* === RIGHT ANTLER (palmate, connected) === */}
            {/* Right pedicle */}
            <mesh position={[0.03, 0.13, -0.01]} rotation={[0, 0, 0.15]}>
              <capsuleGeometry args={[0.024, 0.05, 3, 4]} />
              <meshStandardMaterial color="#c4b08a" roughness={0.7} />
            </mesh>
            {/* Right beam */}
            <mesh position={[0.07, 0.24, -0.02]} rotation={[0.05, 0, 0.25]}>
              <capsuleGeometry args={[0.02, 0.28, 4, 5]} />
              <meshStandardMaterial color="#d6c4a2" roughness={0.65} />
            </mesh>
            {/* Right palm */}
            <mesh position={[0.13, 0.34, -0.02]} rotation={[0.05, -0.1, 0.15]} scale={[1.6, 0.25, 1.1]}>
              <sphereGeometry args={[0.1, 8, 6]} />
              <meshStandardMaterial color="#d6c4a2" roughness={0.65} />
            </mesh>
            {/* Right palm outer extension */}
            <mesh position={[0.2, 0.32, -0.02]} rotation={[0.05, -0.1, 0.35]} scale={[1.2, 0.22, 1]}>
              <sphereGeometry args={[0.07, 6, 5]} />
              <meshStandardMaterial color="#ccb896" roughness={0.65} />
            </mesh>
            {/* Right tine 1 */}
            <mesh position={[0.07, 0.42, -0.01]} rotation={[0, 0, -0.05]}>
              <capsuleGeometry args={[0.012, 0.08, 3, 4]} />
              <meshStandardMaterial color="#c8b690" roughness={0.7} />
            </mesh>
            {/* Right tine 2 */}
            <mesh position={[0.12, 0.43, -0.02]} rotation={[0, 0, 0.15]}>
              <capsuleGeometry args={[0.011, 0.08, 3, 4]} />
              <meshStandardMaterial color="#c8b690" roughness={0.7} />
            </mesh>
            {/* Right tine 3 */}
            <mesh position={[0.17, 0.42, -0.02]} rotation={[0, 0, 0.3]}>
              <capsuleGeometry args={[0.011, 0.07, 3, 4]} />
              <meshStandardMaterial color="#c8b690" roughness={0.7} />
            </mesh>
            {/* Right tine 4 */}
            <mesh position={[0.22, 0.39, -0.01]} rotation={[0, 0, 0.55]}>
              <capsuleGeometry args={[0.01, 0.06, 3, 4]} />
              <meshStandardMaterial color="#c8b690" roughness={0.7} />
            </mesh>
            {/* Right tine 5 */}
            <mesh position={[0.25, 0.35, 0]} rotation={[0, 0, 0.75]}>
              <capsuleGeometry args={[0.009, 0.05, 3, 4]} />
              <meshStandardMaterial color="#c8b690" roughness={0.7} />
            </mesh>
            {/* Right brow tine */}
            <mesh position={[0.06, 0.19, 0.04]} rotation={[0.4, 0, 0.4]}>
              <capsuleGeometry args={[0.013, 0.06, 3, 4]} />
              <meshStandardMaterial color="#c8b690" roughness={0.7} />
            </mesh>
          </group>

          {/* === LEGS (upper + lower + hoof) === */}
          {/* Front Left Leg */}
          <group ref={flLegRef} position={[-0.14, -0.18, 0.16]}>
            {/* Upper leg - muscular */}
            <mesh position={[0, -0.07, 0]} castShadow>
              <boxGeometry args={[0.1, 0.18, 0.12]} />
              <meshStandardMaterial color="#4b311f" roughness={0.9} />
            </mesh>
            {/* Knee joint */}
            <mesh position={[0, -0.17, 0]} castShadow>
              <sphereGeometry args={[0.04, 5, 5]} />
              <meshStandardMaterial color="#5a4030" roughness={0.9} />
            </mesh>
            {/* Lower leg - lighter */}
            <mesh position={[0, -0.28, 0]} castShadow>
              <boxGeometry args={[0.065, 0.18, 0.07]} />
              <meshStandardMaterial color="#8a7660" roughness={0.85} />
            </mesh>
            {/* Hoof */}
            <mesh position={[0, -0.39, 0]}>
              <boxGeometry args={[0.075, 0.04, 0.09]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
            </mesh>
          </group>
          {/* Front Right Leg */}
          <group ref={frLegRef} position={[0.14, -0.18, 0.16]}>
            <mesh position={[0, -0.07, 0]} castShadow>
              <boxGeometry args={[0.1, 0.18, 0.12]} />
              <meshStandardMaterial color="#4b311f" roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.17, 0]} castShadow>
              <sphereGeometry args={[0.04, 5, 5]} />
              <meshStandardMaterial color="#5a4030" roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.28, 0]} castShadow>
              <boxGeometry args={[0.065, 0.18, 0.07]} />
              <meshStandardMaterial color="#8a7660" roughness={0.85} />
            </mesh>
            <mesh position={[0, -0.39, 0]}>
              <boxGeometry args={[0.075, 0.04, 0.09]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
            </mesh>
          </group>
          {/* Back Left Leg */}
          <group ref={blLegRef} position={[-0.14, -0.18, -0.22]}>
            <mesh position={[0, -0.07, 0]} castShadow>
              <boxGeometry args={[0.1, 0.18, 0.12]} />
              <meshStandardMaterial color="#4b311f" roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.17, 0]} castShadow>
              <sphereGeometry args={[0.04, 5, 5]} />
              <meshStandardMaterial color="#5a4030" roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.28, 0]} castShadow>
              <boxGeometry args={[0.065, 0.18, 0.07]} />
              <meshStandardMaterial color="#8a7660" roughness={0.85} />
            </mesh>
            <mesh position={[0, -0.39, 0]}>
              <boxGeometry args={[0.075, 0.04, 0.09]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
            </mesh>
          </group>
          {/* Back Right Leg */}
          <group ref={brLegRef} position={[0.14, -0.18, -0.22]}>
            <mesh position={[0, -0.07, 0]} castShadow>
              <boxGeometry args={[0.1, 0.18, 0.12]} />
              <meshStandardMaterial color="#4b311f" roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.17, 0]} castShadow>
              <sphereGeometry args={[0.04, 5, 5]} />
              <meshStandardMaterial color="#5a4030" roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.28, 0]} castShadow>
              <boxGeometry args={[0.065, 0.18, 0.07]} />
              <meshStandardMaterial color="#8a7660" roughness={0.85} />
            </mesh>
            <mesh position={[0, -0.39, 0]}>
              <boxGeometry args={[0.075, 0.04, 0.09]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
            </mesh>
          </group>

          {/* Short tail */}
          <mesh position={[0, 0.1, -0.4]} rotation={[0.5, 0, 0]}>
            <capsuleGeometry args={[0.04, 0.06, 3, 4]} />
            <meshStandardMaterial color="#4a3120" roughness={0.9} />
          </mesh>
        </group>
        {/* Soft contact shadow on ground */}
        <mesh position={[0, -initData.position[1] + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.5, 16]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            vertexShader={softShadowVert}
            fragmentShader={softShadowFrag}
            uniforms={{ uOpacity: { value: 0.3 } }}
          />
        </mesh>
        <StatusBar hungerRef={hungerRef} thirstRef={thirstRef} yOffset={2.1} />
      </group>
      <IntentionOverlay
        positionRef={position}
        targetRef={intentionTargetRef}
        intentionRef={intentionRef}
        labelY={3.3}
        color="#c9a86d"
      />
    </>
  );
}
