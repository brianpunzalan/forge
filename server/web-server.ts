import Fastify from 'fastify'
import cors from '@fastify/cors'

export const createWebServer = () => {
  const server = Fastify({
    logger: true,
  })

  server.listen({ port: 3000 }, function (err) {
    if (err) {
      server.log.error(err)
    }
  })

  server.register(cors, {
    origin: '*',
  })

  return server
}

export type Server = Fastify.FastifyInstance
