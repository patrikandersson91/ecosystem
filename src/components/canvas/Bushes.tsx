import { useLayoutEffect, useRef, useMemo } from 'react';
import { Object3D, InstancedMesh, SphereGeometry, CircleGeometry, Color } from 'three';
import { softShadowVert, softShadowFrag } from '../../utils/soft-shadow-material.ts';
import { BUSH_POSITIONS } from '../../data/obstacles.ts';
import { groundHeightAt } from '../../utils/terrain-height.ts';

function seededRandom(seed: number) {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export default function Bushes() {
  const bushPositions = useMemo(
    () => BUSH_POSITIONS.filter((pos) => groundHeightAt(pos[0], pos[2]) < 18),
    [],
  );

  const count = bushPositions.length;

  // 3 lobe layers (same as original) + shadow — every bush uses all 3 lobes
  const mainRef = useRef<InstancedMesh>(null!);
  const lobe2Ref = useRef<InstancedMesh>(null!);
  const lobe3Ref = useRef<InstancedMesh>(null!);
  const shadowRef = useRef<InstancedMesh>(null!);

  const [geoMain, geoLobe2, geoLobe3, geoShadow] = useMemo(() => {
    // Main dome
    const g1 = new SphereGeometry(0.55, 8, 6);
    g1.scale(1, 0.75, 1);
    g1.translate(0, 0.38, 0);

    // Side lobe (offset right-forward)
    const g2 = new SphereGeometry(0.38, 7, 5);
    g2.scale(1, 0.7, 1);
    g2.translate(0.25, 0.28, 0.15);

    // Side lobe (offset left-back)
    const g3 = new SphereGeometry(0.35, 7, 5);
    g3.scale(1, 0.65, 1);
    g3.translate(-0.22, 0.26, -0.18);

    const gs = new CircleGeometry(0.95, 14);
    gs.rotateX(-Math.PI / 2);
    gs.translate(0, 0.02, 0);

    return [g1, g2, g3, gs];
  }, []);

  useLayoutEffect(() => {
    const dummy = new Object3D();
    const color = new Color();

    bushPositions.forEach((pos, i) => {
      const seed = i * 13 + 7;
      const scale = 0.7 + seededRandom(seed) * 0.55;
      const rotY = seededRandom(seed + 1) * Math.PI * 2;
      const scaleY = scale * (0.85 + seededRandom(seed + 3) * 0.3);

      const x = pos[0];
      const z = pos[2];
      const y = groundHeightAt(x, z);

      dummy.position.set(x, y, z);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.set(scale, scaleY, scale);
      dummy.updateMatrix();

      mainRef.current.setMatrixAt(i, dummy.matrix);
      lobe2Ref.current.setMatrixAt(i, dummy.matrix);
      lobe3Ref.current.setMatrixAt(i, dummy.matrix);

      // Per-instance green variation
      const hue = 0.28 + seededRandom(seed + 4) * 0.07;
      const sat = 0.5 + seededRandom(seed + 5) * 0.15;
      const lit = 0.2 + seededRandom(seed + 6) * 0.1;
      color.setHSL(hue, sat, lit);
      mainRef.current.setColorAt(i, color);

      color.setHSL(hue - 0.02, sat + 0.05, lit - 0.02);
      lobe2Ref.current.setColorAt(i, color);

      color.setHSL(hue + 0.02, sat - 0.03, lit + 0.02);
      lobe3Ref.current.setColorAt(i, color);

      // Shadow
      dummy.scale.set(scale * 1.1, 1, scale * 1.1);
      dummy.updateMatrix();
      shadowRef.current.setMatrixAt(i, dummy.matrix);
    });

    mainRef.current.instanceMatrix.needsUpdate = true;
    lobe2Ref.current.instanceMatrix.needsUpdate = true;
    lobe3Ref.current.instanceMatrix.needsUpdate = true;
    shadowRef.current.instanceMatrix.needsUpdate = true;
    if (mainRef.current.instanceColor) mainRef.current.instanceColor.needsUpdate = true;
    if (lobe2Ref.current.instanceColor) lobe2Ref.current.instanceColor.needsUpdate = true;
    if (lobe3Ref.current.instanceColor) lobe3Ref.current.instanceColor.needsUpdate = true;
  }, [bushPositions]);

  return (
    <group>
      <instancedMesh
        ref={mainRef}
        args={[undefined, undefined, count]}
        castShadow
        receiveShadow
        geometry={geoMain}
      >
        <meshStandardMaterial color="#3a7d28" roughness={0.92} />
      </instancedMesh>

      <instancedMesh
        ref={lobe2Ref}
        args={[undefined, undefined, count]}
        castShadow
        receiveShadow
        geometry={geoLobe2}
      >
        <meshStandardMaterial color="#2e6b1e" roughness={0.92} />
      </instancedMesh>

      <instancedMesh
        ref={lobe3Ref}
        args={[undefined, undefined, count]}
        castShadow
        receiveShadow
        geometry={geoLobe3}
      >
        <meshStandardMaterial color="#358a22" roughness={0.92} />
      </instancedMesh>

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
          uniforms={{ uOpacity: { value: 0.22 } }}
        />
      </instancedMesh>
    </group>
  );
}
