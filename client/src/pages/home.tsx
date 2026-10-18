import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowUpIcon,
  CodeIcon,
  FileTextIcon,
  LightbulbIcon,
  PaintBrushIcon,
  PaperclipIcon,
  SparkleIcon,
} from '@phosphor-icons/react'
import { HomeSidebar } from '#/components/home-sidebar'
import { MobileSidebarTrigger } from '#/components/mobile-sidebar-trigger'
import { Button } from '#/components/ui/button'
import { SidebarInset, SidebarProvider } from '#/components/ui/sidebar'
import {
  createSession,
  getSeenMessages,
  listSessions,
  type SessionSummary,
} from '#/lib/forge-api'
import logoSrc from '#/assets/logo.png'

const suggestions = [
  { icon: CodeIcon, label: 'Build a component' },
  { icon: PaintBrushIcon, label: 'Design systems' },
  { icon: FileTextIcon, label: 'Summarize a doc' },
  { icon: LightbulbIcon, label: 'Brainstorm ideas' },
]

export default function Page() {
  const navigate = useNavigate()
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [sessions, setSessions] = React.useState<SessionSummary[]>([])
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const reload = React.useCallback(() => {
    void listSessions()
      .then((list) => setSessions(list))
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    reload()
    const timer = setInterval(reload, 4000)
    return () => clearInterval(timer)
  }, [reload])

  const sessionsWithUnread = sessions.map((session) => ({
    ...session,
    unread: Math.max(0, session.messageCount - getSeenMessages(session.id)),
  }))

  const handleNewChat = () => {
    const node = textareaRef.current
    if (node) {
      node.value = ''
      node.focus()
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const prompt = String(data.get('prompt') ?? '').trim()
    if (!prompt || busy) return
    setBusy(true)
    setError(null)
    try {
      const { id } = await createSession(prompt)
      navigate({ to: '/session/$sessionId', params: { sessionId: id } })
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
      setBusy(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <SidebarProvider>
      <HomeSidebar
        sessions={sessionsWithUnread}
        onNewChat={handleNewChat}
        onRefresh={reload}
      />
      <SidebarInset className="relative isolate">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-sm md:hidden">
          <MobileSidebarTrigger />
          <span className="text-sm font-semibold">Forge</span>
        </header>

        {/* Soft ambient glow behind the composer */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <div className="absolute -top-48 left-1/2 size-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -right-24 bottom-0 size-80 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-10 px-4 py-16">
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl border bg-card shadow-sm">
              <img src={logoSrc} alt="Forge" className="size-8" />
            </div>
            <div className="space-y-2">
              <h1 className="font-serif text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                What do you want to build today?
              </h1>
              <p className="mx-auto max-w-md text-sm text-balance text-muted-foreground sm:text-base">
                Describe your idea and Forge will help you design, code, and
                ship it.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="w-full max-w-2xl">
            {error && (
              <p className="mb-2 text-center text-sm text-destructive">{error}</p>
            )}
            <div className="rounded-3xl border bg-card p-2 shadow-sm transition-shadow focus-within:border-ring/60 focus-within:shadow-md">
              <label htmlFor="prompt" className="sr-only">
                Ask me anything
              </label>
              <textarea
                ref={textareaRef}
                id="prompt"
                name="prompt"
                rows={2}
                placeholder="Ask me anything"
                onKeyDown={handleKeyDown}
                className="field-sizing-content max-h-48 min-h-16 w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              <div className="flex items-center justify-between gap-2 px-1">
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
                  disabled={busy}
                  aria-label="Send message"
                >
                  {busy ? (
                    <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <ArrowUpIcon weight="bold" />
                  )}
                </Button>
              </div>
            </div>
          </form>

          <div className="flex max-w-2xl flex-wrap items-center justify-center gap-2">
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion.label}
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full text-muted-foreground"
              >
                <suggestion.icon />
                {suggestion.label}
              </Button>
            ))}
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <SparkleIcon className="size-3.5" />
            Forge can make mistakes. Verify important information.
          </p>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
