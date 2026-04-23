import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { sessionApi } from '../api/chat'
import type { ChatSession } from '../api/types'
import { createHybridStorage } from './utils/indexedDBStorage'

// ============================================
// Types
// ============================================

interface SessionState {
  sessionId: number | null
  sessions: ChatSession[]
  lastActiveSessionId: number | null
  isLoading: boolean
  error: string | null
}

interface SessionActions {
  createSession: () => Promise<void>
  loadSessions: () => Promise<void>
  switchSession: (sessionId: number) => void
  clearSession: () => void
  deleteSession: (sessionId: number) => Promise<void>
  setSessionId: (id: number | null) => void
}

// ============================================
// Store
// ============================================

export const useSessionStore = create<SessionState & SessionActions>()(
  immer(
    subscribeWithSelector(
      persist(
        (set) => ({
          sessionId: null,
          sessions: [],
          lastActiveSessionId: null,
          isLoading: false,
          error: null,

          createSession: async () => {
            set((state) => {
              state.isLoading = true
              state.error = null
            })
            try {
              const session = await sessionApi.create()
              set((state) => {
                state.sessionId = session.id
                state.lastActiveSessionId = session.id
                state.sessions.unshift(session)
                state.isLoading = false
              })
            } catch (error) {
              set((state) => {
                state.error = (error as Error).message
                state.isLoading = false
              })
            }
          },

          loadSessions: async () => {
            set((state) => { state.isLoading = true })
            try {
              const sessions = await sessionApi.list()
              set((state) => {
                state.sessions = sessions
                state.isLoading = false
              })
            } catch (error) {
              set((state) => {
                state.error = (error as Error).message
                state.isLoading = false
              })
            }
          },

          switchSession: (sessionId) => {
            set((state) => {
              state.sessionId = sessionId
              state.lastActiveSessionId = sessionId
            })
          },

          clearSession: () => {
            set((state) => {
              state.sessionId = null
            })
          },

          deleteSession: async (sessionId) => {
            try {
              await sessionApi.delete(sessionId)
              set((state) => {
                state.sessions = state.sessions.filter((s) => s.id !== sessionId)
                if (state.sessionId === sessionId) {
                  state.sessionId = null
                }
              })
            } catch (error) {
              set((state) => { state.error = (error as Error).message })
            }
          },

          setSessionId: (id) => {
            set((state) => { state.sessionId = id })
          },
        }),
        {
          name: 'writer-session-store',
          storage: createHybridStorage(50 * 1024) as never,
          partialize: (state) => ({
            sessionId: state.sessionId,
            lastActiveSessionId: state.lastActiveSessionId,
            sessions: state.sessions,
          }),
          version: 1,
        }
      )
    )
  )
)

// ============================================
// Selectors
// ============================================

export const selectCurrentSession = (state: SessionState) =>
  state.sessions.find((s) => s.id === state.sessionId)

export const selectSessionCount = (state: SessionState) => state.sessions.length

/** 仅选择 loading/error 状态（最小重渲染） */
export const selectSessionStatus = (state: SessionState) => ({
  isLoading: state.isLoading,
  error: state.error,
})

/** 清理 session store 临时状态 */
export function cleanupSessionStore() {
  useSessionStore.setState({
    isLoading: false,
    error: null,
  })
}