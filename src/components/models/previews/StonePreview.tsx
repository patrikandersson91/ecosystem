import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  DodecahedronGeometry,
  IcosahedronGeometry,
  Vector3,
} from 'three';
import type { Group } from 'three';

function seededRandom(seed: number) {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

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
    v.x *= scaleX;
    v.y *= flattenY;
    v.z *= scaleZ;

    const len = v.length();
    if (len > 0.001) {
      const dir = v.clone().normalize();
      const posHash = Math.round(v.x * 1000) * 73856093 ^ Math.round(v.y * 1000) * 19349663 ^ Math.round(v.z * 1000) * 83492791;
      let offset = (seededRandom(seed + Math.abs(posHash)) - 0.5) * noiseAmount;
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

export default function StonePreview() {
  const groupRef = useRef<Group>(null!);

  const [geoBoulder, geoRock] = useMemo(() => {
    const boulder = new DodecahedronGeometry(0.4, 2);
    sculptRock(boulder, 42, 0.04, 0.55, 1.05, 0.95);
    boulder.translate(0, 0.18, 0);

    const rock = new IcosahedronGeometry(0.3, 2);
    sculptRock(rock, 77, 0.04, 0.7, 0.85, 0.9);
    rock.translate(0, 0.15, 0);

    return [boulder, rock];
  }, []);

  useFrame((_, delta) => {
    groupRef.current.rotation.y += delta * 0.3;
  });

  return (
    <group ref={groupRef}>
      {/* Boulder — large craggy rock */}
      <mesh castShadow geometry={geoBoulder} position={[-0.3, 0, 0]}>
        <meshStandardMaterial color="#6e6e6e" roughness={1} metalness={0.05} />
      </mesh>
      {/* Rock — smaller angular piece */}
      <mesh castShadow geometry={geoRock} position={[0.4, 0, 0.1]} scale={0.7}>
        <meshStandardMaterial color="#8a8a8a" roughness={1} metalness={0.06} />
      </mesh>
    </group>
  );
}
