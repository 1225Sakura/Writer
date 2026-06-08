# Zustand Store Error Handling Audit Report

**Date:** 2026-05-27
**Scope:** All Zustand stores in `D:/writer/src/frontend/src/store/`
**Auditor:** Automated code review

---

## 1. Summary Table

| Store File | Async Actions | Has try/catch | Has Loading State | Has Error Toast | Issues Found |
|---|---|---|---|---|---|
| **settingsDataSlice.ts** | 36 | Partial (6/36) | Partial (3/36) | Partial (3/36) | **30 CRUD actions lack try/catch** |
| **settingsUISlice.ts** | 0 | N/A | N/A | N/A | No async actions |
| **settingsValidationSlice.ts** | 0 | N/A | N/A | N/A | No async actions |
| **settingsStore.ts** | 0 | N/A | N/A | N/A | Thin combiner, delegates to slices |
| **settingsDataStore.ts** | 0 | N/A | N/A | N/A | Typed facade, no own async |
| **settingsUIStore.ts** | 0 | N/A | N/A | N/A | Typed facade, no own async |
| **settingsValidationStore.ts** | 0 | N/A | N/A | N/A | Typed facade, no own async |
| **syncStore.ts** | 2 | Yes (2/2) | Yes (1/2) | Yes (1/2) | Inner IIFE catch is silent |
| **writingStore.ts** | 6 | Yes (6/6) | Yes (3/6) | Yes (4/6) | Good overall; 2 fire-and-forget `.catch()` |
| **contentStore.ts** | 14 | Partial (6/14) | Partial (5/14) | Partial (6/14) | **8 CRUD actions lack try/catch** |
| **checkerStore.ts** | 7 | Yes (7/7) | Yes (7/7) | Yes (7/7) | **Excellent** |
| **aiStore.ts** | 9 | Yes (9/9) | Yes (2/9) | Yes (1/9) | Queue operations set error on job, no toast; fetchStyles good |
| **aiProviderStore.ts** | 7 | Yes (7/7) | Partial (5/7) | No (0/7) | **No toast notifications at all** |
| **uiStore.ts** | 0 | N/A | N/A | N/A | No async actions |
| **systemStore.ts** | 15 | Yes (15/15) | Partial (9/15) | No (0/15) | **No toast notifications; 6 actions skip loading** |
| **projectDataStore.ts** | 12 | Yes (12/12) | Yes (12/12) | No (0/12) | **No toast notifications** |
| **graphStore.ts** | 8 | Yes (8/8) | Yes (8/8) | No (0/8) | **No toast notifications** |
| **contextStore.ts** | 9 | Yes (9/9) | Yes (9/9) | No (0/9) | **No toast notifications** |
| **analyticsStore.ts** | 11 | Yes (11/11) | Yes (11/11) | No (0/11) | **No toast notifications** |
| **entityStore.ts** | 22 | Partial (8/22) | Partial (8/22) | No (0/22) | **14 CRUD actions lack try/catch; no toast** |
| **chatEntityStore.ts** | 3 | Yes (3/3) | Partial (2/3) | No (0/3) | **No toast notifications** |
| **chatStore.ts** | 12 | Yes (12/12) | Partial (5/12) | Partial (1/12) | **11 actions lack toast; 1 silent catch** |
| **relationStore.ts** | 5 | Yes (5/5) | Partial (2/5) | No (0/5) | **No toast notifications** |
| **sessionStore.ts** | 4 | Yes (4/4) | Yes (3/4) | No (0/4) | **No toast notifications** |
| **filterStore.ts** | 0 | N/A | N/A | N/A | No async actions |
| **historyStore.ts** | 0 | N/A | N/A | N/A | No async actions |
| **messageStore.ts** | 3 | Yes (3/3) | Partial (1/3) | No (0/3) | **No toast notifications** |
| **crossStoreSync.ts** | 0 | N/A | N/A | N/A | Utility helpers, no store actions |

### Summary Statistics

- **Total stores audited:** 27 files (17 unique stores + 6 facades + 3 slices + 1 utility)
- **Stores with async actions:** 17
- **Stores with complete try/catch:** 9 of 17 (53%)
- **Stores with toast notifications:** 5 of 17 (29%)
- **Stores with loading state:** 13 of 17 (76%)

---

## 2. Detailed Findings by Store

### 2.1 settingsDataSlice.ts — CRITICAL: 30 unguarded CRUD actions

