import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { CanvasTexture, MathUtils } from 'three';
import { WORLD_SIZE } from '../../types/ecosystem.ts';
import { useEcosystem } from '../../state/ecosystem-context.tsx';

type CloudSeed = {
  x: number;
  y: number;
  z: number;
  scale: number;
  height: number;
  width: number;
  depth: number;
  alpha: number;
  speed: number;
  sway: number;
  phase: number;
};

type BirdFlight = {
  active: boolean;
  cooldown: number;
  progress: number;
  duration: number;
  startX: number;
  endX: number;
  startZ: number;
  endZ: number;
  y: number;
  dir: 1 | -1;
  wingPhase: number;
};

type FlockBird = {
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  scale: number;
  flapOffset: number;
};

const SKY_LIMIT = WORLD_SIZE * 0.92;
const CLOUD_COUNT = 22;
const CLOUD_MIN_Y = WORLD_SIZE * 0.32;
const CLOUD_MAX_Y = WORLD_SIZE * 0.46;
const FLOCK_SIZE = 5;
const V_ROW_SPACING = 1.35;
const V_SIDE_SPACING = 1.25;
const CLOUD_PUFFS = [
  { x: 0, y: 0, z: 0, scale: 3.9, alpha: 0.34 },
  { x: 1.7, y: 0.35, z: 0.7, scale: 3.1, alpha: 0.3 },
  { x: -1.65, y: 0.28, z: -0.4, scale: 2.95, alpha: 0.3 },
  { x: 0.45, y: -0.55, z: -0.95, scale: 2.55, alpha: 0.24 },
  { x: -0.55, y: -0.42, z: 1.05, scale: 2.15, alpha: 0.2 },
  { x: 2.5, y: -0.1, z: 0.1, scale: 2.45, alpha: 0.2 },
  { x: -2.35, y: -0.12, z: 0.15, scale: 2.2, alpha: 0.2 },
  { x: 0.75, y: 0.6, z: 1.35, scale: 1.9, alpha: 0.16 },
  { x: -0.95, y: 0.52, z: -1.28, scale: 1.85, alpha: 0.16 },
] as const;

function createCloudTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new CanvasTexture(canvas);

  const center = size / 2;
  const grad = ctx.createRadialGradient(
    center,
    center,
    size * 0.12,
    center,
    center,
    size * 0.48,
  );
  grad.addColorStop(0, 'rgba(255,255,255,0.82)');
  grad.addColorStop(0.33, 'rgba(255,255,255,0.56)');
  grad.addColorStop(0.64, 'rgba(255,255,255,0.24)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function randomCloud(limit: number): CloudSeed {
  const scale = MathUtils.randFloat(1.25, 3.8);
  return {
    x: MathUtils.randFloatSpread(limit * 2),
    y: MathUtils.randFloat(CLOUD_MIN_Y, CLOUD_MAX_Y),
    z: MathUtils.randFloatSpread(limit * 2),
    scale,
    width: MathUtils.randFloat(1.2, 1.55),
    height: MathUtils.randFloat(0.42, 0.64),
    depth: MathUtils.randFloat(0.88, 1.16),
    alpha: MathUtils.randFloat(0.68, 0.84),
    speed: MathUtils.randFloat(0.9, 2.8),
    sway: MathUtils.randFloat(0.3, 1.1),
    phase: MathUtils.randFloat(0, Math.PI * 2),
  };
}

function createBirdFlight(limit: number): BirdFlight {
  const dir: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
  const startX = -dir * limit * 0.96;
  const endX = dir * limit * 0.96;
  const startZ = MathUtils.randFloat(-limit * 0.62, limit * 0.62);
  const endZ = MathUtils.clamp(
    startZ + MathUtils.randFloat(-limit * 0.16, limit * 0.16),
    -limit * 0.7,
    limit * 0.7,
  );

  return {
    active: true,
    cooldown: 0,
    progress: 0,
    duration: MathUtils.randFloat(28, 40),
    startX,
    endX,
    startZ,
    endZ,
    y: MathUtils.randFloat(WORLD_SIZE * 0.24, WORLD_SIZE * 0.39),
    dir,
    wingPhase: MathUtils.randFloat(0, Math.PI * 2),
  };
}

