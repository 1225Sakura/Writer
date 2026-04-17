import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useSettingsStore } from '@/store'
import { LinkIcon, Filter } from 'lucide-react'

interface GraphNode {
  id: number
  name: string
  type: string
  color: string
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

export function RelationGraph() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { characters, addRelationship, removeRelationship } = useSettingsStore()
  const [dimensions, setDimensions] = useState({ width: 300, height: 400 })
  const [filterType, setFilterType] = useState<string>('all')
  const [hoveredNode, setHoveredNode] = useState<number | null>(null)

  // 计算节点和连线 - 使用useMemo优化
  const nodes: GraphNode[] = useMemo(() =>
    characters.map((char) => ({
      id: char.id,
      name: char.name,
      type: 'character',
      color: '#e8b87d',
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

  // 处理删除关系
  const handleRemoveRelationship = useCallback(
    async (characterId: number, relationshipId: number) => {
      try {
        await removeRelationship(characterId, relationshipId)
      } catch (error) {
        console.error('删除关系失败:', error)
      }
    },
    [removeRelationship]
  )

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
      {/* 筛选器 */}
      <div
        className="absolute top-3 right-3 z-10 flex items-center gap-2"
      >
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

      <svg
        width={dimensions.width}
        height={dimensions.height}
        style={{ backgroundColor: 'transparent' }}
      >
        {/* 连线 */}
        {links.map((link, i) => {
          const sourcePos = positions.get(link.source)
          const targetPos = positions.get(link.target)
          if (!sourcePos || !targetPos) return null

          const isHovered = hoveredNode === link.source || hoveredNode === link.target

          return (
            <g key={`link-${i}`}>
              <line
                x1={sourcePos.x}
                y1={sourcePos.y}
                x2={targetPos.x}
                y2={targetPos.y}
                stroke={RELATION_TYPE_COLORS[link.type] || RELATION_TYPE_COLORS.other}
                strokeWidth={isHovered ? 2 : 1}
                opacity={isHovered ? 0.8 : 0.3}
              />
            </g>
          )
        })}

        {/* 节点 */}
        {nodes.map((node) => {
          const pos = positions.get(node.id)
          if (!pos) return null

          const isHovered = hoveredNode === node.id
          const isIsolated = isolatedNodes.some((n) => n.id === node.id)

          return (
            <g
              key={node.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                r={isHovered ? 28 : 24}
                fill={node.color}
                opacity={isIsolated ? 0.4 : 0.9}
              />
              <circle
                r={isHovered ? 28 : 24}
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth={isHovered ? 2 : 1}
              />
              <text
                textAnchor="middle"
                dy={40}
                fill="#9ca3af"
                fontSize={11}
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {node.name.length > 6 ? node.name.slice(0, 6) + '...' : node.name}
              </text>
            </g>
          )
        })}
      </svg>

      {/* 统计信息 */}
      <div
        className="absolute bottom-3 left-4 text-xs px-2 py-1 rounded flex items-center gap-3"
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
      {filterType === 'all' && links.length > 0 && (
        <div
          className="absolute bottom-3 right-4 text-xs px-2 py-1 rounded"
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            color: '#6b7280',
          }}
        >
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            {Object.entries(RELATION_TYPE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span>
                  {type === 'family' && '家人'}
                  {type === 'friend' && '朋友'}
                  {type === 'enemy' && '敌人'}
                  {type === 'master' && '师父'}
                  {type === 'disciple' && '徒弟'}
                  {type === 'rival' && '竞争'}
                  {type === 'romantic' && '恋人'}
                  {type === 'other' && '其他'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
