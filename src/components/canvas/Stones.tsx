import { useLayoutEffect, useRef, useMemo } from 'react';
import {
  Object3D,
  InstancedMesh,
  DodecahedronGeometry,
  IcosahedronGeometry,
  CircleGeometry,
  Color,
} from 'three';
import { softShadowVert, softShadowFrag } from '../../utils/soft-shadow-material.ts';
import { STONE_POSITIONS } from '../../data/obstacles.ts';
import { groundHeightAt } from '../../utils/terrain-height.ts';

function seededRandom(seed: number) {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export default function Stones() {
  const stonePositions = useMemo(
    () => STONE_POSITIONS.filter((pos) => groundHeightAt(pos[0], pos[2]) < 35),
    [],
  );
  const count = stonePositions.length;

  // Main body + accent stone + shadow (like original, but with better shapes)
  const mainRef = useRef<InstancedMesh>(null!);
  const accentRef = useRef<InstancedMesh>(null!);
  const shadowRef = useRef<InstancedMesh>(null!);

  const [geoMain, geoAccent, geoShadow] = useMemo(() => {
    // Main stone — subdivided dodecahedron, squashed for natural boulder look
    const g1 = new DodecahedronGeometry(0.42, 1);
    g1.scale(1, 0.6, 0.85);
    g1.translate(0, 0.2, 0);

    // Accent — smaller angular rock beside main
    const g2 = new IcosahedronGeometry(0.2, 0);
    g2.scale(1, 0.55, 0.9);
    g2.translate(0.3, 0.1, 0.15);

    const gs = new CircleGeometry(0.6, 12);
    gs.rotateX(-Math.PI / 2);
    gs.translate(0, 0.02, 0);

    return [g1, g2, gs];
  }, []);

  useLayoutEffect(() => {
    const dummy = new Object3D();
    const color = new Color();

    stonePositions.forEach((pos, i) => {
      const seed = i * 11 + 3;
      const scale = 0.55 + seededRandom(seed) * 0.65;
      const rotY = seededRandom(seed + 1) * Math.PI * 2;
      const tiltX = (seededRandom(seed + 7) - 0.5) * 0.15;
      const tiltZ = (seededRandom(seed + 8) - 0.5) * 0.15;

      const x = pos[0];
      const z = pos[2];
      const y = groundHeightAt(x, z);

      // Main body — per-instance asymmetric scaling
      dummy.position.set(x, y, z);
      dummy.rotation.set(tiltX, rotY, tiltZ);
      dummy.scale.set(
        scale * (0.9 + seededRandom(seed + 3) * 0.2),
        scale * (0.8 + seededRandom(seed + 4) * 0.3),
        scale * (0.9 + seededRandom(seed + 5) * 0.2),
      );
      dummy.updateMatrix();
      mainRef.current.setMatrixAt(i, dummy.matrix);

      // Color variation — greys, warm tones, mossy hints
      const huePool = [0, 0.05, 0.08, 0.12, 0.28];
      const baseHue = huePool[Math.floor(seededRandom(seed + 6) * huePool.length)];
      const sat = baseHue > 0.2 ? 0.15 + seededRandom(seed + 9) * 0.15 : 0.04 + seededRandom(seed + 9) * 0.08;
      const lit = 0.3 + seededRandom(seed + 10) * 0.2;
      color.setHSL(baseHue, sat, lit);
      mainRef.current.setColorAt(i, color);

      // Accent stone — only for larger stones
      if (scale > 0.75) {
        accentRef.current.setMatrixAt(i, dummy.matrix);
      } else {
        // Move offscreen instead of zero-scale
        dummy.position.set(0, -1000, 0);
        dummy.scale.set(0.001, 0.001, 0.001);
        dummy.updateMatrix();
        accentRef.current.setMatrixAt(i, dummy.matrix);
      }
      accentRef.current.setColorAt(i, color);

      // Shadow
      dummy.position.set(x, y + 0.02, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(scale * 1.1, 1, scale * 1.1);
      dummy.updateMatrix();
      shadowRef.current.setMatrixAt(i, dummy.matrix);
    });

    mainRef.current.instanceMatrix.needsUpdate = true;
    if (mainRef.current.instanceColor) mainRef.current.instanceColor.needsUpdate = true;

    accentRef.current.instanceMatrix.needsUpdate = true;
    if (accentRef.current.instanceColor) accentRef.current.instanceColor.needsUpdate = true;

    shadowRef.current.instanceMatrix.needsUpdate = true;
  }, [stonePositions]);

  return (
    <group>
      {/* Main stone body — subdivided dodecahedron for smoother boulders */}
      <instancedMesh
        ref={mainRef}
        args={[undefined, undefined, count]}
        castShadow
        receiveShadow
        geometry={geoMain}
      >
        <meshStandardMaterial color="#8a8a8a" roughness={1} metalness={0.05} />
      </instancedMesh>

      {/* Smaller angular accent stone */}
      <instancedMesh
        ref={accentRef}
        args={[undefined, undefined, count]}
        castShadow
        receiveShadow
        geometry={geoAccent}
      >
        <meshStandardMaterial color="#7a7a7a" roughness={1} metalness={0.08} />
      </instancedMesh>

      {/* Soft ground shadow */}
      <instancedMesh
        ref={shadowRef}
        args={[undefined, undefined, count]}
        geometry={geoShadow}
      >
        <shaderMaterial
          transparent
          depthWrite={false}
          vertexShader={softShadowVert}
          fragmentShader={softShadowFrag}
          uniforms={{ uOpacity: { value: 0.2 } }}
        />
      </instancedMesh>
    </group>
  );
}
