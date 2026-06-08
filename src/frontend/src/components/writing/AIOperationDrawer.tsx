import { useState, useCallback, useEffect } from 'react'
import { useWritingStore, useAIStore, useContextStore } from '@/store'
import { getEditorInstance } from '@/store/editorRegistry'
import { showToast } from '@/components/ui/Toast'
import { aiApi, chapterApi } from '@/api/writing'
import { evaluateQualityHeuristic } from '@/utils/qualityHeuristic'
import { consumeStream } from '@/api/chat'
import { Button } from '@/components/ui/Button'
import { motion, AnimatePresence } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import {
  FileText,
  Edit3,
  Sparkles,
  Loader2,
  Zap,
  Expand,
  Shrink,
  RefreshCw,
  ArrowRight,
  Paintbrush,
  X,
  Gauge,
  AlertCircle,
  RotateCcw,
  Bot,
  Database,
  Check,
} from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import {
  DrawerHeader,
  AILoadingSkeleton,
  Section,
  AIOperationButton,
  GenerationOptions,
  StyleSelector,
  RatioSliderSection,
  DiffPreview,
  OperationHistoryTimeline,
} from './operations'

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
  { key: 'optimize', label: '优化', shortcut: 'Ctrl+Shift+O', icon: <Icon icon={Zap} size="md" />, activeIcon: <Icon icon={Loader2} size="md" className="animate-spin motion-reduce:animate-none" />, description: '提升表达质量', color: 'var(--accent-primary)' },
  { key: 'expand', label: '扩写', shortcut: 'Ctrl+Shift+E', icon: <Icon icon={Expand} size="md" />, activeIcon: <Icon icon={Loader2} size="md" className="animate-spin motion-reduce:animate-none" />, description: '丰富细节描写', color: 'var(--color-ifline)' },
  { key: 'condense', label: '缩写', shortcut: 'Ctrl+Shift+S', icon: <Icon icon={Shrink} size="md" />, activeIcon: <Icon icon={Loader2} size="md" className="animate-spin motion-reduce:animate-none" />, description: '精简冗余内容', color: 'var(--color-character)' },
  { key: 'rewrite', label: '改写', shortcut: 'Ctrl+Shift+R', icon: <Icon icon={RefreshCw} size="md" />, activeIcon: <Icon icon={Loader2} size="md" className="animate-spin motion-reduce:animate-none" />, description: '换一种表达方式', color: 'var(--color-item)' },
  { key: 'continue', label: '续写', shortcut: 'Ctrl+Shift+W', icon: <Icon icon={ArrowRight} size="md" />, activeIcon: <Icon icon={Loader2} size="md" className="animate-spin motion-reduce:animate-none" />, description: '延续当前情节', color: 'var(--color-location)' },
  { key: 'polish', label: '润色', shortcut: 'Ctrl+Shift+P', icon: <Icon icon={Paintbrush} size="md" />, activeIcon: <Icon icon={Loader2} size="md" className="animate-spin motion-reduce:animate-none" />, description: '打磨文笔风格', color: 'var(--color-vermillion)' },
]

function getOperationLabel(op: string): string {
  const labels: Record<string, string> = { optimize: '优化', expand: '扩写', condense: '缩写', rewrite: '改写', continue: '续写', polish: '润色' }
  return labels[op] || op
}

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(8)
  }
}

/** Evaluate quality score via backend API, falling back to frontend heuristic. */
async function evaluateQualityScore(original: string, result: string, operation: string): Promise<number> {
  try {
    const response = await aiApi.evaluateQuality(original, result, operation)
    return response.overall
  } catch {
    // Backend unavailable — use frontend heuristic fallback
    return evaluateQualityHeuristic(original, result, operation)
  }
}

/** Get the paragraph text at the current cursor position. Returns null if no editor or empty doc. */
function getParagraphAtCursor(editor: ReturnType<typeof getEditorInstance>): { text: string; isAtEnd: boolean } | null {
  if (!editor) return null
  const { state } = editor
  const { selection } = state
  const { $from } = selection

  // Walk up to the nearest block node (paragraph, heading, etc.)
  const depth = $from.depth
  for (let d = depth; d >= 0; d--) {
    const node = $from.node(d)
    if (node.isBlock && node.textContent.trim()) {
      const startPos = $from.start(d)
      const endPos = $from.end(d)
      const text = state.doc.textBetween(startPos, endPos, '\n')
      // Check if cursor is at or near the end of this paragraph (within 2 chars)
      const cursorPos = selection.from
      const isAtEnd = cursorPos >= endPos - 2
      return { text, isAtEnd }
    }
  }
  return null
}

