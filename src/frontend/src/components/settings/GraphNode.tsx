import {
  LinkIcon,
  Info,
  X,
  Highlighter,
  Focus,
  ExternalLink,
  Sparkles,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { ENTITY_TYPE_CONFIG } from './graphTypes'
import type { GraphNode, NodeDetail, HoverTooltipState, ContextMenuState } from './graphTypes'

export { renderNodeCanvas, renderLinkCanvas } from './GraphCanvasRenderers'

export function GraphFallback() {
  return (
    <div className="h-full flex items-center justify-center relative overflow-hidden rounded-lg" style={{ background: 'var(--ink-100)' }}>
      <div className="absolute inset-0 opacity-[0.04]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle, var(--accent-primary) 0.5px, transparent 0.5px)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>
      <div className="text-center relative z-10">
        <div className="relative mx-auto mb-4 w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-[var(--accent-primary)] border-t-transparent animate-spin" />
          <div
            className="absolute inset-1 rounded-full border-2 border-[var(--accent-primary)] border-b-transparent animate-spin"
            style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
          />
          <Sparkles className="w-4 h-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--accent-primary)]" />
        </div>
        <p className="text-xs font-medium" style={{ color: 'var(--paper-80)', opacity: 0.6 }}>
          加载图谱引擎...
        </p>
        <p className="text-[10px] mt-1" style={{ color: 'var(--paper-80)', opacity: 0.3 }}>
          正在构建节点关系
        </p>
      </div>
    </div>
  )
}

export function GraphBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(26,21,16,0.12) 100%)',
        }}
      />
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] opacity-[0.04]"
        style={{
          background:
            'radial-gradient(ellipse at center, var(--accent-primary) 0%, transparent 70%)',
        }}
      />
    </div>
  )
}

export function NodeHoverTooltip({
  tooltip,
  containerRef,
}: {
  tooltip: HoverTooltipState
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  const config = ENTITY_TYPE_CONFIG[tooltip.node.type]
  const Icon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="absolute z-30 rounded-xl p-3 min-w-[180px] max-w-[240px] pointer-events-none"
      style={{
        left: Math.min(
          tooltip.x + 16,
          (containerRef.current?.clientWidth || 800) - 260,
        ),
        top: Math.max(tooltip.y - 12, 8),
        background: 'var(--paper-80)',
        border: '1px solid var(--border-default)',
        boxShadow: `0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px var(--border-subtle), 0 0 40px color-mix(in srgb, ${config.glowColor} 19%, transparent), 0 4px 12px rgba(0,0,0,0.3)`,
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        className="absolute top-0 left-3 right-3 h-px rounded-full"
        style={{
          background: `linear-gradient(90deg, transparent, ${config.color}, transparent)`,
        }}
      />
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${config.color} 13%, transparent), color-mix(in srgb, ${config.color} 3%, transparent))`,
            boxShadow: `0 0 10px color-mix(in srgb, ${config.glowColor} 19%, transparent)`,
          }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink-100)' }}>
            {tooltip.node.name}
          </p>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-90)', opacity: 0.6 }}>
            {config.label}
          </p>
        </div>
      </div>
      {tooltip.node.description && (
        <p className="text-[11px] leading-relaxed line-clamp-2 mb-2" style={{ color: 'var(--ink-90)', opacity: 0.75 }}>
          {tooltip.node.description}
        </p>
      )}
      <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--ink-90)', opacity: 0.5 }}>
        <span className="flex items-center gap-1">
          <LinkIcon className="w-3 h-3" style={{ color: config.color }} />
          {tooltip.node.val - 1} 条关系
        </span>
        <span className="flex items-center gap-1">
          <Info className="w-3 h-3" style={{ color: config.color }} />
          ID: {tooltip.node.entityId}
        </span>
      </div>
    </motion.div>
  )
}

export function NodeDetailPanel({
  detail,
  onClose,
}: {
  detail: NodeDetail
  onClose: () => void
}) {
  const config = ENTITY_TYPE_CONFIG[detail.node.type]
  const Icon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
      className="absolute z-20 rounded-xl p-3.5 min-w-[200px] max-w-[260px]"
      style={{
        left: Math.min(
          detail.x + 16,
          (typeof window !== 'undefined' ? window.innerWidth : 800) - 280,
        ),
        top: Math.max(detail.y - 16, 8),
        background: 'var(--paper-80)',
        border: '1px solid var(--border-default)',
        boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px var(--border-subtle), 0 0 30px color-mix(in srgb, ${config.glowColor} 13%, transparent)`,
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        className="absolute top-0 left-4 right-4 h-px rounded-full"
        style={{
          background: `linear-gradient(90deg, transparent, ${config.color}, transparent)`,
        }}
      />
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center relative"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${config.color} 13%, transparent), color-mix(in srgb, ${config.color} 3%, transparent))`,
              boxShadow: `0 0 12px color-mix(in srgb, ${config.glowColor} 19%, transparent), inset 0 1px 0 var(--border-subtle)`,
            }}
          >
            <Icon className="w-4 h-4" style={{ color: config.color }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--ink-100)' }}>
              {detail.node.name}
            </p>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-90)', opacity: 0.6 }}>
              {config.label}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-[var(--hover-bg)] transition-all duration-200 flex-shrink-0 group"
          aria-label="关闭详情面板"
        >
          <X className="w-3.5 h-3.5 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" />
        </button>
      </div>
      {detail.node.description && (
        <p className="text-xs line-clamp-3 mb-2.5 leading-relaxed" style={{ color: 'var(--ink-90)', opacity: 0.75 }}>
          {detail.node.description}
        </p>
      )}
      <div className="flex items-center gap-1.5 text-[10px] pt-2 border-t border-[var(--border-subtle)]" style={{ color: 'var(--ink-90)', opacity: 0.5 }}>
        <LinkIcon className="w-3 h-3" style={{ color: config.color }} />
        <span>{detail.node.val - 1} 条关系</span>
      </div>
    </motion.div>
  )
}

