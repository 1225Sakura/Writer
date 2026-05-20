import { useAIStore } from '@/store'
import { motion } from 'framer-motion'
import { History } from 'lucide-react'

function getOperationColor(op: string): string {
  const colors: Record<string, string> = {
    optimize: 'var(--accent-primary)',
    expand: 'var(--color-ifline)',
    condense: 'var(--color-character)',
    rewrite: 'var(--color-item)',
    continue: 'var(--color-location)',
    polish: 'var(--color-vermillion)',
  }
  return colors[op] || 'var(--accent-primary)'
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return '刚刚'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`
  return `${Math.floor(seconds / 86400)}天前`
}

export function OperationHistoryTimeline() {
  const { aiJobQueue } = useAIStore()
  const completedJobs = aiJobQueue.filter((j) => j.status === 'completed').slice(-5).reverse()

  if (completedJobs.length === 0) return null

  const getOperationLabel = (op: string): string => {
    const labels: Record<string, string> = {
      optimize: '优化',
      expand: '扩写',
      condense: '缩写',
      rewrite: '改写',
      continue: '续写',
      polish: '润色',
    }
    return labels[op] || op
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <History className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
        <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>操作历史</span>
      </div>
      <div className="relative pl-3">
        {/* Timeline vertical line */}
        <div
          className="absolute left-[5px] top-1 bottom-1 w-px"
          style={{ background: 'linear-gradient(180deg, var(--accent-primary) 0%, var(--border-subtle) 100%)' }}
        />
        <div className="space-y-2.5">
          {completedJobs.map((job, index) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative flex items-center gap-2.5"
            >
              {/* Timeline dot */}
              <div
                className="absolute left-[-7px] w-[11px] h-[11px] rounded-full border-2 flex-shrink-0"
                style={{
                  borderColor: 'var(--color-surface-raised)',
                  background: getOperationColor(job.type),
                  boxShadow: `0 0 6px ${getOperationColor(job.type)}50`,
                }}
              />
              <div className="flex-1 min-w-0 pl-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {getOperationLabel(job.type)}
                  </span>
                  <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                    {job.completedAt ? formatTimeAgo(job.completedAt) : ''}
                  </span>
                </div>
                <div className="text-[10px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                  {job.content?.slice(0, 30)}...
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}