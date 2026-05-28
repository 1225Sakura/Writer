import { useSettingsStore } from '@/store/settingsStore'
import type { UIState } from '@/store/uiStore'
import type { EntityType } from '@/shared/types'
import { Users, Plus, MapPin, Swords, Globe, BookOpen, GitBranch, CheckSquare, Square, Trash2, Tag, X } from 'lucide-react'
import { useState, useCallback, useMemo } from 'react'
import { entityColors } from './EntityCard'
import { motion, AnimatePresence } from 'framer-motion'
import { SectionHeader, EmptyState } from './EntityFieldGroup'
import { AddEntityForm } from './EntityForm'
import {
  CharacterCard,
  NewCharacterForm,
  EditableEntityCard,
  OutlineEditor,
  entityListVariants,
  entityItemVariants,
} from './EntityActions'
import { Icon } from '@/components/ui/Icon'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

interface EntityEditorProps {
  category: UIState['settingsCategory']
}

/** Map category to EntityType for batch operations */
function categoryToEntityType(category: UIState['settingsCategory']): EntityType | null {
  const map: Record<string, EntityType> = {
    character: 'character',
    item: 'item',
    location: 'location',
    faction: 'faction',
    world: 'world',
    rule: 'rule',
    ifline: 'ifline',
  }
  return map[category] ?? null
}

/** Get the entity array name for a category */
function categoryToArrayName(category: UIState['settingsCategory']): 'characters' | 'items' | 'locations' | 'factions' | 'worldSettings' | 'rules' | 'ifLines' | null {
  const map: Record<string, 'characters' | 'items' | 'locations' | 'factions' | 'worldSettings' | 'rules' | 'ifLines'> = {
    character: 'characters',
    item: 'items',
    location: 'locations',
    faction: 'factions',
    world: 'worldSettings',
    rule: 'rules',
    ifline: 'ifLines',
  }
  return map[category] ?? null
}

// ============================================
// BatchSelectionCheckbox
// ============================================

function BatchSelectionCheckbox({
  checked,
  onChange,
  accentColor,
}: {
  checked: boolean
  onChange: () => void
  accentColor: string
}) {
  return (
    <motion.button
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      className="flex-shrink-0 p-1 rounded transition-colors"
      style={{
        color: checked ? accentColor : 'var(--text-tertiary)',
      }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
    >
      <Icon icon={checked ? CheckSquare : Square} size="sm" color="inherit" />
    </motion.button>
  )
}

// ============================================
// BatchToolbar
// ============================================

function BatchToolbar({
  selectedCount,
  onBatchDelete,
  onBatchTagUpdate,
  onClearSelection,
  onSelectAll,
  totalCount,
  accentColor,
}: {
  selectedCount: number
  onBatchDelete: () => void
  onBatchTagUpdate: (tags: string[]) => void
  onClearSelection: () => void
  onSelectAll: () => void
  totalCount: number
  accentColor: string
}) {
  const [showTagInput, setShowTagInput] = useState(false)
  const [tagInputValue, setTagInputValue] = useState('')

  const handleTagSubmit = () => {
    const tags = tagInputValue
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
    if (tags.length > 0) {
      onBatchTagUpdate(tags)
      setTagInputValue('')
      setShowTagInput(false)
    }
  }

  return (
    <motion.div
      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg mb-3"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--accent-primary) 8%, var(--color-surface-raised))',
        border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)',
        boxShadow: 'var(--shadow-card)',
      }}
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <motion.button
          onClick={onSelectAll}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all"
          style={{
            backgroundColor: 'var(--color-surface-raised)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-default)',
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Icon icon={CheckSquare} size="xs" color="inherit" />
          {selectedCount === totalCount ? '取消全选' : '全选'}
        </motion.button>
        <span className="text-xs font-medium" style={{ color: accentColor }}>
          已选 {selectedCount} 项
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {showTagInput ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={tagInputValue}
              onChange={(e) => setTagInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTagSubmit()
                if (e.key === 'Escape') setShowTagInput(false)
              }}
              placeholder="标签名(逗号分隔)"
              className="px-2 py-1 rounded text-xs outline-none"
              style={{
                backgroundColor: 'var(--color-surface-raised)',
                border: '1px solid var(--border-focus)',
                color: 'var(--text-primary)',
                width: '160px',
              }}
              autoFocus
            />
            <motion.button
              onClick={handleTagSubmit}
              className="px-2 py-1 rounded text-xs font-medium"
              style={{
                backgroundColor: 'var(--accent-muted)',
                color: 'var(--accent-primary)',
              }}
              whileTap={{ scale: 0.95 }}
            >
              确定
            </motion.button>
            <motion.button
              onClick={() => setShowTagInput(false)}
              className="p-1 rounded text-[var(--text-tertiary)]"
              whileTap={{ scale: 0.95 }}
            >
              <Icon icon={X} size="xs" color="inherit" />
            </motion.button>
          </div>
        ) : (
          <>
            <motion.button
              onClick={() => setShowTagInput(true)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all"
              style={{
                backgroundColor: 'var(--color-surface-raised)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-surface-overlay)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-surface-raised)'
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Icon icon={Tag} size="xs" color="inherit" />
              批量标签更新
            </motion.button>
            <motion.button
              onClick={onBatchDelete}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-danger) 8%, transparent)',
                color: 'var(--color-danger)',
                border: '1px solid color-mix(in srgb, var(--color-danger) 15%, transparent)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--color-danger) 15%, transparent)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--color-danger) 8%, transparent)'
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Icon icon={Trash2} size="xs" color="inherit" />
              批量删除
            </motion.button>
          </>
        )}
        <motion.button
          onClick={onClearSelection}
          className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <Icon icon={X} size="xs" color="inherit" />
        </motion.button>
      </div>
    </motion.div>
  )
}