export function AIOperationDrawer() {
  const { humanAIRatio, setHumanAIRatio, writingStyle, setWritingStyle, currentChapterId } = useWritingStore()
  const { optimize, expand, condense: shrink, rewrite, continue: continueWriting, polish, aiJobQueue, currentJobId, cancelJob, retryJob } = useAIStore()
  const { contextPack, loading: contextLoading, buildContext } = useContextStore()
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['global', 'style', 'ratio', 'selection']))
  const [previewResult, setPreviewResult] = useState<{ operation: string; original: string; result: string; qualityScore: number } | null>(null)
  const [isMinimized, _setIsMinimized] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [globalLoading, setGlobalLoading] = useState<string | null>(null)

  useCallback(() => { triggerHaptic() }, [])()

  // Auto-build context when chapter changes
  useEffect(() => {
    if (currentChapterId) {
      buildContext(currentChapterId)
    }
  }, [currentChapterId, buildContext])

  const currentJob = aiJobQueue.find((j) => j.id === currentJobId)
  const activeOperation = currentJob?.type || null

  const handleOperation = async (operation: 'optimize' | 'expand' | 'condense' | 'rewrite' | 'continue' | 'polish') => {
    const editor = getEditorInstance()
    let selectedText = editor ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ') : ''

    // When no text is selected, get the paragraph at cursor position
    if (!selectedText) {
      const paragraph = getParagraphAtCursor(editor)
      if (!paragraph || !paragraph.text.trim()) {
        showToast('请先选中文字或将光标放在段落中', 'warning')
        return
      }
      // If cursor is at paragraph end and operation is not explicitly chosen as continue,
      // still use the paragraph as context (the user clicked an operation button)
      selectedText = paragraph.text
      if (paragraph.isAtEnd && operation === 'continue') {
        showToast('基于当前段落续写中...', 'info')
      }
    }

    setPreviewResult(null)
    setIsLoading(true)
    try {
      let result: string
      switch (operation) {
        case 'optimize': result = await optimize(selectedText); break
        case 'expand': result = await expand(selectedText); break
        case 'condense': result = await shrink(selectedText); break
        case 'rewrite': result = await rewrite(selectedText); break
        case 'continue': result = await continueWriting(selectedText); break
        case 'polish': result = await polish(selectedText); break
        default: throw new Error(`Unknown operation: ${operation}`)
      }
      const qualityScore = await evaluateQualityScore(selectedText, result, operation)
      setPreviewResult({ operation, original: selectedText, result, qualityScore })
      showToast(`${getOperationLabel(operation)}完成`, 'success')
    } catch (error) {
      showToast(`${getOperationLabel(operation)}失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => { if (currentJobId) { cancelJob(currentJobId); showToast('已取消AI生成', 'info') } }
  const handleRetry = async (jobId: string) => { try { await retryJob(jobId); showToast('正在重试...', 'info') } catch { showToast('重试失败', 'error') } }
  const handleAcceptResult = useCallback(() => {
    const editor = getEditorInstance()
    if (editor && previewResult) { editor.commands.insertContent(previewResult.result); showToast('已应用AI生成内容', 'success'); setPreviewResult(null) }
  }, [previewResult])
  const handleRejectResult = useCallback(() => { setPreviewResult(null); showToast('已放弃AI生成内容', 'info') }, [])

  const handleGenerateNextChapter = useCallback(async () => {
    const editor = getEditorInstance()
    const context = editor?.state.doc.textContent ?? ''
    if (!context) { showToast('当前没有内容，请先编写一些内容', 'warning'); return }

    setGlobalLoading('generate')
    try {
      const res = await aiApi.generate({
        prompt: context,
        operation: 'continue',
        chapter_id: useWritingStore.getState().currentChapterId ?? undefined,
        human_ai_ratio: useWritingStore.getState().humanAIRatio,
      })
      const result = await consumeStream(res.stream)
      const qualityScore = await evaluateQualityScore(context.slice(-200), result, 'continue')
      setPreviewResult({ operation: 'continue', original: context.slice(-200), result, qualityScore })
      showToast('下一章已生成', 'success')
    } catch (error) {
      showToast(`生成失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    } finally {
      setGlobalLoading(null)
    }
  }, [])

  const handleOptimizeAll = useCallback(async () => {
    setGlobalLoading('optimize')
    try {
      const chapters = await chapterApi.list()
      if (!chapters.length) { showToast('没有可优化的章节', 'warning'); setGlobalLoading(null); return }

      const ratio = useWritingStore.getState().humanAIRatio
      let optimized = 0
      for (const chapter of chapters) {
        try {
          const content = chapter.summary ?? chapter.title ?? `第${chapter.chapter_order ?? chapter.id}章`
          const res = await aiApi.optimize(content, chapter.id, ratio)
          await consumeStream(res.stream)
          optimized++
        } catch {
          // Continue with remaining chapters
        }
      }
      showToast(`全文优化完成 (${optimized}/${chapters.length}章)`, 'success')
    } catch (error) {
      showToast(`优化失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    } finally {
      setGlobalLoading(null)
    }
  }, [])

  const handleRemoldStyle = useCallback(async () => {
    const editor = getEditorInstance()
    const content = editor?.state.doc.textContent ?? ''
    if (!content) { showToast('当前没有内容，请先编写一些内容', 'warning'); return }

    setGlobalLoading('remold')
    try {
      const style = useWritingStore.getState().writingStyle
      const res = await aiApi.generate({
        prompt: content,
        operation: 'rewrite',
        chapter_id: useWritingStore.getState().currentChapterId ?? undefined,
        human_ai_ratio: useWritingStore.getState().humanAIRatio,
        style,
      })
      const result = await consumeStream(res.stream)
      const qualityScore = await evaluateQualityScore(content.slice(0, 200), result, 'rewrite')
      setPreviewResult({ operation: 'rewrite', original: content.slice(0, 200), result, qualityScore })
      showToast('文笔重塑完成', 'success')
    } catch (error) {
      showToast(`重塑失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    } finally {
      setGlobalLoading(null)
    }
  }, [])

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 ai-drawer-scroll">
      <div className="p-3 mb-1"><DrawerHeader /></div>

      <AnimatePresence mode="wait">
        {!isMinimized ? (
          <motion.div key="expanded" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }} className="space-y-3">
            {/* 全文操作 */}
            <Section title="全文操作" icon={<Icon icon={FileText} size="sm" />} isExpanded={expandedSections.has('global')} onToggle={() => toggleSection('global')}>
              <GenerationOptions onGenerateNextChapter={handleGenerateNextChapter} onOptimizeAll={handleOptimizeAll} onRemoldStyle={handleRemoldStyle} loading={globalLoading} />
            </Section>

            {/* 人机比例 */}
            <Section title="人机协作比例" icon={<Icon icon={Gauge} size="sm" />} isExpanded={expandedSections.has('ratio')} onToggle={() => toggleSection('ratio')}>
              <RatioSliderSection humanAIRatio={humanAIRatio} setHumanAIRatio={setHumanAIRatio} />
            </Section>

            {/* 文笔风格 */}
            <Section title="文笔风格" icon={<Icon icon={Edit3} size="sm" />} isExpanded={expandedSections.has('style')} onToggle={() => toggleSection('style')}>
              <StyleSelector writingStyle={writingStyle} onStyleChange={setWritingStyle} />
            </Section>

            {/* 上下文状态 */}
            {currentChapterId && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: contextPack ? 'color-mix(in srgb, var(--color-ifline) 8%, transparent)' : 'var(--color-surface-overlay)', border: `1px solid ${contextPack ? 'color-mix(in srgb, var(--color-ifline) 20%, transparent)' : 'var(--border-subtle)'}` }}>
                <Icon icon={contextLoading ? Loader2 : contextPack ? Check : Database} size="xs" className={contextLoading ? 'animate-spin' : ''} style={{ color: contextPack ? 'var(--color-ifline)' : 'var(--text-tertiary)' }} />
                <span style={{ color: contextPack ? 'var(--color-ifline)' : 'var(--text-tertiary)' }}>
                  {contextLoading ? '加载上下文...' : contextPack ? '上下文已就绪' : '上下文未加载'}
                </span>
              </div>
            )}

            {/* AI写作操作 */}
            <Section title="AI写作操作" icon={<Icon icon={Sparkles} size="sm" />} isExpanded={expandedSections.has('selection')} onToggle={() => toggleSection('selection')}>
              {isLoading && !previewResult ? (
                <AILoadingSkeleton />
              ) : (
                <div className="space-y-3">
                  <motion.div className="grid grid-cols-2 gap-2" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}>
                    {aiOperations.slice(0, 3).map((op) => (
                      <AIOperationButton key={op.key} operation={op} isLoading={activeOperation === op.key} isDisabled={activeOperation !== null && activeOperation !== op.key} progress={activeOperation === op.key ? (currentJob?.progress ?? 0) : 0} onClick={() => handleOperation(op.key)} />
                    ))}
                  </motion.div>

                  <div className="relative py-1">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, var(--border-subtle) 30%, var(--border-subtle) 70%, transparent 100%)' }} />
                    </div>
                  </div>

                  <motion.div className="grid grid-cols-2 gap-2" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06, delayChildren: 0.18 } } }}>
                    {aiOperations.slice(3).map((op) => (
                      <AIOperationButton key={op.key} operation={op} isLoading={activeOperation === op.key} isDisabled={activeOperation !== null && activeOperation !== op.key} progress={activeOperation === op.key ? (currentJob?.progress ?? 0) : 0} onClick={() => handleOperation(op.key)} />
                    ))}
                  </motion.div>

                  {/* Progress bar */}
                  <AnimatePresence>
                    {currentJob && currentJob.status === 'processing' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 space-y-2.5">
                        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span className="font-medium">{getOperationLabel(currentJob.type)}中...{currentJob.retryCount > 0 && <span style={{ color: 'var(--color-vermillion)' }}> (重试 {currentJob.retryCount}/3)</span>}</span>
                          <span className="font-mono">{currentJob.progress}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                          <motion.div className="h-full rounded-full" style={{ background: 'var(--accent-primary)' }} initial={{ width: 0 }} animate={{ width: `${currentJob.progress}%` }} transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }} />
                        </div>
                        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={handleCancel}><Icon icon={X} size="xs" className="mr-1" />取消生成</Button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Failed job */}
                  <AnimatePresence>
                    {aiJobQueue.map((job) => job.status === 'failed' && job.id === currentJobId ? (
                      <motion.div key={job.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="mt-4 p-3 rounded-xl flex items-center gap-3" style={{ background: 'color-mix(in srgb, var(--color-vermillion) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-vermillion) 15%, transparent)' }}>
                        <Icon icon={AlertCircle} size="sm" color="danger" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{getOperationLabel(job.type)}失败</div>
                          <div className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>{job.error || '未知错误'}</div>
                        </div>
                        <Button variant="ghost" size="sm" className="text-xs flex-shrink-0" onClick={() => handleRetry(job.id)}><Icon icon={RotateCcw} size="xs" className="mr-1" />重试</Button>
                      </motion.div>
                    ) : null)}
                  </AnimatePresence>

                  <p className="text-xs mt-3 text-center" style={{ color: 'var(--text-tertiary)' }}>选中文字或点击操作按钮自动获取上下文</p>

                  <AnimatePresence>{previewResult && <DiffPreview original={previewResult.original} result={previewResult.result} qualityScore={previewResult.qualityScore} onAccept={handleAcceptResult} onReject={handleRejectResult} />}</AnimatePresence>

                  <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}><OperationHistoryTimeline /></div>
                </div>
              )}
            </Section>
          </motion.div>
        ) : (
          <motion.div key="minimized" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }} className="flex flex-col items-center gap-3 py-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 20%, transparent) 0%, color-mix(in srgb, var(--accent-primary) 8%, transparent) 100%)', border: '1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent)', boxShadow: '0 0 20px color-mix(in srgb, var(--accent-primary) 15%, transparent)' }}>
              <Icon icon={Bot} size="lg" style={{ color: 'var(--accent-primary)' }} />
            </div>
            <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>已最小化</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}