import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fs from 'node:fs'
import path from 'node:path'
import type { ForgeSession } from '../agent/forge-session.ts'
import type { WireEvent } from '../agent/events.ts'
import { config } from '../config.ts'
import type { SessionManager } from '../session-manager.ts'

type RouteDeps = {
  manager: SessionManager
}

export function registerSessionRoutes(server: FastifyInstance, deps: RouteDeps): void {
  const { manager } = deps

  async function resolveSession(
    req: FastifyRequest,
    reply: FastifyReply,
  ): Promise<ForgeSession | null> {
    const { id } = req.params as { id: string }
    try {
      return await manager.resume(id)
    } catch (err) {
      reply.code(404).send({ error: String(err instanceof Error ? err.message : err) })
      return null
    }
  }

  server.post('/auth', async (req, reply) => {
    const body = req.body as { token?: string } | undefined
    if (config.authToken && body?.token !== config.authToken) {
      return reply.code(401).send({ error: 'invalid token' })
    }
    reply
      .header(
        'set-cookie',
        `${config.authCookieName}=${config.authToken || 'local'}; Path=/; HttpOnly; SameSite=Lax`,
      )
      .send({ ok: true })
  })

  server.addHook('onRequest', async (req, reply) => {
    if (!config.authToken) return
    if (req.url === '/auth' || req.method === 'OPTIONS') return
    if (readCookies(req)[config.authCookieName] !== config.authToken) {
      return reply.code(401).send({ error: 'unauthorized' })
    }
  })

  server.post('/sessions', async (req, reply) => {
    const body = req.body as { prompt?: string } | undefined
    try {
      const session = await manager.create(body?.prompt?.trim() || undefined)
      reply.code(201).send({ id: session.id })
    } catch (err) {
      reply.code(503).send({ error: String(err instanceof Error ? err.message : err) })
    }
  })

  server.get('/sessions', async () => {
    return manager.list()
  })

  server.get('/sessions/:id', async (req, reply) => {
    const session = await resolveSession(req, reply)
    if (!session) return
    return {
      id: session.id,
      status: session.status,
      previewUrl: session.previewUrl,
      workspaceDir: session.workspaceDir,
      messageCount: session.messageCount,
    }
  })

  server.post('/sessions/:id/prompt', async (req, reply) => {
    const session = await resolveSession(req, reply)
    if (!session) return
    const body = req.body as { message?: string; streamingBehavior?: 'steer' | 'followUp' }
    const message = body?.message?.trim()
    if (!message) return reply.code(400).send({ error: 'message required' })

    const clientId = req.headers['x-forge-client'] as string | undefined
    if (clientId) {
      try {
        manager.assertWriter(session.id, clientId)
      } catch (err) {
        return reply.code(409).send({ error: String(err instanceof Error ? err.message : err) })
      }
    }

    void session.prompt(message, body?.streamingBehavior).catch((err) => {
      session.emitControl('error', { message: String(err) })
    })
    reply.code(202).send({ ok: true })
  })

  server.post('/sessions/:id/abort', async (req, reply) => {
    const session = await resolveSession(req, reply)
    if (!session) return
    await session.abort()
    reply.send({ ok: true })
  })

  server.delete('/sessions/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    await manager.deleteSession(id)
    reply.send({ ok: true })
  })

  // Bulk delete via POST because Fastify (like many servers) does not parse a
  // request body on DELETE by default.
  server.post('/sessions/bulk-delete', async (req) => {
    const body = req.body as { ids?: string[] } | undefined
    const ids = (body?.ids ?? []).filter((id) => typeof id === 'string')
    for (const id of ids) {
      await manager.deleteSession(id).catch(() => {})
    }
    return { ok: true, deleted: ids.length }
  })

  server.get('/sessions/:id/files', async (req, reply) => {
    const session = await resolveSession(req, reply)
    if (!session) return
    return { files: session.listFiles() }
  })

  server.get('/sessions/:id/file', async (req, reply) => {
    const session = await resolveSession(req, reply)
    if (!session) return
    const filePath = (req.query as { path?: string }).path
    if (!filePath) return reply.code(400).send({ error: 'path required' })
    const root = path.resolve(session.workspaceDir)
    const abs = path.resolve(root, filePath)
    if (!abs.startsWith(root + path.sep)) {
      return reply.code(400).send({ error: 'path escapes workspace' })
    }
    try {
      const stat = fs.statSync(abs)
      if (stat.size > 200 * 1024) {
        return reply.send({ path: filePath, binary: false, truncated: true, content: '' })
      }
      const content = fs.readFileSync(abs, 'utf8')
      return reply.send({ path: filePath, binary: false, truncated: false, content })
    } catch {
      return reply.code(404).send({ error: 'file not found' })
    }
  })

  server.get('/sessions/:id/events', async (req, reply) => {
    const session = await resolveSession(req, reply)
    if (!session) return

    const lastEventId = req.headers['last-event-id']
    const querySeq = (req.query as { afterSeq?: string }).afterSeq
    const afterSeq = Number(querySeq ?? lastEventId ?? 0) || 0

    const writer = createSseWriter(reply, req.headers.origin)
    const unsubscribe = await session.subscribe(writer, afterSeq)
    reply.raw.on('close', () => {
      unsubscribe()
      writer.close()
    })

    await new Promise<void>((resolve) => {
      reply.raw.on('close', () => resolve())
    })
  })
}

function readCookies(req: FastifyRequest): Record<string, string> {
  const header = req.headers.cookie
  if (!header) return {}
  const out: Record<string, string> = {}
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim())
  }
  return out
}

function createSseWriter(reply: FastifyReply, origin?: string) {
  let closed = false
  const raw = reply.raw

  // NOTE: writing directly to reply.raw bypasses Fastify's onSend hook, so
  // @fastify/cors never runs here. Add the CORS headers manually to mirror the
  // `origin: true, credentials: true` config used for the rest of the API.
  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  }
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
    headers['Vary'] = 'Origin'
  }

  raw.writeHead(200, headers)
  raw.flushHeaders?.()

  const heartbeat = setInterval(() => {
    if (!closed) raw.write(': ping\n\n')
  }, 15_000)
  heartbeat.unref()

  return {
    push(event: WireEvent): void {
      if (closed) return
      raw.write(`id: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`)
    },
    close(): void {
      if (closed) return
      closed = true
      clearInterval(heartbeat)
      raw.end()
    },
  }
}
