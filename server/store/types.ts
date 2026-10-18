export type SessionStatus =
  | 'creating'
  | 'running'
  | 'idle'
  | 'stopping'
  | 'stopped'
  | 'resuming'
  | 'error'
  | 'degraded'

export type SessionRecord = {
  id: string
  title: string | null
  workspaceDir: string
  sessionFile: string | null
  status: SessionStatus
  model: string | null
  lastSeq: number
  messageCount: number
  previewUrl: string | null
  createdAt: string
  updatedAt: string
}

export type StoredEvent = {
  seq: number
  type: string
  payload: unknown
}

export interface SessionStore {
  createSession(record: SessionRecord): Promise<void>
  updateSession(
    id: string,
    patch: Partial<Omit<SessionRecord, 'id' | 'createdAt'>>,
  ): Promise<void>
  getSession(id: string): Promise<SessionRecord | null>
  listSessions(): Promise<SessionRecord[]>
  appendEvent(sessionId: string, event: StoredEvent): Promise<void>
  getEvents(sessionId: string, afterSeq: number): Promise<StoredEvent[]>
  deleteSession(id: string): Promise<void>
  close(): Promise<void>
}
