import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { relationshipApi, storylineApi } from '../api/settings'
import type { CharacterLocal, Relationship, CharacterStorylineLocal } from './entityStore'

// Re-export types
export type { Relationship, CharacterStorylineLocal }

// ============================================
// Types
// ============================================

interface RelationState {
  isLoading: boolean
  error: string | null
}

interface RelationActions {
  addRelationship: (characterId: number, relationship: Omit<Relationship, 'id'>) => Promise<Relationship>
  removeRelationship: (characterId: number, relationshipId: number) => Promise<void>
  loadRelationships: (characterId: number) => Promise<Relationship[]>
  updateStorylineProgress: (characterId: number, storylineId: number, progress: number) => Promise<void>
  loadCharacterRelations: (character: CharacterLocal) => Promise<CharacterLocal>
}

// ============================================
// Store
// ============================================

export const useRelationStore = create<RelationState & RelationActions>()(
  immer(
    subscribeWithSelector(
      (set) => ({
        isLoading: false,
        error: null,

        addRelationship: async (characterId, relationship) => {
          try {
            const apiRel = await relationshipApi.create(characterId, {
              target_id: relationship.targetId,
              type: relationship.type,
              description: relationship.description,
            })
            const newRel: Relationship = {
              id: apiRel.id,
              targetId: apiRel.target_id,
              type: apiRel.type as Relationship['type'],
              description: apiRel.description,
            }
            set((state) => { state.error = null })
            return newRel
          } catch (error) {
            set((state) => { state.error = (error as Error).message })
            throw error
          }
        },

        removeRelationship: async (characterId, relationshipId) => {
          try {
            await relationshipApi.delete(characterId, relationshipId)
            set((state) => { state.error = null })
          } catch (error) {
            set((state) => { state.error = (error as Error).message })
            throw error
          }
        },

        loadRelationships: async (characterId) => {
          set((state) => { state.isLoading = true })
          try {
            const relationships = await relationshipApi.getByCharacter(characterId)
            set((state) => { state.isLoading = false })
            return relationships.map((r) => ({
              id: r.id,
              targetId: r.target_id,
              type: r.type as Relationship['type'],
              description: r.description,
            }))
          } catch (error) {
            set((state) => {
              state.error = (error as Error).message
              state.isLoading = false
            })
            return []
          }
        },

        updateStorylineProgress: async (characterId, storylineId, progress) => {
          try {
            await storylineApi.update(characterId, storylineId, { progress })
            set((state) => { state.error = null })
          } catch (error) {
            set((state) => { state.error = (error as Error).message })
            throw error
          }
        },

        loadCharacterRelations: async (character) => {
          set((state) => { state.isLoading = true })
          try {
            const [relationships, storylines] = await Promise.all([
              relationshipApi.getByCharacter(character.id),
              storylineApi.getByCharacter(character.id),
            ])
            set((state) => { state.isLoading = false })
            return {
              ...character,
              relationships: relationships.map((r) => ({
                id: r.id,
                targetId: r.target_id,
                type: r.type as Relationship['type'],
                description: r.description,
              })),
              storylines: storylines.map((s) => ({
                id: s.id,
                title: s.title,
                arc: s.arc || '',
                progress: s.progress,
              })),
            }
          } catch (error) {
            set((state) => {
              state.error = (error as Error).message
              state.isLoading = false
            })
            return character
          }
        },
      })
    )
  )
)

// ============================================
// Selectors
// ============================================

export const selectRelationCount = (state: RelationState) =>
  state.isLoading ? 0 : 0 // Relations are stored in character objects