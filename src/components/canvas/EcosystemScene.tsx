import { useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import Terrain from './Terrain.tsx';
import River from './River.tsx';
import Ponds from './Ponds.tsx';
import Trees from './Trees.tsx';
import Bushes from './Bushes.tsx';
import Stones from './Stones.tsx';
import Flowers from './Flowers.tsx';
import Grass from './Grass.tsx';
import WeatherSystem from './WeatherSystem.tsx';
import WaterSplashes from './WaterSplashes.tsx';
import BloodEffects from './BloodEffects.tsx';
import RabbitGroup from '../entities/RabbitGroup.tsx';
import FoxGroup from '../entities/FoxGroup.tsx';
import MooseGroup from '../entities/MooseGroup.tsx';
import PostProcessingPipeline from './PostProcessingPipeline.tsx'
import GroundMist from './GroundMist.tsx'
import CascadedShadows from './CascadedShadows.tsx'
import Lightning from './Lightning.tsx'
import Rain from './Rain.tsx'
import { WORLD_SIZE, WORLD_SCALE } from '../../types/ecosystem.ts';
import {
  useEcosystem,
  useEcosystemDispatch,
  randomFlowerPosition,
} from '../../state/ecosystem-context.tsx';
import { useFollow } from '../../state/follow-context.tsx';

function ExtinctionRecorder() {
  const state = useEcosystem();
  const dispatch = useEcosystemDispatch();
  const recordedRef = useRef({ rabbits: false, foxes: false, flowers: false });

  useFrame(() => {
    if (state.paused) return;
    if (state.time < 1) {
      recordedRef.current = { rabbits: false, foxes: false, flowers: false };
      return;
    }

    const rabbits = state.rabbits.length;
    const foxes = state.foxes.length;
    const flowers = state.flowers.filter((f) => f.alive).length;

    if (rabbits === 0 && !recordedRef.current.rabbits) {
      recordedRef.current.rabbits = true;
      dispatch({ type: 'RECORD_EXTINCTION', species: 'rabbits', time: state.time });
    }
    if (foxes === 0 && !recordedRef.current.foxes) {
      recordedRef.current.foxes = true;
      dispatch({ type: 'RECORD_EXTINCTION', species: 'foxes', time: state.time });
    }
    if (flowers === 0 && !recordedRef.current.flowers) {
      recordedRef.current.flowers = true;
      dispatch({ type: 'RECORD_EXTINCTION', species: 'flowers', time: state.time });
    }
  });

  return null;
}

function FlowerRegrowth() {
  const state = useEcosystem();
  const dispatch = useEcosystemDispatch();
  const timer = useRef(0);

  useFrame((_, rawDelta) => {
    if (state.paused) return;
    timer.current += rawDelta * state.speed;
    if (timer.current > 0.75) {
      timer.current = 0;
      const aliveCount = state.flowers.filter((f) => f.alive).length;
      const targetFlowerCount = Math.floor(85 * WORLD_SCALE);
      const spawnCount =
        aliveCount < targetFlowerCount
          ? Math.max(1, Math.floor((targetFlowerCount - aliveCount) / 50))
          : 0;
      for (let i = 0; i < spawnCount; i++) {
        dispatch({
          type: 'SPAWN_FLOWER',
          flower: {
            id: `flower_${Date.now()}_${Math.floor(Math.random() * 10000)}_${i}`,
            position: randomFlowerPosition(),
            alive: true,
          },
        });
      }
    }
  });

  return null;
}

function FollowCameraController({
  controlsRef,
}: {
  controlsRef: RefObject<OrbitControlsImpl | null>;
}) {
  const { scene, camera } = useThree();
  const { followTarget, stopFollowing } = useFollow();
  const lookAt = useRef(new THREE.Vector3());
  const desiredCameraPos = useRef(new THREE.Vector3());
  const worldPos = useRef(new THREE.Vector3());
  const forward = useRef(new THREE.Vector3(0, 0, 1));
  const worldQuat = useRef(new THREE.Quaternion());
  const heightOffset = useRef(new THREE.Vector3());
  const lookOffset = useRef(new THREE.Vector3(0, 1.2, 0));

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (!followTarget) {
      controls.enabled = true;
      return;
    }

    const objectName = `animal-${followTarget.type}-${followTarget.id}`;
    const targetObject = scene.getObjectByName(objectName);
    if (!targetObject) {
      stopFollowing();
      controls.enabled = true;
      return;
    }

    controls.enabled = false;

    targetObject.getWorldPosition(worldPos.current);
    targetObject.getWorldQuaternion(worldQuat.current);

    forward.current.set(0, 0, 1).applyQuaternion(worldQuat.current);
    forward.current.y = 0;
    if (forward.current.lengthSq() < 0.0001) {
      forward.current.set(0, 0, 1);
    } else {
      forward.current.normalize();
    }

    const followDistance = followTarget.type === 'moose' ? 8.5 : 7;
    const followHeight = followTarget.type === 'moose' ? 3.5 : 2.8;

    heightOffset.current.set(0, followHeight, 0);
    desiredCameraPos.current
      .copy(worldPos.current)
      .addScaledVector(forward.current, -followDistance)
      .add(heightOffset.current);
    lookAt.current.copy(worldPos.current).add(lookOffset.current);

    const damping = 1 - Math.exp(-delta * 6);
    camera.position.lerp(desiredCameraPos.current, damping);
    controls.target.lerp(lookAt.current, damping);
    camera.lookAt(controls.target);
    controls.update();
  });

  return null;
}

export default function EcosystemScene() {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  return (
    <>
      <WeatherSystem />
      <color attach="background" args={['#87ceeb']} />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={5}
        maxDistance={WORLD_SIZE * 1.8}
      />
      <FollowCameraController controlsRef={controlsRef} />
      {/* <CascadedShadows /> */}
      <Lightning />
      <Rain />
      <Terrain />
      <Grass />
      <River />
      <Ponds />
      <WaterSplashes />
      <BloodEffects />
      <Trees />
      <Bushes />
      <Stones />
      <Flowers />
      <GroundMist />
      <RabbitGroup />
      <FoxGroup />
      <MooseGroup />
      <FlowerRegrowth />
      <ExtinctionRecorder />
      {/* <PostProcessingPipeline /> */}
    </>
  );
}
