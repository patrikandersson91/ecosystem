import { useMemo, useLayoutEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import {
  Object3D,
  InstancedMesh,
  Color,
  BufferGeometry,
  SphereGeometry,
  CylinderGeometry,
  ConeGeometry,
  DoubleSide,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useEcosystem } from '../../state/ecosystem-context.tsx'
import { groundHeightAt } from '../../utils/terrain-height.ts'
import type { FlowerState } from '../../types/ecosystem.ts'

const PETAL_COLORS = ['#e84393', '#fd79a8', '#fab1a0', '#ffeaa7', '#dfe6e9']
const CENTER_COLORS = ['#fdcb6e', '#f39c12', '#e17055', '#d63031', '#6c5ce7']

function stableHash(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/* ---------- Daisy: ring of flat oval petals around a round center ---------- */
function createDaisyPetals(): BufferGeometry {
  const geoms: BufferGeometry[] = []
  const petalCount = 7
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2
    const g = new SphereGeometry(0.065, 6, 4)
    g.scale(0.6, 0.3, 1.4) // flat oval petal
    g.rotateY(angle)
    g.translate(Math.cos(angle) * 0.1, 0.42, Math.sin(angle) * 0.1)
    geoms.push(g)
  }
  return mergeGeometries(geoms)!
}

/* ---------- Tulip: cupped petals forming a goblet shape ---------- */
function createTulipPetals(): BufferGeometry {
  const geoms: BufferGeometry[] = []
  const petalCount = 5
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2
    const g = new SphereGeometry(0.065, 6, 5)
    g.scale(0.5, 1.2, 0.7) // tall narrow petal
    // Tilt outward slightly for cup shape
    g.translate(0, 0, 0.04)
    g.rotateY(angle)
    g.translate(Math.cos(angle) * 0.035, 0.4, Math.sin(angle) * 0.035)
    geoms.push(g)
  }
  return mergeGeometries(geoms)!
}

/* ---------- Bluebell: drooping bell with small stamens ---------- */
function createBellBody(): BufferGeometry {
  const g = new ConeGeometry(0.1, 0.16, 8)
  g.rotateX(Math.PI) // bell faces down
  g.translate(0, 0.36, 0)
  return g
}

function createBellBalls(): BufferGeometry {
  const geoms: BufferGeometry[] = []
  const count = 4
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2
    const g = new SphereGeometry(0.015, 4, 3)
    g.translate(Math.cos(angle) * 0.035, 0.28, Math.sin(angle) * 0.035)
    geoms.push(g)
  }
  return mergeGeometries(geoms)!
}

/* ---------- Flower bush type 1: mound with tiny blossom dots ---------- */
function createBush1Foliage(): BufferGeometry {
  const geoms: BufferGeometry[] = []
  const main = new SphereGeometry(0.15, 7, 5)
  main.scale(1, 0.6, 1)
  main.translate(0, 0.08, 0)
  geoms.push(main)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    const g = new SphereGeometry(0.1, 6, 4)
    g.scale(1, 0.65, 1)
    g.translate(Math.cos(a) * 0.1, 0.06, Math.sin(a) * 0.1)
    geoms.push(g)
  }
  return mergeGeometries(geoms)!
}

function createBush1Flowers(): BufferGeometry {
  const geoms: BufferGeometry[] = []
  const count = 6
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2
    const r = 0.08 + (i % 2) * 0.03
    const g = new SphereGeometry(0.035, 5, 4)
    g.translate(Math.cos(angle) * r, 0.15 + (i % 2) * 0.02, Math.sin(angle) * r)
    geoms.push(g)
  }
  const center = new SphereGeometry(0.04, 5, 4)
  center.translate(0, 0.17, 0)
  geoms.push(center)
  return mergeGeometries(geoms)!
}

/* ---------- Flower bush type 2: spiky lavender-like stalks ---------- */
function createBush2Foliage(): BufferGeometry {
  const geoms: BufferGeometry[] = []
  const bladeCount = 7
  for (let i = 0; i < bladeCount; i++) {
    const angle = (i / bladeCount) * Math.PI * 2
    const g = new ConeGeometry(0.02, 0.3, 4)
    g.translate(0, 0.15, 0)
    const tilt = 0.35
    g.rotateX(Math.cos(angle) * tilt)
    g.rotateZ(Math.sin(angle) * tilt)
    g.translate(Math.cos(angle) * 0.03, 0, Math.sin(angle) * 0.03)
    geoms.push(g)
  }
  const base = new SphereGeometry(0.08, 6, 4)
  base.scale(1, 0.5, 1)
  base.translate(0, 0.02, 0)
  geoms.push(base)
  return mergeGeometries(geoms)!
}

