import * as React from 'react'
import {
  ArrowUpIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  StopIcon,
  XCircleIcon,
} from '@phosphor-icons/react'
import type { ChatItem, ToolItem } from '#/hooks/use-forge-session'

type Props = {
  items: ChatItem[]
  status: string
  onSend: (message: string, streamingBehavior?: 'steer' | 'followUp') => void
  onAbort: () => void
}

export function ForgeChat({ items, status, onSend, onAbort }: Props) {
  const [draft, setDraft] = React.useState('')
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const running = status === 'running' || status === 'connecting' || status === 'reconnecting'

  React.useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTo({ top: node.scrollHeight })
  }, [items])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const value = draft.trim()
    if (!value) return
    onSend(value, running ? 'followUp' : undefined)
    setDraft('')
  }

  const steer = () => {
    const value = draft.trim()
    if (!value) return
    onSend(value, 'steer')
    setDraft('')
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {items.map((item) => (
          <ChatRow key={item.id} item={item} />
        ))}
        {items.length === 0 && (
          <p className="px-1 text-sm text-muted-foreground">
            {running ? 'Starting the sandbox…' : 'Describe what to build.'}
          </p>
        )}
      </div>

      <form onSubmit={submit} className="border-t p-3">
        {running && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
            <CircleNotchIcon className="size-3.5 animate-spin" />
            <span>Agent is working — your message will be queued as a follow-up.</span>
            <button
              type="button"
              onClick={steer}
              className="ml-auto rounded-md border px-2 py-0.5 font-medium hover:bg-muted"
            >
              Steer instead
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Message Forge…"
            className="field-sizing-content max-h-32 min-h-9 flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-ring/60"
          />
          {running ? (
            <button
              type="button"
              onClick={onAbort}
              className="flex size-9 items-center justify-center rounded-full border text-muted-foreground hover:bg-muted"
              aria-label="Stop"
              title="Stop (abort + clear queue)"
            >
              <StopIcon className="size-4" />
            </button>
          ) : null}
          <button
            type="submit"
            disabled={!draft.trim()}
            className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
            aria-label="Send"
          >
            <ArrowUpIcon weight="bold" className="size-4" />
          </button>
        </div>
      </form>
    </div>
  )
}

function ChatRow({ item }: { item: ChatItem }) {
  if (item.kind === 'message' && item.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
          {item.text}
        </div>
      </div>
    )
  }

  if (item.kind === 'message' && item.role === 'assistant') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] space-y-2">
          {item.thinking ? <ThinkingBlock thinking={item.thinking} /> : null}
          <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm">
            {item.text}
            {item.streaming && <span className="animate-pulse">▍</span>}
          </div>
        </div>
      </div>
    )
  }

  return <ToolRow item={item as ToolItem} />
}

function ThinkingBlock({ thinking }: { thinking: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="rounded-lg border bg-background/60 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-muted-foreground"
      >
        <CircleNotchIcon className="size-3" />
        Thinking
        <span className="ml-auto">{open ? '▾' : '▸'}</span>
      </button>
      {open && <pre className="whitespace-pre-wrap px-2 pb-2 text-muted-foreground">{thinking}</pre>}
    </div>
  )
}

function ToolRow({ item }: { item: ToolItem }) {
  const [open, setOpen] = React.useState(true)
  return (
    <div className="rounded-lg border bg-background/60 px-2 py-1.5 font-mono text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-left"
      >
        {item.status === 'running' ? (
          <CircleNotchIcon className="size-3.5 shrink-0 animate-spin" />
        ) : item.status === 'error' ? (
          <XCircleIcon className="size-3.5 shrink-0 text-destructive" />
        ) : (
          <CheckCircleIcon className="size-3.5 shrink-0 text-primary" />
        )}
        <span className="shrink-0 font-medium">{item.name}</span>
        <span className="truncate text-muted-foreground">{item.args}</span>
        <span className="ml-auto text-muted-foreground">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-muted-foreground">
          {item.output || (item.status === 'running' ? '…' : '(no output)')}
        </pre>
      )}
    </div>
  )
}

export type { ChatItem }
