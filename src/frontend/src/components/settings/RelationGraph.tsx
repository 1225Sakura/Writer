import { useEffect, useRef, useState, useMemo, useCallback, Suspense, lazy } from 'react'
import { useSettingsStore } from '@/store'
import {
  LinkIcon, Filter, Box, Grid2x2, ZoomIn, ZoomOut, RotateCcw,
  Eye, EyeOff, X, Users, MapPin, Swords, BookOpen, Globe, Scroll,
  ChevronRight, Maximize2, Minimize2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// Lazy load force graph components to reduce initial bundle
const ForceGraph2D = lazy(() => import('react-force-graph-2d'))
const ForceGraph3D = lazy(() => import('react-force-graph-3d'))

// ============================================
// Types
// ============================================

interface GraphNode {
  id: string
  name: string
  type: EntityNodeType
  color: string
  val: number
  description?: string
  entityId: number
}

interface GraphLink {
  source: string
  target: string
  type: string
  color: string
}

type EntityNodeType = 'character' | 'item' | 'location' | 'faction' | 'world' | 'rule' | 'outline' | 'ifline'

interface NodeDetail {
  node: GraphNode
  x: number
  y: number
}

// ============================================
// Constants
// ============================================

const ENTITY_TYPE_CONFIG: Record<EntityNodeType, { label: string; color: string; icon: typeof Users }> = {
  character: { label: '角色', color: '#e8b87d', icon: Users },
  item: { label: '物品', color: '#9b7ed9', icon: Scroll },
  location: { label: '地点', color: '#5eb5a6', icon: MapPin },
  faction: { label: '势力', color: '#d45d5d', icon: Swords },
  world: { label: '世界观', color: '#5b8ee8', icon: Globe },
  rule: { label: '规则', color: '#7eb84a', icon: BookOpen },
  outline: { label: '大纲', color: '#5b8ee8', icon: BookOpen },
  ifline: { label: 'IF线', color: '#7eb84a', icon: Scroll },
}

const RELATION_TYPE_COLORS: Record<string, string> = {
  family: '#5eb5a6',
  friend: '#5b8ee8',
  enemy: '#c45c5c',
  master: '#9b7ed9',
  disciple: '#7eb84a',
  rival: '#e8b87d',
  romantic: '#d45d5d',
  owns: '#9b7ed9',
  located_at: '#5eb5a6',
  belongs_to: '#d45d5d',
  other: '#6b7280',
}

const RELATION_TYPE_LABELS: Record<string, string> = {
  family: '家人',
  friend: '朋友',
  enemy: '敌人',
  master: '师父',
  disciple: '徒弟',
  rival: '竞争',
  romantic: '恋人',
  owns: '拥有',
  located_at: '位于',
  belongs_to: '属于',
  other: '其他',
}

// ============================================
// Performance Thresholds
// ============================================

const PERFORMANCE_THRESHOLD = 100

// ============================================
// Helper: Build graph data from store entities
// ============================================

function useGraphData() {
  const { characters, items, locations, factions, worldSettings, rules, ifLines } = useSettingsStore()

  return useMemo(() => {
    const nodes: GraphNode[] = []
    const links: GraphLink[] = []

    // Character nodes
    characters.forEach((char) => {
      nodes.push({
        id: `char_${char.id}`,
        name: char.name,
        type: 'character',
        color: ENTITY_TYPE_CONFIG.character.color,
        val: Math.max(char.relationships.length + 1, 1),
        description: char.description || char.personality || '',
        entityId: char.id,
      })

      // Character relationships
      char.relationships.forEach((rel) => {
        const targetId = `char_${rel.targetId}`
        if (nodes.some((n) => n.id === targetId)) {
          links.push({
            source: `char_${char.id}`,
            target: targetId,
            type: rel.type,
            color: RELATION_TYPE_COLORS[rel.type] || RELATION_TYPE_COLORS.other,
          })
        }
      })
    })

    // Item nodes + ownership links
    items.forEach((item) => {
      nodes.push({
        id: `item_${item.id}`,
        name: item.name,
        type: 'item',
        color: ENTITY_TYPE_CONFIG.item.color,
        val: 1,
        description: item.description || '',
        entityId: item.id,
      })
      if (item.owner) {
        const ownerChar = characters.find((c) => c.name === item.owner)
        if (ownerChar) {
          links.push({
            source: `char_${ownerChar.id}`,
            target: `item_${item.id}`,
            type: 'owns',
            color: RELATION_TYPE_COLORS.owns,
          })
        }
      }
      if (item.location) {
        const loc = locations.find((l) => l.name === item.location)
        if (loc) {
          links.push({
            source: `item_${item.id}`,
            target: `loc_${loc.id}`,
            type: 'located_at',
            color: RELATION_TYPE_COLORS.located_at,
          })
        }
      }
    })

    // Location nodes
    locations.forEach((loc) => {
      nodes.push({
        id: `loc_${loc.id}`,
        name: loc.name,
        type: 'location',
        color: ENTITY_TYPE_CONFIG.location.color,
        val: 1,
        description: loc.description || '',
        entityId: loc.id,
      })
    })

    // Faction nodes + membership links
    factions.forEach((fac) => {
      nodes.push({
        id: `fac_${fac.id}`,
        name: fac.name,
        type: 'faction',
        color: ENTITY_TYPE_CONFIG.faction.color,
        val: 1,
        description: fac.description || '',
        entityId: fac.id,
      })
    })

    // World setting nodes
    worldSettings.forEach((ws) => {
      nodes.push({
        id: `world_${ws.id}`,
        name: ws.name,
        type: 'world',
        color: ENTITY_TYPE_CONFIG.world.color,
        val: 1,
        description: ws.description || '',
        entityId: ws.id,
      })
    })

    // Rule nodes
    rules.forEach((rule) => {
      nodes.push({
        id: `rule_${rule.id}`,
        name: rule.name,
        type: 'rule',
        color: ENTITY_TYPE_CONFIG.rule.color,
        val: 1,
        description: rule.description || '',
        entityId: rule.id,
      })
    })

    // IF line nodes
    ifLines.forEach((ifl) => {
      nodes.push({
        id: `ifl_${ifl.id}`,
        name: ifl.title,
        type: 'ifline',
        color: ENTITY_TYPE_CONFIG.ifline.color,
        val: 1,
        description: ifl.description || '',
        entityId: ifl.id,
      })
      if (ifl.linked_character_id) {
        links.push({
          source: `char_${ifl.linked_character_id}`,
          target: `ifl_${ifl.id}`,
          type: 'other',
          color: RELATION_TYPE_COLORS.other,
        })
      }
    })

    return { nodes, links }
  }, [characters, items, locations, factions, worldSettings, rules, ifLines])
}

// ============================================
// Component: Graph Fallback Loader
// ============================================

function GraphFallback() {
  return (
    <div className="h-full flex items-center justify-center" style={{ backgroundColor: '#0a0b0d' }}>
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin motion-reduce:animate-none mx-auto mb-3" style={{ borderColor: '#5e6ad2', borderTopColor: 'transparent' }} />
        <p className="text-xs" style={{ color: '#6b7280' }}>加载图谱引擎...</p>
      </div>
    </div>
  )
}

// ============================================
// Component: Node Detail Panel
// ============================================

function NodeDetailPanel({ detail, onClose }: { detail: NodeDetail; onClose: () => void }) {
  const config = ENTITY_TYPE_CONFIG[detail.node.type]
  const Icon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="absolute z-20 rounded-lg p-3 min-w-[180px] max-w-[240px]"
      style={{
        left: Math.min(detail.x + 16, (typeof window !== 'undefined' ? window.innerWidth : 800) - 260),
        top: Math.max(detail.y - 16, 8),
        backgroundColor: 'rgba(15,16,17,0.95)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${config.color}20` }}
          >
            <Icon className="w-3 h-3" style={{ color: config.color }} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: '#f7f8f8' }}>{detail.node.name}</p>
            <p className="text-[10px]" style={{ color: '#6b7280' }}>{config.label}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <X className="w-3 h-3" style={{ color: '#6b7280' }} />
        </button>
      </div>
      {detail.node.description && (
        <p className="text-xs line-clamp-3 mb-2" style={{ color: '#9ca3af' }}>
          {detail.node.description}
        </p>
      )}
      <div className="flex items-center gap-1 text-[10px]" style={{ color: '#6b7280' }}>
        <LinkIcon className="w-3 h-3" />
        <span>{detail.node.val - 1} 条关系</span>
      </div>
    </motion.div>
  )
}

