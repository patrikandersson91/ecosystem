import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
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
import { WORLD_SIZE, WORLD_SCALE } from '../../types/ecosystem.ts';
import {
  useEcosystem,
  useEcosystemDispatch,
  randomFlowerPosition,
} from '../../state/ecosystem-context.tsx';

function GameOverDetector() {
  const state = useEcosystem();
  const dispatch = useEcosystemDispatch();

  useFrame(() => {
    if (state.paused || state.gameOver) return;
    // Only check once simulation has started (has entities)
    if (state.time < 1) return;

    const rabbits = state.rabbits.length;
    const foxes = state.foxes.length;
    const flowers = state.flowers.filter((f) => f.alive).length;

    if (rabbits === 0 || foxes === 0 || flowers === 0) {
      dispatch({ type: 'GAME_OVER' });
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
      const targetFlowerCount = Math.floor(120 * WORLD_SCALE);
      const spawnCount =
        aliveCount < targetFlowerCount
          ? Math.max(1, Math.floor((targetFlowerCount - aliveCount) / 30))
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

export default function EcosystemScene() {
  return (
    <>
      <WeatherSystem />
      <color attach="background" args={['#87ceeb']} />
      <OrbitControls
        maxPolarAngle={Math.PI / 2.1}
        minDistance={5}
        maxDistance={WORLD_SIZE * 1.8}
      />
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
      <RabbitGroup />
      <FoxGroup />
      <MooseGroup />
      <FlowerRegrowth />
      <GameOverDetector />
    </>
  );
}
