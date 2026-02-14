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

function createDaisyPetals() {
  const geoms: BufferGeometry[] = []
  const PETAL_ANGLES = [0, 1, 2, 3, 4].map(i => (i / 5) * Math.PI * 2)
  PETAL_ANGLES.forEach(angle => {
    const g = new SphereGeometry(0.07, 6, 4)
    g.rotateX(0.3 * Math.cos(angle))
    g.rotateZ(0.3 * Math.sin(angle))
    g.translate(Math.cos(angle) * 0.08, 0.42, Math.sin(angle) * 0.08)
    geoms.push(g)
  })
  return mergeGeometries(geoms)
}

function createTulipPetals() {
  const geoms: BufferGeometry[] = []
  const angles = [0, 1, 2].map(i => (i / 3) * Math.PI * 2)
  angles.forEach(angle => {
    const g = new ConeGeometry(0.06, 0.18, 6, 1, true)
    g.rotateX(0.1)
    g.rotateY(angle)
    g.rotateZ(0.15)
    g.translate(Math.cos(angle) * 0.05, 0.42, Math.sin(angle) * 0.05)
    geoms.push(g)
  })
  return mergeGeometries(geoms)
}

function createBellBalls() {
  const geoms: BufferGeometry[] = []
  const angles = [0, 1, 2].map(i => (i / 3) * Math.PI * 2)
  angles.forEach(angle => {
    const g = new SphereGeometry(0.02, 5, 4)
    g.translate(Math.cos(angle) * 0.03, 0.32, Math.sin(angle) * 0.03)
    geoms.push(g)
  })
  return mergeGeometries(geoms)
}

function createBush1Foliage() {
  const geoms: BufferGeometry[] = []
  const main = new SphereGeometry(0.15, 6, 5)
  main.scale(1, 0.6, 1)
  main.translate(0, 0.08, 0)
  geoms.push(main)
  
  const angles = [0, 2, 4].map(i => (i / 3) * Math.PI * 2)
  angles.forEach(a => {
      const g = new SphereGeometry(0.1, 5, 4)
      g.translate(Math.cos(a)*0.1, 0.06, Math.sin(a)*0.1)
      geoms.push(g)
  })
  return mergeGeometries(geoms)
}

function createBush1Flowers() {
  const geoms: BufferGeometry[] = []
  const count = 5
  for(let i=0; i<count; i++) {
     const angle = (i/count) * Math.PI * 2
     const r = 0.09
     const g = new SphereGeometry(0.045, 5, 4)
     g.translate(Math.cos(angle)*r, 0.16 + Math.random()*0.02, Math.sin(angle)*r)
     geoms.push(g)
  }
  const center = new SphereGeometry(0.05, 5, 4)
  center.translate(0, 0.19, 0)
  geoms.push(center)
  return mergeGeometries(geoms)
}

function createBush2Foliage() {
   const geoms: BufferGeometry[] = []
   const bladeCount = 6
   for(let i=0; i<bladeCount; i++) {
      const angle = (i/bladeCount) * Math.PI * 2
      const g = new ConeGeometry(0.025, 0.35, 4)
      g.translate(0, 0.175, 0)
      const tilt = 0.4
      const tx = Math.cos(angle) * tilt
      const tz = Math.sin(angle) * tilt
      g.rotateX(tx)
      g.rotateZ(tz)
      g.translate(Math.cos(angle)*0.03, 0, Math.sin(angle)*0.03)
      geoms.push(g)
   }
   // Base
   const base = new SphereGeometry(0.08, 5, 4)
   base.scale(1, 0.5, 1)
   base.translate(0, 0.02, 0)
   geoms.push(base)
   return mergeGeometries(geoms)
}

