import Fastify from 'fastify'
import cors from '@fastify/cors'

export const startServer = async () => {
    const server = Fastify({
        logger: true,
    })

    await server.register(cors, {
        origin: "*"
    })

    return server;
}

export type Server = Fastify.FastifyInstance;