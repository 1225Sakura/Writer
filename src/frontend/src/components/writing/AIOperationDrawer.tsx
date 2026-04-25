import { useState, useCallback, useEffect } from 'react'
import { useWritingStore, WritingStyle } from '@/store'
import { getEditorInstance } from '@/store/editorRegistry'
import { showToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { HumanAIRatioSlider } from '@/components/ui/HumanAIRatioSlider'
import { CircularProgress } from '@/components/ui/CircularProgress'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  Feather,
  FileText,
  Edit3,
  Sparkles,
  Wand2,
  Loader2,
  Zap,
  Expand,
  Shrink,
  RefreshCw,
  ArrowRight,
  Paintbrush,
  Check,
  X,
  Split,
  TrendingUp,
  Gauge,
  AlertCircle,
  RotateCcw,
  Bot,
  History,
} from 'lucide-react'

const writingStyles: Array<{ value: WritingStyle; label: string; description: string; color: string }> = [
  { value: 'default', label: '默认', description: '标准网络小说风格', color: 'var(--accent-primary)' },
  { value: 'jiangnan', label: '江南', description: '细腻描写，意境悠远', color: 'var(--color-character)' },
  { value: 'kafka', label: '卡夫卡', description: '荒诞隐喻，意识流', color: 'var(--color-item)' },
  { value: 'camus', label: '加缪', description: '哲学思辨，冷峻叙事', color: 'var(--color-location)' },
  { value: 'custom', label: '自定义', description: '上传参考文本', color: 'var(--color-vermillion)' },
]

interface AIOperation {
  key: 'optimize' | 'expand' | 'condense' | 'rewrite' | 'continue' | 'polish'
  label: string
  shortcut: string
  icon: React.ReactNode
  activeIcon: React.ReactNode
  description: string
  color: string
}

const aiOperations: AIOperation[] = [
  {
    key: 'optimize',
    label: '优化',
    shortcut: 'Ctrl+Shift+O',
    icon: <Zap className="w-5 h-5" />,
    activeIcon: <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none" />,
    description: '提升表达质量',
    color: 'var(--accent-primary)',
  },
  {
    key: 'expand',
    label: '扩写',
    shortcut: 'Ctrl+Shift+E',
    icon: <Expand className="w-5 h-5" />,
    activeIcon: <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none" />,
    description: '丰富细节描写',
    color: 'var(--color-ifline)',
  },
  {
    key: 'condense',
    label: '缩写',
    shortcut: 'Ctrl+Shift+S',
    icon: <Shrink className="w-5 h-5" />,
    activeIcon: <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none" />,
    description: '精简冗余内容',
    color: 'var(--color-character)',
  },
  {
    key: 'rewrite',
    label: '改写',
    shortcut: 'Ctrl+Shift+R',
    icon: <RefreshCw className="w-5 h-5" />,
    activeIcon: <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none" />,
    description: '换一种表达方式',
    color: 'var(--color-item)',
  },
  {
    key: 'continue',
    label: '续写',
    shortcut: 'Ctrl+Shift+W',
    icon: <ArrowRight className="w-5 h-5" />,
    activeIcon: <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none" />,
    description: '延续当前情节',
    color: 'var(--color-location)',
  },
  {
    key: 'polish',
    label: '润色',
    shortcut: 'Ctrl+Shift+P',
    icon: <Paintbrush className="w-5 h-5" />,
    activeIcon: <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none" />,
    description: '打磨文笔风格',
    color: 'var(--color-vermillion)',
  },
]