**File:** `D:/writer/src/frontend/src/store/settingsDataSlice.ts`

This is the highest-risk store. It manages all entity CRUD operations but 30 out of 36 async actions have **zero error handling**. Any API failure will result in an unhandled promise rejection.

**Actions WITH proper error handling (6):**
- `loadAll` (lines 164-226) — try/catch, loading, error state. No toast.
- `loadCategoryData` (lines 228-303) — try/catch, loading, error state. No toast.
- `reviewWithAI` (lines 307-314) — try/catch, error state. No loading, no toast.
- `generate` (lines 316-325) — try/catch, error state. No loading, no toast.
- `generateRelations` (lines 327-347) — try/catch, error state. No loading, no toast.
- `batchDelete` (lines 821-886) — try/catch, loading, finally. No toast.

**Actions WITHOUT error handling (30) — every one needs a try/catch:**

| Line | Action | Severity |
|---|---|---|
| 351 | `addCharacter` | HIGH — unguarded `characterApi.create` |
| 384 | `updateCharacter` | HIGH — unguarded `characterApi.update` |
| 419 | `deleteCharacter` | HIGH — unguarded `characterApi.delete` |
| 443 | `addRelationship` | HIGH — unguarded `relationshipApi.create` |
| 461 | `removeRelationship` | HIGH — unguarded `relationshipApi.delete` |
| 471 | `updateStorylineProgress` | HIGH — unguarded `storylineApi.update` |
| 484 | `addItem` | HIGH — unguarded `itemApi.create` |
| 490 | `updateItem` | HIGH — unguarded `itemApi.update` |
| 512 | `deleteItem` | HIGH — unguarded `itemApi.delete` |
| 534 | `addLocation` | HIGH — unguarded `locationApi.create` |
| 540 | `updateLocation` | HIGH — unguarded `locationApi.update` |
| 562 | `deleteLocation` | HIGH — unguarded `locationApi.delete` |
| 584 | `addFaction` | HIGH — unguarded `factionApi.create` |
| 590 | `updateFaction` | HIGH — unguarded `factionApi.update` |
| 612 | `deleteFaction` | HIGH — unguarded `factionApi.delete` |
| 634 | `addWorldSetting` | HIGH — unguarded `worldSettingApi.create` |
| 640 | `updateWorldSetting` | HIGH — unguarded `worldSettingApi.update` |
| 662 | `deleteWorldSetting` | HIGH — unguarded `worldSettingApi.delete` |
| 684 | `addRule` | HIGH — unguarded `ruleApi.create` |
| 690 | `updateRule` | HIGH — unguarded `ruleApi.update` |
| 712 | `deleteRule` | HIGH — unguarded `ruleApi.delete` |
| 734 | `setOutline` | HIGH — unguarded `outlineApi.create` |
| 742 | `addChapter` | HIGH — unguarded `chapterApi.create` |
| 751 | `updateChapter` | HIGH — unguarded `chapterApi.update` |
| 759 | `deleteChapter` | HIGH — unguarded `chapterApi.delete` |
| 768 | `addIFLine` | HIGH — unguarded `ifLineApi.create` |
| 773 | `updateIFLine` | HIGH — unguarded `ifLineApi.update` |
| 781 | `deleteIFLine` | HIGH — unguarded `ifLineApi.delete` |
| 790 | `importFromChat` | MEDIUM — delegates to other unguarded actions |
| 930 | `executeBatch` | MEDIUM — delegates to batchDelete (guarded) but updateCharacter/tier paths unguarded |

**Additional issue (lines 186-195):** Inside `loadAll`, there is a nested try/catch with an empty catch block:
```typescript
} catch {
  // Ignore relation fetch errors
}
```
This silently swallows errors when fetching relationships/storylines for individual characters. The user gets no indication that some character data is incomplete.

**Same issue at line 244** in `loadCategoryData`:
```typescript
} catch { /* ignore */ }
```

---

### 2.2 entityStore.ts — CRITICAL: 14 unguarded CRUD actions

**File:** `D:/writer/src/frontend/src/store/entityStore.ts`

Same pattern as settingsDataSlice. 14 out of 22 async actions have no error handling.

