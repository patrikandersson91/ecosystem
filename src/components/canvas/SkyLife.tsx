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
        if (leftWing) leftWing.rotation.z = flap;
        if (rightWing) rightWing.rotation.z = -flap;
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
            <mesh castShadow>
              <capsuleGeometry args={[0.17, 0.56, 6, 10]} />
              <meshStandardMaterial
                color="#3e3f46"
                roughness={0.84}
                metalness={0.03}
              />
            </mesh>
            <mesh position={[0.03, 0.02, 0]} castShadow>
              <sphereGeometry args={[0.19, 12, 10]} />
              <meshStandardMaterial
                color="#585b66"
                roughness={0.86}
                metalness={0.02}
              />
            </mesh>
            <mesh position={[0.35, 0.1, 0]} castShadow>
              <sphereGeometry args={[0.12, 10, 10]} />
              <meshStandardMaterial
                color="#484a54"
                roughness={0.84}
                metalness={0.03}
              />
            </mesh>
            <mesh position={[0.5, 0.09, 0]}>
              <coneGeometry args={[0.05, 0.2, 8]} />
              <meshStandardMaterial
                color="#cda678"
                roughness={0.9}
                metalness={0}
              />
            </mesh>
            <mesh position={[-0.15, -0.02, 0]}>
              <sphereGeometry args={[0.11, 10, 10]} />
              <meshStandardMaterial
                color="#686b75"
                roughness={0.9}
                metalness={0.02}
              />
            </mesh>
            <group
              ref={(el) => {
                leftWingRefs.current[i] = el;
              }}
              position={[0.02, 0.04, 0.23]}
              rotation={[0.05, 0.05, 0.08]}
            >
              <mesh castShadow>
                <cylinderGeometry args={[0.016, 0.05, 0.32, 8]} />
                <meshStandardMaterial
                  color="#4d525e"
                  roughness={0.86}
                  metalness={0.03}
                />
              </mesh>
              <mesh
                position={[0.05, 0, 0.17]}
                rotation={[0, 0, 0.2]}
                castShadow
              >
                <boxGeometry args={[0.5, 0.012, 0.095]} />
                <meshStandardMaterial
                  color="#5f6470"
                  roughness={0.9}
                  metalness={0.01}
                />
              </mesh>
              <mesh
                position={[0.03, 0, 0.3]}
                rotation={[0, 0, 0.08]}
                castShadow
              >
                <boxGeometry args={[0.62, 0.01, 0.07]} />
                <meshStandardMaterial
                  color="#636a76"
                  roughness={0.9}
                  metalness={0.01}
                />
              </mesh>
              <mesh
                position={[-0.02, 0, 0.42]}
                rotation={[0, 0, -0.03]}
                castShadow
              >
                <boxGeometry args={[0.7, 0.009, 0.052]} />
                <meshStandardMaterial
                  color="#6c7380"
                  roughness={0.92}
                  metalness={0}
                />
              </mesh>
              <mesh
                position={[-0.08, 0, 0.52]}
                rotation={[0, 0, -0.12]}
                castShadow
              >
                <boxGeometry args={[0.76, 0.008, 0.042]} />
                <meshStandardMaterial
                  color="#757d8b"
                  roughness={0.94}
                  metalness={0}
                />
              </mesh>
            </group>
            <group
              ref={(el) => {
                rightWingRefs.current[i] = el;
              }}
              position={[0.02, 0.04, -0.23]}
              rotation={[-0.05, -0.05, -0.08]}
            >
              <mesh castShadow>
                <cylinderGeometry args={[0.016, 0.05, 0.32, 8]} />
                <meshStandardMaterial
                  color="#4d525e"
                  roughness={0.86}
                  metalness={0.03}
                />
              </mesh>
              <mesh
                position={[0.05, 0, -0.17]}
                rotation={[0, 0, -0.2]}
                castShadow
              >
                <boxGeometry args={[0.5, 0.012, 0.095]} />
                <meshStandardMaterial
                  color="#5f6470"
                  roughness={0.9}
                  metalness={0.01}
                />
              </mesh>
              <mesh
                position={[0.03, 0, -0.3]}
                rotation={[0, 0, -0.08]}
                castShadow
              >
                <boxGeometry args={[0.62, 0.01, 0.07]} />
                <meshStandardMaterial
                  color="#636a76"
                  roughness={0.9}
                  metalness={0.01}
                />
              </mesh>
              <mesh
                position={[-0.02, 0, -0.42]}
                rotation={[0, 0, 0.03]}
                castShadow
              >
                <boxGeometry args={[0.7, 0.009, 0.052]} />
                <meshStandardMaterial
                  color="#6c7380"
                  roughness={0.92}
                  metalness={0}
                />
              </mesh>
              <mesh
                position={[-0.08, 0, -0.52]}
                rotation={[0, 0, 0.12]}
                castShadow
              >
                <boxGeometry args={[0.76, 0.008, 0.042]} />
                <meshStandardMaterial
                  color="#757d8b"
                  roughness={0.94}
                  metalness={0}
                />
              </mesh>
            </group>
            <mesh
              position={[-0.32, 0.03, 0.09]}
              rotation={[0.2, 0.16, -0.45]}
              castShadow
            >
              <coneGeometry args={[0.032, 0.24, 7]} />
              <meshStandardMaterial
                color="#343740"
                roughness={0.9}
                metalness={0.02}
              />
            </mesh>
            <mesh
              position={[-0.32, 0.03, -0.09]}
              rotation={[-0.2, -0.16, -0.45]}
              castShadow
            >
              <coneGeometry args={[0.032, 0.24, 7]} />
              <meshStandardMaterial
                color="#343740"
                roughness={0.9}
                metalness={0.02}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
