import Fastify from 'fastify'
import cors from '@fastify/cors'
import { registerSessionRoutes } from './routes/sessions.ts'
import type { SessionManager } from './session-manager.ts'

export type Server = Fastify.FastifyInstance

export function createWebServer(deps: { manager: SessionManager }): Server {
  const server = Fastify({ logger: true })

  server.register(cors, {
    origin: true,
    credentials: true,
  })

  registerSessionRoutes(server, deps)

  return server
}