// Quality score display component
function QualityScoreBadge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 90) return 'var(--color-ifline)'
    if (s >= 75) return 'var(--color-location)'
    if (s >= 60) return 'var(--color-character)'
    return 'var(--color-vermillion)'
  }
  const getLabel = (s: number) => {
    if (s >= 90) return '优秀'
    if (s >= 75) return '良好'
    if (s >= 60) return '一般'
    return '需改进'
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--border-default)' }}>
      <CircularProgress
        value={score}
        size={44}
        strokeWidth={3}
        color={getColor(score)}
        trackColor="var(--border-subtle)"
        showPercentage={true}
      />
      <div className="flex-1">
        <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>AI生成质量</div>
        <div className="text-sm font-semibold" style={{ color: getColor(score) }}>
          {getLabel(score)}
        </div>
      </div>
    </div>
  )
}

// Diff preview component for comparing original and AI result
function DiffPreview({
  original,
  result,
  onAccept,
  onReject,
  qualityScore,
}: {
  original: string
  result: string
  onAccept: () => void
  onReject: () => void
  qualityScore: number
}) {
  const [viewMode, setViewMode] = useState<'split' | 'result'>('split')

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mt-4 space-y-3"
    >
      {/* Quality score */}
      <QualityScoreBadge score={qualityScore} />

      {/* View mode toggle */}
      <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--border-default)' }}>
        <button
          onClick={() => setViewMode('split')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-all font-medium ${
            viewMode === 'split'
              ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Split className="w-3.5 h-3.5" />
          对比
        </button>
        <button
          onClick={() => setViewMode('result')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-all font-medium ${
            viewMode === 'result'
              ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          仅结果
        </button>
      </div>

      {/* Content preview */}
      <div className="space-y-2">
        {viewMode === 'split' && (
          <div className="space-y-2">
            <div className="p-3 rounded-xl" style={{ background: 'color-mix(in srgb, var(--color-vermillion) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-vermillion) 15%, transparent)' }}>
              <div className="text-[10px] uppercase tracking-wider mb-1.5 font-semibold" style={{ color: 'var(--color-vermillion)' }}>原文</div>
              <div className="text-sm line-clamp-4 leading-relaxed" style={{ color: 'var(--text-primary)', opacity: 0.8 }}>{original}</div>
            </div>
            <div className="flex justify-center py-1">
              <ArrowRight className="w-4 h-4 rotate-90" style={{ color: 'var(--accent-primary)' }} />
            </div>
          </div>
        )}
        <div className="p-3 rounded-xl" style={{ background: 'color-mix(in srgb, var(--color-ifline) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-ifline) 15%, transparent)' }}>
          <div className="text-[10px] uppercase tracking-wider mb-1.5 font-semibold" style={{ color: 'var(--color-ifline)' }}>
            {viewMode === 'split' ? 'AI生成' : '结果'}
          </div>
          <div className="text-sm line-clamp-6 whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-primary)' }}>{result}</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button onClick={onAccept} variant="primary" size="sm" className="flex-1">
          <Check className="w-4 h-4 mr-1" />
          应用
        </Button>
        <Button onClick={onReject} variant="ghost" size="sm" className="flex-1">
          <X className="w-4 h-4 mr-1" />
          放弃
        </Button>
      </div>
    </motion.div>
  )
}

// AI Operation History Timeline
function OperationHistoryTimeline() {
  const { aiJobQueue } = useWritingStore()
  const completedJobs = aiJobQueue.filter((j) => j.status === 'completed').slice(-5).reverse()

  if (completedJobs.length === 0) return null

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

// Haptic feedback helper
function triggerHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(8)
  }
}

// Refined AI Drawer Header with pulse glow + gradient title
function DrawerHeader() {
  return (
    <div className="flex items-center gap-3 pb-3 mb-1">
      <div className="relative flex-shrink-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center relative z-10"
          style={{
            background: 'linear-gradient(135deg, rgba(94, 106, 210, 0.22) 0%, rgba(94, 106, 210, 0.08) 100%)',
            border: '1px solid rgba(94, 106, 210, 0.3)',
            boxShadow: '0 0 16px rgba(94, 106, 210, 0.15), inset 0 1px 0 rgba(94, 106, 210, 0.1)',
          }}
        >
          <Bot className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
        </div>
        {/* Pulse glow ring */}
        <span
          className="absolute inset-[-2px] rounded-xl animate-ping opacity-25 motion-reduce:animate-none"
          style={{
            background: 'rgba(94, 106, 210, 0.15)',
            animationDuration: '2.5s',
            boxShadow: '0 0 12px rgba(94, 106, 210, 0.2)',
          }}
        />
        {/* Inner glow */}
        <span
          className="absolute inset-0 rounded-xl opacity-40"
          style={{
            boxShadow: 'inset 0 0 8px rgba(94, 106, 210, 0.2)',
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <h3
          className="text-sm font-bold tracking-tight"
          style={{
            background: 'linear-gradient(90deg, var(--accent-primary) 0%, var(--accent-90) 50%, #8b96e8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          AI 写作助手
        </h3>
        <p className="text-[10px] leading-tight flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
          <span
            className="inline-block w-1 h-1 rounded-full animate-pulse motion-reduce:animate-none"
            style={{ background: 'var(--accent-primary)', boxShadow: '0 0 4px var(--accent-primary)' }}
          />
          智能辅助 · 实时生成
        </p>
      </div>
    </div>
  )
}

// Refined loading skeleton for AI operations
function AILoadingSkeleton() {
  return (
    <div className="space-y-3 p-1">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl skeleton-shimmer" />
        <div className="flex-1 space-y-2">
          <div className="h-3 rounded-md skeleton-shimmer w-24" />
          <div className="h-2 rounded-md skeleton-shimmer w-16" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="h-20 rounded-xl skeleton-shimmer" />
        <div className="h-20 rounded-xl skeleton-shimmer" />
        <div className="h-20 rounded-xl skeleton-shimmer" />
        <div className="h-20 rounded-xl skeleton-shimmer" />
      </div>
      <div className="h-1.5 rounded-full skeleton-shimmer" />
      <div className="space-y-2">
        <div className="h-3 rounded-md skeleton-shimmer w-full" />
        <div className="h-3 rounded-md skeleton-shimmer w-3/4" />
      </div>
    </div>
  )
}

export function AIOperationDrawer() {
  const {
    humanAIRatio,
    setHumanAIRatio,
    writingStyle,
    setWritingStyle,
    optimize,
    expand,
    condense: shrink,
    rewrite,
    continue: continueWriting,
    polish,
    aiJobQueue,
    currentJobId,
    cancelJob,
    retryJob,
  } = useWritingStore()
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['global', 'style', 'ratio', 'selection'])
  )
  const [previewResult, setPreviewResult] = useState<{
    operation: string
    original: string
    result: string
    qualityScore: number
  } | null>(null)
  const [isMinimized, _setIsMinimized] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isHeaderHovered, setIsHeaderHovered] = useState(false)

  // Trigger haptic on mount
  useEffect(() => {
    triggerHaptic()
  }, [])

  // Track current job for progress display
  const currentJob = aiJobQueue.find((j) => j.id === currentJobId)
  const activeOperation = currentJob?.type || null

  const handleOperation = async (
    operation: 'optimize' | 'expand' | 'condense' | 'rewrite' | 'continue' | 'polish'
  ) => {
    const editor = getEditorInstance()
    const selectedText = editor
      ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ')
      : ''

    if (!selectedText) {
      showToast('请先选中需要操作的文字', 'warning')
      return
    }

    setPreviewResult(null)
    setIsLoading(true)

    try {
      let result: string
      switch (operation) {
        case 'optimize':
          result = await optimize(selectedText)
          break
        case 'expand':
          result = await expand(selectedText)
          break
        case 'condense':
          result = await shrink(selectedText)
          break
        case 'rewrite':
          result = await rewrite(selectedText)
          break
        case 'continue':
          result = await continueWriting(selectedText)
          break
        case 'polish':
          result = await polish(selectedText)
          break
        default:
          throw new Error(`Unknown operation: ${operation}`)
      }

      // Simulate quality score (in real app, this would come from API)
      const qualityScore = Math.round(70 + Math.random() * 25)

      setPreviewResult({
        operation,
        original: selectedText,
        result,
        qualityScore,
      })
      // Content update toast style
      showToast(`${getOperationLabel(operation)}完成`, 'success')
    } catch (error) {
      console.error(`[写作操作] ${operation} failed:`, error)
      showToast(`${getOperationLabel(operation)}失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    if (currentJobId) {
      cancelJob(currentJobId)
      showToast('已取消AI生成', 'info')
    }
  }

  const handleRetry = async (jobId: string) => {
    try {
      await retryJob(jobId)
      showToast('正在重试...', 'info')
    } catch (error) {
      showToast('重试失败', 'error')
    }
  }

  const handleAcceptResult = useCallback(() => {
    const editor = getEditorInstance()
    if (editor && previewResult) {
      editor.commands.insertContent(previewResult.result)
      showToast('已应用AI生成内容', 'success')
      setPreviewResult(null)
    }
  }, [previewResult])

  const handleRejectResult = useCallback(() => {
    setPreviewResult(null)
    showToast('已放弃AI生成内容', 'info')
  }, [])

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 ai-drawer-scroll">
      {/* Refined AI Drawer Header with gradient bg */}
      <div
        className="ai-drawer-header rounded-xl p-3 mb-1"
        onMouseEnter={() => setIsHeaderHovered(true)}
        onMouseLeave={() => setIsHeaderHovered(false)}
        style={{
          background: isHeaderHovered
            ? 'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 12%, transparent) 0%, color-mix(in srgb, var(--accent-primary) 5%, transparent) 100%)'
            : 'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 8%, transparent) 0%, transparent 100%)',
          border: '1px solid color-mix(in srgb, var(--accent-primary) 15%, transparent)',
          transition: 'background 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <DrawerHeader />
      </div>

      {/* Minimize/Maximize control */}
      <AnimatePresence mode="wait">
        {!isMinimized ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3"
          >
            {/* 全文操作 */}
            <Section
              title="全文操作"
              icon={<FileText className="w-4 h-4" />}
              isExpanded={expandedSections.has('global')}
              onToggle={() => toggleSection('global')}
            >
              <div className="space-y-2">
                <GlobalOperationButton
                  icon={<Feather className="w-4 h-4" />}
                  label="生成下一章"
                  description="基于当前剧情自动生成"
                  onClick={() => showToast('正在生成下一章...', 'info')}
                />
                <GlobalOperationButton
                  icon={<Sparkles className="w-4 h-4" />}
                  label="优化全文"
                  description="提升整体表达质量"
                  onClick={() => showToast('正在优化全文...', 'info')}
                />
                <GlobalOperationButton
                  icon={<Wand2 className="w-4 h-4" />}
                  label="文笔重塑"
                  description="按选定风格重写"
                  onClick={() => showToast('正在重塑文笔...', 'info')}
                />
              </div>
            </Section>

            {/* 人机比例 */}
            <Section
              title="人机协作比例"
              icon={<Gauge className="w-4 h-4" />}
              isExpanded={expandedSections.has('ratio')}
              onToggle={() => toggleSection('ratio')}
            >
              <div className="space-y-3">
                <HumanAIRatioSlider
                  value={humanAIRatio}
                  onChange={setHumanAIRatio}
                />
                {/* Ratio indicator */}
                <div className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: 'var(--color-surface-raised)' }}>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: 'linear-gradient(90deg, var(--accent-primary) 0%, var(--color-ifline) 100%)',
                      }}
                      initial={false}
                      animate={{ width: `${humanAIRatio}%` }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <span className="text-xs font-medium min-w-[3.5em] text-right" style={{ color: 'var(--text-secondary)' }}>
                    {humanAIRatio < 30 ? 'AI辅助' : humanAIRatio < 70 ? '协作模式' : 'AI主导'}
                  </span>
                </div>
              </div>
            </Section>

            {/* 文笔风格 */}
            <Section
              title="文笔风格"
              icon={<Edit3 className="w-4 h-4" />}
              isExpanded={expandedSections.has('style')}
              onToggle={() => toggleSection('style')}
            >
              <div className="space-y-1.5">
                {writingStyles.map((style) => (
                  <StyleButton
                    key={style.value}
                    label={style.label}
                    description={style.description}
                    color={style.color}
                    isActive={writingStyle === style.value}
                    onClick={() => setWritingStyle(style.value)}
                  />
                ))}
              </div>
            </Section>

            {/* 写作操作 */}
            <Section
              title="AI写作操作"
              icon={<Sparkles className="w-4 h-4" />}
              isExpanded={expandedSections.has('selection')}
              onToggle={() => toggleSection('selection')}
            >
              {isLoading && !previewResult ? (
                <AILoadingSkeleton />
              ) : (
                <div className="space-y-3">
                  {/* Operation buttons with grouping */}
                  <motion.div className="grid grid-cols-2 gap-2"
                    initial="hidden"
                    animate="visible"
                    variants={{
                      hidden: {},
                      visible: { transition: { staggerChildren: 0.06 } }
                    }}
                  >
                    {aiOperations.slice(0, 3).map((op) => (
                      <AIOperationButton
                        key={op.key}
                        operation={op}
                        isLoading={activeOperation === op.key}
                        isDisabled={activeOperation !== null && activeOperation !== op.key}
                        progress={activeOperation === op.key ? (currentJob?.progress ?? 0) : 0}
                        onClick={() => handleOperation(op.key)}
                      />
                    ))}
                  </motion.div>
                  {/* Subtle divider between groups */}
                  <div className="relative py-1">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, var(--border-subtle) 30%, var(--border-subtle) 70%, transparent 100%)' }} />
                    </div>
                  </div>
                  <motion.div className="grid grid-cols-2 gap-2"
                    initial="hidden"
                    animate="visible"
                    variants={{
                      hidden: {},
                      visible: { transition: { staggerChildren: 0.06, delayChildren: 0.18 } }
                    }}
                  >
                    {aiOperations.slice(3).map((op) => (
                      <AIOperationButton
                        key={op.key}
                        operation={op}
                        isLoading={activeOperation === op.key}
                        isDisabled={activeOperation !== null && activeOperation !== op.key}
                        progress={activeOperation === op.key ? (currentJob?.progress ?? 0) : 0}
                        onClick={() => handleOperation(op.key)}
                      />
                    ))}
                  </motion.div>

                  {/* Progress bar for active operation */}
                  <AnimatePresence>
                    {currentJob && currentJob.status === 'processing' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 space-y-2.5"
                      >
                        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span className="font-medium">{getOperationLabel(currentJob.type)}中...
                            {currentJob.retryCount > 0 && (
                              <span style={{ color: 'var(--color-vermillion)' }}> (重试 {currentJob.retryCount}/3)</span>
                            )}
                          </span>
                          <span className="font-mono">{currentJob.progress}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: 'var(--accent-primary)' }}
                            initial={{ width: 0 }}
                            animate={{ width: `${currentJob.progress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs"
                          onClick={handleCancel}
                        >
                          <X className="w-3 h-3 mr-1" />
                          取消生成
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Failed job with retry */}
                  <AnimatePresence>
                    {aiJobQueue.map((job) =>
                      job.status === 'failed' && job.id === currentJobId ? (
                        <motion.div
                          key={job.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          className="mt-4 p-3 rounded-xl flex items-center gap-3"
                          style={{
                            background: 'color-mix(in srgb, var(--color-vermillion) 8%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--color-vermillion) 15%, transparent)',
                          }}
                        >
                          <AlertCircle className="w-4 h-4 flex-shrink-0 text-[var(--icon-danger)]" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {getOperationLabel(job.type)}失败
                            </div>
                            <div className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>
                              {job.error || '未知错误'}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs flex-shrink-0"
                            onClick={() => handleRetry(job.id)}
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            重试
                          </Button>
                        </motion.div>
                      ) : null
                    )}
                  </AnimatePresence>

                  <p className="text-xs mt-3 text-center" style={{ color: 'var(--text-tertiary)' }}>
                    选中文字后点击或使用快捷键
                  </p>

                  {/* Result preview */}
                  <AnimatePresence>
                    {previewResult && (
                      <DiffPreview
                        original={previewResult.original}
                        result={previewResult.result}
                        qualityScore={previewResult.qualityScore}
                        onAccept={handleAcceptResult}
                        onReject={handleRejectResult}
                      />
                    )}
                  </AnimatePresence>

                  {/* Operation History Timeline */}
                  <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <OperationHistoryTimeline />
                  </div>
                </div>
              )}
            </Section>
          </motion.div>
        ) : (
          <motion.div
            key="minimized"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center gap-3 py-4"
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(94, 106, 210, 0.2) 0%, rgba(94, 106, 210, 0.08) 100%)',
                border: '1px solid rgba(94, 106, 210, 0.25)',
                boxShadow: '0 0 20px rgba(94, 106, 210, 0.15)',
              }}
            >
              <Bot className="w-6 h-6" style={{ color: 'var(--accent-primary)' }} />
            </div>
            <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>已最小化</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function getOperationLabel(op: string): string {
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

function Section({
  title,
  icon,
  isExpanded,
  onToggle,
  children,
}: {
  title: string
  icon?: React.ReactNode
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <motion.div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--border-default)',
      }}
      whileHover={{ borderColor: 'var(--border-strong)' }}
      transition={{ duration: 0.15 }}
    >
      <motion.button
        onClick={onToggle}
        className="w-full px-3.5 py-3 flex items-center gap-2.5 transition-colors hover:bg-[var(--hover-bg)]"
        whileTap={{ scale: 0.98 }}
      >
        <motion.span
          className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
          style={{ background: 'var(--accent-muted)', color: 'var(--accent-primary)' }}
          whileHover={{ scale: 1.1 }}
        >
          {icon}
        </motion.span>
        <span className="flex-1 text-left text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </span>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <ChevronDown
            className="w-4 h-4 flex-shrink-0"
            style={{ color: 'var(--text-tertiary)' }}
          />
        </motion.div>
      </motion.button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div
              className="px-3.5 pb-3.5 pt-1"
              style={{
                borderTop: '1px solid var(--border-subtle)',
                background: 'var(--color-surface-raised)',
              }}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function AIOperationButton({
  operation,
  isLoading,
  isDisabled,
  progress,
  onClick,
}: {
  operation: AIOperation
  isLoading: boolean
  isDisabled: boolean
  progress?: number
  onClick: () => void
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={isDisabled}
      variants={{
        hidden: { opacity: 0, y: 12, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 28 } }
      }}
      whileHover={isDisabled ? {} : { y: -3, boxShadow: `0 8px 24px color-mix(in srgb, ${operation.color} 25%, transparent), 0 0 16px color-mix(in srgb, ${operation.color} 15%, transparent)` }}
      whileTap={{ scale: isDisabled ? 1 : 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`ai-op-card relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200 overflow-hidden touch-target-button
        ${isLoading
          ? 'border-[var(--accent-primary)]/50 bg-[var(--accent-primary)]/8 animate-glow-border'
          : 'border-[var(--border-default)] bg-[var(--color-surface-base)] hover:border-[var(--border-strong)]'
        }
        ${isDisabled && !isLoading ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
      `}
      style={{
        boxShadow: isLoading
          ? `0 0 20px color-mix(in srgb, ${operation.color} 20%, transparent), inset 0 1px 0 color-mix(in srgb, ${operation.color} 10%, transparent)`
          : undefined,
      }}
    >
      {/* Loading overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--accent-muted)' }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Icon with background circle */}
      <motion.span
        className={`flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 transition-all duration-200 ${
          isLoading ? 'scale-75 opacity-0' : ''
        }`}
        style={{
          background: isLoading
            ? 'transparent'
            : `color-mix(in srgb, ${operation.color} 15%, transparent)`,
          color: isLoading ? 'var(--accent-primary)' : operation.color,
          boxShadow: isLoading
            ? 'none'
            : `0 0 16px color-mix(in srgb, ${operation.color} 25%, transparent), inset 0 1px 0 color-mix(in srgb, ${operation.color} 20%, transparent)`,
        }}
        whileHover={isLoading ? {} : { scale: 1.1, boxShadow: `0 0 24px color-mix(in srgb, ${operation.color} 40%, transparent)` }}
      >
        {isLoading ? operation.activeIcon : operation.icon}
      </motion.span>

      {/* Label with enhanced typography */}
      <motion.span
        className={`text-sm font-bold transition-opacity duration-200 ${isLoading ? 'opacity-0' : ''}`}
        style={{ color: 'var(--text-primary)', letterSpacing: '0.02em' }}
      >
        {operation.label}
      </motion.span>

      {/* Description */}
      <motion.span
        className={`text-[10px] leading-tight text-center transition-opacity duration-200 ${isLoading ? 'opacity-0' : ''}`}
        style={{ color: 'var(--text-tertiary)' }}
      >
        {operation.description}
      </motion.span>

      {/* Enhanced KBD shortcut with better styling */}
      <motion.kbd
        className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono transition-all duration-200 ${isLoading ? 'opacity-0' : ''}`}
        style={{
          background: 'linear-gradient(180deg, var(--color-surface-input) 0%, color-mix(in srgb, var(--color-surface-input) 80%, transparent) 100%)',
          border: '1px solid var(--border-default)',
          borderBottomWidth: '2px',
          color: 'var(--text-secondary)',
          boxShadow: '0 1px 2px var(--shadow-sm)',
        }}
        whileHover={isLoading ? {} : { scale: 1.05, borderColor: 'var(--border-strong)' }}
      >
        {operation.shortcut}
      </motion.kbd>

      {/* Mini progress bar when loading */}
      {isLoading && progress !== undefined && progress > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
          <motion.div
            className="h-full"
            style={{ background: `linear-gradient(90deg, var(--accent-primary) 0%, ${operation.color} 100%)` }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}
    </motion.button>
  )
}

function GlobalOperationButton({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  description: string
  onClick?: () => void
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className="w-full flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 cursor-pointer text-left
                 bg-[var(--color-surface-base)] border border-[var(--border-default)]
                 hover:border-[var(--border-strong)] hover:bg-[var(--hover-bg)] hover:shadow-glow-sm"
    >
      <span
        className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
        style={{ background: 'var(--accent-muted)', color: 'var(--accent-primary)' }}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</div>
        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{description}</div>
      </div>
    </motion.button>
  )
}

function StyleButton({
  label,
  description,
  color,
  isActive,
  onClick,
}: {
  label: string
  description: string
  color: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className="w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 cursor-pointer text-left"
      style={{
        background: isActive ? 'var(--accent-muted)' : 'var(--color-surface-base)',
        borderColor: isActive ? 'color-mix(in srgb, var(--accent-primary) 40%, transparent)' : 'var(--border-default)',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.borderColor = 'var(--border-strong)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.borderColor = 'var(--border-default)'
        }
      }}
    >
      <span
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 8px ${color}40`,
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</div>
        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{description}</div>
      </div>
      {isActive && <Check className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />}
    </motion.button>
  )
}