export function EntityEditor({ category }: EntityEditorProps) {
  const {
    characters,
    items,
    locations,
    factions,
    worldSettings,
    rules,
    ifLines,
    generate,
    generateRelations,
  } = useSettingsStore()

  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const entityType = categoryToEntityType(category)
  const entityArrayName = categoryToArrayName(category)
  const batchableCategories: Array<typeof category> = ['character', 'item', 'location', 'faction', 'world', 'rule', 'ifline']
  const isBatchable = batchableCategories.includes(category) && entityType !== null && entityArrayName !== null

  const toggleSelection = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const selectAll = useCallback(() => {
    if (!entityArrayName) return
    const state = useSettingsStore.getState()
    const arr = state[entityArrayName] as Array<{ id: number }>
    setSelectedIds((prev) => {
      if (prev.size === arr.length) {
        return new Set()
      }
      return new Set(arr.map((e) => e.id))
    })
  }, [entityArrayName])

  const handleBatchDelete = useCallback(async () => {
    if (!entityType || selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    await useSettingsStore.getState().batchDelete(entityType, ids)
    setSelectedIds(new Set())
  }, [entityType, selectedIds])

  const handleBatchTagUpdate = useCallback(async (tags: string[]) => {
    if (!entityType || selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    await useSettingsStore.getState().batchUpdateTags(entityType, ids, tags)
    setSelectedIds(new Set())
  }, [entityType, selectedIds])

  const accentColor = useMemo(() => {
    if (!category) return 'var(--accent-primary)'
    return entityColors[category]?.text || 'var(--accent-primary)'
  }, [category])

  const handleGenerate = (type: 'character' | 'item' | 'location' | 'faction' | 'world' | 'rule') => {
    generate(type)
  }

  /** Wraps an entity item with a batch selection checkbox */
  const withBatchCheckbox = (
    id: number,
    content: React.ReactNode,
  ) => {
    if (!isBatchable) return content
    return (
      <div className="flex items-start gap-2">
        <div className="pt-2 flex-shrink-0">
          <BatchSelectionCheckbox
            checked={selectedIds.has(id)}
            onChange={() => toggleSelection(id)}
            accentColor={accentColor}
          />
        </div>
        <div className="flex-1 min-w-0">{content}</div>
      </div>
    )
  }

  switch (category) {
    case 'character':
      return (
        <div>
          <SectionHeader
            title="角色管理"
            count={characters.length}
            onAdd={() => setShowAddForm(true)}
            onGenerate={() => handleGenerate('character')}
          />
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <BatchToolbar
                selectedCount={selectedIds.size}
                totalCount={characters.length}
                onBatchDelete={handleBatchDelete}
                onBatchTagUpdate={handleBatchTagUpdate}
                onClearSelection={clearSelection}
                onSelectAll={selectAll}
                accentColor={accentColor}
              />
            )}
          </AnimatePresence>
          <motion.div
            className="space-y-3"
            variants={entityListVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <AnimatePresence mode="popLayout">
              {characters.map((char) => (
                <motion.div key={char.id} layout variants={entityItemVariants}>
                  {withBatchCheckbox(char.id, <CharacterCard character={char} />)}
                </motion.div>
              ))}
            </AnimatePresence>
            {characters.length === 0 && (
              <EmptyState icon={Users} title="暂无角色" subtitle="点击下方按钮创建第一个角色" color="var(--color-character)" />
            )}
            <motion.div variants={entityItemVariants}>
              <NewCharacterForm />
            </motion.div>
          </motion.div>
        </div>
      )

    case 'item':
      return (
        <div>
          <SectionHeader title="物品管理" count={items.length} onAdd={() => setShowAddForm(true)} onGenerate={() => handleGenerate('item')} />
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <BatchToolbar
                selectedCount={selectedIds.size}
                totalCount={items.length}
                onBatchDelete={handleBatchDelete}
                onBatchTagUpdate={handleBatchTagUpdate}
                onClearSelection={clearSelection}
                onSelectAll={selectAll}
                accentColor={accentColor}
              />
            )}
          </AnimatePresence>
          <motion.div className="space-y-3" variants={entityListVariants} initial="hidden" animate="visible" exit="exit">
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <motion.div key={item.id} layout variants={entityItemVariants}>
                  {withBatchCheckbox(item.id,
                    <EditableEntityCard
                      entity={item} entityType="item"
                      badge={item.owner ? `持有者: ${item.owner}` : undefined}
                      badgeColor={entityColors.item} tags={item.tags}
                      onDelete={() => useSettingsStore.getState().deleteItem(item.id)}
                      onUpdate={(id, data) => useSettingsStore.getState().updateItem(id, data)}
                      editFields={[
                        { key: 'name', label: '名称', required: true, maxLength: 50 },
                        { key: 'description', label: '描述', type: 'textarea', maxLength: 500 },
                        { key: 'owner', label: '持有者', maxLength: 50 },
                      ]}
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {items.length === 0 && <EmptyState icon={Plus} title="暂无物品" subtitle="点击下方按钮创建第一个物品" color="var(--color-item)" />}
            {showAddForm && (
              <motion.div variants={entityItemVariants}>
                <AddEntityForm placeholder="输入物品名称..." onAdd={(name) => { useSettingsStore.getState().addItem({ name }); setShowAddForm(false) }} onCancel={() => setShowAddForm(false)} />
              </motion.div>
            )}
          </motion.div>
        </div>
      )

    case 'location':
      return (
        <div>
          <SectionHeader title="地点管理" count={locations.length} onAdd={() => setShowAddForm(true)} onGenerate={() => handleGenerate('location')} />
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <BatchToolbar
                selectedCount={selectedIds.size}
                totalCount={locations.length}
                onBatchDelete={handleBatchDelete}
                onBatchTagUpdate={handleBatchTagUpdate}
                onClearSelection={clearSelection}
                onSelectAll={selectAll}
                accentColor={accentColor}
              />
            )}
          </AnimatePresence>
          <motion.div className="space-y-3" variants={entityListVariants} initial="hidden" animate="visible" exit="exit">
            <AnimatePresence mode="popLayout">
              {locations.map((loc) => (
                <motion.div key={loc.id} layout variants={entityItemVariants}>
                  {withBatchCheckbox(loc.id,
                    <EditableEntityCard
                      entity={loc} entityType="location"
                      badge={loc.importance === 'major' ? '重要地点' : '次要地点'}
                      badgeColor={entityColors.location} tags={loc.tags}
                      onDelete={() => useSettingsStore.getState().deleteLocation(loc.id)}
                      onUpdate={(id, data) => useSettingsStore.getState().updateLocation(id, data)}
                      editFields={[
                        { key: 'name', label: '名称', required: true, maxLength: 50 },
                        { key: 'description', label: '描述', type: 'textarea', maxLength: 500 },
                      ]}
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {locations.length === 0 && <EmptyState icon={MapPin} title="暂无地点" subtitle="点击下方按钮创建第一个地点" color="var(--color-location)" />}
            {showAddForm && (
              <motion.div variants={entityItemVariants}>
                <AddEntityForm placeholder="输入地点名称..." onAdd={(name) => { useSettingsStore.getState().addLocation({ name, importance: 'minor' }); setShowAddForm(false) }} onCancel={() => setShowAddForm(false)} />
              </motion.div>
            )}
          </motion.div>
        </div>
      )

    case 'faction':
      return (
        <div>
          <SectionHeader title="势力管理" count={factions.length} onAdd={() => setShowAddForm(true)} onGenerate={() => handleGenerate('faction')} />
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <BatchToolbar
                selectedCount={selectedIds.size}
                totalCount={factions.length}
                onBatchDelete={handleBatchDelete}
                onBatchTagUpdate={handleBatchTagUpdate}
                onClearSelection={clearSelection}
                onSelectAll={selectAll}
                accentColor={accentColor}
              />
            )}
          </AnimatePresence>
          <motion.div className="space-y-3" variants={entityListVariants} initial="hidden" animate="visible" exit="exit">
            <AnimatePresence mode="popLayout">
              {factions.map((fac) => (
                <motion.div key={fac.id} layout variants={entityItemVariants}>
                  {withBatchCheckbox(fac.id,
                    <EditableEntityCard
                      entity={fac} entityType="faction"
                      badge={fac.type} badgeColor={entityColors.faction} tags={fac.tags}
                      onDelete={() => useSettingsStore.getState().deleteFaction(fac.id)}
                      onUpdate={(id, data) => useSettingsStore.getState().updateFaction(id, data)}
                      editFields={[
                        { key: 'name', label: '名称', required: true, maxLength: 50 },
                        { key: 'description', label: '描述', type: 'textarea', maxLength: 500 },
                        { key: 'type', label: '类型', maxLength: 30 },
                      ]}
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {factions.length === 0 && <EmptyState icon={Swords} title="暂无势力" subtitle="点击下方按钮创建第一个势力" color="var(--color-faction)" />}
            {showAddForm && (
              <motion.div variants={entityItemVariants}>
                <AddEntityForm placeholder="输入势力名称..." onAdd={(name) => { useSettingsStore.getState().addFaction({ name, type: 'other' }); setShowAddForm(false) }} onCancel={() => setShowAddForm(false)} />
              </motion.div>
            )}
          </motion.div>
        </div>
      )

    case 'world':
      return (
        <div>
          <SectionHeader title="世界观设定" count={worldSettings.length} onAdd={() => setShowAddForm(true)} onGenerate={() => handleGenerate('world')} />
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <BatchToolbar
                selectedCount={selectedIds.size}
                totalCount={worldSettings.length}
                onBatchDelete={handleBatchDelete}
                onBatchTagUpdate={handleBatchTagUpdate}
                onClearSelection={clearSelection}
                onSelectAll={selectAll}
                accentColor={accentColor}
              />
            )}
          </AnimatePresence>
          <motion.div className="space-y-3" variants={entityListVariants} initial="hidden" animate="visible" exit="exit">
            <AnimatePresence mode="popLayout">
              {worldSettings.map((world) => (
                <motion.div key={world.id} layout variants={entityItemVariants}>
                  {withBatchCheckbox(world.id,
                    <EditableEntityCard
                      entity={world} entityType="world"
                      badgeColor={entityColors.world} tags={world.tags}
                      onDelete={() => useSettingsStore.getState().deleteWorldSetting(world.id)}
                      onUpdate={(id, data) => useSettingsStore.getState().updateWorldSetting(id, data)}
                      editFields={[
                        { key: 'name', label: '名称', required: true, maxLength: 50 },
                        { key: 'description', label: '描述', type: 'textarea', maxLength: 500 },
                      ]}
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {worldSettings.length === 0 && <EmptyState icon={Globe} title="暂无世界观设定" subtitle="点击下方按钮创建第一个设定" color="var(--color-world)" />}
            {showAddForm && (
              <motion.div variants={entityItemVariants}>
                <AddEntityForm placeholder="输入世界观设定名称..." onAdd={(name) => { useSettingsStore.getState().addWorldSetting({ name, description: '' }); setShowAddForm(false) }} onCancel={() => setShowAddForm(false)} />
              </motion.div>
            )}
          </motion.div>
        </div>
      )

    case 'rule':
      return (
        <div>
          <SectionHeader title="规则设定" count={rules.length} onAdd={() => setShowAddForm(true)} onGenerate={() => handleGenerate('rule')} />
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <BatchToolbar
                selectedCount={selectedIds.size}
                totalCount={rules.length}
                onBatchDelete={handleBatchDelete}
                onBatchTagUpdate={handleBatchTagUpdate}
                onClearSelection={clearSelection}
                onSelectAll={selectAll}
                accentColor={accentColor}
              />
            )}
          </AnimatePresence>
          <motion.div className="space-y-3" variants={entityListVariants} initial="hidden" animate="visible" exit="exit">
            <AnimatePresence mode="popLayout">
              {rules.map((rule) => (
                <motion.div key={rule.id} layout variants={entityItemVariants}>
                  {withBatchCheckbox(rule.id,
                    <EditableEntityCard
                      entity={rule} entityType="rule"
                      badge={rule.type} badgeColor={entityColors.rule} tags={rule.tags}
                      onDelete={() => useSettingsStore.getState().deleteRule(rule.id)}
                      onUpdate={(id, data) => useSettingsStore.getState().updateRule(id, data)}
                      editFields={[
                        { key: 'name', label: '名称', required: true, maxLength: 50 },
                        { key: 'description', label: '描述', type: 'textarea', maxLength: 500 },
                        { key: 'type', label: '类型', maxLength: 30 },
                      ]}
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {rules.length === 0 && <EmptyState icon={BookOpen} title="暂无规则设定" subtitle="点击下方按钮创建第一个规则" color="var(--color-rule)" />}
            {showAddForm && (
              <motion.div variants={entityItemVariants}>
                <AddEntityForm placeholder="输入规则名称..." onAdd={(name) => { useSettingsStore.getState().addRule({ name, description: '', type: 'other' }); setShowAddForm(false) }} onCancel={() => setShowAddForm(false)} />
              </motion.div>
            )}
          </motion.div>
        </div>
      )

    case 'outline':
      return <OutlineEditor />

    case 'ifline':
      return (
        <div>
          <SectionHeader title="IF线管理" count={ifLines.length} onAdd={() => setShowAddForm(true)} onGenerate={generateRelations} />
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <BatchToolbar
                selectedCount={selectedIds.size}
                totalCount={ifLines.length}
                onBatchDelete={handleBatchDelete}
                onBatchTagUpdate={handleBatchTagUpdate}
                onClearSelection={clearSelection}
                onSelectAll={selectAll}
                accentColor={accentColor}
              />
            )}
          </AnimatePresence>
          <motion.div className="space-y-3" variants={entityListVariants} initial="hidden" animate="visible" exit="exit">
            <AnimatePresence mode="popLayout">
              {ifLines.map((ifline) => (
                <motion.div key={ifline.id} layout variants={entityItemVariants}>
                  {withBatchCheckbox(ifline.id,
                    <EditableEntityCard
                      entity={ifline} entityType="ifline"
                      badge={ifline.sync_mode === 'auto' ? '自动同步' : '手动同步'}
                      badgeColor={entityColors.ifline} tags={ifline.tags}
                      onDelete={() => useSettingsStore.getState().deleteIFLine(ifline.id)}
                      onUpdate={(id, data) => useSettingsStore.getState().updateIFLine(id, data)}
                      editFields={[
                        { key: 'title', label: '标题', required: true, maxLength: 50 },
                        { key: 'description', label: '描述', type: 'textarea', maxLength: 500 },
                      ]}
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {ifLines.length === 0 && <EmptyState icon={GitBranch} title="暂无IF线" subtitle="点击下方按钮创建第一条IF线" color="var(--color-ifline)" />}
            {showAddForm && (
              <motion.div variants={entityItemVariants}>
                <AddEntityForm
                  placeholder="输入IF线标题..."
                  onAdd={(title) => {
                    useSettingsStore.getState().addIFLine({ title, sync_mode: 'manual', created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                    setShowAddForm(false)
                  }}
                  onCancel={() => setShowAddForm(false)}
                />
              </motion.div>
            )}
          </motion.div>
        </div>
      )

    default:
      return (
        <div className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>
          <p>选择左侧分类开始编辑</p>
        </div>
      )
  }
}
