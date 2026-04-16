import { ExtractedEntity, useUIStore } from '@/store'
import { EntityTag } from './EntityTag'
import { CheckCircle, Circle, ChevronRight, ArrowRight, Edit3 } from 'lucide-react'

interface CollectedInfoPanelProps {
  entities: ExtractedEntity[]
}

const categoryLabels: Record<string, string> = {
  world: '世界观',
  character: '角色',
  item: '物品',
  location: '地点',
  faction: '势力',
  rule: '规则',
  ifline: 'IF线',
}

function EntityItem({ entity }: { entity: ExtractedEntity }) {
  return (
    <div className="flex items-center gap-2 py-2 border-b border-[rgba(255,255,255,0.06)] last:border-b-0">
      <EntityTag type={entity.type} size="small" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-[#f7f8f8] truncate">{entity.name}</div>
        {entity.description && (
          <div className="text-xs text-[#d0d6e0] truncate mt-0.5">
            {entity.description}
          </div>
        )}
      </div>
      {entity.confirmed ? (
        <CheckCircle className="w-4 h-4 text-[#7eb84a] flex-shrink-0" />
      ) : (
        <Circle className="w-4 h-4 text-[#d0d6e0] flex-shrink-0" />
      )}
    </div>
  )
}

function CategorySection({
  title,
  entities,
}: {
  title: string
  entities: ExtractedEntity[]
}) {
  if (entities.length === 0) return null

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <ChevronRight className="w-3 h-3 text-[#d0d6e0]" />
        <h3 className="font-medium text-sm text-[#f7f8f8]">{title}</h3>
        <span className="text-xs text-[#d0d6e0]">({entities.length})</span>
      </div>
      <div className="pl-4">
        {entities.map((entity) => (
          <EntityItem key={entity.id} entity={entity} />
        ))}
      </div>
    </div>
  )
}

export function CollectedInfoPanel({ entities }: CollectedInfoPanelProps) {
  const groupedEntities = entities.reduce(
    (acc, entity) => {
      const key = entity.type
      if (!acc[key]) acc[key] = []
      acc[key].push(entity)
      return acc
    },
    {} as Record<string, ExtractedEntity[]>
  )

  const confirmedCount = entities.filter((e) => e.confirmed).length
  const progressPercent = entities.length > 0 ? (confirmedCount / entities.length) * 100 : 0

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="p-4 border-b border-[rgba(255,255,255,0.08)]">
        <h2 className="font-medium text-sm text-[#f7f8f8]">已收集信息</h2>
        <div className="text-xs text-[#d0d6e0] mt-1">
          {confirmedCount}/{entities.length} 项已确认
        </div>
        {/* 进度条 */}
        <div className="mt-2 h-1 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#5e6ad2] transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto p-4">
        {entities.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.04)] mx-auto mb-3 flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-[#d0d6e0]" />
            </div>
            <p className="text-[#d0d6e0] text-sm">开始对话后，这里将显示收集到的设定信息</p>
          </div>
        ) : (
          <>
            {Object.entries(groupedEntities).map(([type, typeEntities]) => (
              <CategorySection
                key={type}
                title={categoryLabels[type] || type}
                entities={typeEntities}
              />
            ))}
          </>
        )}
      </div>

      {/* 底部操作 */}
      <div className="p-4 border-t border-[rgba(255,255,255,0.08)]">
        <div className="flex gap-2 mb-2">
          <button
            className="flex-1 px-3 py-2 text-sm rounded-md border border-[rgba(255,255,255,0.08)]
                       text-[#d0d6e0] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#f7f8f8]
                       active:scale-95 transition-all"
            onClick={() => useUIStore.getState().setCurrentInterface('chat')}
          >
            继续完善
          </button>
          <button
            className="flex-1 px-3 py-2 text-sm rounded-md border border-[rgba(255,255,255,0.08)]
                       text-[#d0d6e0] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#f7f8f8]
                       active:scale-95 transition-all"
            onClick={() => useUIStore.getState().setCurrentInterface('settings')}
          >
            查看完整设定
          </button>
        </div>
        <button
          className="w-full px-4 py-2 text-sm rounded-md
                     bg-[#5e6ad2] text-white hover:bg-[#4f5ab8]
                     active:scale-95 transition-all flex items-center justify-center gap-2"
          onClick={() => useUIStore.getState().setCurrentInterface('settings')}
        >
          <span>进入设定界面</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
