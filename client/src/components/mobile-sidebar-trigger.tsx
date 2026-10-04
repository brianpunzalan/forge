import { List as ListIcon } from '@phosphor-icons/react'
import { Button } from '#/components/ui/button'
import { useSidebar } from '#/components/ui/sidebar'

export function MobileSidebarTrigger({ className }: { className?: string }) {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon-sm"
      className={className}
      onClick={toggleSidebar}
      aria-label="Open navigation menu"
    >
      <ListIcon />
      <span className="sr-only">Open navigation menu</span>
    </Button>
  )
}
