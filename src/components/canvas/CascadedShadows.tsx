import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, MeshStandardMaterial } from 'three'
import { CSM } from 'three/examples/jsm/csm/CSM.js'
import { useWeatherRefs } from '../../state/weather-refs.tsx'
import { WORLD_SIZE } from '../../types/ecosystem.ts'

export default function CascadedShadows() {
  const { scene, camera } = useThree()
  const weatherRefs = useWeatherRefs()
  const csmRef = useRef<CSM | null>(null)
  const lightDir = useRef(new Vector3(0, -1, 0))

  useEffect(() => {
    const csm = new CSM({
      camera,
      parent: scene,
      cascades: 3,
      maxFar: WORLD_SIZE * 3,
      shadowMapSize: 4096,
      shadowBias: -0.0002,
      lightDirection: new Vector3(-0.2, -1, -0.3).normalize(),
      lightIntensity: 1.5,
      lightNear: 1,
      lightFar: WORLD_SIZE * 5,
      lightMargin: 50,
      mode: 'practical',
    })

    csm.fade = true

    // Traverse scene and setup all MeshStandardMaterials for CSM
    scene.traverse((obj: any) => {
      if (obj.material && obj.material instanceof MeshStandardMaterial) {
        csm.setupMaterial(obj.material)
      }
    })

    csmRef.current = csm

    return () => {
      csm.dispose()
      csmRef.current = null
    }
  }, [camera, scene])

  useFrame(() => {
    const csm = csmRef.current
    if (!csm) return

    // Update light direction from sun position
    const sunPos = weatherRefs.sunPosition.current
    // CSM lightDirection points FROM light TO scene (opposite of sun position)
    lightDir.current.copy(sunPos).negate().normalize()
    csm.lightDirection.copy(lightDir.current)

    // Update cascade light colors and intensity from weather refs
    const sunColor = weatherRefs.sunColor.current
    for (const light of csm.lights) {
      light.color.copy(sunColor)
    }

    // Setup any new materials that were added to the scene
    scene.traverse((obj: any) => {
      if (
        obj.material &&
        obj.material instanceof MeshStandardMaterial &&
        !obj.material.defines?.USE_CSM
      ) {
        csm.setupMaterial(obj.material)
      }
    })

    csm.update()
  })

  return null
}
