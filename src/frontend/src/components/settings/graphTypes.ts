/**
 * graphTypes.ts — Shared types, constants, and data hook for the relation graph.
 * Single source of truth imported by all graph sub-components.
 */

import {
  Users,
  MapPin,
  Swords,
  BookOpen,
  Globe,
  Scroll,
} from 'lucide-react'

// ============================================
// Types
// ============================================

export interface GraphNode {
  id: string
  name: string
  type: EntityNodeType
  color: string
  val: number
  description?: string
  entityId: number
}

export interface GraphLink {
  source: string
  target: string
  type: string
  color: string
}

export type EntityNodeType =
  | 'character'
  | 'item'
  | 'location'
  | 'faction'
  | 'world'
  | 'rule'
  | 'outline'
  | 'ifline'

export interface NodeDetail {
  node: GraphNode
  x: number
  y: number
}

export interface HoverTooltipState {
  node: GraphNode
  x: number
  y: number
}

export interface ContextMenuState {
  node: GraphNode
  x: number
  y: number
}

// ============================================
// Entity Type Config
// ============================================

export const ENTITY_TYPE_CONFIG: Record<
  EntityNodeType,
  {
    label: string
    color: string
    icon: typeof Users
    glowColor: string
    glowStrong: string
    ringColor: string
    size: number
  }
> = {
  character: {
    label: '角色',
    color: 'var(--color-character)',
    icon: Users,
    glowColor: 'color-mix(in srgb, var(--color-character) 30%, transparent)',
    glowStrong: 'color-mix(in srgb, var(--color-character) 60%, transparent)',
    ringColor: 'color-mix(in srgb, var(--color-character) 20%, transparent)',
    size: 8,
  },
  item: {
    label: '物品',
    color: 'var(--color-item)',
    icon: Scroll,
    glowColor: 'color-mix(in srgb, var(--color-item) 30%, transparent)',
    glowStrong: 'color-mix(in srgb, var(--color-item) 60%, transparent)',
    ringColor: 'color-mix(in srgb, var(--color-item) 20%, transparent)',
    size: 6,
  },
  location: {
    label: '地点',
    color: 'var(--color-location)',
    icon: MapPin,
    glowColor: 'color-mix(in srgb, var(--color-location) 30%, transparent)',
    glowStrong: 'color-mix(in srgb, var(--color-location) 60%, transparent)',
    ringColor: 'color-mix(in srgb, var(--color-location) 20%, transparent)',
    size: 7,
  },
  faction: {
    label: '势力',
    color: 'var(--color-faction)',
    icon: Swords,
    glowColor: 'color-mix(in srgb, var(--color-faction) 30%, transparent)',
    glowStrong: 'color-mix(in srgb, var(--color-faction) 60%, transparent)',
    ringColor: 'color-mix(in srgb, var(--color-faction) 20%, transparent)',
    size: 7,
  },
  world: {
    label: '世界观',
    color: 'var(--color-world)',
    icon: Globe,
    glowColor: 'color-mix(in srgb, var(--color-world) 30%, transparent)',
    glowStrong: 'color-mix(in srgb, var(--color-world) 60%, transparent)',
    ringColor: 'color-mix(in srgb, var(--color-world) 20%, transparent)',
    size: 6,
  },
  rule: {
    label: '规则',
    color: 'var(--color-rule)',
    icon: BookOpen,
    glowColor: 'color-mix(in srgb, var(--color-rule) 30%, transparent)',
    glowStrong: 'color-mix(in srgb, var(--color-rule) 60%, transparent)',
    ringColor: 'color-mix(in srgb, var(--color-rule) 20%, transparent)',
    size: 5,
  },
  outline: {
    label: '大纲',
    color: 'var(--color-outline)',
    icon: BookOpen,
    glowColor: 'color-mix(in srgb, var(--color-outline) 30%, transparent)',
    glowStrong: 'color-mix(in srgb, var(--color-outline) 60%, transparent)',
    ringColor: 'color-mix(in srgb, var(--color-outline) 20%, transparent)',
    size: 5,
  },
  ifline: {
    label: 'IF线',
    color: 'var(--color-ifline)',
    icon: Scroll,
    glowColor: 'color-mix(in srgb, var(--color-ifline) 30%, transparent)',
    glowStrong: 'color-mix(in srgb, var(--color-ifline) 60%, transparent)',
    ringColor: 'color-mix(in srgb, var(--color-ifline) 20%, transparent)',
    size: 6,
  },
}

// ============================================
// Relation Colors & Labels
// ============================================

export const RELATION_TYPE_COLORS: Record<string, string> = {
  family: 'var(--color-location)',
  friend: 'var(--color-outline)',
  enemy: 'var(--color-danger)',
  master: 'var(--color-item)',
  disciple: 'var(--color-rule)',
  rival: 'var(--color-character)',
  romantic: 'var(--color-faction)',
  owns: 'var(--color-item)',
  located_at: 'var(--color-location)',
  belongs_to: 'var(--color-faction)',
  other: 'var(--text-tertiary)',
}

export const RELATION_TYPE_LABELS: Record<string, string> = {
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

export const PERFORMANCE_THRESHOLD = 100

// Re-export useGraphData from its own module
export { useGraphData } from './useGraphData'
