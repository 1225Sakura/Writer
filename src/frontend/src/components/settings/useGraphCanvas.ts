/**
 * useGraphCanvas — State management hook for GraphCanvas.
 * Extracted to reduce GraphCanvas.tsx line count.
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useSettingsStore } from '@/store'
import { ENTITY_TYPE_CONFIG, useGraphData, PERFORMANCE_THRESHOLD } from './graphTypes'
import type { GraphNode, EntityNodeType } from './graphTypes'

export function useGraphCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<any>(null)
  const { characters } = useSettingsStore()
  const animationTimeRef = useRef({ pulse: 0, orbit: 0, flow: 0, particle: 0 })
  const animationRafRef = useRef<number>()

  const [dimensions, setDimensions] = useState({ width: 300, height: 400 })
  const [viewport, setViewport] = useState({ x: 0, y: 0, width: 300, height: 400 })
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d')
  const [activeNodeTypes, setActiveNodeTypes] = useState<Set<EntityNodeType>>(
    new Set(Object.keys(ENTITY_TYPE_CONFIG) as EntityNodeType[]),
  )
  const [filterRelation, setFilterRelation] = useState<string>('all')
  const [showLegend, setShowLegend] = useState(true)
  const [selectedNode, setSelectedNode] = useState<{ node: GraphNode; x: number; y: number } | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [hoverTooltip, setHoverTooltip] = useState<{ node: GraphNode; x: number; y: number } | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ node: GraphNode; x: number; y: number } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)

  const { nodes: allNodes, links: allLinks } = useGraphData()

  const { nodes, links } = useMemo(() => {
    const filteredNodes = allNodes.filter((n) => activeNodeTypes.has(n.type))
    const nodeIds = new Set(filteredNodes.map((n) => n.id))
    let filteredLinks = allLinks.filter(
      (l) => nodeIds.has(l.source) && nodeIds.has(l.target),
    )
    if (filterRelation !== 'all') {
      filteredLinks = filteredLinks.filter((l) => l.type === filterRelation)
    }
    return { nodes: filteredNodes, links: filteredLinks }
  }, [allNodes, allLinks, activeNodeTypes, filterRelation])

  const visibleNodes = useMemo(() => {
    const buffer = 100
    return nodes.filter((node) => {
      const nx = (node as any).x || 0
      const ny = (node as any).y || 0
      return (
        nx >= viewport.x - buffer &&
        nx <= viewport.x + viewport.width + buffer &&
        ny >= viewport.y - buffer &&
        ny <= viewport.y + viewport.height + buffer
      )
    })
  }, [nodes, viewport])

  const visibleLinks = useMemo(() => {
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id))
    return links.filter(
      (link) =>
        visibleNodeIds.has(link.source as string) &&
        visibleNodeIds.has(link.target as string),
    )
  }, [links, visibleNodes])

  const renderMode = useMemo(() => {
    if (nodes.length > PERFORMANCE_THRESHOLD * 1.5) return 'simple'
    if (nodes.length > PERFORMANCE_THRESHOLD) return 'optimized'
    return 'full'
  }, [nodes.length])

  const activeHighlightId = highlightedNodeId || selectedNode?.node.id || null

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return allNodes.filter(
      (n) => n.name.toLowerCase().includes(q) || n.type.toLowerCase().includes(q)
    )
  }, [searchQuery, allNodes])

  // Resize observer
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect()
        setDimensions({ width, height })
        setViewport((prev) => ({ ...prev, width, height }))
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

  // Animation loop
  useEffect(() => {
    const animate = () => {
      const now = Date.now()
      animationTimeRef.current = {
        pulse: now,
        orbit: now / 1500,
        flow: now / 800,
        particle: now / 1000,
      }
      if (fgRef.current && typeof fgRef.current.refresh === 'function') {
        fgRef.current.refresh()
      }
      animationRafRef.current = requestAnimationFrame(animate)
    }
    animationRafRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRafRef.current) cancelAnimationFrame(animationRafRef.current)
    }
  }, [])

  // Callbacks
  const updateViewport = useCallback(
    (centerZoom: { k: number; x: number; y: number }) => {
      setViewport({
        x: -centerZoom.x / centerZoom.k,
        y: -centerZoom.y / centerZoom.k,
        width: dimensions.width / centerZoom.k,
        height: dimensions.height / centerZoom.k,
      })
    },
    [dimensions],
  )

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

  const handleNodeClick = useCallback((node: any, event: MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setSelectedNode({
      node: node as GraphNode,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    })
  }, [])

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null)
    setContextMenu(null)
    setHighlightedNodeId(null)
  }, [])

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev)
    setTimeout(() => {
      if (fgRef.current) fgRef.current.zoomToFit(400, 40)
    }, 100)
  }, [])

  const handleGenerateRelations = useCallback(() => {
    setIsGenerating(true)
    setTimeout(() => setIsGenerating(false), 2000)
  }, [])

  const handleNodeRightClick = useCallback((node: any, event: MouseEvent) => {
    event.preventDefault()
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setContextMenu({
      node: node as GraphNode,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    })
    setSelectedNode(null)
  }, [])

  const handleHighlightConnections = useCallback((nodeId: string) => {
    setHighlightedNodeId((prev) => (prev === nodeId ? null : nodeId))
  }, [])

  const handleFocusNode = useCallback((node: GraphNode) => {
    if (fgRef.current) {
      const graphNode = (fgRef.current as any).graphData()?.nodes?.find(
        (n: any) => n.id === node.id
      )
      if (graphNode) {
        fgRef.current.centerAt(graphNode.x, graphNode.y, 600)
        fgRef.current.zoom(2.5, 600)
      }
    }
    setHighlightedNodeId(node.id)
  }, [])

  const handleViewDetailsFromMenu = useCallback((node: GraphNode, x: number, y: number) => {
    setSelectedNode({ node, x, y })
  }, [])

  const handleSearchResultSelect = useCallback((node: GraphNode) => {
    setSearchQuery('')
    setHighlightedNodeId(node.id)
    if (fgRef.current) {
      const graphNode = (fgRef.current as any).graphData()?.nodes?.find(
        (n: any) => n.id === node.id
      )
      if (graphNode) {
        fgRef.current.centerAt(graphNode.x, graphNode.y, 600)
        fgRef.current.zoom(2.5, 600)
      }
    }
  }, [])

  const handleNodeDrag = useCallback((node: any) => {
    if (!node) return
    setHoverTooltip({
      node: node as GraphNode,
      x: (node.x as number) || 0,
      y: (node.y as number) || 0,
    })
  }, [])

  return {
    // Refs
    containerRef,
    fgRef,
    animationTimeRef,
    // State
    characters,
    isGenerating,
    dimensions,
    viewMode,
    setViewMode,
    activeNodeTypes,
    filterRelation,
    setFilterRelation,
    showLegend,
    setShowLegend,
    selectedNode,
    setSelectedNode,
    hoveredNodeId,
    setHoveredNodeId,
    hoverTooltip,
    setHoverTooltip,
    isFullscreen,
    contextMenu,
    setContextMenu,
    searchQuery,
    setSearchQuery,
    highlightedNodeId,
    // Derived
    allNodes,
    nodes,
    links,
    visibleNodes,
    visibleLinks,
    renderMode,
    activeHighlightId,
    searchResults,
    // Callbacks
    updateViewport,
    toggleNodeType,
    handleNodeClick,
    handleBackgroundClick,
    toggleFullscreen,
    handleGenerateRelations,
    handleNodeRightClick,
    handleHighlightConnections,
    handleFocusNode,
    handleViewDetailsFromMenu,
    handleSearchResultSelect,
    handleNodeDrag,
  }
}
