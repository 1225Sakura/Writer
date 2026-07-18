import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import {
  useChatStore,
  useSettingsStore,
  useUIStore,
  useWritingStore,
  useContentStore,
  useAIStore,
} from './store'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// US-022: dev-only test hook — exposes Zustand stores on window so the
// Playwright e2e suite can invoke actions (e.g. migrateChatToSettings)
// that have no UI button yet. Gated by import.meta.env.DEV so it is tree-
// shaken from production builds. The `__writerE2E` namespace keeps it
// obviously test-only and avoids polluting global window in shipped code.
if (import.meta.env.DEV) {
  // US-025 (Phase 5): also expose UI/writing/content/AI stores so the e2e
  // driver can set currentChapterId, drive AI shortcuts, and read AI log.
  ;(window as unknown as { __writerE2E?: unknown }).__writerE2E = {
    useChatStore,
    useSettingsStore,
    useUIStore,
    useWritingStore,
    useContentStore,
    useAIStore,
  }
}
