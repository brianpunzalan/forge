import { createAgentSession } from './agent-session.ts'
import { createWebServer } from './web-server.ts'

export const App = async () => {
  const agentSession = await createAgentSession()
  const server = createWebServer()

  server.get('/hello', (req, reply) => {
    console.log(agentSession.session.model)
    const body = req.body as { message?: string }
    const message = body?.message ?? 'Ping'
    agentSession.session.prompt(message, { streamingBehavior: 'steer' })
    reply.send({ success: true })
  })

  server.listen({ port: 3000 }, function (err) {
    if (err) {
      server.log.error(err)
    }
  })
}
