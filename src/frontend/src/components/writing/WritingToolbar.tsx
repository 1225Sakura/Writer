import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { SPRING } from '@/components/shared/AnimationConfig'
import {
  ToolbarButtons,
  RatioSliderSection,
  QuickAIOperations,
  ToolbarRightSection,
} from './toolbar'

export function WritingToolbar() {
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)

  return (
    <motion.div
      layout
      transition={SPRING.SNAPPY}
      className={`flex items-center px-3 sm:px-4 gap-1.5 sm:gap-2 layout-topbar overflow-x-auto writing-toolbar ${toolbarCollapsed ? 'h-0 opacity-0 overflow-hidden' : 'h-[var(--layout-topbar-height)]'}`}
      style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--border-default)' }}
    >
      <ToolbarButtons />

      <div className="hidden lg:flex items-center gap-2 ml-2 flex-shrink-0">
        <div className="w-px h-5 flex-shrink-0 mx-0.5" style={{ background: 'linear-gradient(to bottom, transparent, var(--border-default) 20%, var(--border-default) 80%, transparent)' }} />
        <RatioSliderSection />
      </div>

      <QuickAIOperations />

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setToolbarCollapsed(!toolbarCollapsed)}
        className="hidden md:flex items-center justify-center w-6 h-6 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors flex-shrink-0"
        title={toolbarCollapsed ? '展开工具栏' : '收起工具栏'}
      >
        <ChevronDown className={`w-4 h-4 transition-transform duration-250 ${toolbarCollapsed ? 'rotate-180' : ''}`} />
      </motion.button>

      <ToolbarRightSection />
    </motion.div>
  )
}
