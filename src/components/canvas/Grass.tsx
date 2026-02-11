import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, Object3D } from 'three'
import type { InstancedMesh, Matrix4 } from 'three'
import { isInWater } from '../../utils/river-path.ts'
import { groundHeightAt } from '../../utils/terrain-height.ts'
import { WORLD_SIZE, WORLD_SCALE } from '../../types/ecosystem.ts'

const BASE_GRASS_CLUMPS = 1800
const GRASS_CLUMPS = Math.floor(BASE_GRASS_CLUMPS * WORLD_SCALE)

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

export default function Grass() {
  const meshRef = useRef<InstancedMesh>(null!)

  const { matrices, colors } = useMemo(() => {
    const rng = seededRandom(1337)
    const dummy = new Object3D()
    const matrixList: Matrix4[] = []
    const colorList: Color[] = []
    const half = WORLD_SIZE * 0.98

    let placed = 0
    let attempts = 0
    while (placed < GRASS_CLUMPS && attempts < GRASS_CLUMPS * 8) {
      attempts++
      const x = (rng() * 2 - 1) * half
      const z = (rng() * 2 - 1) * half
      if (isInWater(x, z, 0.8)) continue

      const y = groundHeightAt(x, z)
      const s = 0.3 + rng() * 0.55
      dummy.position.set(x, y + s * 0.2, z)
      dummy.rotation.set(0, rng() * Math.PI * 2, (rng() - 0.5) * 0.15)
      dummy.scale.set(0.08 + rng() * 0.06, s, 0.08 + rng() * 0.06)
      dummy.updateMatrix()

      matrixList.push(dummy.matrix.clone())
      const shade = 0.82 + rng() * 0.3
      colorList.push(new Color(0.26 * shade, 0.57 * shade, 0.2 * shade))
      placed++
    }

    return { matrices: matrixList, colors: colorList }
  }, [])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    for (let i = 0; i < matrices.length; i++) {
      mesh.setMatrixAt(i, matrices[i])
      mesh.setColorAt(i, colors[i])
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true
    }
  }, [colors, matrices])

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, matrices.length]} castShadow receiveShadow>
      <coneGeometry args={[0.2, 1, 4]} />
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </instancedMesh>
  )
}
