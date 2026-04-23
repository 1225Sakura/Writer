/**
 * 乐观更新工具函数
 * 用于在 API 调用前立即更新 UI，失败时自动回滚
 */

export interface OptimisticContext<T> {
  /** 执行乐观更新 */
  optimistic: (updater: (draft: T) => void) => void
  /** 确认更新成功 */
  commit: () => void
  /** 回滚到更新前状态 */
  rollback: () => void
}

/**
 * 创建乐观更新上下文
 * @param getState 获取当前状态的函数
 * @param setState 设置状态的函数（immer draft）
 * @returns OptimisticContext
 */
export function createOptimisticContext<T>(
  getState: () => T,
  setState: (updater: (draft: T) => void) => void
): OptimisticContext<T> {
  let snapshot: T | null = null

  return {
    optimistic: (updater) => {
      // 保存快照
      snapshot = JSON.parse(JSON.stringify(getState()))
      // 应用乐观更新
      setState(updater)
    },
    commit: () => {
      // 确认更新，清除快照
      snapshot = null
    },
    rollback: () => {
      if (snapshot) {
        // 恢复到快照状态
        setState(() => {
          // Return snapshot to replace entire state
          return snapshot as T
        })
        snapshot = null
      }
    },
  }
}

/**
 * 带乐观更新的异步操作包装器
 * @param context 乐观更新上下文
 * @param optimisticUpdater 乐观更新函数
 * @param asyncFn 实际的异步操作
 * @param errorHandler 错误处理回调（会自动回滚）
 */
export async function withOptimisticUpdate<T, R>(
  context: OptimisticContext<T>,
  optimisticUpdater: (draft: T) => void,
  asyncFn: () => Promise<R>,
  errorHandler?: (error: Error) => void
): Promise<R | undefined> {
  context.optimistic(optimisticUpdater)

  try {
    const result = await asyncFn()
    context.commit()
    return result
  } catch (error) {
    context.rollback()
    if (errorHandler) {
      errorHandler(error as Error)
    }
    throw error
  }
}

/**
 * 消息发送的乐观更新助手
 */
export interface OptimisticMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  pending?: boolean
  failed?: boolean
}

export function createOptimisticMessage(
  content: string,
  genId: () => string
): OptimisticMessage {
  return {
    id: genId(),
    role: 'user',
    content,
    createdAt: Date.now(),
    pending: true,
  }
}

/**
 * 实体编辑的乐观更新助手
 */
export interface OptimisticEntityUpdate<T> {
  id: number | string
  updates: Partial<T>
  original: T
}

export function createOptimisticEntityUpdate<T extends { id: number | string }>(
  entity: T,
  updates: Partial<T>
): OptimisticEntityUpdate<T> {
  return {
    id: entity.id,
    updates,
    original: JSON.parse(JSON.stringify(entity)),
  }
}