**Actions WITHOUT try/catch:**
- `addCharacter` (line 177), `updateCharacter` (line 193), `deleteCharacter` (line 209)
- `addItem` (line 227), `updateItem` (line 233), `deleteItem` (line 240)
- `addLocation` (line 257), `updateLocation` (line 263), `deleteLocation` (line 270)
- `addFaction` (line 287), `updateFaction` (line 293), `deleteFaction` (line 300)
- `addWorldSetting` (line 317), `updateWorldSetting` (line 323), `deleteWorldSetting` (line 330)
- `addRule` (line 347), `updateRule` (line 353), `deleteRule` (line 360)
- `addIFLine` (line 377), `updateIFLine` (line 383), `deleteIFLine` (line 390)

**No toast notifications on any action.** The load* actions (loadCharacters, loadItems, etc.) do set error state but never show a toast.

---

### 2.3 contentStore.ts — 8 unguarded CRUD actions

**File:** `D:/writer/src/frontend/src/store/contentStore.ts`

**Actions WITH proper error handling (6):** `fetchChapters`, `fetchOutlines`, `fetchDrafts`, `fetchIFLines`, `fetchPlotThreads`, `fetchInspections` — all have try/catch, loading in finally, and `showOperationError` toast.

**Actions WITHOUT try/catch (8):**
- `createChapter` (line 169) — unguarded `chapterApi.create`
- `updateChapter` (line 179) — unguarded `chapterApi.update`
- `deleteChapter` (line 187) — unguarded `chapterApi.delete`
- `createOutline` (line 210) — unguarded `outlineApi.create`
- `updateOutline` (line 216) — unguarded `outlineApi.update`
- `deleteOutline` (line 224) — unguarded `outlineApi.delete`
- `createIFLine` (line 296) — unguarded `ifLineApi.create`
- `updateIFLine` (line 302) — unguarded `ifLineApi.update`
- `deleteIFLine` (line 310) — unguarded `ifLineApi.delete`
- `saveDraftVersion` (line 247) — unguarded `draftApi.create`
- `restoreDraftVersion` (line 260) — unguarded `draftApi.getVersion`
- `deleteDraftVersion` (line 271) — unguarded `draftApi.delete`
- `createPlotThread` (line 333) — unguarded `plotThreadApi.create`
- `updatePlotThread` (line 339) — unguarded `plotThreadApi.update`
- `deletePlotThread` (line 347) — unguarded `plotThreadApi.delete`
- `createInspection` (line 375) — unguarded `inspectionApi.create`

---

### 2.4 aiProviderStore.ts — No toast notifications

**File:** `D:/writer/src/frontend/src/store/aiProviderStore.ts`

All 7 async actions have try/catch and set error state. However:
- **Zero toast notifications.** Errors are only stored in `state.error`, which may not be visible to the user.
- `testConnection` (line 91) and `testConnectionParams` (line 101) do not set `isLoading`.

---

### 2.5 systemStore.ts — No toast notifications, inconsistent loading

**File:** `D:/writer/src/frontend/src/store/systemStore.ts`

All 15 async actions have try/catch and set error state. Issues:
- **Zero toast notifications** across all 15 actions.
- **6 observability actions skip loading state:** `fetchMetrics` (line 182), `fetchDebts` (line 192), `fetchTrends` (line 202), `fetchStatus` (line 212), `fetchQuickStatus` (line 222), `fetchConstraintRules` (line 245). These have try/catch but never set `loading = true`.

---

### 2.6 projectDataStore.ts — No toast notifications

**File:** `D:/writer/src/frontend/src/store/projectDataStore.ts`

All 12 async actions have try/catch, loading, and error state. However:
- **Zero toast notifications.** Users will not see error messages unless they check the error state manually.
- `createSnapshot` (line 73) and `restoreSnapshot` (line 102) re-throw errors after setting state, which is good for callers but still lacks a toast.

---

### 2.7 graphStore.ts — No toast notifications

**File:** `D:/writer/src/frontend/src/store/graphStore.ts`

All 8 fetch actions have try/catch, loading, and error state. However:
- **Zero toast notifications.**
- Error messages are set in Chinese but never surfaced to the user.

---

### 2.8 contextStore.ts — No toast notifications

**File:** `D:/writer/src/frontend/src/store/contextStore.ts`

All 9 async actions have try/catch, loading, and error state. However:
- **Zero toast notifications.**

---

### 2.9 analyticsStore.ts — No toast notifications

**File:** `D:/writer/src/frontend/src/store/analyticsStore.ts`

All 11 async actions have try/catch, loading, and error state. However:
- **Zero toast notifications.**

---

### 2.10 chatStore.ts — Silent catch, sparse toast usage

**File:** `D:/writer/src/frontend/src/store/chatStore.ts`

