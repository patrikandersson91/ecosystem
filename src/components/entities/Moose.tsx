import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { Group } from 'three';
import { softShadowVert, softShadowFrag } from '../../utils/soft-shadow-material.ts';
import type { MooseState } from '../../types/ecosystem.ts';
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
  useEcosystem,
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
  data: MooseState;
}

const MOOSE_HUNGER_RATE = 0.00025;
const MOOSE_THIRST_RATE = 0.001;
const MOOSE_OBSTACLE_QUERY_RADIUS = 1.7;

export default function Moose({ data }: MooseProps) {
  const groupRef = useRef<Group>(null!);
  const camera = useThree((threeState) => threeState.camera);
  const flLegRef = useRef<Group>(null!);
  const frLegRef = useRef<Group>(null!);
  const blLegRef = useRef<Group>(null!);
  const brLegRef = useRef<Group>(null!);
  const headRef = useRef<Group>(null!);
  const state = useEcosystem();
  const dispatch = useEcosystemDispatch();
  const { followTarget, setFollowTarget } = useFollow();
  const { getMovementInput } = useMovementInput();

  const position = useRef(new Vector3(...data.position));
  const velocity = useRef(new Vector3(...data.velocity));
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
    id: data.id,
    entityType: 'moose',
    hunger: data.hunger,
    thirst: data.thirst,
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
    if (state.paused) return;

    const delta = rawDelta * state.speed;
    const needs = tickNeeds(delta);
    if (needs.dead) return;

    const pos = position.current;
    const vel = velocity.current;
    const isPlayerControlled =
      followTarget?.type === 'moose' && followTarget.id === data.id;
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
          id: data.id,
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
        dispatch({ type: 'DRINK', entityId: data.id, entityType: 'moose' });
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
            entityId: data.id,
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
        id: data.id,
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
        name={`animal-moose-${data.id}`}
        onClick={(event) => {
          event.stopPropagation();
          setFollowTarget({ id: data.id, type: 'moose' });
        }}
        position={[
          data.position[0],
          groundHeightAt(data.position[0], data.position[2]) + data.position[1],
          data.position[2],
        ]}
      >
        <group scale={[2.2, 2.2, 2.2]}>
          {/* === BODY === */}
          {/* Main torso - compact barrel */}
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.22, 0.28, 8, 12]} />
            <meshStandardMaterial color="#5f4026" />
          </mesh>
          {/* Shoulder hump - subtle */}
          <mesh position={[0, 0.1, 0.08]} castShadow scale={[0.85, 0.8, 0.8]}>
            <sphereGeometry args={[0.18, 10, 10]} />
            <meshStandardMaterial color="#543822" />
          </mesh>
          {/* Hip / rump */}
          <mesh position={[0, 0.02, -0.2]} castShadow>
            <sphereGeometry args={[0.17, 10, 10]} />
            <meshStandardMaterial color="#5a3d25" />
          </mesh>
          {/* Lighter belly underside */}
          <mesh position={[0, -0.12, -0.02]}>
            <boxGeometry args={[0.26, 0.07, 0.4]} />
            <meshStandardMaterial color="#6b4e34" />
          </mesh>

          {/* === NECK === */}
          <mesh position={[0, 0.12, 0.3]} rotation={[0.7, 0, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.2, 6, 8]} />
            <meshStandardMaterial color="#5a3d25" />
          </mesh>

          {/* === HEAD GROUP (animated) === */}
          <group ref={headRef} position={[0, 0.1, 0.52]}>
            {/* Skull */}
            <mesh castShadow>
              <sphereGeometry args={[0.12, 10, 10]} />
              <meshStandardMaterial color="#6f4a2d" />
            </mesh>
            {/* Muzzle - large, bulbous moose nose */}
            <mesh position={[0, -0.05, 0.12]} scale={[0.9, 0.8, 1.15]} castShadow>
              <sphereGeometry args={[0.08, 10, 10]} />
              <meshStandardMaterial color="#7a5638" />
            </mesh>
            {/* Upper lip / nose pad */}
            <mesh position={[0, -0.09, 0.18]} scale={[1.05, 0.65, 0.8]}>
              <sphereGeometry args={[0.048, 8, 8]} />
              <meshStandardMaterial color="#8a6448" />
            </mesh>
            {/* Left nostril */}
            <mesh position={[-0.022, -0.1, 0.21]}>
              <sphereGeometry args={[0.012, 6, 6]} />
              <meshStandardMaterial color="#2a1a10" />
            </mesh>
            {/* Right nostril */}
            <mesh position={[0.022, -0.1, 0.21]}>
              <sphereGeometry args={[0.012, 6, 6]} />
              <meshStandardMaterial color="#2a1a10" />
            </mesh>
            {/* Left eye */}
            <mesh position={[-0.08, 0.04, 0.06]}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshStandardMaterial color="#1a1000" />
            </mesh>
            {/* Right eye */}
            <mesh position={[0.08, 0.04, 0.06]}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshStandardMaterial color="#1a1000" />
            </mesh>
            {/* Left ear */}
            <mesh position={[-0.09, 0.1, -0.03]} rotation={[0.25, 0, -0.35]}>
              <capsuleGeometry args={[0.025, 0.06, 4, 6]} />
              <meshStandardMaterial color="#5a3d25" />
            </mesh>
            {/* Left ear inner */}
            <mesh position={[-0.088, 0.1, -0.025]} rotation={[0.25, 0, -0.35]}>
              <capsuleGeometry args={[0.016, 0.04, 4, 5]} />
              <meshStandardMaterial color="#7a6048" />
            </mesh>
            {/* Right ear */}
            <mesh position={[0.09, 0.1, -0.03]} rotation={[0.25, 0, 0.35]}>
              <capsuleGeometry args={[0.025, 0.06, 4, 6]} />
              <meshStandardMaterial color="#5a3d25" />
            </mesh>
            {/* Right ear inner */}
            <mesh position={[0.088, 0.1, -0.025]} rotation={[0.25, 0, 0.35]}>
              <capsuleGeometry args={[0.016, 0.04, 4, 5]} />
              <meshStandardMaterial color="#7a6048" />
            </mesh>
            {/* Dewlap (bell) - hanging throat skin */}
            <mesh position={[0, -0.15, 0.03]} rotation={[0.3, 0, 0]}>
              <capsuleGeometry args={[0.03, 0.08, 4, 6]} />
              <meshStandardMaterial color="#6f4a2d" />
            </mesh>

            {/* === ANTLERS (palmate) === */}
            {/* Left antler beam */}
            <mesh position={[-0.07, 0.16, -0.02]} rotation={[0.1, 0, -0.45]}>
              <capsuleGeometry args={[0.016, 0.14, 4, 6]} />
              <meshStandardMaterial color="#d6c4a2" />
            </mesh>
            {/* Left palm (flat broad part) */}
            <mesh position={[-0.19, 0.3, -0.02]} rotation={[0, 0, -0.25]} scale={[1.4, 0.25, 1]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial color="#d6c4a2" />
            </mesh>
            {/* Left tine 1 */}
            <mesh position={[-0.14, 0.39, -0.02]} rotation={[0, 0, -0.15]}>
              <capsuleGeometry args={[0.009, 0.08, 3, 4]} />
              <meshStandardMaterial color="#c8b690" />
            </mesh>
            {/* Left tine 2 */}
            <mesh position={[-0.23, 0.37, 0]} rotation={[0, 0, -0.55]}>
              <capsuleGeometry args={[0.009, 0.06, 3, 4]} />
              <meshStandardMaterial color="#c8b690" />
            </mesh>
            {/* Left tine 3 */}
            <mesh position={[-0.28, 0.31, 0.02]} rotation={[0, 0, -0.75]}>
              <capsuleGeometry args={[0.009, 0.05, 3, 4]} />
              <meshStandardMaterial color="#c8b690" />
            </mesh>
            {/* Left brow tine */}
            <mesh position={[-0.1, 0.19, 0.05]} rotation={[0.3, 0, -0.7]}>
              <capsuleGeometry args={[0.009, 0.05, 3, 4]} />
              <meshStandardMaterial color="#c8b690" />
            </mesh>
            {/* Right antler beam */}
            <mesh position={[0.07, 0.16, -0.02]} rotation={[0.1, 0, 0.45]}>
              <capsuleGeometry args={[0.016, 0.14, 4, 6]} />
              <meshStandardMaterial color="#d6c4a2" />
            </mesh>
            {/* Right palm */}
            <mesh position={[0.19, 0.3, -0.02]} rotation={[0, 0, 0.25]} scale={[1.4, 0.25, 1]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial color="#d6c4a2" />
            </mesh>
            {/* Right tine 1 */}
            <mesh position={[0.14, 0.39, -0.02]} rotation={[0, 0, 0.15]}>
              <capsuleGeometry args={[0.009, 0.08, 3, 4]} />
              <meshStandardMaterial color="#c8b690" />
            </mesh>
            {/* Right tine 2 */}
            <mesh position={[0.23, 0.37, 0]} rotation={[0, 0, 0.55]}>
              <capsuleGeometry args={[0.009, 0.06, 3, 4]} />
              <meshStandardMaterial color="#c8b690" />
            </mesh>
            {/* Right tine 3 */}
            <mesh position={[0.28, 0.31, 0.02]} rotation={[0, 0, 0.75]}>
              <capsuleGeometry args={[0.009, 0.05, 3, 4]} />
              <meshStandardMaterial color="#c8b690" />
            </mesh>
            {/* Right brow tine */}
            <mesh position={[0.1, 0.19, 0.05]} rotation={[0.3, 0, 0.7]}>
              <capsuleGeometry args={[0.009, 0.05, 3, 4]} />
              <meshStandardMaterial color="#c8b690" />
            </mesh>
          </group>

          {/* === LEGS (upper + lower + hoof) === */}
          {/* Front Left Leg */}
          <group ref={flLegRef} position={[-0.14, -0.14, 0.14]}>
            <mesh position={[0, -0.1, 0]} castShadow>
              <boxGeometry args={[0.09, 0.2, 0.1]} />
              <meshStandardMaterial color="#4b311f" />
            </mesh>
            <mesh position={[0, -0.25, 0]} castShadow>
              <boxGeometry args={[0.065, 0.14, 0.07]} />
              <meshStandardMaterial color="#8a7660" />
            </mesh>
            <mesh position={[0, -0.34, 0]}>
              <boxGeometry args={[0.075, 0.04, 0.085]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
          </group>
          {/* Front Right Leg */}
          <group ref={frLegRef} position={[0.14, -0.14, 0.14]}>
            <mesh position={[0, -0.1, 0]} castShadow>
              <boxGeometry args={[0.09, 0.2, 0.1]} />
              <meshStandardMaterial color="#4b311f" />
            </mesh>
            <mesh position={[0, -0.25, 0]} castShadow>
              <boxGeometry args={[0.065, 0.14, 0.07]} />
              <meshStandardMaterial color="#8a7660" />
            </mesh>
            <mesh position={[0, -0.34, 0]}>
              <boxGeometry args={[0.075, 0.04, 0.085]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
          </group>
          {/* Back Left Leg */}
          <group ref={blLegRef} position={[-0.14, -0.14, -0.2]}>
            <mesh position={[0, -0.1, 0]} castShadow>
              <boxGeometry args={[0.09, 0.2, 0.1]} />
              <meshStandardMaterial color="#4b311f" />
            </mesh>
            <mesh position={[0, -0.25, 0]} castShadow>
              <boxGeometry args={[0.065, 0.14, 0.07]} />
              <meshStandardMaterial color="#8a7660" />
            </mesh>
            <mesh position={[0, -0.34, 0]}>
              <boxGeometry args={[0.075, 0.04, 0.085]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
          </group>
          {/* Back Right Leg */}
          <group ref={brLegRef} position={[0.14, -0.14, -0.2]}>
            <mesh position={[0, -0.1, 0]} castShadow>
              <boxGeometry args={[0.09, 0.2, 0.1]} />
              <meshStandardMaterial color="#4b311f" />
            </mesh>
            <mesh position={[0, -0.25, 0]} castShadow>
              <boxGeometry args={[0.065, 0.14, 0.07]} />
              <meshStandardMaterial color="#8a7660" />
            </mesh>
            <mesh position={[0, -0.34, 0]}>
              <boxGeometry args={[0.075, 0.04, 0.085]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
          </group>

          {/* Short tail */}
          <mesh position={[0, 0.08, -0.35]} rotation={[0.6, 0, 0]}>
            <capsuleGeometry args={[0.035, 0.06, 4, 6]} />
            <meshStandardMaterial color="#5a3d25" />
          </mesh>
        </group>
        {/* Soft contact shadow on ground */}
        <mesh position={[0, -data.position[1] + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
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
