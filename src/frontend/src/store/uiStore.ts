import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type InterfaceType = 'chat' | 'settings' | 'writing'

export interface UIState {
  // 界面状态
  currentInterface: InterfaceType
  // 抽屉状态
  aiDrawerOpen: boolean
  collaborationDrawerOpen: boolean
  outlineDrawerOpen: boolean
  // 全屏写作
  fullscreenWriting: boolean
  // 沉浸模式
  immersiveMode: boolean
  // 专注模式
  focusModeEnabled: boolean
  // 主题
  theme: 'light' | 'dark'
  // 设置面板
  settingsCategory: 'world' | 'character' | 'item' | 'location' | 'faction' | 'rule' | 'outline' | 'ifline'
}

interface UIActions {
  // 界面流转
  setCurrentInterface: (interfaceType: InterfaceType) => void
  // 抽屉控制
  toggleAIDrawer: () => void
  toggleCollaborationDrawer: () => void
  toggleOutlineDrawer: () => void
  setAIDrawerOpen: (open: boolean) => void
  setCollaborationDrawerOpen: (open: boolean) => void
  // 全屏写作
  toggleFullscreenWriting: () => void
  // 沉浸模式
  toggleImmersiveMode: () => void
  setImmersiveMode: (immersive: boolean) => void
  // 专注模式
  toggleFocusMode: () => void
  setFocusMode: (focusMode: boolean) => void
  // 主题
  setTheme: (theme: 'light' | 'dark') => void
  toggleTheme: () => void
  // 设置分类
  setSettingsCategory: (category: UIState['settingsCategory']) => void
}

export const useUIStore = create<UIState & UIActions>()(
  persist(
    (set) => ({
      // 初始状态
      currentInterface: 'chat',
      aiDrawerOpen: false,
      collaborationDrawerOpen: false,
      outlineDrawerOpen: false,
      fullscreenWriting: false,
      immersiveMode: false,
      focusModeEnabled: false,
      theme: 'dark',
      settingsCategory: 'world',

      // 界面流转
      setCurrentInterface: (interfaceType) => set({ currentInterface: interfaceType }),

      // 抽屉控制
      toggleAIDrawer: () => set((state) => ({ aiDrawerOpen: !state.aiDrawerOpen })),
      toggleCollaborationDrawer: () => set((state) => ({ collaborationDrawerOpen: !state.collaborationDrawerOpen })),
      toggleOutlineDrawer: () => set((state) => ({ outlineDrawerOpen: !state.outlineDrawerOpen })),
      setAIDrawerOpen: (open) => set({ aiDrawerOpen: open }),
      setCollaborationDrawerOpen: (open) => set({ collaborationDrawerOpen: open }),

      // 全屏写作
      toggleFullscreenWriting: () => set((state) => ({ fullscreenWriting: !state.fullscreenWriting })),

      // 沉浸模式
      toggleImmersiveMode: () => set((state) => ({ immersiveMode: !state.immersiveMode })),
      setImmersiveMode: (immersive) => set({ immersiveMode: immersive }),

      // 专注模式
      toggleFocusMode: () => set((state) => ({ focusModeEnabled: !state.focusModeEnabled })),
      setFocusMode: (focusMode) => set({ focusModeEnabled: focusMode }),

      // 主题
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

      // 设置分类
      setSettingsCategory: (category) => set({ settingsCategory: category }),
    }),
    {
      name: 'writer-ui-store',
      partialize: (state: UIState & UIActions) => ({
        theme: state.theme,
        // Only persist theme and current interface - not transient UI state
        currentInterface: state.currentInterface,
        settingsCategory: state.settingsCategory,
      }),
      // Version for future migrations
      version: 1,
    }
  )
)
