import { createContext, useContext, ReactNode } from 'react'
import { useImmersiveState } from './useImmersiveState'

interface ImmersiveModeContextValue {
  immersiveMode: boolean
  chromeVisible: boolean
  showChrome: () => void
  toggleImmersiveMode: () => void
  setImmersiveMode: (value: boolean) => void
  prefersReducedMotion: boolean
  lastTriggerElementRef: React.MutableRefObject<HTMLElement | null>
}

const ImmersiveModeContext = createContext<ImmersiveModeContextValue | null>(null)

export function ImmersiveModeProvider({ children }: { children: ReactNode }) {
  const immersiveState = useImmersiveState()

  return (
    <ImmersiveModeContext.Provider value={immersiveState}>
      {children}
    </ImmersiveModeContext.Provider>
  )
}

export function useImmersiveModeContext() {
  const context = useContext(ImmersiveModeContext)
  if (!context) {
    throw new Error('useImmersiveModeContext must be used within ImmersiveModeProvider')
  }
  return context
}
