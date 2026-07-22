import React from 'react'
import ReactDOM from 'react-dom/client'
import { enableMapSet } from 'immer'
import App from './App'
import {
  useChatStore,
  useSettingsStore,
  useUIStore,
  useWritingStore,
  useContentStore,
  useAIStore,
  useSyncStore,
} from './store'
import { ifLineApi } from './api/ifLineApi'
import { initAuth } from './api/auth'
import './styles/index.css'

// syncStore + any other immer+Map stores require the MapSet plugin.
// Without this, any operation that touches a Map field (e.g. IFLineSyncState
// in syncStore) throws "[Immer] The plugin for 'MapSet' has not been loaded".
// US-026 (Phase 6) discovery: only the syncStore.test.ts file was calling
// enableMapSet(), so production code crashed the moment the syncStore was
// actually exercised (verified via Phase 6 walkthrough registerIFLine call).
enableMapSet()

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
  // v0.5 patch Phase 0a.5: also expose ifLineApi for the IF vertical-slice
  // e2e driver (no UI button to flip the feature flag at runtime).
  ;(window as unknown as { __writerE2E?: unknown }).__writerE2E = {
    useChatStore,
    useSettingsStore,
    useUIStore,
    useWritingStore,
    useContentStore,
    useAIStore,
    useSyncStore,
    ifLineApi,
  }
}

// v0.4 P0-Sec1a US-008: invoke initAuth on app startup (fire-and-forget)
// initAuth calls /auth/key/init → caches API key in electron secureStorage
// All subsequent api.* calls include X-API-Key header via request.ts interceptor
initAuth().catch((err) => {
  // Best-effort: app still functional (request.ts will surface 401 on first protected call)
  console.error('[main] initAuth failed:', err)
})
