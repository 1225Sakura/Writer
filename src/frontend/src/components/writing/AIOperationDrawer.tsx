import { useState, useCallback } from 'react'
import { useWritingStore, WritingStyle } from '@/store'
import { getEditorInstance } from '@/store/editorRegistry'
import { showToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Slider } from '@/components/ui/slider'
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
} from 'lucide-react'

const writingStyles: Array<{ value: WritingStyle; label: string; description: string; color: string }> = [
  { value: 'default', label: '默认', description: '标准网络小说风格', color: '#5e6ad2' },
  { value: 'jiangnan', label: '江南', description: '细腻描写，意境悠远', color: '#e8b87d' },
  { value: 'kafka', label: '卡夫卡', description: '荒诞隐喻，意识流', color: '#9b7ed9' },
  { value: 'camus', label: '加缪', description: '哲学思辨，冷峻叙事', color: '#5eb5a6' },
  { value: 'custom', label: '自定义', description: '上传参考文本', color: '#c45c5c' },
]

interface AIOperation {
  key: 'optimize' | 'expand' | 'shrink' | 'rewrite' | 'continue' | 'polish'
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
    activeIcon: <Loader2 className="w-5 h-5 animate-spin" />,
    description: '提升表达质量',
    color: '#5e6ad2',
  },
  {
    key: 'expand',
    label: '扩写',
    shortcut: 'Ctrl+Shift+E',
    icon: <Expand className="w-5 h-5" />,
    activeIcon: <Loader2 className="w-5 h-5 animate-spin" />,
    description: '丰富细节描写',
    color: '#7eb84a',
  },
  {
    key: 'shrink',
    label: '缩写',
    shortcut: 'Ctrl+Shift+S',
    icon: <Shrink className="w-5 h-5" />,
    activeIcon: <Loader2 className="w-5 h-5 animate-spin" />,
    description: '精简冗余内容',
    color: '#e8b87d',
  },
  {
    key: 'rewrite',
    label: '改写',
    shortcut: 'Ctrl+Shift+R',
    icon: <RefreshCw className="w-5 h-5" />,
    activeIcon: <Loader2 className="w-5 h-5 animate-spin" />,
    description: '换一种表达方式',
    color: '#9b7ed9',
  },
  {
    key: 'continue',
    label: '续写',
    shortcut: 'Ctrl+Shift+W',
    icon: <ArrowRight className="w-5 h-5" />,
    activeIcon: <Loader2 className="w-5 h-5 animate-spin" />,
    description: '延续当前情节',
    color: '#5eb5a6',
  },
  {
    key: 'polish',
    label: '润色',
    shortcut: 'Ctrl+Shift+P',
    icon: <Paintbrush className="w-5 h-5" />,
    activeIcon: <Loader2 className="w-5 h-5 animate-spin" />,
    description: '打磨文笔风格',
    color: '#c45c5c',
  },
]

