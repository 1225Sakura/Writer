/**
 * useGraphData — Hook that builds nodes and links for the relation graph.
 * Extracted from graphTypes.ts.
 */

import { useMemo } from 'react'
import { useSettingsStore } from '@/store'
import { ENTITY_TYPE_CONFIG, RELATION_TYPE_COLORS } from './graphTypes'
import type { GraphNode, GraphLink } from './graphTypes'

export function useGraphData() {
  const {
    characters,
    items,
    locations,
    factions,
    worldSettings,
    rules,
    ifLines,
  } = useSettingsStore()

  return useMemo(() => {
    const nodes: GraphNode[] = []
    const links: GraphLink[] = []

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
