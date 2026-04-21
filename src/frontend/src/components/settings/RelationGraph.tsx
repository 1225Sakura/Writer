import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useSettingsStore } from '@/store'
import { LinkIcon, Filter, Box, Grid2x2, ZoomIn, ZoomOut, RotateCcw, Eye } from 'lucide-react'

interface GraphNode {
  id: number
  name: string
  type: string
  color: string
  val: number
}

interface GraphLink {
  source: number
  target: number
  type: string
}

const RELATION_TYPE_COLORS: Record<string, string> = {
  family: '#5eb5a6',
  friend: '#5b8ee8',
  enemy: '#c45c5c',
  master: '#9b7ed9',
  disciple: '#7eb84a',
  rival: '#e8b87d',
  romantic: '#d45d5d',
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
  other: '其他',
}

export function RelationGraph() {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const { characters } = useSettingsStore()
  const [dimensions, setDimensions] = useState({ width: 300, height: 400 })
  const [filterType, setFilterType] = useState<string>('all')
  const [hoveredNode, setHoveredNode] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [showLegend, setShowLegend] = useState(true)
  const [highlightedConnections, setHighlightedConnections] = useState<Set<number>>(new Set())
  const [isLoaded, setIsLoaded] = useState(false)

  // 计算节点和连线 - 使用useMemo优化
  const nodes: GraphNode[] = useMemo(() =>
    characters.map((char) => ({
      id: char.id,
      name: char.name,
      type: 'character',
      color: '#e8b87d',
      val: char.relationships.length + 1,
    })),
  [characters])

  // 根据筛选类型过滤连线
  const links: GraphLink[] = useMemo(() => {
    let filteredLinks = characters.flatMap((char) =>
      char.relationships.map((rel) => ({
        source: char.id,
        target: rel.targetId,
        type: rel.type,
      }))
    )
    if (filterType !== 'all') {
      filteredLinks = filteredLinks.filter((link) => link.type === filterType)
    }
    return filteredLinks
  }, [characters, filterType])

  // 计算力导向布局 - 使用useMemo优化
  const positions = useMemo(() => {
    const map = new Map<number, { x: number; y: number }>()
    if (characters.length === 0) return map

    const centerX = dimensions.width / 2
    const centerY = dimensions.height / 2
    const radius = Math.min(centerX, centerY) * 0.6

    characters.forEach((char, i) => {
      const angle = (i / Math.max(characters.length, 1)) * 2 * Math.PI
      map.set(char.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      })
    })
    return map
  }, [characters.length, dimensions.width, dimensions.height])

  // 获取有关系的角色ID集合
  const connectedNodeIds = useMemo(() => {
    const ids = new Set<number>()
    links.forEach((link) => {
      ids.add(link.source)
      ids.add(link.target)
    })
    return ids
  }, [links])

  // 计算与当前hover节点相连的节点
  useEffect(() => {
    if (hoveredNode === null) {
      setHighlightedConnections(new Set())
      return
    }
    const connected = new Set<number>()
    connected.add(hoveredNode)
    links.forEach((link) => {
      if (link.source === hoveredNode) connected.add(link.target)
      if (link.target === hoveredNode) connected.add(link.source)
    })
    setHighlightedConnections(connected)
  }, [hoveredNode, links])

  // 加载动画
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect()
      setDimensions({ width, height })
    }
  }, [])

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect()
        setDimensions({ width, height })
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 鼠标拖拽平移
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
    }
  }, [isDragging, dragStart])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.2, 3))
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.2, 0.3))
  const handleReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  if (characters.length === 0) {
    return (
      <div
        className="h-full flex items-center justify-center text-center p-4"
        style={{ backgroundColor: '#0a0b0d' }}
      >
        <div>
          <LinkIcon
            className="w-10 h-10 mx-auto mb-3"
            style={{ color: '#4b5563' }}
          />
          <p className="text-sm mb-1" style={{ color: '#6b7280' }}>
            添加角色后
          </p>
          <p className="text-xs" style={{ color: '#4b5563' }}>
            这里将显示关系图谱
          </p>
        </div>
      </div>
    )
  }

  // 获取孤立节点（没有关系相连的）
  const isolatedNodes = nodes.filter((node) => !connectedNodeIds.has(node.id))

  return (
    <div
      ref={containerRef}
      className="h-full overflow-hidden relative"
      style={{ backgroundColor: '#0a0b0d' }}
    >
      {/* 筛选器和视图切换 */}
      <div
        className="absolute top-3 right-3 z-10 flex items-center gap-2"
      >
        {/* 视图切换 */}
        <button
          onClick={() => setViewMode(viewMode === '2d' ? '3d' : '2d')}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          title={viewMode === '2d' ? '切换到3D视图' : '切换到2D视图'}
        >
          {viewMode === '2d' ? <Box className="w-4 h-4" style={{ color: '#6b7280' }} /> : <Grid2x2 className="w-4 h-4" style={{ color: '#6b7280' }} />}
        </button>
        <Filter className="w-4 h-4" style={{ color: '#6b7280' }} />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="text-xs px-2 py-1 rounded border-none outline-none cursor-pointer"
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            color: '#9ca3af',
          }}
        >
          <option value="all">全部关系</option>
          <option value="family">家人</option>
          <option value="friend">朋友</option>
          <option value="enemy">敌人</option>
          <option value="master">师父</option>
          <option value="disciple">徒弟</option>
          <option value="rival">竞争对手</option>
          <option value="romantic">恋人</option>
          <option value="other">其他</option>
        </select>
      </div>

      {/* Zoom controls */}
      <div
        className="absolute top-3 left-3 z-10 flex flex-col gap-1"
      >
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          title="放大"
        >
          <ZoomIn className="w-4 h-4" style={{ color: '#6b7280' }} />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          title="缩小"
        >
          <ZoomOut className="w-4 h-4" style={{ color: '#6b7280' }} />
        </button>
        <button
          onClick={handleReset}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          title="重置视图"
        >
          <RotateCcw className="w-4 h-4" style={{ color: '#6b7280' }} />
        </button>
      </div>

      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{
          backgroundColor: 'transparent',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* SVG Definitions for glow filters and gradients */}
        <defs>
          {/* Node glow filter */}
          <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Stronger glow for hover */}
          <filter id="node-glow-strong" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Flowing line gradient mask */}
          <linearGradient id="line-flow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="50%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          {/* Animated dash pattern */}
          <pattern id="flowing-dash" width="20" height="4" patternUnits="userSpaceOnUse">
            <rect width="20" height="4" fill="none" />
            <line x1="0" y1="2" x2="12" y2="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </pattern>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* 连线 */}
          {links.map((link, i) => {
            const sourcePos = positions.get(link.source)
            const targetPos = positions.get(link.target)
            if (!sourcePos || !targetPos) return null

            const isHovered = hoveredNode === link.source || hoveredNode === link.target
            const isDimmed = hoveredNode !== null && !isHovered
            const linkColor = RELATION_TYPE_COLORS[link.type] || RELATION_TYPE_COLORS.other

            return (
              <g key={`link-${i}`}>
                {/* Base line */}
                <line
                  x1={sourcePos.x}
                  y1={sourcePos.y}
                  x2={targetPos.x}
                  y2={targetPos.y}
                  stroke={linkColor}
                  strokeWidth={isHovered ? 2.5 : 1}
                  opacity={isDimmed ? 0.1 : isHovered ? 0.9 : 0.4}
                  style={{ transition: 'all 0.2s ease' }}
                />
                {/* Flowing dash animation overlay (visible on hover) */}
                {isHovered && (
                  <line
                    x1={sourcePos.x}
                    y1={sourcePos.y}
                    x2={targetPos.x}
                    y2={targetPos.y}
                    stroke={linkColor}
                    strokeWidth={2}
                    strokeDasharray="6 10"
                    strokeLinecap="round"
                    opacity={0.8}
                    style={{
                      animation: 'flowing-dash 1s linear infinite',
                    }}
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from="0"
                      to="-16"
                      dur="0.8s"
                      repeatCount="indefinite"
                    />
                  </line>
                )}
                {/* 关系类型标签（仅在hover时显示） */}
                {isHovered && (
                  <text
                    x={(sourcePos.x + targetPos.x) / 2}
                    y={(sourcePos.y + targetPos.y) / 2 - 5}
                    textAnchor="middle"
                    fill="#9ca3af"
                    fontSize={9}
                    style={{ fontFamily: 'Inter, sans-serif', pointerEvents: 'none' }}
                  >
                    {RELATION_TYPE_LABELS[link.type] || link.type}
                  </text>
                )}
              </g>
            )
          })}

          {/* 节点 */}
          {nodes.map((node) => {
            const pos = positions.get(node.id)
            if (!pos) return null

            const isHovered = hoveredNode === node.id
            const isIsolated = isolatedNodes.some((n) => n.id === node.id)
            const isConnected = highlightedConnections.has(node.id)
            const isDimmed = hoveredNode !== null && !isConnected
            const nodeRadius = isHovered ? 28 : 22 + Math.min(node.val * 1.5, 8)

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: 'pointer' }}
                opacity={isLoaded ? 1 : 0}
              >
                {/* 外发光（hover时）- 增强版 */}
                {isHovered && (
                  <circle
                    r={nodeRadius + 12}
                    fill="none"
                    stroke={node.color}
                    strokeWidth={2}
                    opacity={0.2}
                    filter="url(#node-glow-strong)"
                  >
                    <animate attributeName="r" values={`${nodeRadius + 8};${nodeRadius + 16};${nodeRadius + 8}`} dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                {/* 次级光晕（hover时） */}
                {isHovered && (
                  <circle
                    r={nodeRadius + 6}
                    fill={node.color}
                    opacity={0.08}
                    filter="url(#node-glow)"
                  />
                )}
                {/* 主圆 */}
                <circle
                  r={nodeRadius}
                  fill={node.color}
                  opacity={isDimmed ? 0.15 : isIsolated ? 0.4 : 0.85}
                  style={{ transition: 'all 0.2s ease' }}
                  filter={isHovered ? 'url(#node-glow)' : undefined}
                />
                {/* 边框 */}
                <circle
                  r={nodeRadius}
                  fill="none"
                  stroke={isHovered ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)'}
                  strokeWidth={isHovered ? 2.5 : 1}
                  opacity={isDimmed ? 0.1 : 1}
                  style={{ transition: 'all 0.2s ease' }}
                />
                {/* Hover时内部高光 */}
                {isHovered && (
                  <circle
                    r={nodeRadius - 4}
                    fill="none"
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth={1}
                  />
                )}
                {/* 关系数量指示 */}
                {node.val > 1 && (
                  <circle
                    r={8}
                    cx={14}
                    cy={-14}
                    fill="#0a0b0d"
                    stroke={node.color}
                    strokeWidth={1}
                  />
                )}
                {node.val > 1 && (
                  <text
                    x={14}
                    y={-11}
                    textAnchor="middle"
                    fill={node.color}
                    fontSize={8}
                    style={{ fontFamily: 'Inter, sans-serif', pointerEvents: 'none' }}
                  >
                    {node.val - 1}
                  </text>
                )}
                {/* 名称 */}
                <text
                  textAnchor="middle"
                  dy={isHovered ? 44 : 40}
                  fill={isHovered ? '#f7f8f8' : '#9ca3af'}
                  fontSize={isHovered ? 12 : 11}
                  fontWeight={isHovered ? 600 : 400}
                  style={{ fontFamily: 'Inter, sans-serif', pointerEvents: 'none', transition: 'all 0.2s ease' }}
                >
                  {node.name.length > 6 ? node.name.slice(0, 6) + '...' : node.name}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {/* 统计信息 */}
      <div
        className="absolute bottom-3 left-3 text-xs px-2 py-1 rounded flex items-center gap-3"
        style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          color: '#6b7280',
        }}
      >
        <span>{nodes.length} 个角色</span>
        <span>·</span>
        <span>{links.length} 条关系</span>
        {filterType !== 'all' && (
          <>
            <span>·</span>
            <span
              className="underline cursor-pointer"
              onClick={() => setFilterType('all')}
            >
              清除筛选
            </span>
          </>
        )}
      </div>

      {/* 关系类型图例 */}
      {showLegend && links.length > 0 && (
        <div
          className="absolute bottom-3 right-3 text-xs px-3 py-2 rounded"
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            color: '#6b7280',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium" style={{ color: '#9ca3af' }}>图例</span>
            <button
              onClick={() => setShowLegend(false)}
              className="p-0.5 rounded hover:bg-white/10 transition-colors"
            >
              <Eye className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {Object.entries(RELATION_TYPE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span style={{ fontSize: '11px' }}>
                  {RELATION_TYPE_LABELS[type]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 显示图例按钮（当图例隐藏时） */}
      {!showLegend && (
        <button
          onClick={() => setShowLegend(true)}
          className="absolute bottom-3 right-3 p-1.5 rounded hover:bg-white/10 transition-colors"
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            color: '#6b7280',
          }}
          title="显示图例"
        >
          <Eye className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
