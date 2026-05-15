import { LeftSidebar } from '@/components/shared/LeftSidebar'
import { CategoryNav } from './CategoryNav'

interface SettingsNavProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
  mobileNavOpen: boolean
  onMobileNavClose: () => void
}

export function SettingsNav({
  sidebarOpen,
  onToggleSidebar,
  mobileNavOpen,
  onMobileNavClose,
}: SettingsNavProps) {
  return (
    <LeftSidebar
      isOpen={sidebarOpen}
      onToggle={onToggleSidebar}
      showOnMobile
      mobileOpen={mobileNavOpen}
      onMobileClose={onMobileNavClose}
      width="var(--sidebar-left-width)"
    >
      <CategoryNav />
    </LeftSidebar>
  )
}
