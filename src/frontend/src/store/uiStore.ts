import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createHybridStorage } from './utils/indexedDBStorage'

// ============================================
// Types
// ============================================

export type InterfaceType = 'chat' | 'settings' | 'writing' | 'global'

export type SettingsCategory =
  | 'world'
  | 'character'
  | 'item'
  | 'location'
  | 'faction'
  | 'rule'
  | 'outline'
  | 'ifline'

/** 界面历史记录条目 */
export interface NavigationHistoryEntry {
  interface: InterfaceType
  settingsCategory?: SettingsCategory
  timestamp: number
  /** 可选的元数据，用于恢复状态 */
  meta?: Record<string, unknown>
}

/** 面板配置 */
export interface PanelState {
  width: number
  height?: number
  position: 'left' | 'right' | 'bottom'
  collapsed: boolean
}

export interface UIState {
  // Current interface
  currentInterface: InterfaceType

  // Performance mode
  reducedMotion: boolean
  lowPerformanceMode: boolean

  // Navigation history
  navigationHistory: NavigationHistoryEntry[]
  canGoBack: boolean

  // Drawer states
  aiDrawerOpen: boolean
  collaborationDrawerOpen: boolean
  outlineDrawerOpen: boolean
  checkerDrawerOpen: boolean

  // Panel states with sizing
  aiPanel: PanelState
  collaborationPanel: PanelState
  outlinePanel: PanelState
  checkerPanel: PanelState

  // Fullscreen & modes
  fullscreenWriting: boolean
  immersiveMode: boolean
  focusModeEnabled: boolean
  typewriterMode: boolean
  paragraphFocusMode: boolean
  paperEdgeDecoration: boolean

  // Theme (expanded to match useTheme hook)
  theme: 'light' | 'dark' | 'eye-care' | 'midnight-blue' | 'warm-paper' | 'forest-green'

  // Settings category
  settingsCategory: SettingsCategory

  // Sidebar width (settings editor)
  settingsSidebarWidth: number

  // Toast/notification queue
  toasts: Toast[]
}

export interface Toast {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  message: string
  duration?: number
  dismissible?: boolean
}

interface UIActions {
  // Navigation
  setCurrentInterface: (interfaceType: InterfaceType, meta?: Record<string, unknown>) => void
  goBack: () => void
  canNavigateBack: () => boolean
  clearHistory: () => void

  // Drawers
  toggleAIDrawer: () => void
  toggleCollaborationDrawer: () => void
  toggleOutlineDrawer: () => void
  toggleCheckerDrawer: () => void
  setAIDrawerOpen: (open: boolean) => void
  setCollaborationDrawerOpen: (open: boolean) => void
  setOutlineDrawerOpen: (open: boolean) => void
  setCheckerDrawerOpen: (open: boolean) => void

  // Panel sizing
  setAIPanelWidth: (width: number) => void
  setCollaborationPanelWidth: (width: number) => void
  setOutlinePanelWidth: (width: number) => void
  setCheckerPanelWidth: (width: number) => void
  collapsePanel: (panel: 'ai' | 'collaboration' | 'outline' | 'checker') => void
  expandPanel: (panel: 'ai' | 'collaboration' | 'outline' | 'checker') => void

  // Fullscreen & modes
  toggleFullscreenWriting: () => void
  setFullscreenWriting: (fullscreen: boolean) => void

  toggleImmersiveMode: () => void
  setImmersiveMode: (immersive: boolean) => void

  toggleFocusMode: () => void
  setFocusMode: (focusMode: boolean) => void

  toggleTypewriterMode: () => void
  setTypewriterMode: (enabled: boolean) => void

  toggleParagraphFocusMode: () => void
  setParagraphFocusMode: (enabled: boolean) => void

  togglePaperEdgeDecoration: () => void
  setPaperEdgeDecoration: (enabled: boolean) => void

  // Theme
  setTheme: (theme: 'light' | 'dark' | 'eye-care' | 'midnight-blue' | 'warm-paper' | 'forest-green') => void
  toggleTheme: () => void

  // Settings category
  setSettingsCategory: (category: SettingsCategory) => void

  // Sidebar
  setSettingsSidebarWidth: (width: number) => void

