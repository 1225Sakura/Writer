import { useSettingsStore } from '@/store/settingsStore'
import type { UIState } from '@/store/uiStore'
import { useMemo } from 'react'
import { entityColors } from './EntityCard'
import { OutlineEditor } from './EntityActions'
import { SchemaDrivenEditor } from './SchemaDrivenEditor'
import { itemSchema, locationSchema, factionSchema, worldSchema, ruleSchema, iflineSchema, characterSchema } from '@/shared/entitySchema'
import { IFLineEnhancer } from './IFLineEnhancer'

interface EntityEditorProps {
  category: UIState['settingsCategory']
}

/** Map category to the store's add methods */
const ADD_METHODS: Record<string, (data: Record<string, any>) => Promise<any>> = {
  item: (data) => useSettingsStore.getState().addItem(data as any),
  location: (data) => useSettingsStore.getState().addLocation(data as any),
  faction: (data) => useSettingsStore.getState().addFaction(data as any),
  world: (data) => useSettingsStore.getState().addWorldSetting(data as any),
  rule: (data) => useSettingsStore.getState().addRule(data as any),
  ifline: (data) => useSettingsStore.getState().addIFLine(data as any),
  character: (data) => useSettingsStore.getState().addCharacter({ ...data, tier: data.tier || 'supporting', tags: data.tags || [] } as any),
}

const UPDATE_METHODS: Record<string, (id: number, data: Record<string, any>) => Promise<any>> = {
  item: (id, data) => useSettingsStore.getState().updateItem(id, data),
  location: (id, data) => useSettingsStore.getState().updateLocation(id, data),
  faction: (id, data) => useSettingsStore.getState().updateFaction(id, data),
  world: (id, data) => useSettingsStore.getState().updateWorldSetting(id, data),
  rule: (id, data) => useSettingsStore.getState().updateRule(id, data),
  ifline: (id, data) => useSettingsStore.getState().updateIFLine(id, data),
  character: (id, data) => useSettingsStore.getState().updateCharacter(id, data),
}

const DELETE_METHODS: Record<string, (id: number) => Promise<any>> = {
  item: (id) => useSettingsStore.getState().deleteItem(id),
  location: (id) => useSettingsStore.getState().deleteLocation(id),
  faction: (id) => useSettingsStore.getState().deleteFaction(id),
  world: (id) => useSettingsStore.getState().deleteWorldSetting(id),
  rule: (id) => useSettingsStore.getState().deleteRule(id),
  ifline: (id) => useSettingsStore.getState().deleteIFLine(id),
  character: (id) => useSettingsStore.getState().deleteCharacter(id),
}

const SCHEMA_MAP: Record<string, typeof itemSchema> = {
  item: itemSchema,
  location: locationSchema,
  faction: factionSchema,
  world: worldSchema,
  rule: ruleSchema,
  ifline: iflineSchema,
  character: characterSchema,
}

const ENTITIES_MAP: Record<string, string> = {
  item: 'items',
  location: 'locations',
  faction: 'factions',
  world: 'worldSettings',
  rule: 'rules',
  ifline: 'ifLines',
  character: 'characters',
}

export function EntityEditor({ category }: EntityEditorProps) {
  const {
    items, locations, factions, worldSettings, rules, ifLines, characters,
  } = useSettingsStore()

  const accentColor = useMemo(() => {
    if (!category) return 'var(--accent-primary)'
    return entityColors[category]?.text || 'var(--accent-primary)'
  }, [category])

  // Schema-driven entities (including character)
  if (category && SCHEMA_MAP[category]) {
    const entitiesArr = { items, locations, factions, worldSettings, rules, ifLines, characters }
    const entities = entitiesArr[ENTITIES_MAP[category] as keyof typeof entitiesArr] || []

    // IF line: wrap with chapter range linking and sync mode visualization
    if (category === 'ifline') {
      return (
        <IFLineEnhancer
          entities={entities as Array<Record<string, any>>}
          accentColor={accentColor}
          schema={SCHEMA_MAP[category]}
          onAdd={ADD_METHODS[category]}
          onUpdate={UPDATE_METHODS[category]}
          onDelete={DELETE_METHODS[category]}
          onBatchDelete={(ids) => useSettingsStore.getState().batchDelete('ifline', ids)}
          onBatchTagUpdate={(ids, tags) => useSettingsStore.getState().batchUpdateTags('ifline', ids, tags)}
        />
      )
    }

    return (
      <SchemaDrivenEditor
        schema={SCHEMA_MAP[category]}
        entities={entities as Array<Record<string, any>>}
        onAdd={ADD_METHODS[category]}
        onUpdate={UPDATE_METHODS[category]}
        onDelete={DELETE_METHODS[category]}
        onBatchDelete={(ids) => useSettingsStore.getState().batchDelete(category as any, ids)}
        onBatchTagUpdate={(ids, tags) => useSettingsStore.getState().batchUpdateTags(category as any, ids, tags)}
        accentColor={accentColor}
      />
    )
  }

  switch (category) {
    case 'outline':
      return <OutlineEditor />

    default:
      return (
        <div className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>
          <p>选择左侧分类开始编辑</p>
        </div>
      )
  }
}
