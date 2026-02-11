import { useLayoutEffect, useRef, useMemo } from 'react'
import { Object3D, InstancedMesh, DodecahedronGeometry, CircleGeometry, Color } from 'three'
import { STONE_POSITIONS } from '../../data/obstacles.ts'
import { groundHeightAt } from '../../utils/terrain-height.ts'

export default function Stones() {
  const stonePositions = useMemo(() => 
    STONE_POSITIONS.filter(pos => groundHeightAt(pos[0], pos[2]) < 35), 
  [])
  const count = stonePositions.length
  
  const mainRef = useRef<InstancedMesh>(null!)
  const accentRef = useRef<InstancedMesh>(null!)
  const shadowRef = useRef<InstancedMesh>(null!)

  const [geoMain, geoAccent, geoShadow] = useMemo(() => {
    const g1 = new DodecahedronGeometry(0.4, 0)
    g1.scale(1, 0.6, 0.85)
    g1.translate(0, 0.18, 0)
    
    const g2 = new DodecahedronGeometry(0.2, 0)
    g2.scale(1, 0.55, 0.9)
    g2.translate(0.3, 0.1, 0.15)
    
    const gs = new CircleGeometry(0.45, 8)
    gs.rotateX(-Math.PI / 2)
    gs.translate(0, 0.02, 0)
    
    return [g1, g2, gs]
  }, [])

  useLayoutEffect(() => {
    const dummy = new Object3D()
    const color = new Color()
    
    stonePositions.forEach((pos, i) => {
      const scale = 0.6 + (((i * 11) % 17) / 17) * 0.6
      const rotation = ((i * 97.3) % 360) * (Math.PI / 180)
      const colorHex = i % 3 === 0 ? '#8a8a8a' : i % 3 === 1 ? '#6e6e6e' : '#9c9590'
      color.set(colorHex)
      
      const x = pos[0]
      const z = pos[2]
      const y = groundHeightAt(x, z)
      
      // Main body
      dummy.position.set(x, y, z)
      dummy.rotation.set(0, rotation, 0)
      dummy.scale.set(scale, scale, scale)
      dummy.updateMatrix()
      
      mainRef.current.setMatrixAt(i, dummy.matrix)
      mainRef.current.setColorAt(i, color)
      
      // Shadow (same matrix)
      shadowRef.current.setMatrixAt(i, dummy.matrix)
      
      // Accent stone
      if (scale > 0.8) {
        accentRef.current.setMatrixAt(i, dummy.matrix)
      } else {
        dummy.scale.set(0, 0, 0)
        dummy.updateMatrix()
        accentRef.current.setMatrixAt(i, dummy.matrix)
      }
      accentRef.current.setColorAt(i, color)
    })
    
    mainRef.current.instanceMatrix.needsUpdate = true
    if (mainRef.current.instanceColor) mainRef.current.instanceColor.needsUpdate = true
    
    accentRef.current.instanceMatrix.needsUpdate = true
    if (accentRef.current.instanceColor) accentRef.current.instanceColor.needsUpdate = true
    
    shadowRef.current.instanceMatrix.needsUpdate = true
  }, [])

  return (
    <group>
      {/* Main stone body */}
      <instancedMesh ref={mainRef} args={[undefined, undefined, count]} castShadow receiveShadow geometry={geoMain}>
        <meshStandardMaterial roughness={1} metalness={0.05} />
      </instancedMesh>
      
      {/* Smaller accent stone */}
      <instancedMesh ref={accentRef} args={[undefined, undefined, count]} castShadow receiveShadow geometry={geoAccent}>
        <meshStandardMaterial roughness={1} metalness={0.05} />
      </instancedMesh>
      
      {/* Shadow blob on ground */}
      <instancedMesh ref={shadowRef} args={[undefined, undefined, count]} geometry={geoShadow}>
        <meshBasicMaterial color="#000000" transparent opacity={0.15} />
      </instancedMesh>
    </group>
  )
}
