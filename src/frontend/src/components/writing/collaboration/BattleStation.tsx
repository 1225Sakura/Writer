import { Target } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { CollapsibleSection } from './CollapsibleSection'
import { useWritingStore } from '@/store/writingStore'
import { chapterApi } from '@/api/writing'
import { showError } from '@/utils/toastHelper'

interface BattleInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  id?: string
}

function BattleInput({ label, value, onChange, placeholder, id }: BattleInputProps) {
  const inputId = id || `battle-${label.toLowerCase()}`
  return (
    <div>
      <label htmlFor={inputId} className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{label}</label>
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-1 px-2.5 py-1.5 text-sm rounded-lg border border-[var(--border-default)] bg-[var(--color-surface-base)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/50 focus:border-[var(--accent-primary)]/50 transition-all"
        aria-label={`${label}输入字段`}
      />
    </div>
  )
}

interface BattleStationData {
  goal: string
  obstacle: string
  cost: string
  hook: string
}

export function BattleStation() {
  const [isExpanded, setIsExpanded] = useState(true)
  const [goal, setGoal] = useState('')
  const [obstacle, setObstacle] = useState('')
  const [cost, setCost] = useState('')
  const [hook, setHook] = useState('')

  const currentChapterId = useWritingStore((s) => s.currentChapterId)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipSaveRef = useRef(true)

  // Load battle station data when chapter changes
  useEffect(() => {
    if (!currentChapterId) {
      setGoal('')
      setObstacle('')
      setCost('')
      setHook('')
      skipSaveRef.current = true
      return
    }

    skipSaveRef.current = true
    chapterApi.getById(currentChapterId).then((chapter) => {
      if (chapter.battle_station_data) {
        try {
          const data: BattleStationData = JSON.parse(chapter.battle_station_data)
          setGoal(data.goal || '')
          setObstacle(data.obstacle || '')
          setCost(data.cost || '')
          setHook(data.hook || '')
        } catch {
          // Malformed JSON, keep defaults
        }
      } else {
        setGoal('')
        setObstacle('')
        setCost('')
        setHook('')
      }
      // Allow saves after a tick so the setState calls above don't trigger a save
      setTimeout(() => { skipSaveRef.current = false }, 0)
    }).catch(() => {
      skipSaveRef.current = false
      showError('章节加载失败')
    })
  }, [currentChapterId])

  // Debounced save when any field changes
  const saveBattleStation = useCallback((data: BattleStationData) => {
    if (!currentChapterId) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        await chapterApi.update(currentChapterId, {
          battle_station_data: JSON.stringify(data),
        })
      } catch {
        showError('保存失败')
      }
    }, 800)
  }, [currentChapterId])

  // Trigger save when fields change (but not during initial load)
  useEffect(() => {
    if (skipSaveRef.current) return
    saveBattleStation({ goal, obstacle, cost, hook })
  }, [goal, obstacle, cost, hook, saveBattleStation])

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <CollapsibleSection
      title="本章作战台"
      icon={<Target className="w-4 h-4 text-[var(--icon-secondary)]" />}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
    >
      <div className="space-y-3">
        <BattleInput label="目标" value={goal} onChange={setGoal} placeholder="本章主角要达成什么？" />
        <BattleInput label="阻力" value={obstacle} onChange={setObstacle} placeholder="遇到什么阻碍？" />
        <BattleInput label="代价" value={cost} onChange={setCost} placeholder="失败会有什么代价？" />
        <BattleInput label="钩子" value={hook} onChange={setHook} placeholder="如何吸引读者继续看？" />
      </div>
    </CollapsibleSection>
  )
}
