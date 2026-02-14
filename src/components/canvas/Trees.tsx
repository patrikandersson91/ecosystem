import { useLayoutEffect, useMemo, useRef } from 'react';
import { Object3D, InstancedMesh, ShaderMaterial } from 'three';
import { softShadowVert, softShadowFrag } from '../../utils/soft-shadow-material.ts';
import {
  CORNER_FOREST_TREE_POSITIONS,
  DENSE_FOREST_TREE_POSITIONS,
  FOREST_EDGE_TREE_POSITIONS,
  RANDOM_GROVE_POSITIONS,
  TREE_POSITIONS,
} from '../../data/obstacles.ts';
import { groundHeightAt } from '../../utils/terrain-height.ts';
import { isInWater } from '../../utils/river-path.ts';

export default function Trees() {
  const TREE_WATER_CLEARANCE = 3;

  const allTrees = useMemo(
    () =>
      [
        ...TREE_POSITIONS,
        ...DENSE_FOREST_TREE_POSITIONS,
        ...FOREST_EDGE_TREE_POSITIONS,
        ...CORNER_FOREST_TREE_POSITIONS,
        ...RANDOM_GROVE_POSITIONS,
      ]
        .filter((pos) => !isInWater(pos[0], pos[2], TREE_WATER_CLEARANCE))
        .filter((pos) => groundHeightAt(pos[0], pos[2]) < 17),
    [],
  );

  const count = allTrees.length;
  const trunkMeshRef = useRef<InstancedMesh>(null!);
  const canopyMeshRef = useRef<InstancedMesh>(null!);
  const shadowMeshRef = useRef<InstancedMesh>(null!);

  useLayoutEffect(() => {
    const dummy = new Object3D();

    allTrees.forEach((pos, i) => {
      const x = pos[0];
      const z = pos[2];
      const y = groundHeightAt(x, z);

      // Trunk
      dummy.position.set(x, y + 1, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      trunkMeshRef.current.setMatrixAt(i, dummy.matrix);

      // Canopy
      dummy.position.set(x, y + 3.2, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      canopyMeshRef.current.setMatrixAt(i, dummy.matrix);

      // Shadow
      dummy.position.set(x, y + 0.02, z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      shadowMeshRef.current.setMatrixAt(i, dummy.matrix);
    });

    trunkMeshRef.current.instanceMatrix.needsUpdate = true;
    canopyMeshRef.current.instanceMatrix.needsUpdate = true;
    shadowMeshRef.current.instanceMatrix.needsUpdate = true;
  }, [allTrees]);

  return (
    <group>
      <instancedMesh
        ref={trunkMeshRef}
        args={[undefined, undefined, count]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.15, 0.25, 2, 6]} />
        <meshStandardMaterial color="#6b3e26" />
      </instancedMesh>
      <instancedMesh
        ref={canopyMeshRef}
        args={[undefined, undefined, count]}
        castShadow
        receiveShadow
      >
        <coneGeometry args={[1.3, 2.8, 6]} />
        <meshStandardMaterial color="#2d6b1e" />
      </instancedMesh>
      <instancedMesh ref={shadowMeshRef} args={[undefined, undefined, count]}>
        <circleGeometry args={[1.8, 16]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          vertexShader={softShadowVert}
          fragmentShader={softShadowFrag}
          uniforms={{ uOpacity: { value: 0.28 } }}
        />
      </instancedMesh>
    </group>
  );
}