// ============================================
// Component: Filter Controls
// ============================================

function FilterControls({
  activeTypes,
  onToggleType,
  filterRelation,
  onSetRelationFilter,
}: {
  activeTypes: Set<EntityNodeType>
  onToggleType: (type: EntityNodeType) => void
  filterRelation: string
  onSetRelationFilter: (type: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  const relationTypes = Object.entries(RELATION_TYPE_LABELS)

  return (
    <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
      {/* Zoom controls */}
      <div
        className="flex flex-col gap-0.5 rounded-lg p-1"
        style={{ backgroundColor: 'rgba(15,16,17,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <FilterButton icon={ZoomIn} title="放大" />
        <FilterButton icon={ZoomOut} title="缩小" />
        <FilterButton icon={RotateCcw} title="重置视图" />
      </div>

      {/* Entity type filter */}
      <div
        className="rounded-lg p-1.5"
        style={{ backgroundColor: 'rgba(15,16,17,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-white/5 transition-colors w-full"
        >
          <Filter className="w-3 h-3" style={{ color: '#9ca3af' }} />
          <span className="text-[10px]" style={{ color: '#9ca3af' }}>筛选</span>
          <ChevronRight
            className="w-3 h-3 ml-auto transition-transform"
            style={{ color: '#6b7280', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-1.5 space-y-0.5">
                {(Object.entries(ENTITY_TYPE_CONFIG) as [EntityNodeType, typeof ENTITY_TYPE_CONFIG['character']][]).map(([type, config]) => {
                  const isActive = activeTypes.has(type)
                  return (
                    <button
                      key={type}
                      onClick={() => onToggleType(type)}
                      className="flex items-center gap-1.5 px-1.5 py-1 rounded w-full transition-colors"
                      style={{
                        backgroundColor: isActive ? `${config.color}15` : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: isActive ? config.color : '#4b5563',
                          opacity: isActive ? 1 : 0.4,
                        }}
                      />
                      <span
                        className="text-[10px]"
                        style={{ color: isActive ? config.color : '#6b7280' }}
                      >
                        {config.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Relation filter */}
              <div className="pt-2 mt-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] mb-1 px-1.5" style={{ color: '#6b7280' }}>关系类型</p>
                <select
                  value={filterRelation}
                  onChange={(e) => onSetRelationFilter(e.target.value)}
                  className="w-full text-[10px] px-1.5 py-1 rounded border-none outline-none cursor-pointer"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    color: '#9ca3af',
                  }}
                >
                  <option value="all">全部关系</option>
                  {relationTypes.map(([type, label]) => (
                    <option key={type} value={type}>{label}</option>
                  ))}
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function FilterButton({ icon: Icon, title }: { icon: typeof ZoomIn; title: string }) {
  return (
    <button
      className="p-1.5 rounded hover:bg-white/10 transition-colors"
      title={title}
    >
      <Icon className="w-3.5 h-3.5" style={{ color: '#9ca3af' }} />
    </button>
  )
}

// ============================================
// Component: Legend
// ============================================

function Legend({
  showLegend,
  onToggle,
  visibleRelationTypes,
}: {
  showLegend: boolean
  onToggle: () => void
  visibleRelationTypes: string[]
}) {
  if (!showLegend) {
    return (
      <button
        onClick={onToggle}
        className="absolute bottom-3 right-3 z-10 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        style={{
          backgroundColor: 'rgba(15,16,17,0.8)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
        title="显示图例"
      >
        <Eye className="w-3.5 h-3.5" style={{ color: '#9ca3af' }} />
      </button>
    )
  }

  const uniqueTypes = [...new Set(visibleRelationTypes)]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-3 right-3 z-10 rounded-lg p-2.5"
      style={{
        backgroundColor: 'rgba(15,16,17,0.9)',
        border: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(8px)',
        minWidth: '140px',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium" style={{ color: '#9ca3af' }}>图例</span>
        <button
          onClick={onToggle}
          className="p-0.5 rounded hover:bg-white/10 transition-colors"
        >
          <EyeOff className="w-3 h-3" style={{ color: '#6b7280' }} />
        </button>
      </div>

      {/* Entity types */}
      <div className="space-y-1 mb-2 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {(Object.entries(ENTITY_TYPE_CONFIG) as [EntityNodeType, typeof ENTITY_TYPE_CONFIG['character']][]).map(([type, config]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: config.color }}
            />
            <span className="text-[10px]" style={{ color: '#6b7280' }}>{config.label}</span>
          </div>
        ))}
      </div>

      {/* Relation types */}
      {uniqueTypes.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px]" style={{ color: '#4b5563' }}>关系</span>
          {uniqueTypes.map((type) => (
            <div key={type} className="flex items-center gap-1.5">
              <div
                className="w-3 h-[2px] rounded"
                style={{ backgroundColor: RELATION_TYPE_COLORS[type] || RELATION_TYPE_COLORS.other }}
              />
              <span className="text-[10px]" style={{ color: '#6b7280' }}>
                {RELATION_TYPE_LABELS[type] || type}
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ============================================
// Component: Stats Bar
// ============================================

function StatsBar({
  nodeCount,
  linkCount,
  filterRelation,
  onClearFilter,
}: {
  nodeCount: number
  linkCount: number
  filterRelation: string
  onClearFilter: () => void
}) {
  return (
    <div
      className="absolute bottom-3 left-3 z-10 text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-2"
      style={{
        backgroundColor: 'rgba(15,16,17,0.9)',
        border: '1px solid rgba(255,255,255,0.06)',
        color: '#6b7280',
        backdropFilter: 'blur(8px)',
      }}
    >
      <span>{nodeCount} 节点</span>
      <span style={{ color: '#4b5563' }}>·</span>
      <span>{linkCount} 关系</span>
      {filterRelation !== 'all' && (
        <>
          <span style={{ color: '#4b5563' }}>·</span>
          <button
            className="underline hover:text-[#9ca3af] transition-colors"
            onClick={onClearFilter}
          >
            清除筛选
          </button>
        </>
      )}
    </div>
  )
}

// ============================================
// Main Component: RelationGraph
// ============================================

export function RelationGraph() {
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<any>(null)
  const { characters } = useSettingsStore()

  const [dimensions, setDimensions] = useState({ width: 300, height: 400 })
  const [viewport, setViewport] = useState({ x: 0, y: 0, width: 300, height: 400 })
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d')
  const [activeNodeTypes, setActiveNodeTypes] = useState<Set<EntityNodeType>>(new Set(Object.keys(ENTITY_TYPE_CONFIG) as EntityNodeType[]))
  const [filterRelation, setFilterRelation] = useState<string>('all')
  const [showLegend, setShowLegend] = useState(true)
  const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const { nodes: allNodes, links: allLinks } = useGraphData()

  // Filter nodes by type and relations
  const { nodes, links } = useMemo(() => {
    const filteredNodes = allNodes.filter((n) => activeNodeTypes.has(n.type))
    const nodeIds = new Set(filteredNodes.map((n) => n.id))
    let filteredLinks = allLinks.filter(
      (l) => nodeIds.has(l.source) && nodeIds.has(l.target)
    )
    if (filterRelation !== 'all') {
      filteredLinks = filteredLinks.filter((l) => l.type === filterRelation)
    }
    return { nodes: filteredNodes, links: filteredLinks }
  }, [allNodes, allLinks, activeNodeTypes, filterRelation])

  // Viewport-based visible node filtering with buffer for culling
  const visibleNodes = useMemo(() => {
    const buffer = 100
    return nodes.filter(node => {
      const nx = (node as any).x || 0
      const ny = (node as any).y || 0
      return nx >= viewport.x - buffer &&
             nx <= viewport.x + viewport.width + buffer &&
             ny >= viewport.y - buffer &&
             ny <= viewport.y + viewport.height + buffer
    })
  }, [nodes, viewport])

  // Visible links filtered to only connect visible nodes
  const visibleLinks = useMemo(() => {
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id))
    return links.filter(link =>
      visibleNodeIds.has(link.source as string) && visibleNodeIds.has(link.target as string)
    )
  }, [links, visibleNodes])

  // Performance-aware render mode
  const renderMode = useMemo(() => {
    if (nodes.length > PERFORMANCE_THRESHOLD * 1.5) return 'simple'
    if (nodes.length > PERFORMANCE_THRESHOLD) return 'optimized'
    return 'full'
  }, [nodes.length])

  // Responsive dimensions and viewport tracking
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect()
        setDimensions({ width, height })
        setViewport(prev => ({ ...prev, width, height }))
      }
    }
    updateDimensions()
    const observer = new ResizeObserver(updateDimensions)
    if (containerRef.current) observer.observe(containerRef.current)
    window.addEventListener('resize', updateDimensions)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateDimensions)
    }
  }, [])

  // Track viewport changes from pan/zoom via control utilities
  const updateViewport = useCallback((centerZoom: { k: number; x: number; y: number }) => {
    const newViewport = {
      x: (-centerZoom.x / centerZoom.k),
      y: (-centerZoom.y / centerZoom.k),
      width: dimensions.width / centerZoom.k,
      height: dimensions.height / centerZoom.k,
    }
    setViewport(newViewport)
  }, [dimensions])

  // Toggle entity type filter
  const toggleNodeType = useCallback((type: EntityNodeType) => {
    setActiveNodeTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        if (next.size > 1) next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }, [])

  // Handle node click
  const handleNodeClick = useCallback((node: any, event: MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setSelectedNode({
      node: node as GraphNode,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    })
  }, [])

  // Handle background click
  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev)
    setTimeout(() => {
      if (fgRef.current) {
        fgRef.current.zoomToFit(400, 40)
      }
    }, 100)
  }, [])

  // Empty state
  if (characters.length === 0 && allNodes.length === 0) {
    return (
      <div
        className="h-full flex items-center justify-center text-center p-4"
        style={{ backgroundColor: '#0a0b0d' }}
      >
        <div>
          <LinkIcon className="w-10 h-10 mx-auto mb-3" style={{ color: '#4b5563' }} />
          <p className="text-sm mb-1" style={{ color: '#6b7280' }}>添加角色后</p>
          <p className="text-xs" style={{ color: '#4b5563' }}>这里将显示关系图谱</p>
        </div>
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div
        className="h-full flex items-center justify-center text-center p-4"
        style={{ backgroundColor: '#0a0b0d' }}
      >
        <div>
          <Filter className="w-8 h-8 mx-auto mb-3" style={{ color: '#4b5563' }} />
          <p className="text-sm mb-1" style={{ color: '#6b7280' }}>筛选条件过于严格</p>
          <p className="text-xs" style={{ color: '#4b5563' }}>没有符合条件的节点</p>
        </div>
      </div>
    )
  }

  const visibleRelationTypes = [...new Set(visibleLinks.map((l) => l.type))]

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50' : 'h-full'}`}
      style={{ backgroundColor: '#0a0b0d' }}
    >
      {/* Decorative gradient accent */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(94,106,210,0.3), transparent)',
          zIndex: 10,
        }}
      />
      {/* View mode toggle */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          style={{ backgroundColor: 'rgba(15,16,17,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
          title={isFullscreen ? '退出全屏' : '全屏'}
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5" style={{ color: '#9ca3af' }} />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" style={{ color: '#9ca3af' }} />
          )}
        </button>
        <button
          onClick={() => setViewMode(viewMode === '2d' ? '3d' : '2d')}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1"
          style={{ backgroundColor: 'rgba(15,16,17,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
          title={viewMode === '2d' ? '切换到3D视图' : '切换到2D视图'}
        >
          {viewMode === '2d' ? (
            <Box className="w-3.5 h-3.5" style={{ color: '#9ca3af' }} />
          ) : (
            <Grid2x2 className="w-3.5 h-3.5" style={{ color: '#9ca3af' }} />
          )}
          <span className="text-[10px]" style={{ color: '#9ca3af' }}>{viewMode.toUpperCase()}</span>
        </button>
      </div>

      {/* Filter controls with zoom */}
      <FilterControls
        activeTypes={activeNodeTypes}
        onToggleType={toggleNodeType}
        filterRelation={filterRelation}
        onSetRelationFilter={setFilterRelation}
      />

      {/* Force Graph */}
      <Suspense fallback={<GraphFallback />}>
        {viewMode === '2d' ? (
          <ForceGraph2D
            ref={fgRef}
            graphData={{ nodes: visibleNodes, links: visibleLinks }}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="#0a0b0d"
            nodeLabel="name"
            nodeColor={(node: any) => node.color}
            nodeVal={(node: any) => Math.sqrt(node.val) * 6 + 4}
            nodeRelSize={6}
            linkColor={(link: any) => link.color}
            linkWidth={(link: any) => {
              const isHighlighted = hoveredNodeId &&
                (link.source.id === hoveredNodeId || link.target.id === hoveredNodeId)
              return isHighlighted ? 2.5 : 1
            }}
            {...{
              linkOpacity: (link: any) => {
                if (renderMode === 'simple') return 0.2
                const isHighlighted = hoveredNodeId &&
                  (link.source.id === hoveredNodeId || link.target.id === hoveredNodeId)
                const isDimmed = hoveredNodeId && !isHighlighted
                return isDimmed ? 0.08 : isHighlighted ? 0.9 : 0.35
              }
            }}
            linkDirectionalParticles={renderMode === 'full' ? 2 : 0}
            linkDirectionalParticleSpeed={renderMode === 'full' ? 0.008 : 0}
            linkDirectionalParticleWidth={(link: any) => {
              const isHighlighted = renderMode !== 'simple' && hoveredNodeId &&
                (link.source.id === hoveredNodeId || link.target.id === hoveredNodeId)
              return isHighlighted ? 2 : 0
            }}
            onNodeClick={handleNodeClick}
            onBackgroundClick={handleBackgroundClick}
            onNodeHover={renderMode !== 'simple' ? ((node: any) => setHoveredNodeId(node?.id || null)) : undefined}
            onEngineStop={() => {
              if (fgRef.current) {
                const centerGraph = fgRef.current.centerAt()
                const zoom = fgRef.current.zoom()
                updateViewport({ k: zoom, x: centerGraph.x || 0, y: centerGraph.y || 0 })
              }
            }}
            cooldownTicks={renderMode === 'simple' ? 30 : renderMode === 'optimized' ? 60 : 100}
            warmupTicks={renderMode === 'simple' ? 5 : renderMode === 'optimized' ? 10 : 20}
            d3AlphaDecay={renderMode === 'simple' ? 0.05 : 0.02}
            d3VelocityDecay={renderMode === 'simple' ? 0.5 : 0.3}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            enablePanInteraction={true}
            nodeCanvasObjectMode={() => 'after'}
            nodeCanvasObject={renderMode === 'simple' ? undefined : ((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const label = node.name
              const fontSize = Math.max(10 / globalScale, 8)
              ctx.font = `${node.id === hoveredNodeId ? '600' : '400'} ${fontSize}px Inter, sans-serif`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'

              const isHovered = node.id === hoveredNodeId
              const isSelected = selectedNode?.node.id === node.id
              const yOffset = Math.sqrt(node.val) * 6 + 4 + fontSize * 0.8

              // Glow effect for hovered/selected (disabled in simple mode)
              if (renderMode !== 'simple' && (isHovered || isSelected)) {
                ctx.shadowColor = node.color
                ctx.shadowBlur = 12
              }

              ctx.fillStyle = isHovered ? '#f7f8f8' : '#9ca3af'
              ctx.fillText(label.length > 6 ? label.slice(0, 6) + '...' : label, node.x, (node.y as number) + yOffset)

              ctx.shadowBlur = 0

              // Type indicator dot (disabled in simple mode)
              if (renderMode !== 'simple' && isHovered) {
                const config = ENTITY_TYPE_CONFIG[node.type as EntityNodeType]
                ctx.beginPath()
                ctx.arc((node.x as number) - ctx.measureText(label).width / 2 - 6, (node.y as number) + yOffset, 3, 0, 2 * Math.PI)
                ctx.fillStyle = config?.color || node.color
                ctx.fill()
              }
            })}
          />
        ) : (
          <ForceGraph3D
            ref={fgRef}
            graphData={{ nodes: visibleNodes, links: visibleLinks }}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="#0a0b0d"
            nodeLabel="name"
            nodeColor={(node: any) => node.color}
            nodeVal={(node: any) => Math.sqrt(node.val) * 4 + 3}
            linkColor={(link: any) => link.color}
            linkWidth={0.5}
            linkOpacity={0.4}
            onNodeClick={handleNodeClick}
            onBackgroundClick={handleBackgroundClick}
            enableNodeDrag={true}
            enableNavigationControls={true}
            showNavInfo={false}
            cooldownTicks={100}
            warmupTicks={20}
          />
        )}
      </Suspense>

      {/* Node detail panel */}
      <AnimatePresence>
        {selectedNode && (
          <NodeDetailPanel
            detail={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </AnimatePresence>

      {/* Stats bar */}
      <StatsBar
        nodeCount={visibleNodes.length}
        linkCount={visibleLinks.length}
        filterRelation={filterRelation}
        onClearFilter={() => setFilterRelation('all')}
      />

      {/* Legend */}
      <Legend
        showLegend={showLegend}
        onToggle={() => setShowLegend(!showLegend)}
        visibleRelationTypes={visibleRelationTypes}
      />
    </div>
  )
}