- `createSession` (line 175): Has try/catch, loading, and **shows toast via `showApiError`**. Good.
- `sendMessage` (line 314): Has try/catch, sets error state. No toast.
- `loadSessions`, `switchSession`, `loadMessages`, `loadExtractedEntities`: Have try/catch and loading. No toast.
- `deleteSession` (line 296), `confirmEntity` (line 537), `batchConfirmEntities` (line 549): Have try/catch. No toast.
- **`extractEntitiesFromMessage` (line 571):** Contains a silent catch at line 597:
  ```typescript
  } catch {
    // Backend unavailable — no entities extracted
  }
  ```
  This silently swallows API errors. The user gets no feedback that entity extraction failed.

---

### 2.11 chatEntityStore.ts — No toast notifications

**File:** `D:/writer/src/frontend/src/store/chatEntityStore.ts`

- `loadExtractedEntities` (line 68): Has try/catch and loading. No toast.
- `confirmEntity` (line 113): Has try/catch. No loading, no toast.
- `batchConfirmEntities` (line 125): Has try/catch, sets extractionState. No toast.

---

### 2.12 relationStore.ts — No toast notifications

**File:** `D:/writer/src/frontend/src/store/relationStore.ts`

All 5 async actions have try/catch and set error state. Some re-throw errors for callers. However:
- **Zero toast notifications.**
- `addRelationship` and `removeRelationship` have no loading state.

---

### 2.13 sessionStore.ts — No toast notifications

**File:** `D:/writer/src/frontend/src/store/sessionStore.ts`

All 4 async actions have try/catch and loading/error state. However:
- **Zero toast notifications.**

---

### 2.14 messageStore.ts — No toast notifications

**File:** `D:/writer/src/frontend/src/store/messageStore.ts`

- `sendMessage` (line 103): Has try/catch, sets error state. No toast.
- `loadMessages` (line 154): Has try/catch and loading. No toast.
- `retryMessage` (line 195): Delegates to caller-provided `sendFn`. No error handling.

---

### 2.15 syncStore.ts — Silent inner catch

**File:** `D:/writer/src/frontend/src/store/syncStore.ts`

- `triggerGlobalSync` (line 226): Outer try/catch with `showError` toast. Good.
- **Inner IIFE at line 254:** Silent catch that only sets sync status to 'error' without toast:
  ```typescript
  } catch {
    set((state) => {
      const ss = state.ifLineSyncStates.get(ifLineId)
      if (ss) { ss.status = 'error' }
    })
  }
  ```
  User sees status change but no explanation of what failed.

---

### 2.16 writingStore.ts — Mostly good

**File:** `D:/writer/src/frontend/src/store/writingStore.ts`

- `init`, `saveCurrentChapter`, `triggerAutoSave`: All have try/catch with `showOperationError` toast and proper loading management. Excellent.
- `setHumanAIRatio` (line 303), `setWritingStyle` (line 310): Fire-and-forget `.catch()` with `showOperationError`. Acceptable pattern since these are config syncs.
- `setChapterNote` (line 326), `deleteChapterNote` (line 346): Unguarded `chapterApi.update` calls. Errors will be unhandled promise rejections.

---

### 2.17 checkerStore.ts — EXCELLENT (reference implementation)

**File:** `D:/writer/src/frontend/src/store/checkerStore.ts`

All 7 async actions follow the gold standard pattern:
1. Set `loading = true` and `error = null` before async work
2. try/catch with error message extraction
3. `showOperationError` toast on failure
4. `finally` block sets `loading = false`

This store should be used as the reference implementation for all other stores.

---

## 3. Specific Fixes Needed

### Priority 1 — CRITICAL: Unguarded async actions (will cause unhandled promise rejections)

