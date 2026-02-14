import { useLayoutEffect, useRef, useMemo } from 'react';
import { Object3D, InstancedMesh, SphereGeometry, CircleGeometry } from 'three';
import { softShadowVert, softShadowFrag } from '../../utils/soft-shadow-material.ts';
import { BUSH_POSITIONS } from '../../data/obstacles.ts';
import { groundHeightAt } from '../../utils/terrain-height.ts';

export default function Bushes() {
  const bushPositions = useMemo(
    () => BUSH_POSITIONS.filter((pos) => groundHeightAt(pos[0], pos[2]) < 18),
    [],
  );

  const count = bushPositions.length;

  const mesh1Ref = useRef<InstancedMesh>(null!);
  const mesh2Ref = useRef<InstancedMesh>(null!);
  const mesh3Ref = useRef<InstancedMesh>(null!);
  const shadowRef = useRef<InstancedMesh>(null!);

  const [geo1, geo2, geo3, geoShadow] = useMemo(() => {
    const g1 = new SphereGeometry(0.55, 7, 6);
    g1.translate(0, 0.35, 0);

    const g2 = new SphereGeometry(0.4, 6, 5);
    g2.translate(0.25, 0.25, 0.15);

    const g3 = new SphereGeometry(0.38, 6, 5);
    g3.translate(-0.2, 0.28, -0.18);

    const gs = new CircleGeometry(0.9, 14);
    gs.rotateX(-Math.PI / 2);
    gs.translate(0, 0.02, 0);

    return [g1, g2, g3, gs];
  }, []);

  useLayoutEffect(() => {
    const dummy = new Object3D();

    bushPositions.forEach((pos, i) => {
      // Vary bush size slightly per instance
      const scale = 0.8 + (((i * 7) % 13) / 13) * 0.5;
      const rotation = ((i * 137.5) % 360) * (Math.PI / 180);

      const x = pos[0];
      const z = pos[2];
      const y = groundHeightAt(x, z);

      dummy.position.set(x, y, z);
      dummy.rotation.set(0, rotation, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();

      mesh1Ref.current.setMatrixAt(i, dummy.matrix);
      mesh2Ref.current.setMatrixAt(i, dummy.matrix);
      mesh3Ref.current.setMatrixAt(i, dummy.matrix);
      shadowRef.current.setMatrixAt(i, dummy.matrix);
    });

    mesh1Ref.current.instanceMatrix.needsUpdate = true;
    mesh2Ref.current.instanceMatrix.needsUpdate = true;
    mesh3Ref.current.instanceMatrix.needsUpdate = true;
    shadowRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <group>
      {/* Main bush sphere */}
      <instancedMesh
        ref={mesh1Ref}
        args={[undefined, undefined, count]}
        castShadow
        receiveShadow
        geometry={geo1}
      >
        <meshStandardMaterial color="#3a7d28" roughness={0.9} />
      </instancedMesh>

      {/* Secondary lobe */}
      <instancedMesh
        ref={mesh2Ref}
        args={[undefined, undefined, count]}
        castShadow
        receiveShadow
        geometry={geo2}
      >
        <meshStandardMaterial color="#2e6b1e" roughness={0.9} />
      </instancedMesh>

      {/* Third lobe */}
      <instancedMesh
        ref={mesh3Ref}
        args={[undefined, undefined, count]}
        castShadow
        receiveShadow
        geometry={geo3}
      >
        <meshStandardMaterial color="#358a22" roughness={0.9} />
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
          uniforms={{ uOpacity: { value: 0.22 } }}
        />
      </instancedMesh>
    </group>
  );
}
