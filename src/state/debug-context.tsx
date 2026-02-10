import { createContext, useContext, useState, useRef, useCallback } from 'react'
import type { ReactNode, MutableRefObject } from 'react'

interface DebugState {
  showIntentions: boolean
  setShowIntentions: (v: boolean) => void
  spawnBlood: (x: number, y: number, z: number) => void
  bloodSpawnRef: MutableRefObject<((x: number, y: number, z: number) => void) | null>
}

const DebugContext = createContext<DebugState>({
  showIntentions: false,
  setShowIntentions: () => {},
  spawnBlood: () => {},
  bloodSpawnRef: { current: null },
})

export function DebugProvider({ children }: { children: ReactNode }) {
  const [showIntentions, setShowIntentions] = useState(false)
  const bloodSpawnRef = useRef<((x: number, y: number, z: number) => void) | null>(null)

  const spawnBlood = useCallback((x: number, y: number, z: number) => {
    bloodSpawnRef.current?.(x, y, z)
  }, [])

  return (
    <DebugContext value={{ showIntentions, setShowIntentions, spawnBlood, bloodSpawnRef }}>
      {children}
    </DebugContext>
  )
}

export function useDebug(): DebugState {
  return useContext(DebugContext)
}
