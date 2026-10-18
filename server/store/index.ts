import { config } from '../config.ts'
import { MemoryStore } from './memory.ts'
import { PgStore } from './pg.ts'
import type { SessionStore } from './types.ts'

export type { SessionRecord, SessionStore, SessionStatus, StoredEvent } from './types.ts'

export function createStore(): SessionStore {
  if (config.databaseUrl) {
    return new PgStore(config.databaseUrl)
  }
  return new MemoryStore()
}
