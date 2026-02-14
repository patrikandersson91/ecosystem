import { useLayoutEffect, useMemo, useRef } from 'react';
import { Object3D, InstancedMesh, Color } from 'three';
import { softShadowVert, softShadowFrag } from '../../utils/soft-shadow-material.ts';
import {
  CORNER_FOREST_TREE_POSITIONS,
  DENSE_FOREST_TREE_POSITIONS,
  FOREST_EDGE_TREE_POSITIONS,
  RANDOM_GROVES,
  TREE_POSITIONS,
} from '../../data/obstacles.ts';
import { groundHeightAt } from '../../utils/terrain-height.ts';
import { isInWater } from '../../utils/river-path.ts';

/** Deterministic hash-based random for consistent per-tree variation */
function seededRandom(seed: number) {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export default function Trees() {
  const TREE_WATER_CLEARANCE = 3;

  const filterValid = (positions: [number, number, number][]) =>
    positions
      .filter((pos) => !isInWater(pos[0], pos[2], TREE_WATER_CLEARANCE))
      .filter((pos) => groundHeightAt(pos[0], pos[2]) < 17);

  // Zone-based type assignment — same type trees stay together
  const { conifers, deciduous } = useMemo(() => {
    const con: [number, number, number][] = [];
    const dec: [number, number, number][] = [];

    // Dense forest → conifers (thick pine forest)
    con.push(...filterValid(DENSE_FOREST_TREE_POSITIONS));

    // Corner forest → conifers (second pine forest patch)
    con.push(...filterValid(CORNER_FOREST_TREE_POSITIONS));

    // Forest edge → deciduous (leafy transition zone)
    dec.push(...filterValid(FOREST_EDGE_TREE_POSITIONS));

    // Scattered trees → deciduous (lone oaks in meadows)
    dec.push(...filterValid(TREE_POSITIONS));

    // Random groves → each grove is one type, alternating
    RANDOM_GROVES.forEach((grove, groveIndex) => {
      const filtered = filterValid(grove);
      // Alternate: even groves = conifer, odd = deciduous
      if (groveIndex % 2 === 0) {
        con.push(...filtered);
      } else {
        dec.push(...filtered);
      }
    });

    return { conifers: con, deciduous: dec };
  }, []);

  /* ---------- Conifer refs (pine / spruce) ---------- */
  const coniferTrunkRef = useRef<InstancedMesh>(null!);
  const coniferTier1Ref = useRef<InstancedMesh>(null!);
  const coniferTier2Ref = useRef<InstancedMesh>(null!);
  const coniferTier3Ref = useRef<InstancedMesh>(null!);
  const coniferShadowRef = useRef<InstancedMesh>(null!);

  /* ---------- Deciduous refs (oak / maple) ---------- */
  const deciduousTrunkRef = useRef<InstancedMesh>(null!);
  const deciduousCanopyRef = useRef<InstancedMesh>(null!);
  const deciduousCanopy2Ref = useRef<InstancedMesh>(null!);
  const deciduousShadowRef = useRef<InstancedMesh>(null!);

  /* ---------- Place conifer instances ---------- */
  useLayoutEffect(() => {
    const dummy = new Object3D();
    const color = new Color();

    conifers.forEach((pos, i) => {
      const x = pos[0];
      const z = pos[2];
      const y = groundHeightAt(x, z);
      const seed = i * 13 + 5;
      const scale = 0.75 + seededRandom(seed) * 0.55;
      const rotY = seededRandom(seed + 1) * Math.PI * 2;

      // Trunk – tapered cylinder
      dummy.position.set(x, y + 1.25 * scale, z);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      coniferTrunkRef.current.setMatrixAt(i, dummy.matrix);
      color.setHSL(0.07, 0.5, 0.17 + seededRandom(seed + 2) * 0.08);
      coniferTrunkRef.current.setColorAt(i, color);

      // Tier 1 – bottom, widest
      dummy.position.set(x, y + 2.0 * scale, z);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.set(scale * 1.1, scale, scale * 1.1);
      dummy.updateMatrix();
      coniferTier1Ref.current.setMatrixAt(i, dummy.matrix);
      color.setHSL(0.28 + seededRandom(seed + 3) * 0.05, 0.6, 0.19 + seededRandom(seed + 4) * 0.07);
      coniferTier1Ref.current.setColorAt(i, color);

      // Tier 2 – middle
      dummy.position.set(x, y + 3.0 * scale, z);
      dummy.rotation.set(0, rotY + 0.5, 0);
      dummy.scale.set(scale * 0.85, scale * 0.95, scale * 0.85);
      dummy.updateMatrix();
      coniferTier2Ref.current.setMatrixAt(i, dummy.matrix);
      color.setHSL(0.30 + seededRandom(seed + 5) * 0.05, 0.55, 0.21 + seededRandom(seed + 6) * 0.07);
      coniferTier2Ref.current.setColorAt(i, color);

      // Tier 3 – top, narrowest
      dummy.position.set(x, y + 3.85 * scale, z);
      dummy.rotation.set(0, rotY + 1.0, 0);
      dummy.scale.set(scale * 0.6, scale * 0.9, scale * 0.6);
      dummy.updateMatrix();
      coniferTier3Ref.current.setMatrixAt(i, dummy.matrix);
      color.setHSL(0.32 + seededRandom(seed + 7) * 0.05, 0.5, 0.24 + seededRandom(seed + 8) * 0.07);
      coniferTier3Ref.current.setColorAt(i, color);

      // Shadow disc
      dummy.position.set(x, y + 0.02, z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(scale * 1.3, scale * 1.3, 1);
      dummy.updateMatrix();
      coniferShadowRef.current.setMatrixAt(i, dummy.matrix);
    });

    coniferTrunkRef.current.instanceMatrix.needsUpdate = true;
    coniferTier1Ref.current.instanceMatrix.needsUpdate = true;
    coniferTier2Ref.current.instanceMatrix.needsUpdate = true;
    coniferTier3Ref.current.instanceMatrix.needsUpdate = true;
    coniferShadowRef.current.instanceMatrix.needsUpdate = true;
    if (coniferTrunkRef.current.instanceColor) coniferTrunkRef.current.instanceColor.needsUpdate = true;
    if (coniferTier1Ref.current.instanceColor) coniferTier1Ref.current.instanceColor.needsUpdate = true;
    if (coniferTier2Ref.current.instanceColor) coniferTier2Ref.current.instanceColor.needsUpdate = true;
    if (coniferTier3Ref.current.instanceColor) coniferTier3Ref.current.instanceColor.needsUpdate = true;
  }, [conifers]);

  /* ---------- Place deciduous instances ---------- */
  useLayoutEffect(() => {
    const dummy = new Object3D();
    const color = new Color();

    deciduous.forEach((pos, i) => {
      const x = pos[0];
      const z = pos[2];
      const y = groundHeightAt(x, z);
      const seed = i * 17 + 11;
      const scale = 0.8 + seededRandom(seed) * 0.5;
      const rotY = seededRandom(seed + 1) * Math.PI * 2;

      // Trunk – thicker
      const trunkH = 2.2 * scale;
      dummy.position.set(x, y + trunkH / 2, z);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      deciduousTrunkRef.current.setMatrixAt(i, dummy.matrix);
      color.setHSL(0.06, 0.45, 0.19 + seededRandom(seed + 2) * 0.1);
      deciduousTrunkRef.current.setColorAt(i, color);

      // Main canopy – large organic dodecahedron
      const canopyY = y + trunkH + 0.7 * scale;
      const csx = scale * (1.0 + seededRandom(seed + 3) * 0.25);
      const csy = scale * (0.8 + seededRandom(seed + 4) * 0.25);
      const csz = scale * (1.0 + seededRandom(seed + 5) * 0.25);
      dummy.position.set(x, canopyY, z);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.set(csx, csy, csz);
      dummy.updateMatrix();
      deciduousCanopyRef.current.setMatrixAt(i, dummy.matrix);
      color.setHSL(0.26 + seededRandom(seed + 6) * 0.09, 0.55, 0.24 + seededRandom(seed + 7) * 0.1);
      deciduousCanopyRef.current.setColorAt(i, color);

      // Secondary canopy cluster – offset to the side for fuller look
      const offsetX = (seededRandom(seed + 10) - 0.5) * 0.7 * scale;
      const offsetZ = (seededRandom(seed + 11) - 0.5) * 0.7 * scale;
      dummy.position.set(x + offsetX, canopyY - 0.15 * scale, z + offsetZ);
      dummy.rotation.set(0, rotY + 2, 0);
      dummy.scale.set(csx * 0.75, csy * 0.7, csz * 0.75);
      dummy.updateMatrix();
      deciduousCanopy2Ref.current.setMatrixAt(i, dummy.matrix);
      color.setHSL(0.24 + seededRandom(seed + 8) * 0.08, 0.5, 0.22 + seededRandom(seed + 9) * 0.09);
      deciduousCanopy2Ref.current.setColorAt(i, color);

      // Shadow disc
      dummy.position.set(x, y + 0.02, z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(scale * 1.6, scale * 1.6, 1);
      dummy.updateMatrix();
      deciduousShadowRef.current.setMatrixAt(i, dummy.matrix);
    });

    deciduousTrunkRef.current.instanceMatrix.needsUpdate = true;
    deciduousCanopyRef.current.instanceMatrix.needsUpdate = true;
    deciduousCanopy2Ref.current.instanceMatrix.needsUpdate = true;
    deciduousShadowRef.current.instanceMatrix.needsUpdate = true;
    if (deciduousTrunkRef.current.instanceColor) deciduousTrunkRef.current.instanceColor.needsUpdate = true;
    if (deciduousCanopyRef.current.instanceColor) deciduousCanopyRef.current.instanceColor.needsUpdate = true;
    if (deciduousCanopy2Ref.current.instanceColor) deciduousCanopy2Ref.current.instanceColor.needsUpdate = true;
  }, [deciduous]);

  const coniferCount = conifers.length;
  const deciduousCount = deciduous.length;

  return (
    <group>
      {/* ===== Conifers (Pine / Spruce) ===== */}
      <instancedMesh
        ref={coniferTrunkRef}
        args={[undefined, undefined, coniferCount]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.08, 0.2, 2.5, 8]} />
        <meshStandardMaterial color="#5a3420" roughness={0.95} />
      </instancedMesh>

      <instancedMesh
        ref={coniferTier1Ref}
        args={[undefined, undefined, coniferCount]}
        castShadow
        receiveShadow
      >
        <coneGeometry args={[1.5, 2.0, 8]} />
        <meshStandardMaterial color="#2a5e1a" roughness={0.88} />
      </instancedMesh>

      <instancedMesh
        ref={coniferTier2Ref}
        args={[undefined, undefined, coniferCount]}
        castShadow
        receiveShadow
      >
        <coneGeometry args={[1.2, 1.8, 7]} />
        <meshStandardMaterial color="#2d6b1e" roughness={0.88} />
      </instancedMesh>

      <instancedMesh
        ref={coniferTier3Ref}
        args={[undefined, undefined, coniferCount]}
        castShadow
        receiveShadow
      >
        <coneGeometry args={[0.75, 1.5, 7]} />
        <meshStandardMaterial color="#357a25" roughness={0.88} />
      </instancedMesh>

      <instancedMesh ref={coniferShadowRef} args={[undefined, undefined, coniferCount]}>
        <circleGeometry args={[1.8, 16]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          vertexShader={softShadowVert}
          fragmentShader={softShadowFrag}
          uniforms={{ uOpacity: { value: 0.28 } }}
        />
      </instancedMesh>

      {/* ===== Deciduous (Oak / Maple) ===== */}
      <instancedMesh
        ref={deciduousTrunkRef}
        args={[undefined, undefined, deciduousCount]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.12, 0.3, 2.2, 8]} />
        <meshStandardMaterial color="#6b4226" roughness={0.95} />
      </instancedMesh>

      <instancedMesh
        ref={deciduousCanopyRef}
        args={[undefined, undefined, deciduousCount]}
        castShadow
        receiveShadow
      >
        <dodecahedronGeometry args={[1.5, 1]} />
        <meshStandardMaterial color="#3a7a2a" roughness={0.82} />
      </instancedMesh>

      <instancedMesh
        ref={deciduousCanopy2Ref}
        args={[undefined, undefined, deciduousCount]}
        castShadow
        receiveShadow
      >
        <dodecahedronGeometry args={[1.5, 1]} />
        <meshStandardMaterial color="#347524" roughness={0.82} />
      </instancedMesh>

      <instancedMesh ref={deciduousShadowRef} args={[undefined, undefined, deciduousCount]}>
        <circleGeometry args={[2.2, 16]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          vertexShader={softShadowVert}
          fragmentShader={softShadowFrag}
          uniforms={{ uOpacity: { value: 0.25 } }}
        />
      </instancedMesh>
    </group>
  );
}
