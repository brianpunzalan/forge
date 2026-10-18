import { ModelRuntime, resolveCliModel } from '@earendil-works/pi-coding-agent'
import { config } from './config.ts'
import { SessionManager } from './session-manager.ts'
import { createStore } from './store/index.ts'
import { createWebServer } from './web-server.ts'

export const App = async () => {
  // Shared singleton: model catalogs + credentials are expensive to build.
  const modelRuntime = await ModelRuntime.create()

  const resolved = config.model
    ? resolveCliModel({ cliModel: config.model, modelRuntime })
    : undefined
  if (config.model && (resolved?.error || !resolved?.model)) {
    throw new Error(`cannot resolve FORGE_MODEL=${config.model}: ${resolved?.error ?? 'no match'}`)
  }

  const store = createStore()

  // A fresh process owns no live sessions: mark any non-stopped record from a
  // previous (possibly killed) process as stopped so the DB status stays honest.
  const orphaned = (await store.listSessions()).filter(
    (s) => s.status !== 'stopped' && s.status !== 'stopping',
  )
  for (const s of orphaned) {
    await store.updateSession(s.id, { status: 'stopped' })
  }

  const manager = new SessionManager(store, modelRuntime, {
    model: resolved?.model,
    thinkingLevel: resolved?.thinkingLevel,
  })
  const server = createWebServer({ manager })

  if (orphaned.length > 0) {
    server.log.info(`marked ${orphaned.length} orphaned session(s) as stopped`)
  }

  server.log.info(
    `${config.databaseUrl ? 'store: postgres' : 'store: in-memory'}, model: ${config.model || '(default)'}`,
  )

  server.listen({ port: config.port, host: '127.0.0.1' }, (err) => {
    if (err) {
      server.log.error(err)
      process.exit(1)
    }
  })

  let shuttingDown = false
  const shutdown = async () => {
    if (shuttingDown) return
    shuttingDown = true
    server.log.info('shutting down')
    await manager.close()
    await store.close()
    await server.close()
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown())
  process.on('SIGTERM', () => void shutdown())
}
