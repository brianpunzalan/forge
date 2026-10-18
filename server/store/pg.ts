import pg from 'pg'
import type { SessionRecord, SessionStore, StoredEvent } from './types.ts'

export class PgStore implements SessionStore {
  private pool: pg.Pool
  private ready: Promise<void>

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString })
    this.ready = this.migrate()
  }

  private async migrate(): Promise<void> {
    const attempts = 8
    for (let attempt = 0; ; attempt++) {
      try {
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS forge_sessions (
            id text PRIMARY KEY,
            workspace_dir text NOT NULL,
            session_file text,
            status text NOT NULL,
            model text,
            last_seq bigint NOT NULL DEFAULT 0,
            preview_url text,
            created_at timestamptz NOT NULL,
            updated_at timestamptz NOT NULL
          )
        `)
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS forge_session_events (
            id bigserial PRIMARY KEY,
            session_id text NOT NULL REFERENCES forge_sessions(id) ON DELETE CASCADE,
            seq bigint NOT NULL,
            type text NOT NULL,
            payload jsonb NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            UNIQUE (session_id, seq)
          )
        `)
        await this.pool.query(`
          CREATE INDEX IF NOT EXISTS forge_session_events_session_seq
            ON forge_session_events (session_id, seq)
        `)
        await this.pool.query(
          `ALTER TABLE forge_sessions ADD COLUMN IF NOT EXISTS title text`,
        )
        await this.pool.query(
          `ALTER TABLE forge_sessions ADD COLUMN IF NOT EXISTS message_count integer NOT NULL DEFAULT 0`,
        )
        return
      } catch (err) {
        if (attempt >= attempts) throw err
        await new Promise((resolve) => setTimeout(resolve, 1_000))
      }
    }
  }

  async createSession(record: SessionRecord): Promise<void> {
    await this.ready
    await this.pool.query(
      `INSERT INTO forge_sessions
         (id, title, workspace_dir, session_file, status, model, last_seq, message_count, preview_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        record.id,
        record.title,
        record.workspaceDir,
        record.sessionFile,
        record.status,
        record.model,
        record.lastSeq,
        record.messageCount,
        record.previewUrl,
        record.createdAt,
        record.updatedAt,
      ],
    )
  }

  async updateSession(
    id: string,
    patch: Partial<Omit<SessionRecord, 'id' | 'createdAt'>>,
  ): Promise<void> {
    await this.ready
    const current = await this.getSession(id)
    if (!current) return
    const next = { ...current, ...patch }
    await this.pool.query(
      `UPDATE forge_sessions SET
         title = $2, workspace_dir = $3, session_file = $4, status = $5, model = $6,
         last_seq = $7, message_count = $8, preview_url = $9, updated_at = $10
       WHERE id = $1`,
      [
        id,
        next.title,
        next.workspaceDir,
        next.sessionFile,
        next.status,
        next.model,
        next.lastSeq,
        next.messageCount,
        next.previewUrl,
        new Date().toISOString(),
      ],
    )
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    await this.ready
    const result = await this.pool.query(
      `SELECT id, title, workspace_dir, session_file, status, model, last_seq, message_count,
              preview_url, created_at, updated_at
         FROM forge_sessions WHERE id = $1`,
      [id],
    )
    const row = result.rows[0]
    if (!row) return null
    return {
      id: row.id,
      title: row.title,
      workspaceDir: row.workspace_dir,
      sessionFile: row.session_file,
      status: row.status,
      model: row.model,
      lastSeq: Number(row.last_seq),
      messageCount: Number(row.message_count),
      previewUrl: row.preview_url,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }
  }

  async listSessions(): Promise<SessionRecord[]> {
    await this.ready
    const result = await this.pool.query(
      `SELECT id, title, workspace_dir, session_file, status, model, last_seq, message_count,
              preview_url, created_at, updated_at
         FROM forge_sessions ORDER BY updated_at DESC`,
    )
    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      workspaceDir: row.workspace_dir,
      sessionFile: row.session_file,
      status: row.status,
      model: row.model,
      lastSeq: Number(row.last_seq),
      messageCount: Number(row.message_count),
      previewUrl: row.preview_url,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }))
  }

  async appendEvent(sessionId: string, event: StoredEvent): Promise<void> {
    await this.ready
    await this.pool
      .query(
        `INSERT INTO forge_session_events (session_id, seq, type, payload)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (session_id, seq) DO NOTHING`,
        [sessionId, event.seq, event.type, JSON.stringify(event.payload)],
      )
      .catch(() => {
        // Persistence must never break the live stream; log-and-continue.
      })
    await this.pool
      .query(`UPDATE forge_sessions SET last_seq = $2, updated_at = now() WHERE id = $1`, [
        sessionId,
        event.seq,
      ])
      .catch(() => {})
  }

  async getEvents(sessionId: string, afterSeq: number): Promise<StoredEvent[]> {
    await this.ready
    const result = await this.pool.query(
      `SELECT seq, type, payload FROM forge_session_events
        WHERE session_id = $1 AND seq > $2 ORDER BY seq ASC`,
      [sessionId, afterSeq],
    )
    return result.rows.map((row) => ({
      seq: Number(row.seq),
      type: row.type,
      payload: row.payload,
    }))
  }

  async deleteSession(id: string): Promise<void> {
    await this.ready
    // forge_session_events has ON DELETE CASCADE.
    await this.pool.query(`DELETE FROM forge_sessions WHERE id = $1`, [id])
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}
