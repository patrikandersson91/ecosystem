import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { SphereGeometry, Matrix4, Vector3, Quaternion } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Group, BufferGeometry } from 'three';

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

function createLeafLayer(
  leafCount: number,
  domeRadius: number,
  leafSize: number,
  domeSquash: number,
  seedOffset: number,
): BufferGeometry {
  const geoms: SphereGeometry[] = [];

  for (let i = 0; i < leafCount; i++) {
    const seed = i * 17 + seedOffset;
    const t = (i + 0.5) / leafCount;
    const phi = Math.acos(1 - t * 0.92);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;

    const px = domeRadius * Math.sin(phi) * Math.cos(theta);
    const pz = domeRadius * Math.sin(phi) * Math.sin(theta);
    const py = domeRadius * Math.cos(phi) * domeSquash;

    const jitter = leafSize * 0.35;
    const jx = (seededRandom(seed) - 0.5) * jitter;
    const jy = (seededRandom(seed + 1) - 0.5) * jitter * 0.5;
    const jz = (seededRandom(seed + 2) - 0.5) * jitter;

    _pos.set(px + jx, py + jy, pz + jz);
    _dir.copy(_pos).normalize();
    if (_dir.lengthSq() < 0.001) _dir.set(0, 1, 0);

    const size = leafSize * (0.8 + seededRandom(seed + 3) * 0.4);
    const leaf = new SphereGeometry(size, 5, 3);
    leaf.scale(1, 0.15, 0.65);

    _quat.setFromUnitVectors(_up, _dir);
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

export default function BushPreview() {
  const groupRef = useRef<Group>(null!);

  const [geoInner, geoMid, geoOuter] = useMemo(() => {
    const inner = createLeafLayer(18, 0.22, 0.11, 0.65, 0);
    const mid = createLeafLayer(24, 0.3, 0.12, 0.68, 100);
    const outer = createLeafLayer(26, 0.38, 0.13, 0.7, 200);
    return [inner, mid, outer];
  }, []);

  useFrame((_, delta) => {
    groupRef.current.rotation.y += delta * 0.3;
  });

  return (
    <group ref={groupRef}>
      <mesh castShadow geometry={geoInner}>
        <meshStandardMaterial color="#2a5e18" roughness={0.9} />
      </mesh>
      <mesh castShadow geometry={geoMid}>
        <meshStandardMaterial color="#3a7d28" roughness={0.88} />
      </mesh>
      <mesh castShadow geometry={geoOuter}>
        <meshStandardMaterial color="#5a9a35" roughness={0.85} />
      </mesh>
    </group>
  );
}
