import { useState } from 'react'
import { useSettingsStore } from '@/store/settingsStore'
import { TagList } from './TagList'
import { TagInputField } from './TagInputField'


interface TagInputProps {
  entityType: 'character' | 'item' | 'location' | 'faction' | 'world' | 'rule' | 'ifline'
  entityId: number
  tags: string[]
}

export { TagList as TagChips } from './TagList'

export function TagInput({ entityType, entityId, tags }: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const addTagToEntity = useSettingsStore((state) => state.addTagToEntity)
  const removeTagFromEntity = useSettingsStore((state) => state.removeTagFromEntity)
  const allTags = useSettingsStore((state) => state.tags)

  const existingTagNames = allTags.map((t) => t.name)
  const suggestions = inputValue.trim()
    ? existingTagNames.filter(
        (name) =>
          name.toLowerCase().includes(inputValue.toLowerCase()) &&
          !tags.includes(name)
      )
    : existingTagNames.filter((name) => !tags.includes(name)).slice(0, 6)

  const handleAdd = (tagName: string) => {
    addTagToEntity(entityType, entityId, tagName)
  }

  const handleRemove = (tag: string) => {
    removeTagFromEntity(entityType, entityId, tag)
  }

  return (
    <div className="relative">
      <TagList tags={tags} onRemove={handleRemove} entityType={entityType} />

      <TagInputField
        entityType={entityType}
        entityId={entityId}
        tags={tags}
        onAdd={handleAdd}
        onRemove={handleRemove}
        suggestions={suggestions}
        onInputChange={setInputValue}
      />
    </div>
  )
}