  // Performance mode
  setReducedMotion: (enabled: boolean) => void
  toggleReducedMotion: () => void
  setLowPerformanceMode: (enabled: boolean) => void
  toggleLowPerformanceMode: () => void

  // Toasts
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
  clearToasts: () => void
}

// ============================================
// Helpers
// ============================================

const genToastId = () => `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

const MAX_HISTORY = 20

// ============================================
// Store
// ============================================

export const useUIStore = create<UIState & UIActions>()(
  immer(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          // Initial state
          currentInterface: 'chat',
          navigationHistory: [],
          canGoBack: false,
          aiDrawerOpen: false,
          collaborationDrawerOpen: false,
          outlineDrawerOpen: false,
          checkerDrawerOpen: false,
          aiPanel: { width: 360, position: 'right', collapsed: false },
          collaborationPanel: { width: 320, position: 'right', collapsed: false },
          outlinePanel: { width: 280, position: 'left', collapsed: false },
          checkerPanel: { width: 340, position: 'right', collapsed: false },
          fullscreenWriting: false,
          immersiveMode: false,
          focusModeEnabled: false,
          typewriterMode: false,
          paragraphFocusMode: false,
          paperEdgeDecoration: false,
          theme: 'dark',
          settingsCategory: 'world',
          settingsSidebarWidth: 240,
          toasts: [],
          reducedMotion: false,
          lowPerformanceMode: false,

          // ----------------------------------------
          // Navigation
          // ----------------------------------------

          setCurrentInterface: (interfaceType, meta) => {
            const { currentInterface, settingsCategory } = get()

            // Don't push duplicate consecutive entries
            if (currentInterface === interfaceType && !meta) return

            // Push current to history before switching
            const entry: NavigationHistoryEntry = {
              interface: currentInterface,
              settingsCategory,
              timestamp: Date.now(),
              meta,
            }

            set((state) => {
              state.navigationHistory.push(entry)
              if (state.navigationHistory.length > MAX_HISTORY) {
                state.navigationHistory.shift()
              }
              state.currentInterface = interfaceType
              state.canGoBack = state.navigationHistory.length > 0

              // Close drawers when switching interfaces
              if (interfaceType !== 'writing') {
                state.aiDrawerOpen = false
                state.collaborationDrawerOpen = false
                state.outlineDrawerOpen = false
              }
            })
          },

          goBack: () => {
            const { navigationHistory } = get()
            if (navigationHistory.length === 0) return

            const previous = navigationHistory[navigationHistory.length - 1]
            set((state) => {
              state.navigationHistory.pop()
              state.currentInterface = previous.interface
              if (previous.settingsCategory) {
                state.settingsCategory = previous.settingsCategory
              }
              state.canGoBack = state.navigationHistory.length > 0
            })
          },

          canNavigateBack: () => {
            return get().navigationHistory.length > 0
          },

          clearHistory: () => {
            set((state) => {
              state.navigationHistory = []
              state.canGoBack = false
            })
          },

          // ----------------------------------------
          // Drawers
          // ----------------------------------------

          toggleAIDrawer: () => {
            set((state) => {
              state.aiDrawerOpen = !state.aiDrawerOpen
              // Mutually exclusive with collaboration
              if (state.aiDrawerOpen && state.collaborationDrawerOpen) {
                state.collaborationDrawerOpen = false
              }
            })
          },

          toggleCollaborationDrawer: () => {
            set((state) => {
              state.collaborationDrawerOpen = !state.collaborationDrawerOpen
              if (state.collaborationDrawerOpen && state.aiDrawerOpen) {
                state.aiDrawerOpen = false
              }
            })
          },

          toggleOutlineDrawer: () => {
            set((state) => { state.outlineDrawerOpen = !state.outlineDrawerOpen })
          },

          toggleCheckerDrawer: () => {
            set((state) => {
              state.checkerDrawerOpen = !state.checkerDrawerOpen
              if (state.checkerDrawerOpen && state.aiDrawerOpen) {
                state.aiDrawerOpen = false
              }
            })
          },

          setAIDrawerOpen: (open) => {
            set((state) => {
              state.aiDrawerOpen = open
              if (open && state.collaborationDrawerOpen) {
                state.collaborationDrawerOpen = false
              }
            })
          },

          setCollaborationDrawerOpen: (open) => {
            set((state) => {
              state.collaborationDrawerOpen = open
              if (open && state.aiDrawerOpen) {
                state.aiDrawerOpen = false
              }
            })
          },

          setOutlineDrawerOpen: (open) => {
            set((state) => { state.outlineDrawerOpen = open })
          },

          setCheckerDrawerOpen: (open) => {
            set((state) => {
              state.checkerDrawerOpen = open
              if (open && state.aiDrawerOpen) {
                state.aiDrawerOpen = false
              }
            })
          },

          // ----------------------------------------
          // Panel Sizing
          // ----------------------------------------

          setAIPanelWidth: (width) => {
            set((state) => { state.aiPanel.width = Math.max(240, Math.min(600, width)) })
          },

          setCollaborationPanelWidth: (width) => {
            set((state) => {
              state.collaborationPanel.width = Math.max(240, Math.min(500, width))
            })
          },

          setOutlinePanelWidth: (width) => {
            set((state) => {
              state.outlinePanel.width = Math.max(200, Math.min(400, width))
            })
          },

          setCheckerPanelWidth: (width) => {
            set((state) => {
              state.checkerPanel.width = Math.max(240, Math.min(500, width))
            })
          },

          collapsePanel: (panel) => {
            set((state) => {
              switch (panel) {
                case 'ai':
                  state.aiPanel.collapsed = true
                  break
                case 'collaboration':
                  state.collaborationPanel.collapsed = true
                  break
                case 'outline':
                  state.outlinePanel.collapsed = true
                  break
                case 'checker':
                  state.checkerPanel.collapsed = true
                  break
              }
            })
          },

          expandPanel: (panel) => {
            set((state) => {
              switch (panel) {
                case 'ai':
                  state.aiPanel.collapsed = false
                  break
                case 'collaboration':
                  state.collaborationPanel.collapsed = false
                  break
                case 'outline':
                  state.outlinePanel.collapsed = false
                  break
                case 'checker':
                  state.checkerPanel.collapsed = false
                  break
              }
            })
          },

          // ----------------------------------------
          // Fullscreen & Modes
          // ----------------------------------------

          toggleFullscreenWriting: () => {
            set((state) => { state.fullscreenWriting = !state.fullscreenWriting })
          },

          setFullscreenWriting: (fullscreen) => {
            set((state) => { state.fullscreenWriting = fullscreen })
          },

          toggleImmersiveMode: () => {
            set((state) => { state.immersiveMode = !state.immersiveMode })
          },

          setImmersiveMode: (immersive) => {
            set((state) => { state.immersiveMode = immersive })
          },

          toggleFocusMode: () => {
            set((state) => { state.focusModeEnabled = !state.focusModeEnabled })
          },

          setFocusMode: (focusMode) => {
            set((state) => { state.focusModeEnabled = focusMode })
          },

          toggleTypewriterMode: () => {
            set((state) => { state.typewriterMode = !state.typewriterMode })
          },

          setTypewriterMode: (enabled) => {
            set((state) => { state.typewriterMode = enabled })
          },

          toggleParagraphFocusMode: () => {
            set((state) => { state.paragraphFocusMode = !state.paragraphFocusMode })
          },

          setParagraphFocusMode: (enabled) => {
            set((state) => { state.paragraphFocusMode = enabled })
          },

          togglePaperEdgeDecoration: () => {
            set((state) => { state.paperEdgeDecoration = !state.paperEdgeDecoration })
          },

          setPaperEdgeDecoration: (enabled) => {
            set((state) => { state.paperEdgeDecoration = enabled })
          },

          // ----------------------------------------
          // Theme
          // ----------------------------------------

          setTheme: (theme) => {
            set((state) => { state.theme = theme })
          },

          toggleTheme: () => {
            set((state) => {
              state.theme = state.theme === 'light' ? 'dark' : 'light'
            })
          },

          // ----------------------------------------
          // Settings Category
          // ----------------------------------------

          setSettingsCategory: (category) => {
            set((state) => { state.settingsCategory = category })
          },

          // ----------------------------------------
          // Sidebar
          // ----------------------------------------

          setSettingsSidebarWidth: (width) => {
            set((state) => {
              state.settingsSidebarWidth = Math.max(180, Math.min(400, width))
            })
          },

          // ----------------------------------------
          // Performance mode
          // ----------------------------------------

          setReducedMotion: (enabled) => {
            set((state) => { state.reducedMotion = enabled })
          },

          toggleReducedMotion: () => {
            set((state) => { state.reducedMotion = !state.reducedMotion })
          },

          setLowPerformanceMode: (enabled) => {
            set((state) => { state.lowPerformanceMode = enabled })
          },

          toggleLowPerformanceMode: () => {
            set((state) => { state.lowPerformanceMode = !state.lowPerformanceMode })
          },

          // ----------------------------------------
          // Toasts
          // ----------------------------------------

          addToast: (toast) => {
            const id = genToastId()
            set((state) => {
              state.toasts.push({ ...toast, id })
              if (state.toasts.length > 5) {
                state.toasts.shift()
              }
            })
            // Auto-dismiss
            if (toast.duration !== 0) {
              setTimeout(() => {
                get().removeToast(id)
              }, toast.duration || 3000)
            }
            return id
          },

          removeToast: (id) => {
            set((state) => {
              state.toasts = state.toasts.filter((t) => t.id !== id)
            })
          },

          clearToasts: () => {
            set((state) => { state.toasts = [] })
          },
        }),
        {
          name: 'writer-ui-store-v2',
          storage: createHybridStorage(50 * 1024) as never,
          partialize: (state) => ({
            theme: state.theme,
            currentInterface: state.currentInterface,
            settingsCategory: state.settingsCategory,
            aiPanel: state.aiPanel,
            collaborationPanel: state.collaborationPanel,
            outlinePanel: state.outlinePanel,
            settingsSidebarWidth: state.settingsSidebarWidth,
            immersiveMode: state.immersiveMode,
            focusModeEnabled: state.focusModeEnabled,
            typewriterMode: state.typewriterMode,
            paragraphFocusMode: state.paragraphFocusMode,
            paperEdgeDecoration: state.paperEdgeDecoration,
            reducedMotion: state.reducedMotion,
            lowPerformanceMode: state.lowPerformanceMode,
          }),
          version: 2,
        }
      )
    )
  )
)

// ============================================
// Selectors
// ============================================

export const selectAnyDrawerOpen = (state: UIState) =>
  state.aiDrawerOpen || state.collaborationDrawerOpen || state.outlineDrawerOpen

export const selectIsInWritingMode = (state: UIState) =>
  state.currentInterface === 'writing'

/** 仅选择 drawer 状态（最小重渲染） */
export const selectDrawerState = (state: UIState) =>
  ({
    aiDrawerOpen: state.aiDrawerOpen,
    collaborationDrawerOpen: state.collaborationDrawerOpen,
    outlineDrawerOpen: state.outlineDrawerOpen,
  })

/** 仅选择导航状态 */
export const selectNavigationState = (state: UIState) =>
  ({
    currentInterface: state.currentInterface,
    canGoBack: state.canGoBack,
    settingsCategory: state.settingsCategory,
  })

/** 仅选择面板尺寸 */
export const selectPanelSizes = (state: UIState) =>
  ({
    aiPanel: state.aiPanel,
    collaborationPanel: state.collaborationPanel,
    outlinePanel: state.outlinePanel,
  })

/** 仅选择主题 */
export const selectTheme = (state: UIState) => state.theme

/** 仅选择全屏/沉浸状态 */
export const selectDisplayModes = (state: UIState) =>
  ({
    fullscreenWriting: state.fullscreenWriting,
    immersiveMode: state.immersiveMode,
    focusModeEnabled: state.focusModeEnabled,
    typewriterMode: state.typewriterMode,
    paragraphFocusMode: state.paragraphFocusMode,
    paperEdgeDecoration: state.paperEdgeDecoration,
  })

/** 清理 UI store 临时状态 */
export function cleanupUIStore() {
  useUIStore.setState({
    aiDrawerOpen: false,
    collaborationDrawerOpen: false,
    outlineDrawerOpen: false,
    toasts: [],
    fullscreenWriting: false,
  })
}
