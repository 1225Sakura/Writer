import { useState } from 'react'
import { ChevronDown, ChevronUp, Check, X, Sparkles } from 'lucide-react'

interface Suggestion {
  id: string
  type: 'consistency' | 'relationship' | 'foreshadowing' | 'suggestion'
  title: string
  description: string
  autoFixable: boolean
}

const mockSuggestions: Suggestion[] = [
  {
    id: '1',
    type: 'consistency',
    title: '境界设定不一致',
    description: '主角境界设定为炼气三层，但第三章描述为筑基期',
    autoFixable: true,
  },
  {
    id: '2',
    type: 'relationship',
    title: '关系冲突',
    description: '玄天宗少主与主角有杀父之仇，但势力图中显示为同门',
    autoFixable: false,
  },
  {
    id: '3',
    type: 'foreshadowing',
    title: '伏笔未揭示',
    description: '第一章埋下"神秘玉佩"伏笔，尚未在第五章揭示',
    autoFixable: false,
  },
  {
    id: '4',
    type: 'suggestion',
    title: '建议增加角色',
    description: '建议为李青云增加一个劲敌角色增加戏剧冲突',
    autoFixable: false,
  },
]

const typeLabels: Record<string, string> = {
  consistency: '一致性',
  relationship: '关系',
  foreshadowing: '伏笔',
  suggestion: '建议',
}

const typeColors: Record<string, { bg: string; text: string; border: string }> = {
  consistency: { bg: 'rgba(196,92,92,0.15)', text: '#d45d5d', border: 'rgba(196,92,92,0.3)' },
  relationship: { bg: 'rgba(232,184,125,0.15)', text: '#e8b87d', border: 'rgba(232,184,125,0.3)' },
  foreshadowing: { bg: 'rgba(126,184,74,0.15)', text: '#7eb84a', border: 'rgba(126,184,74,0.3)' },
  suggestion: { bg: 'rgba(94,106,210,0.15)', text: '#5e6ad2', border: 'rgba(94,106,210,0.3)' },
}

export function AISuggestionPanel() {
  const [isExpanded, setIsExpanded] = useState(true)
  const [suggestions] = useState<Suggestion[]>(mockSuggestions)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visibleSuggestions = suggestions.filter((s) => !dismissed.has(s.id))

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set([...prev, id]))
  }

  const handleApplyFix = (id: string) => {
    console.log('Applying fix for suggestion:', id)
    handleDismiss(id)
  }

  return (
    <div style={{ backgroundColor: '#0f1011' }}>
      {/* 头部 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between transition-all"
        style={{ borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: '#5e6ad2' }} />
          <span className="text-sm font-medium" style={{ color: '#f7f8f8' }}>
            AI 审查建议
          </span>
          {visibleSuggestions.length > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(196,92,92,0.15)', color: '#d45d5d' }}
            >
              {visibleSuggestions.length}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" style={{ color: '#6b7280' }} />
        ) : (
          <ChevronUp className="w-4 h-4" style={{ color: '#6b7280' }} />
        )}
      </button>

      {/* 内容 */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-2">
          {visibleSuggestions.length === 0 ? (
            <div className="text-center py-6">
              <Check className="w-8 h-8 mx-auto mb-2" style={{ color: '#7eb84a' }} />
              <p className="text-sm" style={{ color: '#6b7280' }}>
                设定一致，暂无建议
              </p>
            </div>
          ) : (
            visibleSuggestions.map((suggestion) => {
              const colors = typeColors[suggestion.type]
              return (
                <div
                  key={suggestion.id}
                  className="p-3 rounded-lg transition-all"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className="text-xs px-2 py-0.5 rounded font-medium"
                          style={{
                            backgroundColor: colors.bg,
                            color: colors.text,
                          }}
                        >
                          {typeLabels[suggestion.type]}
                        </span>
                        <span className="text-sm font-medium" style={{ color: '#f7f8f8' }}>
                          {suggestion.title}
                        </span>
                      </div>
                      <p className="text-xs line-clamp-2" style={{ color: '#6b7280' }}>
                        {suggestion.description}
                      </p>
                    </div>
                    <div className="flex gap-1 ml-2 flex-shrink-0">
                      {suggestion.autoFixable && (
                        <button
                          onClick={() => handleApplyFix(suggestion.id)}
                          className="p-1.5 rounded transition-all"
                          style={{ color: '#6b7280' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(126,184,74,0.15)'
                            e.currentTarget.style.color = '#7eb84a'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                            e.currentTarget.style.color = '#6b7280'
                          }}
                          title="自动修复"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDismiss(suggestion.id)}
                        className="p-1.5 rounded transition-all"
                        style={{ color: '#6b7280' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'
                          e.currentTarget.style.color = '#9ca3af'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent'
                          e.currentTarget.style.color = '#6b7280'
                        }}
                        title="忽略"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}

          {/* 批量操作 */}
          {visibleSuggestions.length > 0 && (
            <div className="flex gap-2 pt-3">
              <button
                onClick={() => {
                  visibleSuggestions
                    .filter((s) => s.autoFixable)
                    .forEach((s) => handleApplyFix(s.id))
                }}
                className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  color: '#d0d6e0',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'
                }}
              >
                应用所有修复
              </button>
              <button
                onClick={() => setDismissed(new Set(visibleSuggestions.map((s) => s.id)))}
                className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: 'transparent',
                  color: '#9ca3af',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                仅记录问题
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
