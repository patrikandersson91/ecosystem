import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { EntityType } from '../types/ecosystem.ts'

export interface FollowTarget {
  id: string
  type: EntityType
}

interface FollowContextValue {
  followTarget: FollowTarget | null
  setFollowTarget: (target: FollowTarget | null) => void
  stopFollowing: () => void
}

const FollowContext = createContext<FollowContextValue>({
  followTarget: null,
  setFollowTarget: () => {},
  stopFollowing: () => {},
})

export function FollowProvider({ children }: { children: ReactNode }) {
  const [followTarget, setFollowTarget] = useState<FollowTarget | null>(null)

  const stopFollowing = useCallback(() => {
    setFollowTarget(null)
  }, [])

  const value = useMemo(
    () => ({
      followTarget,
      setFollowTarget,
      stopFollowing,
    }),
    [followTarget, stopFollowing],
  )

  return <FollowContext value={value}>{children}</FollowContext>
}

export function useFollow() {
  return useContext(FollowContext)
}
