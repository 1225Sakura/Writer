import { useUIStore, useSettingsStore } from '@/store'
import { CategoryNav } from './CategoryNav'
import { EntityEditor } from './EntityEditor'
import { RelationGraph } from './RelationGraph'
import { AISuggestionPanel } from './AISuggestionPanel'
import { Button } from '@/components/ui/Button'
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
          backgroundColor: 'var(--color-bg-surface)',
          borderRight: '1px solid var(--color-border)',
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
            backgroundColor: 'var(--color-bg-surface)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4" style={{ color: '#5e6ad2' }} />
            <span className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
              设定编辑器
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setCurrentInterface('chat')}
              variant="ghost"
              size="sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              返回聊天
            </Button>
            <Button
              onClick={() => setCurrentInterface('writing')}
              variant="primary"
              size="sm"
            >
              <PenTool className="w-3.5 h-3.5" />
              开始写作
            </Button>
            <Button
              onClick={() => {
                if (settingsCategory !== 'outline' && settingsCategory !== 'ifline') {
                  generate(settingsCategory as 'character' | 'item' | 'location' | 'faction' | 'world' | 'rule')
                }
              }}
              variant="ghost"
              size="sm"
            >
              <Feather className="w-3.5 h-3.5" />
              智能生成
            </Button>
          </div>
        </div>

        {/* 编辑器内容区 */}
        <div className="flex-1 overflow-y-auto p-5">
          <EntityEditor category={settingsCategory} />
        </div>

        {/* AI审查建议 */}
        <div
          style={{
            borderTop: '1px solid var(--color-border)',
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
          backgroundColor: 'var(--color-bg-primary)',
          borderLeft: '1px solid var(--color-border)',
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#d0d6e0' }}>
              关系图谱
            </span>
          </div>
          <Button
            onClick={generateRelations}
            variant="ghost"
            size="icon"
            title="生成关系"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          <RelationGraph />
        </div>
      </div>
    </div>
  )
}
