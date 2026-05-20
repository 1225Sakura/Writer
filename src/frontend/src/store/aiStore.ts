import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { aiApi, stylesApi } from '../api/writing'
import { consumeStream } from '../api/chat'
import { showOperationError } from '../utils/toastHelper'

// ============================================
// Types
// ============================================

/** AI生成队列项 */
export interface AIGenerationJob {
  id: string
  type: 'optimize' | 'expand' | 'condense' | 'rewrite' | 'continue' | 'polish'
  content: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  result?: string
  error?: string
  createdAt: number
  completedAt?: number
  progress: number
  retryCount: number
}

interface AIState {
  aiJobQueue: AIGenerationJob[]
  currentJobId: string | null
  availableStyles: Array<{ id: string; name: string; description: string }>
  loading: {
    ai: boolean
    styles: boolean
  }
  error: string | null
}

interface AIActions {
  // Queue management
  addJob: (type: AIGenerationJob['type'], content: string) => string
  cancelJob: (jobId: string) => void
  clearCompletedJobs: () => void
  retryJob: (jobId: string) => Promise<void>
  getJobStatus: (jobId: string) => AIGenerationJob | undefined
  /** @internal Process next job in queue */
  processNextJob: () => Promise<void>
  /** @internal Wait for a specific job to complete */
  waitForJob: (jobId: string) => Promise<void>

  // AI operations
  optimize: (content: string) => Promise<string>
  expand: (content: string) => Promise<string>
  condense: (content: string) => Promise<string>
  rewrite: (content: string) => Promise<string>
  continue: (content: string) => Promise<string>
  polish: (content: string) => Promise<string>

  // Styles
  fetchStyles: () => Promise<void>
}

// ============================================
// Helpers
// ============================================

