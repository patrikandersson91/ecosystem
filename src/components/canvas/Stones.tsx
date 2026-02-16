import { useLayoutEffect, useRef, useMemo } from 'react';
import {
  Object3D,
  InstancedMesh,
  DodecahedronGeometry,
  IcosahedronGeometry,
  CircleGeometry,
  Color,
  Vector3,
} from 'three';
import { softShadowVert, softShadowFrag } from '../../utils/soft-shadow-material.ts';
import { STONE_POSITIONS } from '../../data/obstacles.ts';
import { groundHeightAt } from '../../utils/terrain-height.ts';

function seededRandom(seed: number) {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Sculpt a single solid geometry into a rocky shape via per-vertex displacement.
 * Uses directional bias so the rock isn't uniformly noisy — some faces jut out
 * while others stay flat, giving an angular/craggy look.
 */
function sculptRock(
  geo: DodecahedronGeometry | IcosahedronGeometry,
  seed: number,
  noiseAmount: number,
  flattenY: number,
  scaleX: number,
  scaleZ: number,
) {
  const posAttr = geo.attributes.position;
  const v = new Vector3();

  // Create a few random "bump directions" that push vertices outward
  // along specific directions, giving angular character
  const bumpCount = 3 + Math.floor(seededRandom(seed) * 3);
  const bumps: { dir: Vector3; strength: number }[] = [];
  for (let b = 0; b < bumpCount; b++) {
    const bseed = seed + b * 37;
    const theta = seededRandom(bseed) * Math.PI * 2;
    const phi = seededRandom(bseed + 1) * Math.PI * 0.6;
    bumps.push({
      dir: new Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi) * 0.4,
        Math.sin(phi) * Math.sin(theta),
      ).normalize(),
      strength: 0.03 + seededRandom(bseed + 2) * 0.06,
    });
  }

  for (let i = 0; i < posAttr.count; i++) {
    v.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));

    // Base shape scaling — squash Y, stretch X/Z for boulder feel
    v.x *= scaleX;
    v.y *= flattenY;
    v.z *= scaleZ;

    const len = v.length();
    if (len > 0.001) {
      const dir = v.clone().normalize();

      // Position-based hash so duplicate vertices at shared edges get identical offsets
      const posHash = Math.round(v.x * 1000) * 73856093 ^ Math.round(v.y * 1000) * 19349663 ^ Math.round(v.z * 1000) * 83492791;
      let offset = (seededRandom(seed + Math.abs(posHash)) - 0.5) * noiseAmount;

      // Directional bumps — dot product with bump directions
      for (const bump of bumps) {
        const dot = dir.dot(bump.dir);
        if (dot > 0.3) {
          offset += (dot - 0.3) * bump.strength;
        }
      }

      v.copy(dir).multiplyScalar(len + offset);
    }

    posAttr.setXYZ(i, v.x, v.y, v.z);
  }

  posAttr.needsUpdate = true;
  geo.computeVertexNormals();
}

/**
 * Boulder — single solid dodecahedron, sculpted wide and flat.
 */
function createBoulderGeometry(seed: number) {
  const geo = new DodecahedronGeometry(0.4, 2);
  sculptRock(geo, seed, 0.04, 0.55, 1.05, 0.95);
  geo.translate(0, 0.18, 0);
  return geo;
}

/**
 * Rock — single solid icosahedron, sculpted taller and more angular.
 */
function createRockGeometry(seed: number) {
  const geo = new IcosahedronGeometry(0.3, 2);
  sculptRock(geo, seed, 0.04, 0.7, 0.85, 0.9);
  geo.translate(0, 0.15, 0);
  return geo;
}

