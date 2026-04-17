import { useEffect } from 'react'
import { useChatStore, useUIStore } from '@/store'
import { AIGuidePanel } from './AIGuidePanel'
import { UserInputPanel } from './UserInputPanel'
import { CollectedInfoPanel } from './CollectedInfoPanel'
import { Button } from '@/components/ui/Button'
import { ArrowRight, Settings } from 'lucide-react'

export function ChatInitPage() {
  const { extractedEntities, sessionId, createSession, loadExtractedEntities } = useChatStore()
  const { setCurrentInterface } = useUIStore()

  // Initialize session on mount
  useEffect(() => {
    if (!sessionId) {
      createSession()
    }
  }, [sessionId, createSession])

  // Load extracted entities when session changes
  useEffect(() => {
    if (sessionId) {
      loadExtractedEntities()
    }
  }, [sessionId, loadExtractedEntities])

  return (
    <div className="flex h-full bg-[#08090a]">
      {/* 左侧：AI聊天区域 */}
      <div className="flex-1 flex flex-col border-r border-[rgba(255,255,255,0.08)]">
        {/* 顶部导航栏 */}
        <div className="h-12 border-b border-[rgba(255,255,255,0.08)] bg-[#0f1011] flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#5e6ad2] flex items-center justify-center">
              <span className="text-white text-sm font-semibold">写</span>
            </div>
            <h1 className="font-medium text-[#f7f8f8] text-sm">自动化写作软件</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setCurrentInterface('settings')}
              variant="primary"
              size="sm"
            >
              <Settings className="w-4 h-4" />
              <span>进入设定</span>
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* 聊天内容 */}
        <div className="flex-1 overflow-hidden">
          <AIGuidePanel />
        </div>
        <UserInputPanel />
      </div>

      {/* 右侧：已收集信息面板 - 320px */}
      <div className="w-80 bg-[#0f1011] overflow-y-auto">
        <CollectedInfoPanel entities={extractedEntities} />
      </div>
    </div>
  )
}