const genJobId = () => `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

// ============================================
// Store
// ============================================

export const useAIStore = create<AIState & AIActions>()(
  immer(
    subscribeWithSelector((set, get) => ({
      // Initial state
      aiJobQueue: [],
      currentJobId: null,
      availableStyles: [],
      loading: {
        ai: false,
        styles: false,
      },
      error: null,

      // ----------------------------------------
      // Queue management
      // ----------------------------------------

      addJob: (type, content) => {
        const jobId = genJobId()
        const job: AIGenerationJob = {
          id: jobId,
          type,
          content,
          status: 'pending',
          createdAt: Date.now(),
          progress: 0,
          retryCount: 0,
        }
        set((state) => {
          state.aiJobQueue.push(job)
        })
        // Auto-process if not already processing
        const { currentJobId } = get()
        if (!currentJobId) {
          get().processNextJob()
        }
        return jobId
      },

      cancelJob: (jobId) => {
        set((state) => {
          const job = state.aiJobQueue.find((j) => j.id === jobId)
          if (!job) return

          if (job.status === 'pending') {
            job.status = 'failed'
            job.error = '已取消'
          } else if (job.status === 'processing') {
            job.error = '取消中...'
          }
        })
      },

      clearCompletedJobs: () => {
        set((state) => {
          state.aiJobQueue = state.aiJobQueue.filter(
            (j) => j.status === 'pending' || j.status === 'processing'
          )
        })
      },

      retryJob: async (jobId) => {
        set((state) => {
          const job = state.aiJobQueue.find((j) => j.id === jobId)
          if (job) {
            job.status = 'pending'
            job.error = undefined
            job.progress = 0
          }
        })
        await get().processNextJob()
      },

      getJobStatus: (jobId) => {
        return get().aiJobQueue.find((j) => j.id === jobId)
      },

      // Internal: process next job in queue with retry, timeout, and cancellation
      processNextJob: async () => {
        const { aiJobQueue, currentJobId } = get()
        if (currentJobId) return // Already processing

        const nextJob = aiJobQueue.find((j) => j.status === 'pending')
        if (!nextJob) return

        const MAX_RETRIES = 3
        const TIMEOUT_MS = 30000

        set((state) => {
          state.currentJobId = nextJob.id
          nextJob.status = 'processing'
          nextJob.progress = 5
          state.loading.ai = true
        })

        // Get chapterId and ratio from writingStore
        const { useWritingStore } = await import('./writingStore')
        const chapterId = useWritingStore.getState().currentChapterId ?? undefined
        const ratio = useWritingStore.getState().humanAIRatio
        let lastError: Error | null = null

        // Retry loop
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          // Check if job was cancelled before starting
          const currentJob = get().aiJobQueue.find((j) => j.id === nextJob.id)
          if (!currentJob || currentJob.error === '取消中...') {
            set((state) => {
              const job = state.aiJobQueue.find((j) => j.id === nextJob.id)
              if (job) {
                job.status = 'failed'
                job.error = '已取消'
                job.progress = 0
              }
              state.currentJobId = null
              state.loading.ai = false
            })
            return
          }

          if (attempt > 0) {
            set((state) => {
              const job = state.aiJobQueue.find((j) => j.id === nextJob.id)
              if (job) {
                job.retryCount = attempt
                job.progress = 5
                job.error = undefined
              }
            })
            // Exponential backoff before retry
            await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000))
          }

          try {
            let res: { stream: ReadableStream<Uint8Array>; headers: { operation: string; 'human-ai-ratio': string; style: string } }
            switch (nextJob.type) {
              case 'optimize':
                res = await aiApi.optimize(nextJob.content, chapterId, ratio)
                break
              case 'expand':
                res = await aiApi.expand(nextJob.content, chapterId, ratio)
                break
              case 'condense':
                res = await aiApi.shrink(nextJob.content, chapterId, ratio)
                break
              case 'rewrite':
                res = await aiApi.rewrite(nextJob.content, chapterId, ratio)
                break
              case 'continue':
                res = await aiApi.continue(nextJob.content, chapterId, ratio)
                break
              case 'polish':
                res = await aiApi.polish(nextJob.content, chapterId, ratio)
                break
              default:
                throw new Error('Unknown job type')
            }

            // Consume stream with timeout, progress tracking, and cancellation check
            const result = await Promise.race([
              consumeStream(res.stream, {
                onChunk: () => {
                  // Chunk updates are handled by progress events
                },
                onProgress: (percent) => {
                  set((state) => {
                    const job = state.aiJobQueue.find((j) => j.id === nextJob.id)
                    if (job) job.progress = percent
                  })
                },
                onDone: () => {
                  set((state) => {
                    const job = state.aiJobQueue.find((j) => j.id === nextJob.id)
                    if (job) job.progress = 100
                  })
                },
              }),
              new Promise<string>((_, reject) => {
                setTimeout(() => {
                  reject(new Error('AI生成超时，请重试'))
                }, TIMEOUT_MS)
              }),
            ])

            // Check if cancelled during stream consumption
            const postStreamJob = get().aiJobQueue.find((j) => j.id === nextJob.id)
            if (postStreamJob?.error === '取消中...') {
              set((state) => {
                const job = state.aiJobQueue.find((j) => j.id === nextJob.id)
                if (job) {
                  job.status = 'failed'
                  job.error = '已取消'
                  job.progress = 0
                }
                state.currentJobId = null
                state.loading.ai = false
              })
              return
            }

            // Validate result
            if (!result || !result.trim()) {
              throw new Error('AI返回了空内容')
            }

            set((state) => {
              const job = state.aiJobQueue.find((j) => j.id === nextJob.id)
              if (job) {
                job.status = 'completed'
                job.result = result
                job.completedAt = Date.now()
                job.progress = 100
                job.retryCount = attempt
              }
              state.currentJobId = null
              state.loading.ai = false
            })

            // Success - break retry loop
            lastError = null
            break
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))
            console.warn(`[AI Job] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed for ${nextJob.type}:`, lastError.message)

            // Don't retry on cancellation
            const checkJob = get().aiJobQueue.find((j) => j.id === nextJob.id)
            if (checkJob?.error === '取消中...') {
              set((state) => {
                const job = state.aiJobQueue.find((j) => j.id === nextJob.id)
                if (job) {
                  job.status = 'failed'
                  job.error = '已取消'
                  job.progress = 0
                }
                state.currentJobId = null
                state.loading.ai = false
              })
              return
            }

            // On final attempt, mark as failed
            if (attempt === MAX_RETRIES) {
              set((state) => {
                const job = state.aiJobQueue.find((j) => j.id === nextJob.id)
                if (job) {
                  job.status = 'failed'
                  job.error = lastError?.message || 'AI生成失败，已达到最大重试次数'
                  job.progress = 0
                }
                state.currentJobId = null
                state.loading.ai = false
              })
            }
          }
        }

        // Process next job
        await get().processNextJob()
      },

      optimize: async (content) => {
        const jobId = get().addJob('optimize', content)
        await get().waitForJob(jobId)
        const job = get().aiJobQueue.find((j) => j.id === jobId)
        if (job?.status === 'completed') return job.result!
        throw new Error(job?.error || 'Optimization failed')
      },

      expand: async (content) => {
        const jobId = get().addJob('expand', content)
        await get().waitForJob(jobId)
        const job = get().aiJobQueue.find((j) => j.id === jobId)
        if (job?.status === 'completed') return job.result!
        throw new Error(job?.error || 'Expansion failed')
      },

      condense: async (content) => {
        const jobId = get().addJob('condense', content)
        await get().waitForJob(jobId)
        const job = get().aiJobQueue.find((j) => j.id === jobId)
        if (job?.status === 'completed') return job.result!
        throw new Error(job?.error || 'Shrink failed')
      },

      rewrite: async (content) => {
        const jobId = get().addJob('rewrite', content)
        await get().waitForJob(jobId)
        const job = get().aiJobQueue.find((j) => j.id === jobId)
        if (job?.status === 'completed') return job.result!
        throw new Error(job?.error || 'Rewrite failed')
      },

      continue: async (content) => {
        const jobId = get().addJob('continue', content)
        await get().waitForJob(jobId)
        const job = get().aiJobQueue.find((j) => j.id === jobId)
        if (job?.status === 'completed') return job.result!
        throw new Error(job?.error || 'Continue failed')
      },

      polish: async (content) => {
        const jobId = get().addJob('polish', content)
        await get().waitForJob(jobId)
        const job = get().aiJobQueue.find((j) => j.id === jobId)
        if (job?.status === 'completed') return job.result!
        throw new Error(job?.error || 'Polish failed')
      },

      // Helper to wait for a job
      waitForJob: async (jobId) => {
        return new Promise<void>((resolve) => {
          const check = () => {
            const job = get().aiJobQueue.find((j) => j.id === jobId)
            if (job && (job.status === 'completed' || job.status === 'failed')) {
              resolve()
            } else {
              setTimeout(check, 100)
            }
          }
          check()
        })
      },

      // ----------------------------------------
      // Styles
      // ----------------------------------------

      fetchStyles: async () => {
        set((state) => { state.loading.styles = true })
        try {
          const styles = await stylesApi.list()
          set((state) => { state.availableStyles = styles })
        } catch (error) {
          showOperationError('fetchStyles', error)
        } finally {
          set((state) => { state.loading.styles = false })
        }
      },
    }))
  )
)

// ============================================
// Selectors
// ============================================

export const selectPendingJobs = (state: AIState) =>
  state.aiJobQueue.filter((j) => j.status === 'pending')

export const selectCompletedJobs = (state: AIState) =>
  state.aiJobQueue.filter((j) => j.status === 'completed')

export function cleanupAIStore() {
  useAIStore.setState((state) => {
    state.loading.ai = false
    state.loading.styles = false
    state.error = null
  })
}
