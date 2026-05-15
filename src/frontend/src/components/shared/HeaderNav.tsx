import { useUIStore } from '@/store'
import { Icon } from '@/components/ui/Icon'
import { MessageCircle, Settings, BookOpen } from 'lucide-react'
import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

/* ============================================================
   NAV TABS
   ============================================================ */

interface NavTab {
  id: 'chat' | 'settings' | 'writing'
  label: string
  icon: typeof MessageCircle
}

const navTabs: NavTab[] = [
  { id: 'chat',     label: '聊天', icon: MessageCircle },
  { id: 'settings', label: '设定', icon: Settings },
  { id: 'writing',  label: '写作', icon: BookOpen },
]

export function NavTabs() {
  const { currentInterface, setCurrentInterface } = useUIStore()

  return (
    <nav className="flex items-center gap-1" role="tablist" aria-label="页面导航">
      {navTabs.map((tab) => {
        const isActive = currentInterface === tab.id
        return (
          <motion.button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => setCurrentInterface(tab.id)}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors duration-150
              ${isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-surface-hover)]'}
            `}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
          >
            <Icon icon={tab.icon} size="xs" />
            <span>{tab.label}</span>
            {isActive && (
              <motion.div
                className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                style={{ backgroundColor: 'var(--accent-primary)' }}
                layoutId="nav-tab-indicator"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </motion.button>
        )
      })}
    </nav>
  )
}
