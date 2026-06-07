// ============================================
// Entity Schema Type System (US-001)
// ============================================

/** Field type for entity schema rendering */
export enum FieldType {
  text = 'text',
  textarea = 'textarea',
  select = 'select',
  array = 'array',
  number = 'number',
  date = 'date',
  markdown = 'markdown',
  entity_ref = 'entity_ref',
}

/** Field definition for a single entity property */
export interface FieldDef {
  key: string
  label: string
  type: FieldType
  required?: boolean
  maxLength?: number
  options?: Array<{ value: string; label: string }>
  entityType?: string
  placeholder?: string
}

/** Entity schema drives generic rendering and editing of any entity type */
export interface EntitySchema {
  entityType: string
  fields: FieldDef[]
  layout: 'card' | 'detail' | 'compact'
  customActions?: Array<{ id: string; label: string; icon?: string; handler: string }>
}

// ============================================
// Simple Entity Schemas
// ============================================

export const itemSchema: EntitySchema = {
  entityType: 'item',
  layout: 'card',
  fields: [
    { key: 'name', label: '名称', type: FieldType.text, required: true, placeholder: '物品名称' },
    { key: 'description', label: '描述', type: FieldType.textarea, placeholder: '物品描述' },
    { key: 'owner', label: '持有者', type: FieldType.text, placeholder: '当前持有者' },
    { key: 'location', label: '所在位置', type: FieldType.text, placeholder: '当前位置' },
  ],
}

export const locationSchema: EntitySchema = {
  entityType: 'location',
  layout: 'card',
  fields: [
    { key: 'name', label: '名称', type: FieldType.text, required: true, placeholder: '地点名称' },
    { key: 'description', label: '描述', type: FieldType.textarea, placeholder: '地点描述' },
    {
      key: 'importance',
      label: '重要性',
      type: FieldType.select,
      options: [
        { value: 'major', label: '重要' },
        { value: 'minor', label: '次要' },
      ],
    },
  ],
}

export const factionSchema: EntitySchema = {
  entityType: 'faction',
  layout: 'card',
  fields: [
    { key: 'name', label: '名称', type: FieldType.text, required: true, placeholder: '势力名称' },
    { key: 'description', label: '描述', type: FieldType.textarea, placeholder: '势力描述' },
    { key: 'type', label: '类型', type: FieldType.text, placeholder: '势力类型' },
  ],
}

export const worldSchema: EntitySchema = {
  entityType: 'world',
  layout: 'card',
  fields: [
    { key: 'name', label: '名称', type: FieldType.text, required: true, placeholder: '设定名称' },
    { key: 'description', label: '描述', type: FieldType.textarea, placeholder: '世界观设定' },
  ],
}

export const ruleSchema: EntitySchema = {
  entityType: 'rule',
  layout: 'card',
  fields: [
    { key: 'name', label: '名称', type: FieldType.text, required: true, placeholder: '规则名称' },
    { key: 'description', label: '描述', type: FieldType.textarea, placeholder: '规则描述' },
    { key: 'type', label: '类型', type: FieldType.text, placeholder: '规则类型' },
  ],
}

export const iflineSchema: EntitySchema = {
  entityType: 'ifline',
  layout: 'card',
  fields: [
    { key: 'title', label: '标题', type: FieldType.text, required: true, placeholder: 'IF线标题' },
    { key: 'description', label: '描述', type: FieldType.textarea, placeholder: 'IF线描述' },
    {
      key: 'sync_mode',
      label: '同步模式',
      type: FieldType.select,
      options: [
        { value: 'auto', label: '自动' },
        { value: 'manual', label: '手动' },
        { value: 'paused', label: '暂停' },
      ],
    },
  ],
}

// ============================================
// Character Schema (Phase 1b)
// ============================================

export const characterSchema: EntitySchema = {
  entityType: 'character',
  layout: 'card',
  fields: [
    { key: 'name', label: '姓名', type: FieldType.text, required: true, placeholder: '角色姓名' },
    {
      key: 'gender',
      label: '性别',
      type: FieldType.select,
      options: [
        { value: '男', label: '男' },
        { value: '女', label: '女' },
        { value: '其他', label: '其他' },
      ],
    },
    { key: 'personality', label: '性格', type: FieldType.textarea, placeholder: '性格特征' },
    { key: 'desires', label: '欲望', type: FieldType.textarea, placeholder: '角色欲望与追求' },
    { key: 'flaws', label: '缺陷', type: FieldType.textarea, placeholder: '角色缺陷' },
    { key: 'description', label: '描述', type: FieldType.textarea, placeholder: '角色描述' },
    {
      key: 'tier',
      label: '级别',
      type: FieldType.select,
      options: [
        { value: '主角', label: '主角' },
        { value: '配角', label: '配角' },
        { value: '龙套', label: '龙套' },
      ],
    },
    { key: 'cultivationRealm', label: '修炼境界', type: FieldType.text, placeholder: '修炼境界' },
  ],
}

// ============================================
// Outline Schema (reference only, not in schema system)
// ============================================

export const outlineSchema: EntitySchema = {
  entityType: 'outline',
  layout: 'card',
  fields: [
    { key: 'title', label: '标题', type: FieldType.text, required: true, placeholder: '大纲标题' },
    { key: 'description', label: '描述', type: FieldType.textarea, placeholder: '大纲内容' },
  ],
}

// ============================================
// Schema Registry
// ============================================

/** All schemas indexed by entity type */
export const schemaRegistry: Record<string, EntitySchema> = {
  item: itemSchema,
  location: locationSchema,
  faction: factionSchema,
  world: worldSchema,
  rule: ruleSchema,
  ifline: iflineSchema,
  character: characterSchema,
  outline: outlineSchema,
}

/** Look up a schema by entity type, returns undefined if not found */
export function getSchema(entityType: string): EntitySchema | undefined {
  return schemaRegistry[entityType]
}
