export const FORGE_API_BASE =
  import.meta.env.VITE_FORGE_API ?? 'http://127.0.0.1:3000'

export type WireEvent =
  | { seq: number; kind: 'agent'; event: AgentEvent }
  | { seq: number; kind: 'control'; type: string; data?: unknown }

// Minimal, lenient view of pi's session events (server forwards them verbatim).
export type AgentEvent = {
  type: string
  message?: { role?: string; content?: unknown }
  assistantMessageEvent?: { type?: string; delta?: string; content?: string }
  toolCallId?: string
  toolName?: string
  args?: unknown
  partialResult?: unknown
  result?: unknown
  isError?: boolean
  durationMs?: number
  [key: string]: unknown
}

export type FileNode = {
  name: string
  path: string
  type: 'file' | 'dir'
  size: number
  binary: boolean
  children?: FileNode[]
}

export type SessionSummary = {
  id: string
  title: string | null
  status: string
  lastSeq: number
  messageCount: number
  updatedAt: string
}

function jsonFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${FORGE_API_BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include',
  })
}

export async function createSession(prompt?: string): Promise<{ id: string }> {
  const res = await jsonFetch('/sessions', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function listSessions(): Promise<SessionSummary[]> {
  const res = await jsonFetch('/sessions')
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function deleteSession(id: string): Promise<void> {
  const res = await jsonFetch(`/sessions/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await readError(res))
}

export async function deleteSessions(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  if (ids.length === 1) {
    await deleteSession(ids[0])
    return
  }
  const res = await jsonFetch('/sessions/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) throw new Error(await readError(res))
}

export function markSeen(sessionId: string, seq: number): void {
  try {
    const key = `forge:seen:${sessionId}`
    if (seq > Number(localStorage.getItem(key) ?? 0)) {
      localStorage.setItem(key, String(seq))
    }
  } catch {
    // ignore
  }
}

export function getSeen(sessionId: string): number {
  try {
    return Number(localStorage.getItem(`forge:seen:${sessionId}`) ?? 0)
  } catch {
    return 0
  }
}

export function markSeenMessages(sessionId: string, count: number): void {
  try {
    const key = `forge:seenmsgs:${sessionId}`
    if (count > Number(localStorage.getItem(key) ?? 0)) {
      localStorage.setItem(key, String(count))
    }
  } catch {
    // ignore
  }
}

export function getSeenMessages(sessionId: string): number {
  try {
    return Number(localStorage.getItem(`forge:seenmsgs:${sessionId}`) ?? 0)
  } catch {
    return 0
  }
}

export function openEvents(sessionId: string): EventSource {
  return new EventSource(`${FORGE_API_BASE}/sessions/${sessionId}/events`, {
    withCredentials: true,
  })
}

export async function sendPrompt(
  sessionId: string,
  message: string,
  streamingBehavior?: 'steer' | 'followUp',
  clientId?: string,
): Promise<void> {
  const res = await jsonFetch(`/sessions/${sessionId}/prompt`, {
    method: 'POST',
    body: JSON.stringify({ message, streamingBehavior }),
    headers: clientId ? { 'x-forge-client': clientId } : {},
  })
  if (!res.ok) throw new Error(await readError(res))
}

export async function abortSession(sessionId: string): Promise<void> {
  await jsonFetch(`/sessions/${sessionId}/abort`, { method: 'POST' })
}

export async function fetchFiles(sessionId: string): Promise<FileNode[]> {
  const res = await jsonFetch(`/sessions/${sessionId}/files`)
  if (!res.ok) throw new Error(await readError(res))
  const body = (await res.json()) as { files: FileNode[] }
  return body.files
}

export async function fetchFile(
  sessionId: string,
  path: string,
): Promise<{ path: string; content: string; binary: boolean; truncated: boolean }> {
  const res = await jsonFetch(`/sessions/${sessionId}/file?path=${encodeURIComponent(path)}`)
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    return body.error ?? res.statusText
  } catch {
    return res.statusText
  }
}
