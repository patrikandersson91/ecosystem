import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

interface DebugState {
  showIntentions: boolean
  setShowIntentions: (v: boolean) => void
}

const DebugContext = createContext<DebugState>({
  showIntentions: false,
  setShowIntentions: () => {},
})

export function DebugProvider({ children }: { children: ReactNode }) {
  const [showIntentions, setShowIntentions] = useState(false)
  return (
    <DebugContext value={{ showIntentions, setShowIntentions }}>
      {children}
    </DebugContext>
  )
}

export function useDebug(): DebugState {
  return useContext(DebugContext)
}
