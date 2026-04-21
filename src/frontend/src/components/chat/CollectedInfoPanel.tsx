import { useState } from 'react'
import { ExtractedEntity, useUIStore } from '@/store'
import { EntityTag } from './EntityTag'
import { CheckCircle, Circle, ChevronRight, ArrowRight, Edit3 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface CollectedInfoPanelProps {
  entities: ExtractedEntity[]
  onConfirmEntity?: (id: string) => void
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

function EntityItem({ entity, onConfirm }: { entity: ExtractedEntity; onConfirm?: (id: string) => void }) {
  const [justConfirmed, setJustConfirmed] = useState(false)

  const handleConfirm = () => {
    if (!entity.confirmed && onConfirm) {
      onConfirm(entity.id)
      setJustConfirmed(true)
      setTimeout(() => setJustConfirmed(false), 800)
    } else {
      onConfirm?.(entity.id)
    }
  }

  return (
    <motion.div
      className="flex items-center gap-2 py-2 px-2 -mx-2 rounded-md cursor-pointer group"
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
      whileHover={{
        backgroundColor: 'rgba(255,255,255,0.03)',
        y: -1,
      }}
      transition={{ duration: 0.15 }}
    >
      <EntityTag type={entity.type} size="small" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>
          {entity.name}
        </div>
        {entity.description && (
          <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {entity.description}
          </div>
        )}
      </div>
      <motion.button
        onClick={handleConfirm}
        className="cursor-pointer"
        title={entity.confirmed ? '已确认' : '点击确认'}
        whileTap={{ scale: 0.85 }}
        animate={justConfirmed ? { scale: [1, 1.3, 1] } : {}}
        transition={{ duration: 0.4 }}
      >
        {entity.confirmed ? (
          <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
        ) : (
          <Circle className="w-4 h-4 flex-shrink-0 hover:text-[#7eb84a]" style={{ color: 'var(--text-secondary)' }} />
        )}
      </motion.button>
    </motion.div>
  )
}

function CategorySection({
  title,
  entities,
  onConfirm,
}: {
  title: string
  entities: ExtractedEntity[]
  onConfirm?: (id: string) => void
}) {
  if (entities.length === 0) return null

  return (
    <motion.div
      className="mb-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center gap-2 mb-2">
        <ChevronRight className="w-3 h-3" style={{ color: 'var(--text-secondary)' }} />
        <h3 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>({entities.length})</span>
      </div>
      <div className="pl-4">
        {entities.map((entity) => (
          <EntityItem key={entity.id} entity={entity} onConfirm={onConfirm} />
        ))}
      </div>
    </motion.div>
  )
}

export function CollectedInfoPanel({ entities, onConfirmEntity }: CollectedInfoPanelProps) {
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
        <h2 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>已收集信息</h2>
        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          {confirmedCount}/{entities.length} 项已确认
        </div>
        {/* 进度条 */}
        <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: 'var(--accent-primary)' }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {entities.length === 0 ? (
            <motion.div
              className="text-center py-8"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Edit3 className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
              </motion.div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                开始对话后，这里将显示收集到的设定信息
              </p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {Object.entries(groupedEntities).map(([type, typeEntities]) => (
                <CategorySection
                  key={type}
                  title={categoryLabels[type] || type}
                  entities={typeEntities}
                  onConfirm={onConfirmEntity}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 底部操作 */}
      <div className="p-4 border-t border-[rgba(255,255,255,0.08)]">
        <div className="flex gap-2 mb-2">
          <motion.button
            className="flex-1 px-3 py-2 text-sm rounded-md border border-[rgba(255,255,255,0.08)]
                       text-[#d0d6e0] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#f7f8f8]"
            onClick={() => useUIStore.getState().setCurrentInterface('chat')}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
          >
            继续完善
          </motion.button>
          <motion.button
            className="flex-1 px-3 py-2 text-sm rounded-md border border-[rgba(255,255,255,0.08)]
                       text-[#d0d6e0] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#f7f8f8]"
            onClick={() => useUIStore.getState().setCurrentInterface('settings')}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
          >
            查看完整设定
          </motion.button>
        </div>
        <motion.button
          className="w-full px-4 py-2 text-sm rounded-md
                     text-white flex items-center justify-center gap-2"
          style={{ backgroundColor: 'var(--accent-primary)' }}
          onClick={() => useUIStore.getState().setCurrentInterface('settings')}
          whileHover={{
            backgroundColor: 'var(--accent-hover)',
            y: -1,
          }}
          whileTap={{ scale: 0.97 }}
        >
          <span>进入设定界面</span>
          <ArrowRight className="w-4 h-4" />
        </motion.button>
      </div>
    </div>
  )
}