function createBush2Flowers(): BufferGeometry {
  const geoms: BufferGeometry[] = []
  const count = 7
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2
    // Small bud at tip of each stalk
    const tilt = 0.35
    const g = new SphereGeometry(0.025, 4, 3)
    g.translate(0, 0.32, 0)
    g.rotateX(Math.cos(angle) * tilt)
    g.rotateZ(Math.sin(angle) * tilt)
    g.translate(Math.cos(angle) * 0.03, 0, Math.sin(angle) * 0.03)
    geoms.push(g)
  }
  return mergeGeometries(geoms)!
}

type FlowerItem = FlowerState & { hash: number }

export default function Flowers() {
  const { flowers } = useEcosystem()

  const [
    geoDaisyPetals, geoDaisyCenter,
    geoTulipPetals, geoTulipCenter,
    geoBellBody, geoBellCenter, geoBellBalls,
    geoBush1Foliage, geoBush1Flowers,
    geoBush2Foliage, geoBush2Flowers,
    geoStem, geoLeaf
  ] = useMemo(() => {
    const daisyP = createDaisyPetals()

    const daisyC = new SphereGeometry(0.05, 6, 6)
    daisyC.translate(0, 0.43, 0)

    const tulipP = createTulipPetals()

    const tulipC = new SphereGeometry(0.03, 6, 6)
    tulipC.translate(0, 0.42, 0)

    const bellB = createBellBody()

    const bellC = new SphereGeometry(0.025, 6, 6)
    bellC.translate(0, 0.28, 0)

    const bellBalls = createBellBalls()

    const b1Fol = createBush1Foliage()
    const b1Flow = createBush1Flowers()

    const b2Fol = createBush2Foliage()
    const b2Flow = createBush2Flowers()

    // Stem — slightly curved via asymmetric radii
    const stem = new CylinderGeometry(0.015, 0.022, 0.4, 5)
    stem.translate(0, 0.2, 0)

    // Leaf — elongated ellipsoid
    const leaf = new SphereGeometry(0.055, 5, 3)
    leaf.scale(0.5, 0.3, 1.2)
    leaf.rotateZ(0.5)
    leaf.translate(0.06, 0.14, 0)

    return [
      daisyP, daisyC,
      tulipP, tulipC,
      bellB, bellC, bellBalls,
      b1Fol, b1Flow,
      b2Fol, b2Flow,
      stem, leaf
    ]
  }, [])

  const stemsRef = useRef<InstancedMesh>(null!)
  const leavesRef = useRef<InstancedMesh>(null!)

  const daisyPetalsRef = useRef<InstancedMesh>(null!)
  const daisyCenterRef = useRef<InstancedMesh>(null!)

  const tulipPetalsRef = useRef<InstancedMesh>(null!)
  const tulipCenterRef = useRef<InstancedMesh>(null!)

  const bellBodyRef = useRef<InstancedMesh>(null!)
  const bellCenterRef = useRef<InstancedMesh>(null!)
  const bellBallsRef = useRef<InstancedMesh>(null!)

  const bush1FoliageRef = useRef<InstancedMesh>(null!)
  const bush1FlowerRef = useRef<InstancedMesh>(null!)

  const bush2FoliageRef = useRef<InstancedMesh>(null!)
  const bush2FlowerRef = useRef<InstancedMesh>(null!)

  const aliveFlowers = useMemo(() => flowers.filter(f => f.alive), [flowers])

  useLayoutEffect(() => {
    const dummy = new Object3D()
    const color = new Color()

    const daisies: FlowerItem[] = []
    const tulips: FlowerItem[] = []
    const bells: FlowerItem[] = []
    const bush1: FlowerItem[] = []
    const bush2: FlowerItem[] = []

    aliveFlowers.forEach((f) => {
      const h = stableHash(f.id)
      const model = h % 5
      const item = { ...f, hash: h }
      if (model === 0) daisies.push(item)
      else if (model === 1) tulips.push(item)
      else if (model === 2) bells.push(item)
      else if (model === 3) bush1.push(item)
      else bush2.push(item)
    })

    const standardFlowers = [...daisies, ...tulips, ...bells]

    const updateMesh = <T extends FlowerState & { hash: number }>(
      ref: MutableRefObject<InstancedMesh>,
      items: T[],
      getColor: (item: T) => string,
      getScale?: (item: T) => number,
    ) => {
      if (!ref.current) return
      ref.current.count = items.length

      items.forEach((item, i) => {
        const x = item.position[0]
        const z = item.position[2]
        const y = groundHeightAt(x, z)
        const s = getScale ? getScale(item) : 1
        const rotY = (item.hash * 137.5 % 360) * (Math.PI / 180)

        dummy.position.set(x, y, z)
        dummy.rotation.set(0, rotY, 0)
        dummy.scale.set(s, s, s)
        dummy.updateMatrix()

        ref.current.setMatrixAt(i, dummy.matrix)
        color.set(getColor(item))
        ref.current.setColorAt(i, color)
      })
      ref.current.instanceMatrix.needsUpdate = true
      if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
    }

    const flowerScale = (item: FlowerItem) => 0.85 + (item.hash % 7) / 7 * 0.35

    // Stems & Leaves (for standard flowers)
    updateMesh(stemsRef, standardFlowers, () => '#3d8b37', flowerScale)
    updateMesh(leavesRef, standardFlowers, () => '#4caf50', flowerScale)

    // Daisies
    updateMesh(daisyPetalsRef, daisies, (item) => PETAL_COLORS[item.hash % PETAL_COLORS.length], flowerScale)
    updateMesh(daisyCenterRef, daisies, (item) => CENTER_COLORS[item.hash % CENTER_COLORS.length], flowerScale)

    // Tulips
    updateMesh(tulipPetalsRef, tulips, (item) => PETAL_COLORS[item.hash % PETAL_COLORS.length], flowerScale)
    updateMesh(tulipCenterRef, tulips, (item) => CENTER_COLORS[item.hash % CENTER_COLORS.length], flowerScale)

    // Bells
    updateMesh(bellBodyRef, bells, (item) => PETAL_COLORS[item.hash % PETAL_COLORS.length], flowerScale)
    updateMesh(bellCenterRef, bells, (item) => CENTER_COLORS[item.hash % CENTER_COLORS.length], flowerScale)
    updateMesh(bellBallsRef, bells, (item) => CENTER_COLORS[item.hash % CENTER_COLORS.length], flowerScale)

    // Bush 1 (Mound)
    const bushScale = (item: FlowerItem) => 0.9 + (item.hash % 5) / 5 * 0.3
    updateMesh(bush1FoliageRef, bush1, () => '#2e7d32', bushScale)
    updateMesh(bush1FlowerRef, bush1, (item) => PETAL_COLORS[item.hash % PETAL_COLORS.length], bushScale)

    // Bush 2 (Spike)
    updateMesh(bush2FoliageRef, bush2, () => '#388e3c', bushScale)
    updateMesh(bush2FlowerRef, bush2, (item) => CENTER_COLORS[item.hash % CENTER_COLORS.length], bushScale)

  }, [aliveFlowers])

  const MAX_FLOWERS = 2000

  if (flowers.length === 0) return null

  return (
    <group>
      <instancedMesh ref={stemsRef} args={[undefined, undefined, MAX_FLOWERS]} receiveShadow geometry={geoStem}>
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={leavesRef} args={[undefined, undefined, MAX_FLOWERS]} receiveShadow geometry={geoLeaf}>
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>

      <instancedMesh ref={daisyPetalsRef} args={[undefined, undefined, MAX_FLOWERS]} receiveShadow geometry={geoDaisyPetals}>
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={daisyCenterRef} args={[undefined, undefined, MAX_FLOWERS]} receiveShadow geometry={geoDaisyCenter}>
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>

      <instancedMesh ref={tulipPetalsRef} args={[undefined, undefined, MAX_FLOWERS]} receiveShadow geometry={geoTulipPetals}>
        <meshStandardMaterial roughness={0.65} side={DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={tulipCenterRef} args={[undefined, undefined, MAX_FLOWERS]} receiveShadow geometry={geoTulipCenter}>
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>

      <instancedMesh ref={bellBodyRef} args={[undefined, undefined, MAX_FLOWERS]} receiveShadow geometry={geoBellBody}>
        <meshStandardMaterial roughness={0.7} side={DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={bellCenterRef} args={[undefined, undefined, MAX_FLOWERS]} receiveShadow geometry={geoBellCenter}>
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={bellBallsRef} args={[undefined, undefined, MAX_FLOWERS]} receiveShadow geometry={geoBellBalls}>
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>

      <instancedMesh ref={bush1FoliageRef} args={[undefined, undefined, MAX_FLOWERS]} castShadow receiveShadow geometry={geoBush1Foliage}>
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={bush1FlowerRef} args={[undefined, undefined, MAX_FLOWERS]} receiveShadow geometry={geoBush1Flowers}>
        <meshStandardMaterial roughness={0.65} />
      </instancedMesh>

      <instancedMesh ref={bush2FoliageRef} args={[undefined, undefined, MAX_FLOWERS]} castShadow receiveShadow geometry={geoBush2Foliage}>
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={bush2FlowerRef} args={[undefined, undefined, MAX_FLOWERS]} receiveShadow geometry={geoBush2Flowers}>
        <meshStandardMaterial roughness={0.65} />
      </instancedMesh>
    </group>
  )
}
