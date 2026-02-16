import { useLayoutEffect, useRef, useMemo } from 'react';
import {
  Object3D,
  InstancedMesh,
  SphereGeometry,
  CircleGeometry,
  Color,
  Matrix4,
  Vector3,
  Quaternion,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { softShadowVert, softShadowFrag } from '../../utils/soft-shadow-material.ts';
import { BUSH_POSITIONS } from '../../data/obstacles.ts';
import { groundHeightAt } from '../../utils/terrain-height.ts';

function seededRandom(seed: number) {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const _up = new Vector3(0, 1, 0);
const _mat4 = new Matrix4();
const _quat = new Quaternion();
const _tiltQuat = new Quaternion();
const _pos = new Vector3();
const _dir = new Vector3();
const _tiltAxis = new Vector3();

/** Build a merged geometry of many small leaf shapes arranged on a dome. */
function createLeafLayer(
  leafCount: number,
  domeRadius: number,
  leafSize: number,
  domeSquash: number,
  seedOffset: number,
) {
  const geoms: SphereGeometry[] = [];

  for (let i = 0; i < leafCount; i++) {
    const seed = i * 17 + seedOffset;

    // Fibonacci hemisphere distribution
    const t = (i + 0.5) / leafCount;
    const phi = Math.acos(1 - t * 0.92);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;

    const px = domeRadius * Math.sin(phi) * Math.cos(theta);
    const pz = domeRadius * Math.sin(phi) * Math.sin(theta);
    const py = domeRadius * Math.cos(phi) * domeSquash;

    // Slight random jitter for natural look
    const jitter = leafSize * 0.35;
    const jx = (seededRandom(seed) - 0.5) * jitter;
    const jy = (seededRandom(seed + 1) - 0.5) * jitter * 0.5;
    const jz = (seededRandom(seed + 2) - 0.5) * jitter;

    _pos.set(px + jx, py + jy, pz + jz);

    // Direction from center outward
    _dir.copy(_pos).normalize();
    if (_dir.lengthSq() < 0.001) _dir.set(0, 1, 0);

    // Per-leaf size variation
    const size = leafSize * (0.8 + seededRandom(seed + 3) * 0.4);
    const leaf = new SphereGeometry(size, 5, 3);
    leaf.scale(1, 0.15, 0.65); // flatten into leaf-like shape

    // Orient leaf so flat face points outward from dome center
    _quat.setFromUnitVectors(_up, _dir);

    // Random tilt for organic variation
    _tiltAxis.set(
      seededRandom(seed + 4) - 0.5,
      seededRandom(seed + 5) - 0.5,
      seededRandom(seed + 6) - 0.5,
    ).normalize();
    _tiltQuat.setFromAxisAngle(_tiltAxis, (seededRandom(seed + 7) - 0.5) * 0.45);
    _quat.multiply(_tiltQuat);

    _mat4.makeRotationFromQuaternion(_quat);
    _mat4.setPosition(_pos.x, _pos.y, _pos.z);
    leaf.applyMatrix4(_mat4);

    geoms.push(leaf);
  }

  return mergeGeometries(geoms)!;
}

export default function Bushes() {
  const bushPositions = useMemo(
    () => BUSH_POSITIONS.filter((pos) => groundHeightAt(pos[0], pos[2]) < 18),
    [],
  );

  const count = bushPositions.length;

  const innerRef = useRef<InstancedMesh>(null!);
  const midRef = useRef<InstancedMesh>(null!);
  const outerRef = useRef<InstancedMesh>(null!);
  const shadowRef = useRef<InstancedMesh>(null!);

  const [geoInner, geoMid, geoOuter, geoShadow] = useMemo(() => {
    const inner = createLeafLayer(18, 0.22, 0.11, 0.65, 0);
    const mid = createLeafLayer(24, 0.3, 0.12, 0.68, 100);
    const outer = createLeafLayer(26, 0.38, 0.13, 0.7, 200);

    const shadow = new CircleGeometry(0.7, 14);
    shadow.rotateX(-Math.PI / 2);
    shadow.translate(0, 0.02, 0);

    return [inner, mid, outer, shadow];
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

      innerRef.current.setMatrixAt(i, dummy.matrix);
      midRef.current.setMatrixAt(i, dummy.matrix);
      outerRef.current.setMatrixAt(i, dummy.matrix);

      // Per-instance green variation
      const hue = 0.28 + seededRandom(seed + 4) * 0.07;
      const sat = 0.5 + seededRandom(seed + 5) * 0.15;
      const lit = 0.2 + seededRandom(seed + 6) * 0.1;

      color.setHSL(hue - 0.01, sat + 0.06, lit - 0.03);
      innerRef.current.setColorAt(i, color);

      color.setHSL(hue, sat, lit);
      midRef.current.setColorAt(i, color);

      color.setHSL(hue + 0.04, sat - 0.04, lit + 0.08);
      outerRef.current.setColorAt(i, color);

      // Shadow
      dummy.scale.set(scale * 1.1, 1, scale * 1.1);
      dummy.updateMatrix();
      shadowRef.current.setMatrixAt(i, dummy.matrix);
    });

    innerRef.current.instanceMatrix.needsUpdate = true;
    midRef.current.instanceMatrix.needsUpdate = true;
    outerRef.current.instanceMatrix.needsUpdate = true;
    shadowRef.current.instanceMatrix.needsUpdate = true;
    if (innerRef.current.instanceColor) innerRef.current.instanceColor.needsUpdate = true;
    if (midRef.current.instanceColor) midRef.current.instanceColor.needsUpdate = true;
    if (outerRef.current.instanceColor) outerRef.current.instanceColor.needsUpdate = true;
  }, [bushPositions]);

  return (
    <group>
      <instancedMesh
        ref={innerRef}
        args={[undefined, undefined, count]}
        castShadow
        receiveShadow
        geometry={geoInner}
      >
        <meshStandardMaterial color="#2a5e18" roughness={0.9} />
      </instancedMesh>

      <instancedMesh
        ref={midRef}
        args={[undefined, undefined, count]}
        castShadow
        receiveShadow
        geometry={geoMid}
      >
        <meshStandardMaterial color="#3a7d28" roughness={0.88} />
      </instancedMesh>

      <instancedMesh
        ref={outerRef}
        args={[undefined, undefined, count]}
        castShadow
        receiveShadow
        geometry={geoOuter}
      >
        <meshStandardMaterial color="#5a9a35" roughness={0.85} />
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
