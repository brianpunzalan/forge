import * as React from 'react'
import {
  abortSession,
  fetchFile,
  fetchFiles,
  markSeen,
  markSeenMessages,
  openEvents,
  sendPrompt,
  type AgentEvent,
  type FileNode,
  type WireEvent,
} from '#/lib/forge-api'

export type ToolItem = {
  kind: 'tool'
  id: string
  name: string
  args: string
  status: 'running' | 'done' | 'error'
  output: string
}

export type MessageItem = {
  kind: 'message'
  id: string
  role: 'user' | 'assistant'
  text: string
  thinking: string
  streaming: boolean
}

export type ChatItem = MessageItem | ToolItem

type State = {
  status: string
  phase: string | null
  notice: string | null
  previewUrl: string | null
  items: ChatItem[]
  files: FileNode[]
  error: string | null
}

const INITIAL: State = {
  status: 'connecting',
  phase: null,
  notice: null,
  previewUrl: null,
  items: [],
  files: [],
  error: null,
}

const clientId = crypto.randomUUID()

export function useForgeSession(sessionId: string) {
  const [state, setState] = React.useState<State>(INITIAL)

  React.useEffect(() => {
    let es: EventSource | null = null
    let cancelled = false

    const refreshFiles = async () => {
      try {
        const files = await fetchFiles(sessionId)
        if (!cancelled) setState((prev) => ({ ...prev, files }))
      } catch {
        // ignore
      }
    }

    const handleControl = (type: string, data: unknown) => {
      switch (type) {
        case 'preview_ready':
          setState((prev) => ({
            ...prev,
            status: 'idle',
            previewUrl: (data as { url?: string })?.url ?? null,
          }))
          break
        case 'provisioning':
          setState((prev) => ({
            ...prev,
            phase: `Preparing sandbox: ${String((data as { step?: string })?.step ?? '…')}`,
          }))
          break
        case 'provisioned':
          setState((prev) => ({ ...prev, phase: null }))
          break
        case 'preview_unavailable':
          setState((prev) => ({
            ...prev,
            status: 'idle',
            phase: null,
            notice: `Preview not available: ${String((data as { reason?: string })?.reason ?? 'unknown')}. Ask Forge to build an app.`,
          }))
          break
        case 'preview_stopped':
          setState((prev) => ({ ...prev, previewUrl: null }))
          break
        case 'session_stopped':
          setState((prev) => ({ ...prev, status: 'stopped' }))
          break
        case 'session_degraded':
          setState((prev) => ({ ...prev, status: 'degraded' }))
          break
        case 'files_changed':
          void refreshFiles()
          break
        case 'preview_error':
          setState((prev) => ({
            ...prev,
            phase: null,
            error: `Preview failed: ${String((data as { message?: string })?.message ?? data)}`,
          }))
          break
        case 'error':
          setState((prev) => ({
            ...prev,
            error: String((data as { message?: string })?.message ?? data),
          }))
          break
        default:
          break
      }
    }

    let seenSeq = 0
    let seenMsgs = 0
    let seenTimer: ReturnType<typeof setTimeout> | null = null
    const flushSeen = () => {
      if (seenTimer) {
        clearTimeout(seenTimer)
        seenTimer = null
      }
      if (seenSeq > 0) markSeen(sessionId, seenSeq)
      if (seenMsgs > 0) markSeenMessages(sessionId, seenMsgs)
    }

    es = openEvents(sessionId)
    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as WireEvent
        seenSeq = Math.max(seenSeq, event.seq)
        if (
          event.kind === 'agent' &&
          event.event.type === 'message_end' &&
          event.event.message?.role === 'assistant'
        ) {
          seenMsgs++
        }
        if (!seenTimer) seenTimer = setTimeout(flushSeen, 1000)
        if (event.kind === 'agent') {
          setState((prev) => reduceAgent(prev, event.event))
        } else {
          handleControl(event.type, event.data)
        }
      } catch {
        // ignore malformed frames
      }
    }
    es.onerror = () => {
      setState((prev) => (prev.status === 'error' ? prev : { ...prev, status: 'reconnecting' }))
    }
    void refreshFiles()

    return () => {
      cancelled = true
      flushSeen()
      es?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const send = React.useCallback(
    (message: string, streamingBehavior?: 'steer' | 'followUp') => {
      void sendPrompt(sessionId, message, streamingBehavior, clientId).catch((err) =>
        setState((prev) => ({ ...prev, error: String(err) })),
      )
    },
    [sessionId],
  )

  const abort = React.useCallback(() => {
    void abortSession(sessionId).catch(() => {})
  }, [sessionId])

  const readFile = React.useCallback(
    async (path: string) => fetchFile(sessionId, path),
    [sessionId],
  )

  return { sessionId, ...state, send, abort, readFile }
}

function reduceAgent(state: State, event: AgentEvent): State {
  switch (event.type) {
    case 'message_start': {
      const role = event.message?.role
      if (role === 'user') {
        return { ...state, items: [...state.items, userItem(textOf(event.message?.content))] }
      }
      if (role === 'assistant') {
        const item: MessageItem = {
          kind: 'message',
          id: assistantId(state.items.length),
          role: 'assistant',
          text: '',
          thinking: '',
          streaming: true,
        }
        return { ...state, status: 'running', items: [...state.items, item] }
      }
      return state
    }
    case 'message_update': {
      const delta = event.assistantMessageEvent
      const type = delta?.type
      const next = [...state.items]
      const last = next[next.length - 1]
      if (last && last.kind === 'message' && last.role === 'assistant') {
        if (type === 'text_delta') {
          next[next.length - 1] = { ...last, text: last.text + (delta?.delta ?? '') }
          return { ...state, items: next }
        }
        if (type === 'thinking_delta') {
          next[next.length - 1] = { ...last, thinking: last.thinking + (delta?.delta ?? '') }
          return { ...state, items: next }
        }
      }
      return state
    }
    case 'message_end': {
      const role = event.message?.role
      if (role === 'assistant') {
        const next = [...state.items]
        const last = next[next.length - 1]
        if (last && last.kind === 'message' && last.role === 'assistant') {
          // Authoritative final content — replaces streamed deltas and, crucially,
          // populates the message when replaying history from Postgres (which
          // stores only authoritative events, not the text_delta stream).
          const { text, thinking } = extractAssistantContent(event.message?.content)
          next[next.length - 1] = {
            ...last,
            text: text || last.text,
            thinking: thinking || last.thinking,
            streaming: false,
          }
          return { ...state, items: next }
        }
      }
      return state
    }
    case 'tool_execution_start': {
      const item: ToolItem = {
        kind: 'tool',
        id: String(event.toolCallId ?? crypto.randomUUID()),
        name: event.toolName ?? 'tool',
        args: summarizeArgs(event.args),
        status: 'running',
        output: '',
      }
      return { ...state, status: 'running', items: [...state.items, item] }
    }
    case 'tool_execution_update': {
      const next = [...state.items]
      const idx = next.findIndex((i) => i.id === String(event.toolCallId))
      if (idx >= 0 && next[idx].kind === 'message') return state
      if (idx >= 0) {
        const item = next[idx] as ToolItem
        // `partialResult` is the cumulative snapshot so far (not a delta).
        next[idx] = { ...item, output: textOf(event.partialResult) }
        return { ...state, items: next }
      }
      return state
    }
    case 'tool_execution_end': {
      const next = [...state.items]
      const idx = next.findIndex((i) => i.id === String(event.toolCallId))
      if (idx >= 0 && next[idx].kind !== 'message') {
        const item = next[idx] as ToolItem
        next[idx] = {
          ...item,
          status: event.isError ? 'error' : 'done',
          output: textOf(event.result) || item.output,
        }
        return { ...state, items: next }
      }
      return state
    }
    case 'agent_settled':
      return { ...state, status: 'idle' }
    case 'agent_start':
      return { ...state, status: 'running' }
    default:
      return state
  }
}

function assistantId(seed: number): string {
  return `assistant-${seed}-${crypto.randomUUID()}`
}

function userItem(text: string): MessageItem {
  return {
    kind: 'message',
    id: `user-${crypto.randomUUID()}`,
    role: 'user',
    text,
    thinking: '',
    streaming: false,
  }
}

function extractAssistantContent(content: unknown): { text: string; thinking: string } {
  let text = ''
  let thinking = ''
  if (Array.isArray(content)) {
    for (const block of content) {
      if (!block || typeof block !== 'object') continue
      const b = block as { type?: string; text?: string; thinking?: string }
      if (b.type === 'text' && typeof b.text === 'string') text += b.text
      if (b.type === 'thinking' && typeof b.thinking === 'string') thinking += b.thinking
    }
  }
  return { text, thinking }
}

function summarizeArgs(args: unknown): string {
  if (args && typeof args === 'object' && 'command' in args) {
    return String((args as { command: unknown }).command ?? '').slice(0, 300)
  }
  try {
    return JSON.stringify(args).slice(0, 300)
  } catch {
    return ''
  }
}

function textOf(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === 'string') return block
        if (block && typeof block === 'object' && 'text' in block) {
          return String((block as { text: unknown }).text ?? '')
        }
        return ''
      })
      .join('')
  }
  if (content && typeof content === 'object') {
    const candidate = content as { text?: unknown; content?: unknown }
    if ('text' in candidate) return String(candidate.text ?? '')
    if ('content' in candidate) return textOf(candidate.content)
  }
  return ''
}
