import { useSettingsStore } from '@/store/settingsStore'
import type { UIState } from '@/store/uiStore'
import { Users, Plus, MapPin, Swords, Globe, BookOpen, GitBranch } from 'lucide-react'
import { useState } from 'react'
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

interface EntityEditorProps {
  category: UIState['settingsCategory']
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

  const handleGenerate = (type: 'character' | 'item' | 'location' | 'faction' | 'world' | 'rule') => {
    generate(type)
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
                  <CharacterCard character={char} />
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
          <motion.div className="space-y-3" variants={entityListVariants} initial="hidden" animate="visible" exit="exit">
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <motion.div key={item.id} layout variants={entityItemVariants}>
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
          <motion.div className="space-y-3" variants={entityListVariants} initial="hidden" animate="visible" exit="exit">
            <AnimatePresence mode="popLayout">
              {locations.map((loc) => (
                <motion.div key={loc.id} layout variants={entityItemVariants}>
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
          <motion.div className="space-y-3" variants={entityListVariants} initial="hidden" animate="visible" exit="exit">
            <AnimatePresence mode="popLayout">
              {factions.map((fac) => (
                <motion.div key={fac.id} layout variants={entityItemVariants}>
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
          <motion.div className="space-y-3" variants={entityListVariants} initial="hidden" animate="visible" exit="exit">
            <AnimatePresence mode="popLayout">
              {worldSettings.map((world) => (
                <motion.div key={world.id} layout variants={entityItemVariants}>
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
          <motion.div className="space-y-3" variants={entityListVariants} initial="hidden" animate="visible" exit="exit">
            <AnimatePresence mode="popLayout">
              {rules.map((rule) => (
                <motion.div key={rule.id} layout variants={entityItemVariants}>
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
          <motion.div className="space-y-3" variants={entityListVariants} initial="hidden" animate="visible" exit="exit">
            <AnimatePresence mode="popLayout">
              {ifLines.map((ifline) => (
                <motion.div key={ifline.id} layout variants={entityItemVariants}>
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
