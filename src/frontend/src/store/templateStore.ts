// ============================================
// Template Store — Entity template CRUD with localStorage persistence
// ============================================

import { create } from 'zustand'
import type { EntityTemplate, EntityType } from '../shared/types'

// ============================================
// Storage helpers
// ============================================

const STORAGE_KEY = 'writer-entity-templates'

function loadTemplates(): EntityTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as EntityTemplate[]
  } catch { /* ignore corrupt data */ }
  return []
}

function saveTemplates(templates: EntityTemplate[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  } catch { /* quota exceeded, silently fail */ }
}

// ============================================
// Built-in presets
// ============================================

export const builtinTemplates: EntityTemplate[] = [
  {
    id: 'builtin-protagonist',
    name: '主角模板',
    type: 'character',
    fields: { tier: true, personality: true, desires: true, flaws: true, gender: true },
    defaultValues: { tier: '主角', personality: '坚韧不拔', desires: '追求真相', flaws: '过于执着' },
    isBuiltin: true,
  },
  {
    id: 'builtin-antagonist',
    name: '反派模板',
    type: 'character',
    fields: { tier: true, personality: true, desires: true, flaws: true, gender: true },
    defaultValues: { tier: '配角', personality: '阴险狡诈', desires: '统治世界', flaws: '自大狂妄' },
    isBuiltin: true,
  },
  {
    id: 'builtin-supporting',
    name: '配角模板',
    type: 'character',
    fields: { tier: true, personality: true, desires: true, flaws: true },
    defaultValues: { tier: '配角', personality: '忠诚可靠', desires: '守护同伴', flaws: '优柔寡断' },
    isBuiltin: true,
  },
  {
    id: 'builtin-faction',
    name: '势力模板',
    type: 'faction',
    fields: { type: true, description: true },
    defaultValues: { type: 'organization' },
    isBuiltin: true,
  },
  {
    id: 'builtin-location',
    name: '地点模板',
    type: 'location',
    fields: { importance: true, description: true },
    defaultValues: { importance: 'major' },
    isBuiltin: true,
  },
  {
    id: 'builtin-item',
    name: '物品模板',
    type: 'item',
    fields: { description: true, owner: true, location: true },
    defaultValues: {},
    isBuiltin: true,
  },
]

// ============================================
// Store interface
// ============================================

interface TemplateState {
  templates: EntityTemplate[]
  loadTemplates: () => void
  addTemplate: (template: Omit<EntityTemplate, 'id' | 'isBuiltin'>) => EntityTemplate
  updateTemplate: (id: string, updates: Partial<Pick<EntityTemplate, 'name' | 'fields' | 'defaultValues'>>) => void
  deleteTemplate: (id: string) => void
  duplicateTemplate: (id: string) => EntityTemplate | null
  getTemplatesByType: (type: EntityType) => EntityTemplate[]
}

// ============================================
// Store
// ============================================

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: [],

  loadTemplates: () => {
    const custom = loadTemplates()
    // Merge: builtins always present, custom appended (dedup by id)
    const builtinIds = new Set(builtinTemplates.map((t) => t.id))
    const merged = [
      ...builtinTemplates,
      ...custom.filter((t) => !builtinIds.has(t.id)),
    ]
    set({ templates: merged })
  },

  addTemplate: (template) => {
    const newTemplate: EntityTemplate = {
      ...template,
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      isBuiltin: false,
    }
    set((state) => {
      const next = [...state.templates, newTemplate]
      saveTemplates(next.filter((t) => !t.isBuiltin))
      return { templates: next }
    })
    return newTemplate
  },

  updateTemplate: (id, updates) => {
    set((state) => {
      const next = state.templates.map((t) =>
        t.id === id ? { ...t, ...updates } : t,
      )
      saveTemplates(next.filter((t) => !t.isBuiltin))
      return { templates: next }
    })
  },

  deleteTemplate: (id) => {
    const tpl = get().templates.find((t) => t.id === id)
    if (!tpl || tpl.isBuiltin) return
    set((state) => {
      const next = state.templates.filter((t) => t.id !== id)
      saveTemplates(next.filter((t) => !t.isBuiltin))
      return { templates: next }
    })
  },

  duplicateTemplate: (id) => {
    const tpl = get().templates.find((t) => t.id === id)
    if (!tpl) return null
    return get().addTemplate({
      name: `${tpl.name} (副本)`,
      type: tpl.type,
      fields: { ...tpl.fields },
      defaultValues: { ...tpl.defaultValues },
    })
  },

  getTemplatesByType: (type) => {
    return get().templates.filter((t) => t.type === type)
  },
}))
