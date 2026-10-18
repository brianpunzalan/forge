import type { SessionRecord, SessionStore, StoredEvent } from './types.ts'

export class MemoryStore implements SessionStore {
  private sessions = new Map<string, SessionRecord>()
  private events = new Map<string, StoredEvent[]>()

  async createSession(record: SessionRecord): Promise<void> {
    this.sessions.set(record.id, record)
  }

  async updateSession(
    id: string,
    patch: Partial<Omit<SessionRecord, 'id' | 'createdAt'>>,
  ): Promise<void> {
    const current = this.sessions.get(id)
    if (!current) return
    this.sessions.set(id, { ...current, ...patch, updatedAt: new Date().toISOString() })
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    return this.sessions.get(id) ?? null
  }

  async listSessions(): Promise<SessionRecord[]> {
    return [...this.sessions.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    )
  }

  async appendEvent(sessionId: string, event: StoredEvent): Promise<void> {
    const list = this.events.get(sessionId) ?? []
    list.push(event)
    this.events.set(sessionId, list)
  }

  async getEvents(sessionId: string, afterSeq: number): Promise<StoredEvent[]> {
    const list = this.events.get(sessionId) ?? []
    return list.filter((e) => e.seq > afterSeq)
  }

  async deleteSession(id: string): Promise<void> {
    this.sessions.delete(id)
    this.events.delete(id)
  }

  async close(): Promise<void> {}
}
