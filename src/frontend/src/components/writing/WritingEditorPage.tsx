import { useUIStore } from '@/store'
import { WritingToolbar } from './WritingToolbar'
import { WritingCanvas } from './WritingCanvas'
import { AIOperationDrawer } from './AIOperationDrawer'
import { CollaborationPanel } from './CollaborationPanel'
import { X } from 'lucide-react'

export function WritingEditorPage() {
  const { aiDrawerOpen, collaborationDrawerOpen, setAIDrawerOpen, setCollaborationDrawerOpen } = useUIStore()

  return (
    <div className="h-full flex flex-col bg-[#08090a]">
      {/* 工具栏 */}
      <WritingToolbar />

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 写作区域 */}
        <div className="flex-1 overflow-hidden relative">
          <WritingCanvas />
        </div>

        {/* AI操作抽屉 - 右侧 280px */}
        {aiDrawerOpen && (
          <div className="w-[280px] border-l border-[rgba(255,255,255,0.08)] bg-[#191a1b] flex flex-col">
            <div className="p-3 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between">
              <span className="font-medium text-sm text-[#f7f8f8]">写作操作</span>
              <button
                onClick={() => setAIDrawerOpen(false)}
                className="p-1 rounded hover:bg-[rgba(255,255,255,0.08)] transition-colors"
              >
                <X className="w-4 h-4 text-[#d0d6e0]" />
              </button>
            </div>
            <AIOperationDrawer />
          </div>
        )}

        {/* 协作面板 - 右侧 260px */}
        {collaborationDrawerOpen && (
          <div className="w-[260px] border-l border-[rgba(255,255,255,0.08)] bg-[#191a1b] flex flex-col">
            <div className="p-3 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between">
              <span className="font-medium text-sm text-[#f7f8f8]">协作面板</span>
              <button
                onClick={() => setCollaborationDrawerOpen(false)}
                className="p-1 rounded hover:bg-[rgba(255,255,255,0.08)] transition-colors"
              >
                <X className="w-4 h-4 text-[#d0d6e0]" />
              </button>
            </div>
            <CollaborationPanel />
          </div>
        )}
      </div>
    </div>
  )
}
