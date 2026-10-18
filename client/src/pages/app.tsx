import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowSquareOutIcon, CodeIcon, EyeIcon } from '@phosphor-icons/react'
import { ForgeChat } from '#/components/forge-chat'
import { ForgeCode } from '#/components/forge-code'
import { useForgeSession } from '#/hooks/use-forge-session'
import logoSrc from '#/assets/logo.png'

export default function Page({ sessionId }: { sessionId: string }) {
  const session = useForgeSession(sessionId)
  const [view, setView] = React.useState<'preview' | 'code'>('preview')

  const statusLabel = {
    connecting: 'Starting sandbox…',
    running: 'Building…',
    idle: 'Idle',
    reconnecting: 'Reconnecting…',
    stopped: 'Stopped',
    degraded: 'Degraded',
    error: 'Error',
  }[session.status] ?? session.status

  return (
    <div className="flex h-screen min-h-0 bg-background">
      <aside className="flex w-80 shrink-0 flex-col border-r">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <Link to="/" aria-label="Back to home" className="shrink-0">
            <img src={logoSrc} alt="Forge" className="size-6 rounded" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Forge</p>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              {session.phase ?? statusLabel}
            </p>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <ForgeChat
            items={session.items}
            status={session.status}
            onSend={session.send}
            onAbort={session.abort}
          />
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <span className="text-sm font-medium">{view === 'code' ? 'Code' : 'Preview'}</span>
          {view === 'preview' && session.previewUrl && (
            <a
              href={session.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Open preview in a new window"
              title="Open preview in a new window"
            >
              <ArrowSquareOutIcon className="size-4" />
            </a>
          )}
          <span className="text-muted-foreground">·</span>
          <span className="truncate text-muted-foreground">
            {view === 'code' ? 'Read-only' : (session.previewUrl ?? 'preview starting…')}
          </span>
          <button
            type="button"
            onClick={() => setView((v) => (v === 'code' ? 'preview' : 'code'))}
            className="ml-auto flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm"
          >
            {view === 'code' ? <EyeIcon className="size-4" /> : <CodeIcon className="size-4" />}
            {view === 'code' ? 'Preview' : 'Code'}
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden">
          {view === 'code' ? (
            <ForgeCode files={session.files} readFile={session.readFile} />
          ) : session.previewUrl ? (
            <iframe
              src={session.previewUrl}
              title="Preview"
              className="size-full border-0 bg-white"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
              {session.error ? (
                <span className="text-destructive">{session.error}</span>
              ) : null}
              <span>{session.notice ?? 'The preview will appear here once the app builds.'}</span>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
