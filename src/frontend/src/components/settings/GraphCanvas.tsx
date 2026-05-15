/**
 * GraphCanvas — Main graph rendering component.
 * State management in useGraphCanvas hook, UI sub-components in sibling files.
 */

import { Suspense, lazy } from 'react'
import {
  Box,
  Grid2x2,
  Maximize2,
  Minimize2,
  Sparkles,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGraphCanvas } from './useGraphCanvas'
import { GraphBackground, GraphFallback, NodeHoverTooltip, NodeDetailPanel, ContextMenu, renderNodeCanvas, renderLinkCanvas } from './GraphNode'
import { FilterControls } from './GraphControls'
import { Legend, StatsBar } from './GraphLegend'
import { GraphEmptyState } from './GraphEmptyState'

const ForceGraph2D = lazy(() => import('react-force-graph-2d'))
const ForceGraph3D = lazy(() => import('react-force-graph-3d'))

export function GraphCanvas() {
  const s = useGraphCanvas()

  const nodeCanvasObject = (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    renderNodeCanvas(node, ctx, globalScale, {
      hoveredNodeId: s.hoveredNodeId,
      selectedNodeId: s.selectedNode?.node.id ?? null,
      activeHighlightId: s.activeHighlightId,
      renderMode: s.renderMode,
      animationPulse: s.animationTimeRef.current.pulse,
      animationOrbit: s.animationTimeRef.current.orbit,
    })
  }

  const linkCanvasObject = (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    renderLinkCanvas(link, ctx, globalScale, {
      hoveredNodeId: s.hoveredNodeId,
      activeHighlightId: s.activeHighlightId,
      renderMode: s.renderMode,
      animationFlow: s.animationTimeRef.current.flow,
      animationParticle: s.animationTimeRef.current.particle,
    })
  }

  if (s.characters.length === 0 && s.allNodes.length === 0) {
    return <GraphEmptyState variant="no-data" />
  }

  if (s.nodes.length === 0) {
    return <GraphEmptyState variant="no-results" />
  }

  const visibleRelationTypes = [...new Set(s.visibleLinks.map((l) => l.type))]

  return (
    <div
      ref={s.containerRef}
      className={`relative overflow-hidden ${s.isFullscreen ? 'fixed inset-0 z-50' : 'h-full rounded-lg'}`}
      style={{ background: 'var(--ink-100)', border: s.isFullscreen ? undefined : '1px solid var(--border-subtle)' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <GraphBackground />

      <div className="absolute top-0 left-0 right-0 h-px z-10" style={{ background: 'linear-gradient(90deg, transparent, var(--accent-100), transparent)', opacity: 0.25 }} />

      <div className="absolute top-3 right-20 z-10">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={s.handleGenerateRelations}
          disabled={s.isGenerating}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-medium transition-all duration-300 disabled:opacity-70"
          style={{
            background: s.isGenerating ? 'var(--accent-muted)' : 'var(--paper-80)',
            border: '1px solid var(--border-default)',
            boxShadow: s.isGenerating ? '0 0 12px var(--accent-glow)' : '0 2px 8px rgba(0,0,0,0.08)',
            color: 'var(--accent-primary)',
          }}
        >
          {s.isGenerating ? (
            <>
              <div className="w-3 h-3 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
              <span>生成中...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>生成关系</span>
            </>
          )}
        </motion.button>
      </div>

      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        <button
          onClick={s.toggleFullscreen}
          className="p-2 rounded-xl transition-all duration-200 group"
          title={s.isFullscreen ? '退出全屏' : '全屏'}
          style={{ background: 'var(--paper-80)', border: '1px solid var(--border-subtle)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
        >
          {s.isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5 transition-colors" style={{ color: 'var(--ink-90)', opacity: 0.5 }} />
          ) : (
            <Maximize2 className="w-3.5 h-3.5 transition-colors" style={{ color: 'var(--ink-90)', opacity: 0.5 }} />
          )}
        </button>
        <button
          onClick={() => s.setViewMode(s.viewMode === '2d' ? '3d' : '2d')}
          className="p-2 rounded-xl transition-all duration-200 flex items-center gap-1.5 group"
          title={s.viewMode === '2d' ? '切换到3D视图' : '切换到2D视图'}
          style={{ background: 'var(--paper-80)', border: '1px solid var(--border-subtle)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
        >
          {s.viewMode === '2d' ? (
            <Box className="w-3.5 h-3.5 transition-colors" style={{ color: 'var(--ink-90)', opacity: 0.5 }} />
          ) : (
            <Grid2x2 className="w-3.5 h-3.5 transition-colors" style={{ color: 'var(--ink-90)', opacity: 0.5 }} />
          )}
          <span className="text-[10px] transition-colors font-medium" style={{ color: 'var(--ink-90)', opacity: 0.5 }}>
            {s.viewMode.toUpperCase()}
          </span>
        </button>
      </div>

      <FilterControls
        activeTypes={s.activeNodeTypes}
        onToggleType={s.toggleNodeType}
        filterRelation={s.filterRelation}
        onSetRelationFilter={s.setFilterRelation}
        onZoomIn={() => s.fgRef.current?.zoom(s.fgRef.current.zoom() * 1.3, 300)}
        onZoomOut={() => s.fgRef.current?.zoom(s.fgRef.current.zoom() / 1.3, 300)}
        onResetView={() => s.fgRef.current?.zoomToFit(400, 40)}
        searchQuery={s.searchQuery}
        onSearchChange={s.setSearchQuery}
        searchResults={s.searchResults}
        onSelectResult={s.handleSearchResultSelect}
      />

      <Suspense fallback={<GraphFallback />}>
        {s.viewMode === '2d' ? (
          <ForceGraph2D
            ref={s.fgRef}
            graphData={{ nodes: s.visibleNodes, links: s.visibleLinks }}
            width={s.dimensions.width}
            height={s.dimensions.height}
            backgroundColor="transparent"
            nodeLabel="name"
            nodeColor={(node: any) => node.color}
            nodeVal={(node: any) => Math.sqrt(node.val) * 6 + 4}
            nodeRelSize={6}
            linkColor={(link: any) => link.color}
            linkWidth={(link: any) => {
              const focusId = s.hoveredNodeId || s.activeHighlightId
              const isHighlighted = focusId && (link.source.id === focusId || link.target.id === focusId)
              return isHighlighted ? 2.5 : 1
            }}
            {...{
              linkOpacity: (link: any) => {
                if (s.renderMode === 'simple') return 0.2
                const focusId = s.hoveredNodeId || s.activeHighlightId
                const isHighlighted = focusId && (link.source.id === focusId || link.target.id === focusId)
                const isDimmed = focusId && !isHighlighted
                return isDimmed ? 0.08 : isHighlighted ? 0.9 : 0.35
              },
            }}
            linkDirectionalParticles={s.renderMode === 'full' ? 2 : 0}
            linkDirectionalParticleSpeed={s.renderMode === 'full' ? 0.008 : 0}
            linkDirectionalParticleWidth={(link: any) => {
              const focusId = s.hoveredNodeId || s.activeHighlightId
              const isHighlighted = s.renderMode !== 'simple' && focusId && (link.source.id === focusId || link.target.id === focusId)
              return isHighlighted ? 2 : 0
            }}
            onNodeClick={s.handleNodeClick}
            onBackgroundClick={s.handleBackgroundClick}
            onNodeRightClick={s.handleNodeRightClick}
            onNodeHover={s.renderMode !== 'simple' ? (node: any) => {
              s.setHoveredNodeId(node?.id || null)
              if (!node) s.setHoverTooltip(null)
            } : undefined}
            onNodeDrag={s.renderMode !== 'simple' ? s.handleNodeDrag : undefined}
            onEngineStop={() => {
              if (s.fgRef.current) {
                const centerGraph = s.fgRef.current.centerAt()
                const zoom = s.fgRef.current.zoom()
                s.updateViewport({ k: zoom, x: centerGraph.x || 0, y: centerGraph.y || 0 })
              }
            }}
            cooldownTicks={s.renderMode === 'simple' ? 30 : s.renderMode === 'optimized' ? 60 : 100}
            warmupTicks={s.renderMode === 'simple' ? 5 : s.renderMode === 'optimized' ? 10 : 20}
            d3AlphaDecay={s.renderMode === 'simple' ? 0.05 : 0.02}
            d3VelocityDecay={s.renderMode === 'simple' ? 0.5 : 0.3}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            enablePanInteraction={true}
            nodeCanvasObjectMode={() => 'replace'}
            nodeCanvasObject={s.renderMode === 'simple' ? undefined : nodeCanvasObject}
            linkCanvasObjectMode={() => 'replace'}
            linkCanvasObject={s.renderMode === 'simple' ? undefined : linkCanvasObject}
          />
        ) : (
          <ForceGraph3D
            ref={s.fgRef}
            graphData={{ nodes: s.visibleNodes, links: s.visibleLinks }}
            width={s.dimensions.width}
            height={s.dimensions.height}
            backgroundColor="transparent"
            nodeLabel="name"
            nodeColor={(node: any) => node.color}
            nodeVal={(node: any) => Math.sqrt(node.val) * 4 + 3}
            linkColor={(link: any) => link.color}
            linkWidth={0.5}
            linkOpacity={0.4}
            onNodeClick={s.handleNodeClick}
            onBackgroundClick={s.handleBackgroundClick}
            onNodeRightClick={s.handleNodeRightClick}
            enableNodeDrag={true}
            enableNavigationControls={true}
            showNavInfo={false}
            cooldownTicks={100}
            warmupTicks={20}
          />
        )}
      </Suspense>

      <AnimatePresence>
        {s.hoverTooltip && !s.selectedNode && (
          <NodeHoverTooltip tooltip={s.hoverTooltip} containerRef={s.containerRef} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {s.selectedNode && (
          <NodeDetailPanel detail={s.selectedNode} onClose={() => s.setSelectedNode(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {s.contextMenu && (
          <ContextMenu
            menu={s.contextMenu}
            onClose={() => s.setContextMenu(null)}
            onHighlight={s.handleHighlightConnections}
            onFocus={s.handleFocusNode}
            onViewDetails={s.handleViewDetailsFromMenu}
          />
        )}
      </AnimatePresence>

      <StatsBar nodeCount={s.visibleNodes.length} linkCount={s.visibleLinks.length} filterRelation={s.filterRelation} onClearFilter={() => s.setFilterRelation('all')} />

      <Legend showLegend={s.showLegend} onToggle={() => s.setShowLegend(!s.showLegend)} visibleRelationTypes={visibleRelationTypes} />
    </div>
  )
}
