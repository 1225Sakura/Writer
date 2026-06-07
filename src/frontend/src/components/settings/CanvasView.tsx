import { useMemo, useCallback, useEffect, useState, useRef, type CSSProperties } from 'react'
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
  type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useSettingsStore } from '@/store/settingsStore'
import { CanvasNode, type CanvasNodeData } from './CanvasNode'
import {
  RelationshipEdge,
  RELATIONSHIP_TYPES,
  type RelType,
  type RelationshipEdgeData,
} from './RelationshipEdge'
import { CanvasContextMenu, type ContextMenuItem } from './CanvasContextMenu'
import { RelationshipDetailPanel } from './RelationshipDetailPanel'
import { RelationshipTypePicker } from './RelationshipTypePicker'
import { Trash2, Edit3, Link, Eye } from 'lucide-react'

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

/** Parse entity ID like "char_5" → { prefix: "char", numericId: 5 } */
function parseEntityNodeId(nodeId: string): { prefix: string; numericId: number } | null {
  const match = nodeId.match(/^(\w+)_(\d+)$/)
  if (!match) return null
  return { prefix: match[1], numericId: Number(match[2]) }
}

const nodeTypes = { entityNode: CanvasNode }
const edgeTypes = { relationship: RelationshipEdge }

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
  const addRelationship = useSettingsStore((s) => s.addRelationship)
  const updateRelationship = useSettingsStore((s) => s.updateRelationship)
  const removeRelationship = useSettingsStore((s) => s.removeRelationship)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    items: ContextMenuItem[]
  } | null>(null)

  // Detail panel state
  const [detailEdgeId, setDetailEdgeId] = useState<string | null>(null)

  // Pending connection state (for new edge creation)
  const [pendingConnection, setPendingConnection] = useState<{
    sourceId: string
    targetId: string
    sourceLabel: string
    targetLabel: string
  } | null>(null)

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
    const edges: Edge<RelationshipEdgeData>[] = []

    // Character relationships
    for (const char of characters) {
      for (const rel of char.relationships) {
        const sourceId = `char_${char.id}`
        const targetId = `char_${rel.targetId}`
        // Only add if target exists
        if (characters.some((c) => c.id === rel.targetId)) {
          const relType: RelType =
            rel.type in RELATIONSHIP_TYPES ? (rel.type as RelType) : 'other'
          edges.push({
            id: `rel_${char.id}_${rel.targetId}`,
            source: sourceId,
            target: targetId,
            type: 'relationship',
            data: {
              relationType: relType,
              description: rel.description,
              characterId: char.id,
              relationshipId: rel.id,
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
            type: 'relationship',
            data: { relationType: 'other' },
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
            type: 'relationship',
            data: { relationType: 'other' },
          })
        }
      }
    }

    return edges
  }, [characters, items, locations])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Keep a ref to edges for context menu callbacks
  const edgesRef = useRef(edges)
  edgesRef.current = edges
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes

  // Sync when entities change
  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  // ---- Node click: highlight connected edges ----
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          selected: e.source === node.id || e.target === node.id,
        })),
      )
    },
    [setEdges],
  )

  // ---- Pane click: reset selection ----
  const onPaneClick = useCallback(() => {
    setEdges((eds) => eds.map((e) => ({ ...e, selected: false })))
    setContextMenu(null)
    setDetailEdgeId(null)
  }, [setEdges])

  // ---- Node right-click ----
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      const parsed = parseEntityNodeId(node.id)

      const items: ContextMenuItem[] = [
        {
          key: 'view',
          label: '查看详情',
          icon: <Eye size={14} />,
          onClick: () => {
            // Highlight connected edges
            setEdges((eds) =>
              eds.map((e) => ({
                ...e,
                selected: e.source === node.id || e.target === node.id,
              })),
            )
          },
        },
        {
          key: 'add-rel',
          label: '添加关系...',
          icon: <Link size={14} />,
          onClick: () => {
            // Relationship creation is done via drag-connect handles
          },
          disabled: !parsed || parsed.prefix !== 'char',
        },
      ]

      setContextMenu({ x: event.clientX, y: event.clientY, items })
    },
    [setEdges],
  )

  // ---- Pane right-click: close menu ----
  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault()
    setContextMenu(null)
  }, [])

  // ---- Edge click: show detail panel ----
  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setDetailEdgeId(edge.id)
      setEdges((eds) =>
        eds.map((e) => ({ ...e, selected: e.id === edge.id })),
      )
    },
    [setEdges],
  )

  // ---- Edge right-click: context menu ----
  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent, edge: Edge) => {
      event.preventDefault()
      const data = edge.data as RelationshipEdgeData | undefined

      const items: ContextMenuItem[] = [
        {
          key: 'detail',
          label: '编辑关系',
          icon: <Edit3 size={14} />,
          onClick: () => setDetailEdgeId(edge.id),
        },
        {
          key: 'delete',
          label: '删除关系',
          icon: <Trash2 size={14} />,
          danger: true,
          onClick: () => {
            setEdges((eds) => eds.filter((e) => e.id !== edge.id))
            if (data?.characterId && data?.relationshipId) {
              removeRelationship(data.characterId, data.relationshipId)
            }
          },
        },
      ]

      setContextMenu({ x: event.clientX, y: event.clientY, items })
    },
    [removeRelationship, setEdges],
  )

  // ---- New connection created via drag ----
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return

      const sourceNode = nodesRef.current.find((n) => n.id === connection.source)
      const targetNode = nodesRef.current.find((n) => n.id === connection.target)
      if (!sourceNode || !targetNode) return

      // Prevent self-loops
      if (connection.source === connection.target) return

      // Prevent duplicate edges
      const exists = edgesRef.current.some(
        (e) => e.source === connection.source && e.target === connection.target,
      )
      if (exists) return

      const sourceLabel =
        (sourceNode.data as CanvasNodeData)?.entityName || connection.source
      const targetLabel =
        (targetNode.data as CanvasNodeData)?.entityName || connection.target

      setPendingConnection({
        sourceId: connection.source,
        targetId: connection.target,
        sourceLabel,
        targetLabel,
      })
    },
    [],
  )

  // ---- Handle relationship type selection from picker ----
  const handleRelationshipTypeSelect = useCallback(
    async (relType: RelType) => {
      if (!pendingConnection) return

      const { sourceId, targetId } = pendingConnection
      const sourceParsed = parseEntityNodeId(sourceId)
      const targetParsed = parseEntityNodeId(targetId)

      const newEdgeId = `new_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

      // Add edge to canvas
      setEdges((eds) => [
        ...eds,
        {
          id: newEdgeId,
          source: sourceId,
          target: targetId,
          type: 'relationship',
          data: {
            relationType: relType,
            description: '',
          } as RelationshipEdgeData,
        },
      ])

      // Persist to store if both are characters
      if (
        sourceParsed?.prefix === 'char' &&
        targetParsed?.prefix === 'char'
      ) {
        try {
          await addRelationship(sourceParsed.numericId, {
            targetId: targetParsed.numericId,
            type: relType,
            description: '',
          })
        } catch {
          // Error already handled by store toast
        }
      }

      setPendingConnection(null)
    },
    [pendingConnection, addRelationship, setEdges],
  )

  // ---- Handle relationship type update from detail panel ----
  const handleUpdateRelationType = useCallback(
    (edgeId: string, newType: RelType) => {
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== edgeId) return e
          return {
            ...e,
            data: {
              ...e.data,
              relationType: newType,
            } as RelationshipEdgeData,
          }
        }),
      )

      // Persist to store
      const edge = edgesRef.current.find((e) => e.id === edgeId)
      const data = edge?.data as RelationshipEdgeData | undefined
      if (data?.characterId && data?.relationshipId) {
        updateRelationship(data.characterId, data.relationshipId, {
          type: newType,
        })
      }
    },
    [setEdges, updateRelationship],
  )

  // ---- Handle delete from detail panel ----
  const handleDeleteFromPanel = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId))
      const edge = edgesRef.current.find((e) => e.id === edgeId)
      const data = edge?.data as RelationshipEdgeData | undefined
      if (data?.characterId && data?.relationshipId) {
        removeRelationship(data.characterId, data.relationshipId)
      }
      setDetailEdgeId(null)
    },
    [setEdges, removeRelationship],
  )

  // ---- Get label for a node ID ----
  const getNodeLabel = useCallback(
    (nodeId: string): string => {
      const node = nodesRef.current.find((n) => n.id === nodeId)
      return (node?.data as CanvasNodeData)?.entityName || nodeId
    },
    [],
  )

  // Detail panel edge data
  const detailEdge = detailEdgeId
    ? edgesRef.current.find((e) => e.id === detailEdgeId)
    : null

  return (
    <div className="w-full h-full relative" style={{ background: 'var(--ink-100)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        onEdgeClick={onEdgeClick}
        onEdgeContextMenu={onEdgeContextMenu}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        colorMode={'dark' as ColorMode}
        style={{ background: 'transparent' }}
        defaultEdgeOptions={{
          type: 'relationship',
        }}
        connectionLineStyle={{
          stroke: 'var(--accent-primary)',
          strokeWidth: 2,
          strokeDasharray: '6 3',
        }}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          color="rgba(var(--accent-rgb), 0.08)"
          gap={24}
          size={1}
        />
        <Controls
          showInteractive={false}
          style={
            {
              button: {
                backgroundColor: 'var(--paper-80)',
                borderColor: 'var(--border-default)',
                color: 'var(--ink-100)',
                width: 28,
                height: 28,
              },
            } as CSSProperties
          }
        />
        <MiniMap
          style={miniMapStyle}
          nodeColor="var(--accent-primary)"
          maskColor="rgba(var(--glass-base-rgb), 0.7)"
          pannable
          zoomable
        />
      </ReactFlow>

      {/* Context Menu */}
      {contextMenu && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Relationship Detail Panel */}
      {detailEdge && detailEdge.data && (
        <RelationshipDetailPanel
          edgeId={detailEdge.id}
          sourceLabel={getNodeLabel(detailEdge.source)}
          targetLabel={getNodeLabel(detailEdge.target)}
          data={detailEdge.data as RelationshipEdgeData}
          onUpdateRelationType={handleUpdateRelationType}
          onDelete={handleDeleteFromPanel}
          onClose={() => setDetailEdgeId(null)}
        />
      )}

      {/* Relationship Type Picker (on new connection) */}
      {pendingConnection && (
        <RelationshipTypePicker
          sourceLabel={pendingConnection.sourceLabel}
          targetLabel={pendingConnection.targetLabel}
          onSelect={handleRelationshipTypeSelect}
          onCancel={() => setPendingConnection(null)}
        />
      )}
    </div>
  )
}