| File | Line | Action | Fix |
|---|---|---|---|
| settingsDataSlice.ts | 351 | `addCharacter` | Wrap in try/catch, add `showOperationError('创建角色', error)` |
| settingsDataSlice.ts | 384 | `updateCharacter` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 419 | `deleteCharacter` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 443 | `addRelationship` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 461 | `removeRelationship` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 471 | `updateStorylineProgress` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 484 | `addItem` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 490 | `updateItem` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 512 | `deleteItem` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 534 | `addLocation` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 540 | `updateLocation` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 562 | `deleteLocation` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 584 | `addFaction` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 590 | `updateFaction` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 612 | `deleteFaction` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 634 | `addWorldSetting` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 640 | `updateWorldSetting` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 662 | `deleteWorldSetting` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 684 | `addRule` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 690 | `updateRule` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 712 | `deleteRule` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 734 | `setOutline` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 742 | `addChapter` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 751 | `updateChapter` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 759 | `deleteChapter` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 768 | `addIFLine` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 773 | `updateIFLine` | Wrap in try/catch, add toast |
| settingsDataSlice.ts | 781 | `deleteIFLine` | Wrap in try/catch, add toast |
| entityStore.ts | 177-390 | All 14+ CRUD actions | Wrap in try/catch, add toast |
| contentStore.ts | 169-375 | All 16 CRUD actions | Wrap in try/catch, add toast |
| writingStore.ts | 326 | `setChapterNote` | Wrap in try/catch, add toast |
| writingStore.ts | 346 | `deleteChapterNote` | Wrap in try/catch, add toast |

### Priority 2 — HIGH: Missing toast notifications (errors silently stored but never shown)

| File | Actions affected | Fix |
|---|---|---|
| aiProviderStore.ts | All 7 actions | Import `showOperationError`, add toast in each catch block |
| systemStore.ts | All 15 actions | Import `showOperationError`, add toast in each catch block |
| projectDataStore.ts | All 12 actions | Import `showOperationError`, add toast in each catch block |
| graphStore.ts | All 8 actions | Import `showOperationError`, add toast in each catch block |
| contextStore.ts | All 9 actions | Import `showOperationError`, add toast in each catch block |
| analyticsStore.ts | All 11 actions | Import `showOperationError`, add toast in each catch block |
| chatEntityStore.ts | All 3 actions | Import `showOperationError`, add toast in each catch block |
| relationStore.ts | All 5 actions | Import `showOperationError`, add toast in each catch block |
| sessionStore.ts | All 4 actions | Import `showOperationError`, add toast in each catch block |
| messageStore.ts | All 3 actions | Import `showOperationError`, add toast in each catch block |
| chatStore.ts | 11 actions (except createSession) | Import `showOperationError`, add toast in catch blocks |

### Priority 3 — MEDIUM: Silent catch blocks

| File | Line | Issue | Fix |
|---|---|---|---|
| settingsDataSlice.ts | 193-195 | Silent catch in `loadAll` inner loop | Add `console.warn` or collect partial failures |
| settingsDataSlice.ts | 244 | Silent catch in `loadCategoryData` inner loop | Same as above |
| chatStore.ts | 597 | Silent catch in `extractEntitiesFromMessage` | Add `console.warn` or toast |
| syncStore.ts | 254 | Silent catch in inner IIFE | Add toast notification for sync failure |

### Priority 4 — LOW: Inconsistent loading state

| File | Actions | Issue |
|---|---|---|
| systemStore.ts | `fetchMetrics`, `fetchDebts`, `fetchTrends`, `fetchStatus`, `fetchQuickStatus`, `fetchConstraintRules` | No `loading = true` before async work |
| aiProviderStore.ts | `testConnection`, `testConnectionParams` | No `loading` state set |
| relationStore.ts | `addRelationship`, `removeRelationship` | No loading state |
| messageStore.ts | `sendMessage`, `retryMessage` | No `isLoading` (uses `isStreaming` instead, which is acceptable) |

---

## 4. Recommended Pattern (from checkerStore.ts)

Every async action in a Zustand store should follow this pattern:

```typescript
actionName: async (params) => {
  set((state) => {
    state.loading.target = true
    state.error = null
  })
  try {
    const result = await apiCall(params)
    set((state) => {
      state.data = result
    })
    return result
  } catch (error) {
    const msg = error instanceof Error ? error.message : '操作失败'
    set((state) => { state.error = msg })
    showOperationError('操作名称', error)
    return null  // or throw, depending on caller needs
  } finally {
    set((state) => { state.loading.target = false })
  }
},
```

Key elements:
1. **Before:** Set `loading = true`, clear `error`
2. **try:** Perform async work, update state on success
3. **catch:** Set `error` state AND call `showOperationError()` for user-visible toast
4. **finally:** Always set `loading = false`

---

## 5. Duplicate Store Concern

`entityStore.ts` and `settingsDataSlice.ts` have nearly identical CRUD operations for the same entities (characters, items, locations, factions, worldSettings, rules, ifLines). Both have the same error handling gaps. This duplication means:
- Fixes must be applied to both files
- Risk of behavioral drift between the two
- Consider consolidating into a single store or having entityStore delegate to settingsDataSlice