export default function Stones() {
  const stonePositions = useMemo(
    () => STONE_POSITIONS.filter((pos) => groundHeightAt(pos[0], pos[2]) < 35),
    [],
  );

  // Split positions: ~45% boulders, ~55% rocks (based on seed)
  const { boulderPositions, rockPositions } = useMemo(() => {
    const boulders: { pos: [number, number, number]; idx: number }[] = [];
    const rocks: { pos: [number, number, number]; idx: number }[] = [];
    stonePositions.forEach((pos, i) => {
      if (seededRandom(i * 31 + 5) < 0.45) {
        boulders.push({ pos, idx: i });
      } else {
        rocks.push({ pos, idx: i });
      }
    });
    return { boulderPositions: boulders, rockPositions: rocks };
  }, [stonePositions]);

  const boulderCount = boulderPositions.length;
  const rockCount = rockPositions.length;

  const boulderRef = useRef<InstancedMesh>(null!);
  const boulderShadowRef = useRef<InstancedMesh>(null!);
  const rockRef = useRef<InstancedMesh>(null!);
  const rockShadowRef = useRef<InstancedMesh>(null!);

  const [geoBoulder, geoRock, geoShadowLg, geoShadowSm] = useMemo(() => {
    const boulder = createBoulderGeometry(42);
    const rock = createRockGeometry(77);

    const shadowLg = new CircleGeometry(0.65, 14);
    shadowLg.rotateX(-Math.PI / 2);
    shadowLg.translate(0, 0.02, 0);

    const shadowSm = new CircleGeometry(0.4, 12);
    shadowSm.rotateX(-Math.PI / 2);
    shadowSm.translate(0, 0.02, 0);

    return [boulder, rock, shadowLg, shadowSm];
  }, []);

  // Place boulders
  useLayoutEffect(() => {
    if (boulderCount === 0) return;
    const dummy = new Object3D();
    const color = new Color();

    boulderPositions.forEach(({ pos, idx }, i) => {
      const seed = idx * 11 + 3;
      const scale = 0.7 + seededRandom(seed) * 0.6;
      const rotY = seededRandom(seed + 1) * Math.PI * 2;
      const tiltX = (seededRandom(seed + 7) - 0.5) * 0.12;
      const tiltZ = (seededRandom(seed + 8) - 0.5) * 0.12;

      const x = pos[0];
      const z = pos[2];
      const y = groundHeightAt(x, z);

      dummy.position.set(x, y, z);
      dummy.rotation.set(tiltX, rotY, tiltZ);
      dummy.scale.set(
        scale * (0.9 + seededRandom(seed + 3) * 0.2),
        scale * (0.75 + seededRandom(seed + 4) * 0.35),
        scale * (0.9 + seededRandom(seed + 5) * 0.2),
      );
      dummy.updateMatrix();
      boulderRef.current.setMatrixAt(i, dummy.matrix);

      // Color: grey-brown range with occasional dark or mossy patches
      const huePool = [0, 0.04, 0.07, 0.1, 0.28];
      const baseHue = huePool[Math.floor(seededRandom(seed + 6) * huePool.length)];
      const isMossy = baseHue > 0.2;
      const sat = isMossy
        ? 0.15 + seededRandom(seed + 9) * 0.15
        : 0.03 + seededRandom(seed + 9) * 0.06;
      const lit = 0.25 + seededRandom(seed + 10) * 0.18;
      color.setHSL(baseHue, sat, lit);
      boulderRef.current.setColorAt(i, color);

      // Shadow
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(scale * 1.2, 1, scale * 1.1);
      dummy.updateMatrix();
      boulderShadowRef.current.setMatrixAt(i, dummy.matrix);
    });

    boulderRef.current.instanceMatrix.needsUpdate = true;
    if (boulderRef.current.instanceColor) boulderRef.current.instanceColor.needsUpdate = true;
    boulderShadowRef.current.instanceMatrix.needsUpdate = true;
  }, [boulderPositions, boulderCount]);

  // Place rocks
  useLayoutEffect(() => {
    if (rockCount === 0) return;
    const dummy = new Object3D();
    const color = new Color();

    rockPositions.forEach(({ pos, idx }, i) => {
      const seed = idx * 11 + 3;
      const scale = 0.5 + seededRandom(seed) * 0.45;
      const rotY = seededRandom(seed + 1) * Math.PI * 2;
      const tiltX = (seededRandom(seed + 7) - 0.5) * 0.2;
      const tiltZ = (seededRandom(seed + 8) - 0.5) * 0.2;

      const x = pos[0];
      const z = pos[2];
      const y = groundHeightAt(x, z);

      dummy.position.set(x, y, z);
      dummy.rotation.set(tiltX, rotY, tiltZ);
      dummy.scale.set(
        scale * (0.85 + seededRandom(seed + 3) * 0.3),
        scale * (0.8 + seededRandom(seed + 4) * 0.4),
        scale * (0.85 + seededRandom(seed + 5) * 0.3),
      );
      dummy.updateMatrix();
      rockRef.current.setMatrixAt(i, dummy.matrix);

      // Color: similar palette, slightly lighter range
      const huePool = [0, 0.03, 0.06, 0.1, 0.28];
      const baseHue = huePool[Math.floor(seededRandom(seed + 6) * huePool.length)];
      const isMossy = baseHue > 0.2;
      const sat = isMossy
        ? 0.12 + seededRandom(seed + 9) * 0.18
        : 0.03 + seededRandom(seed + 9) * 0.07;
      const lit = 0.28 + seededRandom(seed + 10) * 0.2;
      color.setHSL(baseHue, sat, lit);
      rockRef.current.setColorAt(i, color);

      // Shadow
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(scale * 1.0, 1, scale * 1.0);
      dummy.updateMatrix();
      rockShadowRef.current.setMatrixAt(i, dummy.matrix);
    });

    rockRef.current.instanceMatrix.needsUpdate = true;
    if (rockRef.current.instanceColor) rockRef.current.instanceColor.needsUpdate = true;
    rockShadowRef.current.instanceMatrix.needsUpdate = true;
  }, [rockPositions, rockCount]);

  return (
    <group>
      {/* ── Boulders ── large, chunky, craggy */}
      {boulderCount > 0 && (
        <>
          <instancedMesh
            ref={boulderRef}
            args={[undefined, undefined, boulderCount]}
            castShadow
            receiveShadow
            geometry={geoBoulder}
          >
            <meshStandardMaterial
              color="#7a7a7a"
              roughness={1}
              metalness={0.05}
            />
          </instancedMesh>
          <instancedMesh
            ref={boulderShadowRef}
            args={[undefined, undefined, boulderCount]}
            geometry={geoShadowLg}
          >
            <shaderMaterial
              transparent
              depthWrite={false}
              vertexShader={softShadowVert}
              fragmentShader={softShadowFrag}
              uniforms={{ uOpacity: { value: 0.22 } }}
            />
          </instancedMesh>
        </>
      )}

      {/* ── Rocks ── smaller, angular, pointed */}
      {rockCount > 0 && (
        <>
          <instancedMesh
            ref={rockRef}
            args={[undefined, undefined, rockCount]}
            castShadow
            receiveShadow
            geometry={geoRock}
          >
            <meshStandardMaterial
              color="#8a8a8a"
              roughness={1}
              metalness={0.06}
            />
          </instancedMesh>
          <instancedMesh
            ref={rockShadowRef}
            args={[undefined, undefined, rockCount]}
            geometry={geoShadowSm}
          >
            <shaderMaterial
              transparent
              depthWrite={false}
              vertexShader={softShadowVert}
              fragmentShader={softShadowFrag}
              uniforms={{ uOpacity: { value: 0.18 } }}
            />
          </instancedMesh>
        </>
      )}
    </group>
  );
}