// Quality score display component
function QualityScoreBadge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 90) return '#7eb84a'
    if (s >= 75) return '#5eb5a6'
    if (s >= 60) return '#e8b87d'
    return '#c45c5c'
  }
  const getLabel = (s: number) => {
    if (s >= 90) return '优秀'
    if (s >= 75) return '良好'
    if (s >= 60) return '一般'
    return '需改进'
  }

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-[#0f1011] border border-[rgba(255,255,255,0.06)]">
      <CircularProgress
        value={score}
        size={40}
        strokeWidth={3}
        color={getColor(score)}
        trackColor="rgba(255,255,255,0.06)"
        showPercentage={true}
      />
      <div className="flex-1">
        <div className="text-xs text-[#d0d6e0]">AI生成质量</div>
        <div className="text-sm font-medium" style={{ color: getColor(score) }}>
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
      className="mt-3 space-y-3"
    >
      {/* Quality score */}
      <QualityScoreBadge score={qualityScore} />

      {/* View mode toggle */}
      <div className="flex gap-1 p-0.5 rounded-lg bg-[#0f1011] border border-[rgba(255,255,255,0.06)]">
        <button
          onClick={() => setViewMode('split')}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-md text-xs transition-all ${
            viewMode === 'split'
              ? 'bg-[#5e6ad2]/20 text-[#5e6ad2]'
              : 'text-[#d0d6e0] hover:text-[#f7f8f8]'
          }`}
        >
          <Split className="w-3 h-3" />
          对比
        </button>
        <button
          onClick={() => setViewMode('result')}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-md text-xs transition-all ${
            viewMode === 'result'
              ? 'bg-[#5e6ad2]/20 text-[#5e6ad2]'
              : 'text-[#d0d6e0] hover:text-[#f7f8f8]'
          }`}
        >
          <TrendingUp className="w-3 h-3" />
          仅结果
        </button>
      </div>

      {/* Content preview */}
      <div className="space-y-2">
        {viewMode === 'split' && (
          <div className="space-y-2">
            <div className="p-2.5 rounded-lg bg-[#c45c5c]/10 border border-[#c45c5c]/20">
              <div className="text-[10px] uppercase tracking-wider text-[#c45c5c] mb-1 font-medium">原文</div>
              <div className="text-sm text-[#f7f8f8]/80 line-clamp-4">{original}</div>
            </div>
            <div className="flex justify-center">
              <ArrowRight className="w-4 h-4 text-[#5e6ad2] rotate-90" />
            </div>
          </div>
        )}
        <div className="p-2.5 rounded-lg bg-[#7eb84a]/10 border border-[#7eb84a]/20">
          <div className="text-[10px] uppercase tracking-wider text-[#7eb84a] mb-1 font-medium">
            {viewMode === 'split' ? 'AI生成' : '结果'}
          </div>
          <div className="text-sm text-[#f7f8f8] line-clamp-6 whitespace-pre-wrap">{result}</div>
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

