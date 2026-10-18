import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from '@phosphor-icons/react'
import { NavUser } from '#/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '#/components/ui/sidebar'
import { deleteSessions, type SessionSummary } from '#/lib/forge-api'
import { cn } from 'cn'
import logoSrc from '#/assets/logo.png'
import { Button } from './ui/button'

type SessionRow = SessionSummary & { unread: number }

function statusDot(status: string): string {
  switch (status) {
    case 'running':
    case 'creating':
    case 'resuming':
    case 'reconnecting':
      return 'bg-amber-400 animate-pulse'
    case 'idle':
      return 'bg-emerald-500'
    case 'degraded':
    case 'error':
      return 'bg-destructive'
    default:
      return 'bg-muted-foreground/40'
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'running':
    case 'creating':
    case 'resuming':
    case 'reconnecting':
      return 'Building'
    case 'idle':
      return 'Idle'
    case 'degraded':
      return 'Degraded'
    case 'error':
      return 'Error'
    default:
      return 'Stopped'
  }
}

const SidebarHeaderTrigger = () => {
  const { state, toggleSidebar } = useSidebar()

  if (state === 'collapsed') {
    return (
      <Button
        data-sidebar="trigger"
        data-slot="sidebar-trigger"
        variant="ghost"
        size="icon-sm"
        className="cursor-e-resize"
        onClick={() => toggleSidebar()}
      >
        <img src={logoSrc} alt="Forge" className="size-5 rounded" />
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2 px-1">
      <img src={logoSrc} alt="Forge" className="size-7 rounded-lg" />
      <span className="text-sm font-semibold">Forge</span>
      <SidebarTrigger className="ml-auto" />
    </div>
  )
}

export function HomeSidebar({
  sessions,
  onNewChat,
  onRefresh,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  sessions: SessionRow[]
  onNewChat: () => void
  onRefresh: () => void
}) {
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [menu, setMenu] = React.useState<{ x: number; y: number; ids: string[] } | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const filtered = query.trim()
    ? sessions.filter((s) =>
        (s.title ?? '').toLowerCase().includes(query.trim().toLowerCase()),
      )
    : sessions

  const handleClick = (event: React.MouseEvent, id: string) => {
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault()
      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      return
    }
    setSelected(new Set())
    void navigate({ to: '/session/$sessionId', params: { sessionId: id } })
  }

  const handleContextMenu = (event: React.MouseEvent, id: string) => {
    event.preventDefault()
    const ids = selected.has(id) ? [...selected] : [id]
    setSelected(new Set(ids))
    setMenu({ x: event.clientX, y: event.clientY, ids })
  }

  const doDelete = async (ids: string[]) => {
    setMenu(null)
    setDeleting(true)
    try {
      await deleteSessions(ids)
      setSelected(new Set())
      onRefresh()
    } catch {
      // ignore; list refresh will reflect reality
    } finally {
      setDeleting(false)
    }
  }

  React.useEffect(() => {
    if (!menu) return
    const onDown = () => setMenu(null)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarHeaderTrigger />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="pt-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="New chat"
                className="font-medium"
                onClick={onNewChat}
              >
                <PlusIcon weight="bold" />
                <span>New chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>Chats</SidebarGroupLabel>
          <SidebarGroupAction
            aria-label="Search chats"
            title="Search chats"
            className="hover:bg-sidebar-accent"
            onClick={() => {
              setSearchOpen((v) => !v)
              if (searchOpen) setQuery('')
            }}
          >
            <MagnifyingGlassIcon />
          </SidebarGroupAction>
          {searchOpen && (
            <div className="px-2 pb-1">
              <SidebarInput
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search chats…"
              />
            </div>
          )}
          {selected.size > 0 && (
            <div className="flex items-center gap-1.5 px-2 pb-1">
              <span className="text-[11px] text-muted-foreground">
                {selected.size} selected
              </span>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="icon-xs"
                  variant="outline"
                  className="rounded-md text-destructive"
                  disabled={deleting}
                  aria-label="Delete selected"
                  title="Delete selected"
                  onClick={() => void doDelete([...selected])}
                >
                  <TrashIcon />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="rounded-md"
                  aria-label="Clear selection"
                  title="Clear selection"
                  onClick={() => setSelected(new Set())}
                >
                  <XIcon />
                </Button>
              </div>
            </div>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {filtered.length === 0 && (
                <SidebarMenuItem>
                  <span className="px-2 py-1 text-xs text-sidebar-foreground/60">
                    {query.trim() ? 'No matching sessions' : 'No sessions yet'}
                  </span>
                </SidebarMenuItem>
              )}
              {filtered.map((session) => (
                <SidebarMenuItem key={session.id}>
                  <SidebarMenuButton
                    tooltip={`${session.title ?? session.id} · ${statusLabel(session.status)}`}
                    isActive={selected.has(session.id)}
                    onClick={(event) => handleClick(event, session.id)}
                    onContextMenu={(event) => handleContextMenu(event, session.id)}
                  >
                    <span
                      className={cn(
                        'size-2.5 shrink-0 rounded-full',
                        statusDot(session.status),
                      )}
                      title={statusLabel(session.status)}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {session.title ?? `Session ${session.id.slice(0, 8)}`}
                    </span>
                    {session.unread > 0 && (
                      <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                        {session.unread > 9 ? '9+' : session.unread}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />

      {menu && (
        <div
          className="fixed z-50 min-w-40 rounded-lg border bg-popover p-1 shadow-md"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            disabled={deleting}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-muted"
            onClick={() => void doDelete(menu.ids)}
          >
            <TrashIcon className="size-4" />
            Delete {menu.ids.length > 1 ? `${menu.ids.length} sessions` : 'session'}
          </button>
        </div>
      )}
    </Sidebar>
  )
}
