import { useRef } from 'react'
import { HUNGER_RATE, THIRST_RATE } from '../types/ecosystem.ts'
import { useEcosystemDispatch } from '../state/ecosystem-context.tsx'

interface UseEntityNeedsOptions {
  id: string
  entityType: 'rabbit' | 'fox'
  hunger: number
  thirst: number
  hungerRate?: number
}

export function useEntityNeeds({ id, entityType, hunger, thirst, hungerRate = HUNGER_RATE }: UseEntityNeedsOptions) {
  const dispatch = useEcosystemDispatch()
  const hungerRef = useRef(hunger)
  const thirstRef = useRef(thirst)
  const syncTimer = useRef(0)

  // Keep refs in sync when context state updates
  hungerRef.current = hunger
  thirstRef.current = thirst

  function tick(delta: number): { hunger: number; thirst: number; dead: boolean } {
    hungerRef.current = Math.max(0, hungerRef.current - hungerRate * delta)
    thirstRef.current = Math.max(0, thirstRef.current - THIRST_RATE * delta)

    if (hungerRef.current <= 0 || thirstRef.current <= 0) {
      dispatch({ type: 'KILL_ENTITY', id, entityType })
      return { hunger: 0, thirst: 0, dead: true }
    }

    // Sync needs to context periodically
    syncTimer.current += delta
    if (syncTimer.current > 0.5) {
      syncTimer.current = 0
      dispatch({
        type: 'UPDATE_ENTITY_NEEDS',
        id,
        entityType,
        hunger: hungerRef.current,
        thirst: thirstRef.current,
      })
    }

    return { hunger: hungerRef.current, thirst: thirstRef.current, dead: false }
  }

  return { tick, hungerRef, thirstRef }
}