function createBush2Flowers() {
   const geoms: BufferGeometry[] = []
   const count = 6
   for(let i=0; i<count; i++) {
      const angle = (i/count) * Math.PI * 2
      const g = new ConeGeometry(0.03, 0.12, 4)
      g.rotateX(Math.PI) // Point down? No point up like a spike flower
      // Actually standard cone points up.
      
      const tilt = 0.4
      const tx = Math.cos(angle) * tilt
      const tz = Math.sin(angle) * tilt
      
      g.translate(0, 0.35, 0) // Tip of foliage roughly
      g.rotateX(tx)
      g.rotateZ(tz)
      g.translate(Math.cos(angle)*0.03, 0, Math.sin(angle)*0.03)
      geoms.push(g)
   }
   return mergeGeometries(geoms)
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
    // Daisy Petals
    const daisyP = createDaisyPetals()
    
    // Daisy Center
    const daisyC = new SphereGeometry(0.055, 6, 6)
    daisyC.translate(0, 0.43, 0)

    // Tulip Petals
    const tulipP = createTulipPetals()

    // Tulip Center
    const tulipC = new SphereGeometry(0.04, 6, 6)
    tulipC.translate(0, 0.37, 0)

    // Bell Body
    const bellB = new ConeGeometry(0.09, 0.16, 7)
    bellB.rotateX(Math.PI)
    bellB.translate(0, 0.39, 0)

    // Bell Center
    const bellC = new SphereGeometry(0.03, 6, 6)
    bellC.translate(0, 0.3, 0)

    // Bell Balls
    const bellBalls = createBellBalls()

    // Bush 1
    const b1Fol = createBush1Foliage()
    const b1Flow = createBush1Flowers()

    // Bush 2
    const b2Fol = createBush2Foliage()
    const b2Flow = createBush2Flowers()

    // Stem
    const stem = new CylinderGeometry(0.02, 0.025, 0.4, 4)
    stem.translate(0, 0.2, 0)

    // Leaf
    const leaf = new SphereGeometry(0.06, 4, 3)
    leaf.rotateZ(0.6)
    leaf.translate(0.06, 0.15, 0)

    return [
      daisyP, daisyC, 
      tulipP, tulipC, 
      bellB, bellC, bellBalls,
      b1Fol, b1Flow,
      b2Fol, b2Flow,
      stem, leaf
    ]
  }, [])

  // Refs
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

    // Grouping
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
    
    // Standard flowers use stems/leaves
    const standardFlowers = [...daisies, ...tulips, ...bells]
    
    const updateMesh = <T extends FlowerState>(ref: MutableRefObject<InstancedMesh>, items: T[], getColor: (item: T) => string) => {
       if (!ref.current) return
       ref.current.count = items.length
       
       items.forEach((item, i) => {
         const x = item.position[0]
         const z = item.position[2]
         const y = groundHeightAt(x, z)
         
         dummy.position.set(x, y, z)
         dummy.rotation.set(0, 0, 0)
         dummy.scale.set(1, 1, 1)
         dummy.updateMatrix()
         
         ref.current.setMatrixAt(i, dummy.matrix)
         color.set(getColor(item))
         ref.current.setColorAt(i, color)
       })
       ref.current.instanceMatrix.needsUpdate = true
       if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
    }

    // Update Stems & Leaves (for Standard flowers only)
    updateMesh(stemsRef, standardFlowers, () => '#3d8b37')
    updateMesh(leavesRef, standardFlowers, () => '#4caf50')

    // Daisies
    updateMesh(daisyPetalsRef, daisies, (item) => PETAL_COLORS[item.hash % PETAL_COLORS.length])
    updateMesh(daisyCenterRef, daisies, (item) => CENTER_COLORS[item.hash % CENTER_COLORS.length])

    // Tulips
    updateMesh(tulipPetalsRef, tulips, (item) => PETAL_COLORS[item.hash % PETAL_COLORS.length])
    updateMesh(tulipCenterRef, tulips, (item) => CENTER_COLORS[item.hash % CENTER_COLORS.length])

    // Bells
    updateMesh(bellBodyRef, bells, (item) => PETAL_COLORS[item.hash % PETAL_COLORS.length])
    updateMesh(bellCenterRef, bells, (item) => CENTER_COLORS[item.hash % CENTER_COLORS.length])
    updateMesh(bellBallsRef, bells, (item) => CENTER_COLORS[item.hash % CENTER_COLORS.length])

    // Bush 1 (Mound)
    updateMesh(bush1FoliageRef, bush1, () => '#2e7d32')
    updateMesh(bush1FlowerRef, bush1, (item) => PETAL_COLORS[item.hash % PETAL_COLORS.length])

    // Bush 2 (Spike)
    updateMesh(bush2FoliageRef, bush2, () => '#388e3c')
    updateMesh(bush2FlowerRef, bush2, (item) => CENTER_COLORS[item.hash % CENTER_COLORS.length])

  }, [aliveFlowers])

  const MAX_FLOWERS = 2000

  if (flowers.length === 0) return null

  return (
    <group>
       <instancedMesh ref={stemsRef} args={[undefined, undefined, MAX_FLOWERS]} receiveShadow geometry={geoStem}>
         <meshStandardMaterial />
       </instancedMesh>
       <instancedMesh ref={leavesRef} args={[undefined, undefined, MAX_FLOWERS]} receiveShadow geometry={geoLeaf}>
         <meshStandardMaterial />
       </instancedMesh>

       <instancedMesh ref={daisyPetalsRef} args={[undefined, undefined, MAX_FLOWERS]} receiveShadow geometry={geoDaisyPetals}>
         <meshStandardMaterial />
       </instancedMesh>
       <instancedMesh ref={daisyCenterRef} args={[undefined, undefined, MAX_FLOWERS]} receiveShadow geometry={geoDaisyCenter}>
         <meshStandardMaterial />
       </instancedMesh>

       <instancedMesh ref={tulipPetalsRef} args={[undefined, undefined, MAX_FLOWERS]} receiveShadow geometry={geoTulipPetals}>
         <meshStandardMaterial side={DoubleSide} />
       </instancedMesh>
       <instancedMesh ref={tulipCenterRef} args={[undefined, undefined, MAX_FLOWERS]} receiveShadow geometry={geoTulipCenter}>
         <meshStandardMaterial />
       </instancedMesh>

       <instancedMesh ref={bellBodyRef} args={[undefined, undefined, MAX_FLOWERS]} receiveShadow geometry={geoBellBody}>
         <meshStandardMaterial />
       </instancedMesh>
       <instancedMesh ref={bellCenterRef} args={[undefined, undefined, MAX_FLOWERS]} receiveShadow geometry={geoBellCenter}>
         <meshStandardMaterial />
       </instancedMesh>
       <instancedMesh ref={bellBallsRef} args={[undefined, undefined, MAX_FLOWERS]} receiveShadow geometry={geoBellBalls}>
         <meshStandardMaterial />
       </instancedMesh>

       <instancedMesh ref={bush1FoliageRef} args={[undefined, undefined, MAX_FLOWERS]} castShadow receiveShadow geometry={geoBush1Foliage}>
         <meshStandardMaterial />
       </instancedMesh>
       <instancedMesh ref={bush1FlowerRef} args={[undefined, undefined, MAX_FLOWERS]} receiveShadow geometry={geoBush1Flowers}>
         <meshStandardMaterial />
       </instancedMesh>

       <instancedMesh ref={bush2FoliageRef} args={[undefined, undefined, MAX_FLOWERS]} castShadow receiveShadow geometry={geoBush2Foliage}>
         <meshStandardMaterial />
       </instancedMesh>
       <instancedMesh ref={bush2FlowerRef} args={[undefined, undefined, MAX_FLOWERS]} receiveShadow geometry={geoBush2Flowers}>
         <meshStandardMaterial />
       </instancedMesh>
    </group>
  )
}
