/**
 * 跨 Store 同步工具
 * 用于保持多个 store 之间的数据一致性
 */

import type { StoreApi } from 'zustand'

export type SyncListener<T> = (state: T, prevState: T) => void

interface SyncSubscription {
  unsubscribe: () => void
}

/**
 * 创建跨 store 同步器
 * 当源 store 的特定字段变化时，同步到目标 store
 */
export function createCrossStoreSync<
  SourceState extends object,
  TargetState extends object,
  K extends keyof SourceState
>(
  sourceStore: StoreApi<SourceState>,
  targetStore: StoreApi<TargetState>,
  sourceSelector: (state: SourceState) => SourceState[K],
  targetUpdater: (targetState: TargetState, value: SourceState[K]) => void,
  options?: {
    /** 是否立即同步当前值 */
    immediate?: boolean
    /** 自定义比较函数 */
    equalityFn?: (a: SourceState[K], b: SourceState[K]) => boolean
  }
): SyncSubscription {
  const { immediate = true, equalityFn = Object.is } = options || {}

  let lastValue: SourceState[K] | undefined

  const unsubscribe = sourceStore.subscribe((state) => {
    const value = sourceSelector(state)
    if (lastValue !== undefined && equalityFn(value, lastValue)) {
      return
    }
    lastValue = value
    targetStore.setState((targetState) => {
      targetUpdater(targetState as TargetState, value)
      return targetState
    })
  })

  if (immediate) {
    const currentValue = sourceSelector(sourceStore.getState())
    lastValue = currentValue
    targetStore.setState((targetState) => {
      targetUpdater(targetState as TargetState, currentValue)
      return targetState
    })
  }

  return { unsubscribe }
}

/**
 * 创建双向同步
 */
export function createBidirectionalSync<
  StateA extends object,
  StateB extends object,
  KA extends keyof StateA,
  KB extends keyof StateB
>(
  storeA: StoreApi<StateA>,
  storeB: StoreApi<StateB>,
  selectorA: (state: StateA) => StateA[KA],
  selectorB: (state: StateB) => StateB[KB],
  updaterA: (state: StateA, value: StateB[KB]) => void,
  updaterB: (state: StateB, value: StateA[KA]) => void
): { unsubscribe: () => void } {
  let isSyncing = false

  const unsubA = storeA.subscribe((state) => {
    if (isSyncing) return
    isSyncing = true
    const value = selectorA(state)
    storeB.setState((s) => {
      updaterB(s as StateB, value)
      return s
    })
    isSyncing = false
  })

  const unsubB = storeB.subscribe((state) => {
    if (isSyncing) return
    isSyncing = true
    const value = selectorB(state)
    storeA.setState((s) => {
      updaterA(s as StateA, value)
      return s
    })
    isSyncing = false
  })

  return {
    unsubscribe: () => {
      unsubA()
      unsubB()
    },
  }
}

/**
 * Store 清理工具
 * 用于组件卸载时清理 store 状态，防止内存泄漏
 */
export interface CleanupRegistry {
  register: (cleanupFn: () => void) => void
  cleanup: () => void
}

export function createCleanupRegistry(): CleanupRegistry {
  const cleanups: Set<() => void> = new Set()

  return {
    register: (cleanupFn) => {
      cleanups.add(cleanupFn)
    },
    cleanup: () => {
      cleanups.forEach((fn) => {
        try {
          fn()
        } catch (e) {
          console.error('Cleanup error:', e)
        }
      })
      cleanups.clear()
    },
  }
}

/**
 * 自动清理的订阅包装器
 */
export function createAutoCleanupSubscription<T extends object>(
  store: StoreApi<T>,
  listener: (state: T, prevState: T) => void
): { unsubscribe: () => void } {
  const unsubscribe = store.subscribe(listener)

  return {
    unsubscribe: () => {
      unsubscribe()
    },
  }
}
