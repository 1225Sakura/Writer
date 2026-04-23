import { shallow } from 'zustand/shallow'

/**
 * 细粒度 selector 工厂函数
 * 用于创建仅返回特定字段的 selector，避免不必要的重渲染
 */
export function createSelector<T, K>(selector: (state: T) => K) {
  return selector
}

/**
 * 使用 shallow 比较的 selector hook
 * 用法: const { field1, field2 } = useStore(useShallowSelector(['field1', 'field2']))
 */
export function useShallowSelector<T extends object, K extends keyof T>(
  keys: K[]
): (state: T) => Pick<T, K> {
  return (state: T) => {
    const result = {} as Pick<T, K>
    keys.forEach((key) => {
      result[key] = state[key]
    })
    return result
  }
}

/**
 * 创建带 shallow 比较的 selector
 * 用于选择对象/数组时避免引用变化导致重渲染
 */
export function createShallowSelector<T, K>(selector: (state: T) => K) {
  return (state: T) => selector(state)
}

/**
 * 预定义的常用 shallow selector 组合
 */
export const shallowSelectors = {
  /** 仅选择 loading 状态 */
  loadingOnly: <T extends { isLoading: boolean }>(state: T) =>
    ({ isLoading: state.isLoading }),

  /** 仅选择 error 状态 */
  errorOnly: <T extends { error: string | null }>(state: T) =>
    ({ error: state.error }),

  /** 选择 loading + error */
  statusOnly: <T extends { isLoading: boolean; error: string | null }>(state: T) =>
    ({ isLoading: state.isLoading, error: state.error }),
}

export { shallow }