export function ContextMenu({
  menu,
  onClose,
  onHighlight,
  onFocus,
  onViewDetails,
}: {
  menu: ContextMenuState
  onClose: () => void
  onHighlight: (nodeId: string) => void
  onFocus: (node: GraphNode) => void
  onViewDetails: (node: GraphNode, x: number, y: number) => void
}) {
  const config = ENTITY_TYPE_CONFIG[menu.node.type]
  const Icon = config.icon

  const menuItems = [
    { icon: Info, label: '查看详情', action: () => { onViewDetails(menu.node, menu.x, menu.y); onClose() } },
    { icon: Highlighter, label: '高亮关联', action: () => { onHighlight(menu.node.id); onClose() } },
    { icon: Focus, label: '聚焦节点', action: () => { onFocus(menu.node); onClose() } },
    { icon: ExternalLink, label: '展开连接', action: () => { onHighlight(menu.node.id); onClose() } },
  ]

  const itemBtnStyle = (hover: boolean) => ({
    backgroundColor: hover ? 'rgba(201, 169, 110, 0.1)' : 'transparent',
    color: hover ? 'var(--accent-primary)' : 'var(--ink-90)',
  })

  return (
    <motion.div
      role="menu"
      aria-label={`${menu.node.name} 的操作菜单`}
      initial={{ opacity: 0, scale: 0.92, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -4 }}
      transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
      className="absolute z-40 rounded-xl overflow-hidden min-w-[160px]"
      style={{ left: menu.x, top: menu.y, background: 'var(--paper-80)', border: '1px solid var(--border-default)', boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px var(--border-subtle)', fontFamily: 'var(--font-sans)' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-subtle)]">
        <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${config.color} 13%, transparent), color-mix(in srgb, ${config.color} 3%, transparent))` }}>
          <Icon className="w-3 h-3" style={{ color: config.color }} />
        </div>
        <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--ink-100)' }}>{menu.node.name}</span>
      </div>
      <div className="p-1">
        {menuItems.map((item, idx) => (
          <button key={idx} onClick={item.action} role="menuitem"
            className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-left transition-all duration-150"
            style={{ color: 'var(--ink-90)' }}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, itemBtnStyle(true))}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, itemBtnStyle(false))}
          >
            <item.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ opacity: 0.6 }} />
            <span className="text-[11px]">{item.label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  )
}
