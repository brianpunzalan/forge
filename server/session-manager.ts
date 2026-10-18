import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { ForgeSession } from './agent/forge-session.ts'
import { config } from './config.ts'
import { log, type Logger } from './log.ts'
import type { SessionRecord, SessionStore } from './store/types.ts'
import type { ModelRuntime } from '@earendil-works/pi-coding-agent'

export class SessionManager {
  private live = new Map<string, ForgeSession>()
  private writers = new Map<string, string>()
  private sweepTimer: NodeJS.Timeout | null = null
  private readonly store: SessionStore
  private readonly modelRuntime: ModelRuntime
  private readonly model: unknown
  private readonly thinkingLevel: unknown
  private readonly log: Logger

  constructor(
    store: SessionStore,
    modelRuntime: ModelRuntime,
    modelOpts: { model?: unknown; thinkingLevel?: unknown } = {},
  ) {
    this.store = store
    this.modelRuntime = modelRuntime
    this.model = modelOpts.model
    this.thinkingLevel = modelOpts.thinkingLevel
    this.log = log.child(' [manager]')
    this.sweepTimer = setInterval(() => void this.sweepIdle(), 30_000)
    this.sweepTimer.unref()
  }

  get(id: string): ForgeSession | undefined {
    return this.live.get(id)
  }

  async create(prompt?: string): Promise<ForgeSession> {
    if (this.live.size >= config.maxLiveSessions) {
      throw new Error(`at capacity (${config.maxLiveSessions} live sessions)`)
    }
    const id = randomUUID()
    this.log.info('creating session', { id })
    const session = await ForgeSession.create({
      id,
      store: this.store,
      modelRuntime: this.modelRuntime,
      model: this.model,
      thinkingLevel: this.thinkingLevel,
      title: prompt ? prompt.trim().slice(0, 80) || null : null,
    })
    this.live.set(id, session)
    this.log.info('session live', { id, live: this.live.size })
    if (prompt) {
      void session.prompt(prompt).catch((err) => session.emitControl('error', { message: String(err) }))
    }
    return session
  }

  async resume(id: string): Promise<ForgeSession> {
    const existing = this.live.get(id)
    if (existing) return existing

    const record = await this.store.getSession(id)
    if (!record) throw new Error('session not found')

    this.log.info('resuming session', { id })
    const session = await ForgeSession.resume(
      {
        id,
        store: this.store,
        modelRuntime: this.modelRuntime,
        model: this.model,
        thinkingLevel: this.thinkingLevel,
      },
      record,
    )
    this.live.set(id, session)
    this.log.info('session resumed', { id })
    return session
  }

  assertWriter(sessionId: string, clientId: string): void {
    const current = this.writers.get(sessionId)
    if (current && current !== clientId) {
      throw new Error('another tab is driving this session')
    }
    this.writers.set(sessionId, clientId)
  }

  async teardown(id: string): Promise<void> {
    this.log.info('teardown requested', { id })
    const session = this.live.get(id)
    if (session) {
      await session.teardown()
      this.live.delete(id)
    }
    this.writers.delete(id)
  }

  async teardownAll(): Promise<number> {
    let count = 0
    for (const [id, session] of [...this.live.entries()]) {
      this.log.info('teardown requested (bulk)', { id })
      await session.teardown().catch(() => {})
      this.live.delete(id)
      this.writers.delete(id)
      count++
    }
    return count
  }

  async deleteSession(id: string): Promise<void> {
    this.log.info('delete requested', { id })
    const session = this.live.get(id)
    if (session) {
      await session.teardown().catch(() => {})
      this.live.delete(id)
    }
    this.writers.delete(id)

    const record = await this.store.getSession(id)
    await this.store.deleteSession(id)

    if (record) {
      await rm(record.workspaceDir, { recursive: true, force: true }).catch(() => {})
      if (record.sessionFile) {
        await rm(record.sessionFile, { force: true }).catch(() => {})
      }
    }
  }

  async list(): Promise<SessionRecord[]> {
    return this.store.listSessions()
  }

  async close(): Promise<void> {
    if (this.sweepTimer) clearInterval(this.sweepTimer)
    for (const session of [...this.live.values()]) {
      await session.teardown().catch(() => {})
    }
    this.live.clear()
    this.writers.clear()
  }

  private async sweepIdle(): Promise<void> {
    const now = Date.now()
    for (const [id, session] of [...this.live.entries()]) {
      if (session.isIdle(now)) {
        this.log.info('idle sweep teardown', { id })
        await session.teardown().catch(() => {})
        this.live.delete(id)
        this.writers.delete(id)
      }
    }
  }
}
