import { useSettingsStore } from '@/store'
import { motion } from 'framer-motion'

export function CollaboratorAvatars() {
  const { characters } = useSettingsStore()
  const visibleChars = characters.slice(0, 4)

  if (visibleChars.length === 0) return null

  const statusColors = ['var(--color-ifline)', 'var(--color-character)', 'var(--color-location)', 'var(--color-item)']
  const statusTypes = ['online', 'online', 'away', 'online'] as const

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {visibleChars.map((char, i) => (
          <motion.div
            key={char.id}
            initial={{ opacity: 0, scale: 0.8, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="collaborator-avatar relative w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2"
            style={{
              backgroundColor: statusColors[i % statusColors.length],
              borderColor: 'var(--color-surface-raised)',
              color: 'var(--ink-100)',
              zIndex: visibleChars.length - i,
            }}
            title={char.name}
          >
            {char.name.charAt(0)}
            <span
              className={`collaborator-avatar__status collaborator-avatar__status--${statusTypes[i % statusTypes.length]}`}
              style={{
                background: statusColors[i % statusColors.length],
                boxShadow: `0 0 4px color-mix(in srgb, ${statusColors[i % statusColors.length]} 60%, transparent)`,
              }}
            />
          </motion.div>
        ))}
      </div>
      {characters.length > 4 && (
        <span className="ml-2 text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
          +{characters.length - 4}
        </span>
      )}
    </div>
  )
}