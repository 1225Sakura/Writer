import { useUIStore, useSettingsStore } from '@/store'
import { CategoryNav } from './CategoryNav'
import { EntityEditor } from './EntityEditor'
import { RelationGraph } from './RelationGraph'
import { AISuggestionPanel } from './AISuggestionPanel'
import { Settings, Feather, RefreshCw, PenTool, ArrowLeft } from 'lucide-react'

export function SettingEditorPage() {
  const { settingsCategory, setCurrentInterface } = useUIStore()
  const generateRelations = useSettingsStore((state) => state.generateRelations)
  const generate = useSettingsStore((state) => state.generate)

  return (
    <div className="flex h-full" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* 左侧：分类导航 - 224px 宽 */}
      <div
        className="flex-shrink-0 h-full overflow-hidden flex flex-col"
        style={{
          width: '224px',
          backgroundColor: '#0f1011',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <CategoryNav />
      </div>

      {/* 中间：实体编辑器 */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        {/* 顶部工具栏 */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{
            backgroundColor: '#0f1011',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4" style={{ color: '#5e6ad2' }} />
            <span className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
              设定编辑器
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentInterface('chat')}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-all"
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
              <ArrowLeft className="w-3.5 h-3.5" />
              返回聊天
            </button>
            <button
              onClick={() => setCurrentInterface('writing')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
              style={{
                backgroundColor: 'rgba(94,106,210,0.15)',
                color: '#5e6ad2',
                border: '1px solid rgba(94,106,210,0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(94,106,210,0.25)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(94,106,210,0.15)'
              }}
            >
              <PenTool className="w-3.5 h-3.5" />
              开始写作
            </button>
            <button
              onClick={generate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
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
              <Feather className="w-3.5 h-3.5" />
              智能生成
            </button>
          </div>
        </div>

        {/* 编辑器内容区 */}
        <div className="flex-1 overflow-y-auto p-5">
          <EntityEditor category={settingsCategory} />
        </div>

        {/* AI审查建议 */}
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <AISuggestionPanel />
        </div>
      </div>

      {/* 右侧：关系图谱 - 320px 宽 */}
      <div
        className="flex-shrink-0 h-full flex flex-col overflow-hidden"
        style={{
          width: '320px',
          backgroundColor: '#0a0b0d',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#d0d6e0' }}>
              关系图谱
            </span>
          </div>
          <button
            onClick={generateRelations}
            className="p-1.5 rounded transition-all"
            style={{ color: '#5e6ad2' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(94,106,210,0.15)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
            title="生成关系"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <RelationGraph />
        </div>
      </div>
    </div>
  )
}
