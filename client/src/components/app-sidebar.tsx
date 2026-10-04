import * as React from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowUpIcon,
  ChatCircleDotsIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  CodeIcon,
  FolderPlusIcon,
  PaperclipIcon,
  TerminalWindowIcon,
} from '@phosphor-icons/react'
import { cn } from 'cn'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '#/components/ui/sidebar'
import { Button } from '#/components/ui/button'
import logoSrc from '#/assets/logo.png'

type ToolRun = {
  icon: React.ElementType
  label: string
  state: 'done' | 'running'
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  time: string
  unread?: boolean
  tools?: ToolRun[]
}

const createInitialMessages = (prompt?: string): ChatMessage[] => [
  {
    id: 'prompt',
    role: 'user',
    content:
      prompt?.trim() ||
      'Build me a modern analytics dashboard for my SaaS product.',
    time: 'Just now',
  },
  {
    id: 'plan',
    role: 'assistant',
    content:
      "I'll scaffold a React + Tailwind dashboard with a stats overview, a revenue chart, and a recent orders table. Starting now.",
    time: 'Just now',
    tools: [
      { icon: FolderPlusIcon, label: 'Created project', state: 'done' },
      { icon: TerminalWindowIcon, label: 'pnpm install', state: 'done' },
      { icon: CodeIcon, label: 'Generated 8 files', state: 'done' },
    ],
  },
  {
    id: 'result',
    role: 'assistant',
    content:
      'Your preview is live in the main panel. Want me to add dark mode or wire up the API next?',
    time: 'Just now',
    unread: true,
  },
]

function SidebarHeaderTrigger() {
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
      <Link
        to="/"
        title="Back to home"
        aria-label="Back to home"
        className="shrink-0 rounded-lg outline-hidden transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <img src={logoSrc} alt="Forge" className="size-7 rounded-lg" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">New session</p>
        <p className="flex items-center gap-1.5 truncate text-xs text-sidebar-foreground/70">
          <span className="size-1.5 rounded-full bg-primary" />
          Building preview
        </p>
      </div>
      <SidebarTrigger />
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5',
        isUser ? 'items-end' : 'items-start',
      )}
    >
      <div className="flex items-center gap-1.5 px-1 text-[11px] font-medium text-sidebar-foreground/60">
        {isUser ? (
          <span className="flex size-4 items-center justify-center rounded-full bg-sidebar-primary text-[9px] font-semibold text-sidebar-primary-foreground">
            Y
          </span>
        ) : (
          <img src={logoSrc} alt="" className="size-4 rounded-full" />
        )}
        <span>{isUser ? 'You' : 'Forge'}</span>
        <span className="font-normal">· {message.time}</span>
      </div>
      <div
        className={cn(
          'max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
          isUser
            ? 'rounded-tr-sm bg-primary text-primary-foreground'
            : 'rounded-tl-sm bg-sidebar-accent text-sidebar-accent-foreground',
        )}
      >
        {message.content}
      </div>
      {message.tools && (
        <div className="flex w-full flex-col gap-1 pt-0.5">
          {message.tools.map((tool) => (
            <div
              key={tool.label}
              className="flex items-center gap-1.5 rounded-lg border bg-background/60 px-2 py-1 text-[11px] text-muted-foreground"
            >
              <tool.icon className="size-3.5 shrink-0" />
              <span className="truncate">{tool.label}</span>
              {tool.state === 'done' ? (
                <CheckCircleIcon
                  weight="fill"
                  className="ml-auto size-3.5 shrink-0 text-primary"
                />
              ) : (
                <CircleNotchIcon className="ml-auto size-3.5 shrink-0 animate-spin" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CollapsedChatButton({ unreadCount }: { unreadCount: number }) {
  const { toggleSidebar } = useSidebar()

  return (
    <SidebarMenu className="items-center gap-1 p-2">
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={
            unreadCount > 0
              ? `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}`
              : 'Session chat'
          }
          className="justify-center"
          onClick={() => toggleSidebar()}
        >
          <div className="relative flex items-center justify-center">
            <ChatCircleDotsIcon className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function AppSidebar({
  prompt,
  ...props
}: React.ComponentProps<typeof Sidebar> & { prompt?: string }) {
  const { state } = useSidebar()
  const [messages, setMessages] = React.useState<ChatMessage[]>(() =>
    createInitialMessages(prompt),
  )
  const unreadCount = messages.filter((message) => message.unread).length
  const [draft, setDraft] = React.useState('')
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const node = scrollRef.current
    if (node) {
      node.scrollTo({ top: node.scrollHeight })
    }
  }, [messages])

  const handleSend = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = draft.trim()
    if (!value) return

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: value,
        time: 'Just now',
      },
    ])
    setDraft('')

    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: "Got it — I'm updating the preview now.",
          time: 'Just now',
          unread: true,
        },
      ])
    }, 700)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarHeaderTrigger />
      </SidebarHeader>

      <SidebarContent ref={scrollRef}>
        {state === 'collapsed' ? (
          <CollapsedChatButton unreadCount={unreadCount} />
        ) : (
          <div className="flex flex-col gap-5 px-3 py-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        )}
      </SidebarContent>

      {state === 'expanded' && (
        <SidebarFooter>
          <form
            onSubmit={handleSend}
            className="rounded-2xl border bg-background p-1.5 transition-colors focus-within:border-ring/60"
          >
            <label htmlFor="session-message" className="sr-only">
              Message Forge
            </label>
            <textarea
              id="session-message"
              name="message"
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Forge…"
              className="field-sizing-content max-h-32 min-h-9 w-full resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center justify-between px-0.5 pb-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full text-muted-foreground"
              >
                <PaperclipIcon />
                <span className="sr-only">Attach a file</span>
              </Button>
              <Button
                type="submit"
                size="icon-sm"
                className="rounded-full"
                disabled={!draft.trim()}
                aria-label="Send message"
              >
                <ArrowUpIcon weight="bold" />
              </Button>
            </div>
          </form>
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  )
}