export function AIOperationDrawer() {
  const {
    humanAIRatio,
    setHumanAIRatio,
    writingStyle,
    setWritingStyle,
    optimize,
    expand,
    shrink,
    rewrite,
    continue: continueWriting,
    polish,
  } = useWritingStore()
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['global', 'style', 'ratio', 'selection'])
  )
  const [operationLoading, setOperationLoading] = useState<string | null>(null)
  const [previewResult, setPreviewResult] = useState<{
    operation: string
    original: string
    result: string
    qualityScore: number
  } | null>(null)

  const handleOperation = async (
    operation: 'optimize' | 'expand' | 'shrink' | 'rewrite' | 'continue' | 'polish'
  ) => {
    const editor = getEditorInstance()
    const selectedText = editor
      ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ')
      : ''

    if (!selectedText) {
      showToast('请先选中需要操作的文字', 'warning')
      return
    }

    setOperationLoading(operation)
    setPreviewResult(null)

    try {
      let result: string
      switch (operation) {
        case 'optimize':
          result = await optimize(selectedText)
          break
        case 'expand':
          result = await expand(selectedText)
          break
        case 'shrink':
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
    } catch (error) {
      console.error(`[写作操作] ${operation} failed:`, error)
      showToast(`${operation}失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    } finally {
      setOperationLoading(null)
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
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
          {/* Custom styled slider */}
          <div className="relative pt-1">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-[#5e6ad2] font-medium">AI主导</span>
              <span className="text-[#f7f8f8] font-semibold">{humanAIRatio}%</span>
              <span className="text-[#7eb84a] font-medium">用户主导</span>
            </div>
            <Slider
              value={[humanAIRatio]}
              min={0}
              max={100}
              step={5}
              onValueChange={(value) => setHumanAIRatio(value[0])}
              className="w-full"
            />
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-[#d0d6e0]/60">AI全自动</span>
              <span className="text-[10px] text-[#d0d6e0]/60">半协作</span>
              <span className="text-[10px] text-[#d0d6e0]/60">纯人工</span>
            </div>
          </div>
          {/* Ratio indicator */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#0f1011]">
            <div className="flex-1 h-1.5 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #5e6ad2 0%, #7eb84a 100%)',
                }}
                initial={false}
                animate={{ width: `${humanAIRatio}%` }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className="text-xs text-[#d0d6e0]">
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
        <div className="space-y-2">
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
        <div className="grid grid-cols-2 gap-2">
          {aiOperations.map((op) => (
            <AIOperationButton
              key={op.key}
              operation={op}
              isLoading={operationLoading === op.key}
              isDisabled={operationLoading !== null}
              onClick={() => handleOperation(op.key)}
            />
          ))}
        </div>
        <p className="text-xs text-[#d0d6e0]/70 mt-2 text-center">
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
      </Section>
    </div>
  )
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
    <div className="border border-[rgba(255,255,255,0.08)] rounded-xl overflow-hidden bg-[#0f1011]">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2.5 flex items-center gap-2
                   hover:bg-[rgba(255,255,255,0.04)] transition-colors"
      >
        {icon && <span className="text-[#5e6ad2]">{icon}</span>}
        <span className="flex-1 text-left text-sm font-medium text-[#f7f8f8]">{title}</span>
        <ChevronDown
          className={`w-4 h-4 text-[#d0d6e0] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="p-3 bg-[#08090a]">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function AIOperationButton({
  operation,
  isLoading,
  isDisabled,
  onClick,
}: {
  operation: AIOperation
  isLoading: boolean
  isDisabled: boolean
  onClick: () => void
}) {
  const [ripple, setRipple] = useState<{ x: number; y: number } | null>(null)

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) return

    // Calculate ripple position
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setRipple({ x, y })
    setTimeout(() => setRipple(null), 600)

    onClick()
  }

  return (
    <motion.button
      onClick={handleClick}
      disabled={isDisabled}
      whileHover={{ scale: isDisabled ? 1 : 1.03 }}
      whileTap={{ scale: isDisabled ? 1 : 0.97 }}
      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200 overflow-hidden
        ${isLoading
          ? 'border-[#5e6ad2]/40 bg-[#5e6ad2]/10'
          : 'border-[rgba(255,255,255,0.08)] bg-[#0f1011] hover:border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.04)]'
        }
        ${isDisabled && !isLoading ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {/* Ripple effect */}
      <AnimatePresence>
        {ripple && (
          <motion.div
            initial={{ opacity: 0.5, scale: 0 }}
            animate={{ opacity: 0, scale: 2.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute w-8 h-8 rounded-full"
            style={{
              left: ripple.x - 16,
              top: ripple.y - 16,
              background: `radial-gradient(circle, ${operation.color}40 0%, transparent 70%)`,
            }}
          />
        )}
      </AnimatePresence>

      {/* Loading overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-xl bg-[#5e6ad2]/5 flex items-center justify-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 className="w-6 h-6 text-[#5e6ad2]" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.span
        style={{ color: isLoading ? '#5e6ad2' : operation.color }}
        animate={isLoading ? { scale: [1, 0.9, 1] } : {}}
        transition={{ duration: 0.5, repeat: isLoading ? Infinity : 0 }}
      >
        {isLoading ? operation.activeIcon : operation.icon}
      </motion.span>
      <span className="text-sm font-medium text-[#f7f8f8]">{operation.label}</span>
      <span className="text-[10px] text-[#d0d6e0]/60">{operation.description}</span>
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-[#d0d6e0]/50">
        {operation.shortcut}
      </span>
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
      className="w-full flex items-center gap-3 p-2.5 rounded-lg
                 bg-[#0f1011] border border-[rgba(255,255,255,0.06)]
                 hover:border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.03)]
                 transition-all duration-200 cursor-pointer text-left"
    >
      <span className="text-[#5e6ad2]">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[#f7f8f8]">{label}</div>
        <div className="text-xs text-[#d0d6e0]/60">{description}</div>
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
      className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all duration-200 cursor-pointer text-left
        ${isActive
          ? 'border-[#5e6ad2]/40 bg-[#5e6ad2]/10'
          : 'border-[rgba(255,255,255,0.06)] bg-[#0f1011] hover:border-[rgba(255,255,255,0.12)]'
        }`}
    >
      <span
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}40` }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[#f7f8f8]">{label}</div>
        <div className="text-xs text-[#d0d6e0]/60">{description}</div>
      </div>
      {isActive && <Check className="w-4 h-4 text-[#5e6ad2] flex-shrink-0" />}
    </motion.button>
  )
}