export default function SkyLife() {
  const state = useEcosystem();
  const cloudRefs = useRef<Array<Group | null>>([]);
  const cloudSeeds = useMemo(
    () => Array.from({ length: CLOUD_COUNT }, () => randomCloud(SKY_LIMIT)),
    [],
  );
  const cloudTexture = useMemo(() => createCloudTexture(), []);
  const flockRef = useRef<Group>(null);
  const leftWingRefs = useRef<Array<Group | null>>([]);
  const rightWingRefs = useRef<Array<Group | null>>([]);
  const flockBirds = useMemo<FlockBird[]>(
    () =>
      Array.from({ length: FLOCK_SIZE }, (_, i) => {
        if (i === 0) {
          return {
            offsetX: 0,
            offsetY: 0,
            offsetZ: 0,
            scale: 1.08,
            flapOffset: MathUtils.randFloat(0, Math.PI * 2),
          };
        }

        // Realistic V: one leader and symmetric trailing pairs.
        const row = Math.ceil(i / 2);
        const side = i % 2 === 1 ? -1 : 1;
        return {
          offsetX: -row * V_ROW_SPACING,
          offsetY: MathUtils.randFloat(-0.04, 0.04),
          offsetZ: side * row * V_SIDE_SPACING,
          scale: MathUtils.randFloat(0.94, 1.02),
          flapOffset: MathUtils.randFloat(0, Math.PI * 2),
        };
      }),
    [],
  );
  const flightRef = useRef<BirdFlight>({
    active: false,
    cooldown: MathUtils.randFloat(2, 6),
    progress: 0,
    duration: 16,
    startX: 0,
    endX: 0,
    startZ: 0,
    endZ: 0,
    y: WORLD_SIZE * 0.3,
    dir: 1,
    wingPhase: 0,
  });

  useEffect(() => {
    return () => {
      cloudTexture.dispose();
    };
  }, [cloudTexture]);

  useFrame((_, rawDelta) => {
    if (state.paused) return;

    const dt = rawDelta * state.speed;

    for (let i = 0; i < cloudSeeds.length; i++) {
      const seed = cloudSeeds[i];
      const cloud = cloudRefs.current[i];
      if (!cloud) continue;

      seed.x += seed.speed * dt;
      seed.phase += seed.sway * dt * 0.45;
      seed.z += Math.sin(seed.phase) * dt * 0.45;

      const outsideMap =
        Math.abs(seed.x) > SKY_LIMIT || Math.abs(seed.z) > SKY_LIMIT;
      if (outsideMap) {
        const reset = randomCloud(SKY_LIMIT);
        reset.x = -Math.sign(seed.speed || 1) * SKY_LIMIT * 0.98;
        seed.x = reset.x;
        seed.y = reset.y;
        seed.z = reset.z;
        seed.scale = reset.scale;
        seed.width = reset.width;
        seed.height = reset.height;
        seed.depth = reset.depth;
        seed.alpha = reset.alpha;
        seed.speed = reset.speed;
        seed.sway = reset.sway;
        seed.phase = reset.phase;
      }

      cloud.position.set(seed.x, seed.y, seed.z);
      cloud.scale.set(
        seed.scale * seed.width,
        seed.scale * seed.height,
        seed.scale * seed.depth,
      );
      cloud.rotation.y = Math.sin(seed.phase * 0.5) * 0.12;
      cloud.rotation.z = Math.sin(seed.phase * 0.35) * 0.04;
      cloud.visible =
        Math.abs(seed.x) <= SKY_LIMIT && Math.abs(seed.z) <= SKY_LIMIT;
    }

    const flight = flightRef.current;
    if (!flight.active) {
      flight.cooldown -= dt;
      if (flight.cooldown <= 0) {
        Object.assign(flight, createBirdFlight(SKY_LIMIT));
      }
    } else {
      flight.progress += dt / flight.duration;

      const t = MathUtils.clamp(flight.progress, 0, 1);
      const x = MathUtils.lerp(flight.startX, flight.endX, t);
      const z = MathUtils.lerp(flight.startZ, flight.endZ, t);
      const bob = Math.sin((t + flight.wingPhase) * Math.PI * 2.2) * 0.9;
      const y = flight.y + bob;

      const birdOutsideMap = Math.abs(x) > SKY_LIMIT || Math.abs(z) > SKY_LIMIT;
      if (t >= 1 || birdOutsideMap) {
        flight.active = false;
        flight.cooldown = MathUtils.randFloat(4, 10);
      }

      if (flockRef.current) {
        flockRef.current.visible = flight.active && !birdOutsideMap;
        if (flockRef.current.visible) {
          flockRef.current.position.set(x, y, z);
          flockRef.current.rotation.y = flight.dir === 1 ? 0 : Math.PI;
          flockRef.current.rotation.z =
            Math.sin((t + flight.wingPhase) * Math.PI * 2.2) * 0.04;
        }
      }

      for (let i = 0; i < flockBirds.length; i++) {
        const bird = flockBirds[i];
        const flap =
          Math.sin(
            (t * 20 + flight.wingPhase + bird.flapOffset) * Math.PI * 2,
          ) * 0.66;
        const leftWing = leftWingRefs.current[i];
        const rightWing = rightWingRefs.current[i];
        if (leftWing) leftWing.rotation.x = -flap;
        if (rightWing) rightWing.rotation.x = flap;
      }
    }

    if (!flight.active && flockRef.current) {
      flockRef.current.visible = false;
    }
  });

  return (
    <group>
      {cloudSeeds.map((seed, i) => (
        <group
          key={i}
          ref={(el) => {
            cloudRefs.current[i] = el;
          }}
          position={[seed.x, seed.y, seed.z]}
        >
          {CLOUD_PUFFS.map((puff, puffIdx) => {
            const wobble = Math.sin(seed.phase * (0.8 + puffIdx * 0.07)) * 0.08;
            const puffScale = puff.scale + wobble;
            return (
              <sprite
                key={puffIdx}
                position={[puff.x, puff.y, puff.z]}
                scale={[puffScale, puffScale, 1]}
              >
                <spriteMaterial
                  map={cloudTexture}
                  color="#f7fbff"
                  transparent
                  depthWrite={false}
                  opacity={puff.alpha * seed.alpha}
                />
              </sprite>
            );
          })}
        </group>
      ))}

      <group ref={flockRef} visible={false}>
        {flockBirds.map((bird, i) => (
          <group
            key={`bird_${i}`}
            position={[bird.offsetX, bird.offsetY, bird.offsetZ]}
            scale={[bird.scale, bird.scale, bird.scale]}
          >
            {/* === BODY === */}
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <capsuleGeometry args={[0.17, 0.48, 6, 10]} />
              <meshStandardMaterial color="#6b5a48" roughness={0.82} metalness={0.02} />
            </mesh>
            <mesh position={[0.04, -0.05, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <capsuleGeometry args={[0.14, 0.34, 6, 8]} />
              <meshStandardMaterial color="#c4b49a" roughness={0.8} metalness={0.01} />
            </mesh>
            <mesh position={[-0.02, 0.07, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <capsuleGeometry args={[0.13, 0.3, 6, 8]} />
              <meshStandardMaterial color="#5a4a3a" roughness={0.84} metalness={0.02} />
            </mesh>
            {/* === FLANK FEATHERS === */}
            <mesh position={[0, 0.01, 0.14]} rotation={[0.2, 0, 0]}>
              <boxGeometry args={[0.32, 0.008, 0.07]} />
              <meshStandardMaterial color="#7a6a56" roughness={0.86} metalness={0.01} />
            </mesh>
            <mesh position={[-0.06, -0.02, 0.13]} rotation={[0.35, 0, 0]}>
              <boxGeometry args={[0.28, 0.008, 0.06]} />
              <meshStandardMaterial color="#8a7a66" roughness={0.86} metalness={0.01} />
            </mesh>
            <mesh position={[0, 0.01, -0.14]} rotation={[-0.2, 0, 0]}>
              <boxGeometry args={[0.32, 0.008, 0.07]} />
              <meshStandardMaterial color="#7a6a56" roughness={0.86} metalness={0.01} />
            </mesh>
            <mesh position={[-0.06, -0.02, -0.13]} rotation={[-0.35, 0, 0]}>
              <boxGeometry args={[0.28, 0.008, 0.06]} />
              <meshStandardMaterial color="#8a7a66" roughness={0.86} metalness={0.01} />
            </mesh>
            {/* === NECK & HEAD === */}
            <mesh position={[0.46, 0.0, 0]} rotation={[0, 0, Math.PI / 2 + 0.1]} castShadow>
              <capsuleGeometry args={[0.042, 0.34, 6, 8]} />
              <meshStandardMaterial color="#1a1c20" roughness={0.78} metalness={0.03} />
            </mesh>
            <mesh position={[0.64, 0.03, 0]} castShadow>
              <sphereGeometry args={[0.07, 10, 10]} />
              <meshStandardMaterial color="#1a1c20" roughness={0.76} metalness={0.03} />
            </mesh>
            <mesh position={[0.635, 0.025, 0.05]} scale={[0.75, 0.95, 0.35]}>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshStandardMaterial color="#f0ede8" roughness={0.78} metalness={0.01} />
            </mesh>
            <mesh position={[0.635, 0.025, -0.05]} scale={[0.75, 0.95, 0.35]}>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshStandardMaterial color="#f0ede8" roughness={0.78} metalness={0.01} />
            </mesh>
            <mesh position={[0.74, 0.02, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <coneGeometry args={[0.025, 0.1, 8]} />
              <meshStandardMaterial color="#222222" roughness={0.9} metalness={0} />
            </mesh>
            <mesh position={[0.67, 0.055, 0.05]}>
              <sphereGeometry args={[0.009, 6, 6]} />
              <meshStandardMaterial color="#111111" roughness={0.5} metalness={0.1} />
            </mesh>
            <mesh position={[0.67, 0.055, -0.05]}>
              <sphereGeometry args={[0.009, 6, 6]} />
              <meshStandardMaterial color="#111111" roughness={0.5} metalness={0.1} />
            </mesh>
            <mesh position={[-0.28, -0.02, 0]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial color="#f0ede8" roughness={0.82} metalness={0.01} />
            </mesh>
            {/* === LEFT WING === */}
            <group
              ref={(el) => { leftWingRefs.current[i] = el; }}
              position={[-0.02, 0.04, 0.16]}
              rotation={[0, 0.03, 0.04]}
            >
              {/* Coverts with barring edges */}
              <mesh position={[0.04, 0.01, 0.03]} castShadow>
                <boxGeometry args={[0.28, 0.014, 0.14]} />
                <meshStandardMaterial color="#8a7560" roughness={0.84} metalness={0.01} />
              </mesh>
              <mesh position={[0.04, 0.018, -0.03]}>
                <boxGeometry args={[0.26, 0.004, 0.016]} />
                <meshStandardMaterial color="#b8a68e" roughness={0.82} metalness={0.01} />
              </mesh>
              <mesh position={[0.02, 0.008, 0.15]} castShadow>
                <boxGeometry args={[0.32, 0.012, 0.14]} />
                <meshStandardMaterial color="#7e6a54" roughness={0.86} metalness={0.01} />
              </mesh>
              <mesh position={[0.02, 0.015, 0.08]}>
                <boxGeometry args={[0.30, 0.004, 0.016]} />
                <meshStandardMaterial color="#b0a086" roughness={0.82} metalness={0.01} />
              </mesh>
              {/* Secondary feathers */}
              <mesh position={[0.05, 0, 0.18]} rotation={[0, -0.03, 0.02]} castShadow>
                <boxGeometry args={[0.26, 0.01, 0.048]} />
                <meshStandardMaterial color="#665644" roughness={0.88} metalness={0.01} />
              </mesh>
              <mesh position={[0.03, 0, 0.23]} rotation={[0, -0.01, 0.01]} castShadow>
                <boxGeometry args={[0.28, 0.009, 0.048]} />
                <meshStandardMaterial color="#625242" roughness={0.88} metalness={0.01} />
              </mesh>
              <mesh position={[0.01, -0.001, 0.28]} castShadow>
                <boxGeometry args={[0.30, 0.009, 0.046]} />
                <meshStandardMaterial color="#5e4e3e" roughness={0.88} metalness={0} />
              </mesh>
              <mesh position={[-0.01, -0.001, 0.33]} rotation={[0, 0.03, -0.01]} castShadow>
                <boxGeometry args={[0.32, 0.008, 0.044]} />
                <meshStandardMaterial color="#5a4a3a" roughness={0.88} metalness={0} />
              </mesh>
              {/* Primary feathers - fanned */}
              <mesh position={[0.03, -0.003, 0.38]} rotation={[0, 0.03, 0.01]} castShadow>
                <boxGeometry args={[0.36, 0.008, 0.04]} />
                <meshStandardMaterial color="#3a3530" roughness={0.9} metalness={0} />
              </mesh>
              <mesh position={[0.0, -0.004, 0.43]} rotation={[0, 0.07, -0.01]} castShadow>
                <boxGeometry args={[0.40, 0.007, 0.038]} />
                <meshStandardMaterial color="#332e2a" roughness={0.9} metalness={0} />
              </mesh>
              <mesh position={[-0.03, -0.005, 0.48]} rotation={[0, 0.11, -0.03]} castShadow>
                <boxGeometry args={[0.42, 0.007, 0.036]} />
                <meshStandardMaterial color="#2c2824" roughness={0.92} metalness={0} />
              </mesh>
              <mesh position={[-0.06, -0.006, 0.53]} rotation={[0, 0.15, -0.05]} castShadow>
                <boxGeometry args={[0.38, 0.006, 0.034]} />
                <meshStandardMaterial color="#252220" roughness={0.92} metalness={0} />
              </mesh>
              <mesh position={[-0.09, -0.007, 0.57]} rotation={[0, 0.20, -0.08]} castShadow>
                <boxGeometry args={[0.32, 0.006, 0.03]} />
                <meshStandardMaterial color="#1e1e22" roughness={0.94} metalness={0} />
              </mesh>
            </group>
            {/* === RIGHT WING === */}
            <group
              ref={(el) => { rightWingRefs.current[i] = el; }}
              position={[-0.02, 0.04, -0.16]}
              rotation={[0, -0.03, -0.04]}
            >
              {/* Coverts with barring edges */}
              <mesh position={[0.04, 0.01, -0.03]} castShadow>
                <boxGeometry args={[0.28, 0.014, 0.14]} />
                <meshStandardMaterial color="#8a7560" roughness={0.84} metalness={0.01} />
              </mesh>
              <mesh position={[0.04, 0.018, 0.03]}>
                <boxGeometry args={[0.26, 0.004, 0.016]} />
                <meshStandardMaterial color="#b8a68e" roughness={0.82} metalness={0.01} />
              </mesh>
              <mesh position={[0.02, 0.008, -0.15]} castShadow>
                <boxGeometry args={[0.32, 0.012, 0.14]} />
                <meshStandardMaterial color="#7e6a54" roughness={0.86} metalness={0.01} />
              </mesh>
              <mesh position={[0.02, 0.015, -0.08]}>
                <boxGeometry args={[0.30, 0.004, 0.016]} />
                <meshStandardMaterial color="#b0a086" roughness={0.82} metalness={0.01} />
              </mesh>
              {/* Secondary feathers */}
              <mesh position={[0.05, 0, -0.18]} rotation={[0, 0.03, -0.02]} castShadow>
                <boxGeometry args={[0.26, 0.01, 0.048]} />
                <meshStandardMaterial color="#665644" roughness={0.88} metalness={0.01} />
              </mesh>
              <mesh position={[0.03, 0, -0.23]} rotation={[0, 0.01, -0.01]} castShadow>
                <boxGeometry args={[0.28, 0.009, 0.048]} />
                <meshStandardMaterial color="#625242" roughness={0.88} metalness={0.01} />
              </mesh>
              <mesh position={[0.01, -0.001, -0.28]} castShadow>
                <boxGeometry args={[0.30, 0.009, 0.046]} />
                <meshStandardMaterial color="#5e4e3e" roughness={0.88} metalness={0} />
              </mesh>
              <mesh position={[-0.01, -0.001, -0.33]} rotation={[0, -0.03, 0.01]} castShadow>
                <boxGeometry args={[0.32, 0.008, 0.044]} />
                <meshStandardMaterial color="#5a4a3a" roughness={0.88} metalness={0} />
              </mesh>
              {/* Primary feathers - fanned */}
              <mesh position={[0.03, -0.003, -0.38]} rotation={[0, -0.03, -0.01]} castShadow>
                <boxGeometry args={[0.36, 0.008, 0.04]} />
                <meshStandardMaterial color="#3a3530" roughness={0.9} metalness={0} />
              </mesh>
              <mesh position={[0.0, -0.004, -0.43]} rotation={[0, -0.07, 0.01]} castShadow>
                <boxGeometry args={[0.40, 0.007, 0.038]} />
                <meshStandardMaterial color="#332e2a" roughness={0.9} metalness={0} />
              </mesh>
              <mesh position={[-0.03, -0.005, -0.48]} rotation={[0, -0.11, 0.03]} castShadow>
                <boxGeometry args={[0.42, 0.007, 0.036]} />
                <meshStandardMaterial color="#2c2824" roughness={0.92} metalness={0} />
              </mesh>
              <mesh position={[-0.06, -0.006, -0.53]} rotation={[0, -0.15, 0.05]} castShadow>
                <boxGeometry args={[0.38, 0.006, 0.034]} />
                <meshStandardMaterial color="#252220" roughness={0.92} metalness={0} />
              </mesh>
              <mesh position={[-0.09, -0.007, -0.57]} rotation={[0, -0.20, 0.08]} castShadow>
                <boxGeometry args={[0.32, 0.006, 0.03]} />
                <meshStandardMaterial color="#1e1e22" roughness={0.94} metalness={0} />
              </mesh>
            </group>
            {/* === TAIL FAN === */}
            <mesh position={[-0.36, 0.01, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <boxGeometry args={[0.2, 0.008, 0.048]} />
              <meshStandardMaterial color="#1a1c20" roughness={0.88} metalness={0.02} />
            </mesh>
            <mesh position={[-0.35, 0.01, 0.035]} rotation={[0.08, 0, Math.PI / 2]} castShadow>
              <boxGeometry args={[0.19, 0.007, 0.044]} />
              <meshStandardMaterial color="#1e1e22" roughness={0.88} metalness={0.02} />
            </mesh>
            <mesh position={[-0.35, 0.01, -0.035]} rotation={[-0.08, 0, Math.PI / 2]} castShadow>
              <boxGeometry args={[0.19, 0.007, 0.044]} />
              <meshStandardMaterial color="#1e1e22" roughness={0.88} metalness={0.02} />
            </mesh>
            <mesh position={[-0.34, 0.01, 0.07]} rotation={[0.16, 0, Math.PI / 2]} castShadow>
              <boxGeometry args={[0.17, 0.006, 0.04]} />
              <meshStandardMaterial color="#222226" roughness={0.9} metalness={0.02} />
            </mesh>
            <mesh position={[-0.34, 0.01, -0.07]} rotation={[-0.16, 0, Math.PI / 2]} castShadow>
              <boxGeometry args={[0.17, 0.006, 0.04]} />
              <meshStandardMaterial color="#222226" roughness={0.9} metalness={0.02} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
