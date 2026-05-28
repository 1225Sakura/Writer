import { useMemo, useCallback, useEffect, type CSSProperties } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type ColorMode,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useSettingsStore } from '@/store/settingsStore'
import { CanvasNode, type CanvasNodeData } from './CanvasNode'

// Entity type config for canvas nodes
const ENTITY_TYPES = [
  { key: 'characters', type: 'character' as const, idPrefix: 'char' },
  { key: 'items', type: 'item' as const, idPrefix: 'item' },
  { key: 'locations', type: 'location' as const, idPrefix: 'loc' },
  { key: 'factions', type: 'faction' as const, idPrefix: 'fac' },
  { key: 'worldSettings', type: 'world' as const, idPrefix: 'world' },
  { key: 'rules', type: 'rule' as const, idPrefix: 'rule' },
  { key: 'ifLines', type: 'ifline' as const, idPrefix: 'ifline' },
] as const

// Simple dagre-like auto layout: arrange nodes in a grid
function autoLayout(nodes: Node[]): Node[] {
  const cols = Math.ceil(Math.sqrt(nodes.length))
  const spacingX = 260
  const spacingY = 180

  return nodes.map((node, i) => ({
    ...node,
    position: {
      x: (i % cols) * spacingX + 40,
      y: Math.floor(i / cols) * spacingY + 40,
    },
  }))
}

const nodeTypes = { entityNode: CanvasNode }

const miniMapStyle: CSSProperties = {
  backgroundColor: 'var(--paper-80)',
  border: '1px solid var(--border-default)',
  borderRadius: 6,
}

export function CanvasView() {
  const characters = useSettingsStore((s) => s.characters)
  const items = useSettingsStore((s) => s.items)
  const locations = useSettingsStore((s) => s.locations)
  const factions = useSettingsStore((s) => s.factions)
  const worldSettings = useSettingsStore((s) => s.worldSettings)
  const rules = useSettingsStore((s) => s.rules)
  const ifLines = useSettingsStore((s) => s.ifLines)

  // Build nodes from entities
  const initialNodes = useMemo(() => {
    const nodes: Node<CanvasNodeData>[] = []

    for (const { key, type, idPrefix } of ENTITY_TYPES) {
      const entities = {
        characters, items, locations, factions, worldSettings, rules, ifLines,
      }[key] as Array<{ id: number; name: string; description?: string; personality?: string; relationships?: Array<{ targetId: number }> }>

      for (const entity of entities) {
        nodes.push({
          id: `${idPrefix}_${entity.id}`,
          type: 'entityNode',
          position: { x: 0, y: 0 },
          data: {
            entityName: entity.name,
            entityType: type,
            description: entity.description || entity.personality || '',
          },
        })
      }
    }

    return autoLayout(nodes)
  }, [characters, items, locations, factions, worldSettings, rules, ifLines])

  // Build edges from relationships
  const initialEdges = useMemo(() => {
    const edges: Edge[] = []

    // Character relationships
    for (const char of characters) {
      for (const rel of char.relationships) {
        const sourceId = `char_${char.id}`
        const targetId = `char_${rel.targetId}`
        // Only add if target exists
        if (characters.some((c) => c.id === rel.targetId)) {
          edges.push({
            id: `rel_${char.id}_${rel.targetId}`,
            source: sourceId,
            target: targetId,
            type: 'straight',
            animated: rel.type === 'romantic',
            style: {
              stroke: 'var(--accent-primary)',
              strokeWidth: 1.5,
              strokeDasharray: '6 3',
              opacity: 0.6,
            },
          })
        }
      }
    }

    // Item ownership
    for (const item of items) {
      if (item.owner) {
        const owner = characters.find((c) => c.name === item.owner)
        if (owner) {
          edges.push({
            id: `owns_${owner.id}_${item.id}`,
            source: `char_${owner.id}`,
            target: `item_${item.id}`,
            style: {
              stroke: 'var(--accent-primary)',
              strokeWidth: 1,
              strokeDasharray: '4 4',
              opacity: 0.4,
            },
          })
        }
      }
      if (item.location) {
        const loc = locations.find((l) => l.name === item.location)
        if (loc) {
          edges.push({
            id: `loc_${item.id}_${loc.id}`,
            source: `item_${item.id}`,
            target: `loc_${loc.id}`,
            style: {
              stroke: 'var(--accent-primary)',
              strokeWidth: 1,
              strokeDasharray: '4 4',
              opacity: 0.4,
            },
          })
        }
      }
    }

    return edges
  }, [characters, items, locations])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Sync when entities change
  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    // Highlight connected edges on click
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        style: {
          ...e.style,
          opacity: e.source === node.id || e.target === node.id ? 0.9 : 0.2,
          strokeWidth: e.source === node.id || e.target === node.id ? 2 : 1,
        },
      }))
    )
  }, [setEdges])

  const onPaneClick = useCallback(() => {
    // Reset all edge highlights
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        style: {
          ...e.style,
          opacity: 0.6,
          strokeWidth: 1.5,
        },
      }))
    )
  }, [setEdges])

  return (
    <div className="w-full h-full" style={{ background: 'var(--ink-100)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        colorMode={'dark' as ColorMode}
        style={{ background: 'transparent' }}
        defaultEdgeOptions={{
          style: {
            stroke: 'var(--accent-primary)',
            strokeWidth: 1.5,
            strokeDasharray: '6 3',
          },
        }}
      >
        <Background
          color="rgba(var(--accent-rgb), 0.08)"
          gap={24}
          size={1}
        />
        <Controls
          showInteractive={false}
          style={{
            button: {
              backgroundColor: 'var(--paper-80)',
              borderColor: 'var(--border-default)',
              color: 'var(--ink-100)',
              width: 28,
              height: 28,
            },
          } as CSSProperties}
        />
        <MiniMap
          style={miniMapStyle}
          nodeColor="var(--accent-primary)"
          maskColor="rgba(var(--glass-base-rgb), 0.7)"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  )
}
