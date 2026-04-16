import { useEffect, useRef, useState } from 'react'
import { useSettingsStore } from '@/store'
import { LinkIcon } from 'lucide-react'

interface GraphNode {
  id: string
  name: string
  type: string
  color: string
}

interface GraphLink {
  source: string
  target: string
  type: string
}

export function RelationGraph() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { characters } = useSettingsStore()
  const [dimensions, setDimensions] = useState({ width: 300, height: 400 })

  // 计算节点和连线
  const nodes: GraphNode[] = characters.map((char) => ({
    id: char.id,
    name: char.name,
    type: 'character',
    color: '#e8b87d',
  }))

  const links: GraphLink[] = characters.flatMap((char) =>
    char.relationships.map((rel) => ({
      source: char.id,
      target: rel.targetId,
      type: rel.type,
    }))
  )

  // 简单的力导向布局计算
  const [positions] = useState<Map<string, { x: number; y: number }>>(() => {
    const map = new Map()
    characters.forEach((char, i) => {
      const angle = (i / characters.length) * 2 * Math.PI
      const radius = 100
      map.set(char.id, {
        x: 150 + radius * Math.cos(angle),
        y: 200 + radius * Math.sin(angle),
      })
    })
    return map
  })

  useEffect(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect()
      setDimensions({ width, height })
    }
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

  return (
    <div
      ref={containerRef}
      className="h-full overflow-hidden relative"
      style={{ backgroundColor: '#0a0b0d' }}
    >
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

          return (
            <line
              key={i}
              x1={sourcePos.x}
              y1={sourcePos.y}
              x2={targetPos.x}
              y2={targetPos.y}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1}
            />
          )
        })}

        {/* 节点 */}
        {nodes.map((node) => {
          const pos = positions.get(node.id)
          if (!pos) return null

          return (
            <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`}>
              <circle r={24} fill={node.color} opacity={0.9} />
              <circle r={24} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
              <text
                textAnchor="middle"
                dy={40}
                fill="#9ca3af"
                fontSize={11}
                className="pointer-events-none"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {node.name.length > 6 ? node.name.slice(0, 6) + '...' : node.name}
              </text>
            </g>
          )
        })}
      </svg>

      {/* 图例 */}
      <div
        className="absolute bottom-3 left-4 text-xs px-2 py-1 rounded"
        style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          color: '#6b7280',
        }}
      >
        {nodes.length} 个角色 · {links.length} 条关系
      </div>
    </div>
  )
}
