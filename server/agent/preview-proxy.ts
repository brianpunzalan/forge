import http from 'node:http'
import net from 'node:net'
import type { Duplex } from 'node:stream'
import { WebSocketServer, WebSocket } from 'ws'

/**
 * A tiny per-session HTTP+WS reverse proxy that forwards a browser to the
 * gondolin ingress gateway (which in turn reaches the guest dev server).
 * Bound to a loopback port so the preview URL is `http://localhost:<port>`.
 */
export class PreviewProxy {
  private server: http.Server | null = null
  private wss: WebSocketServer | null = null
  private readonly upstreamPort: number
  private readonly portRange: [number, number]
  port = 0

  constructor(upstreamPort: number, portRange: [number, number]) {
    this.upstreamPort = upstreamPort
    this.portRange = portRange
  }

  async start(): Promise<void> {
    this.port = await findFreePort(this.portRange)

    const server = http.createServer((req, res) => {
      void this.handleHttp(req, res)
    })

    const wss = new WebSocketServer({ noServer: true })
    server.on('upgrade', (req, socket, head) => {
      this.handleUpgrade(wss, req, socket, head)
    })

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(this.port, '127.0.0.1', () => {
        server.off('error', reject)
        resolve()
      })
    })

    this.server = server
    this.wss = wss
  }

  async stop(): Promise<void> {
    for (const client of this.wss?.clients ?? []) client.terminate()
    this.wss?.close()
    if (this.server) {
      await new Promise<void>((resolve) => this.server!.close(() => resolve()))
    }
    this.server = null
    this.wss = null
  }

  private handleHttp(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    return new Promise((resolve) => {
      const upstream = http.request(
        {
          host: '127.0.0.1',
          port: this.upstreamPort,
          method: req.method,
          path: req.url,
          headers: { ...req.headers, host: `127.0.0.1:${this.upstreamPort}` },
        },
        (upRes) => {
          res.writeHead(upRes.statusCode ?? 502, upRes.headers)
          upRes.pipe(res)
          upRes.on('end', resolve)
          upRes.on('error', () => res.end())
        },
      )
      upstream.on('error', () => {
        if (!res.headersSent) res.writeHead(502)
        res.end()
        resolve()
      })
      req.pipe(upstream)
      req.on('error', () => upstream.destroy())
    })
  }

  private handleUpgrade(
    wss: WebSocketServer,
    req: http.IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void {
    const upstream = new WebSocket(`ws://127.0.0.1:${this.upstreamPort}${req.url}`)
    let open = false

    upstream.on('open', () => {
      open = true
      wss.handleUpgrade(req, socket, head, (client) => {
        client.on('message', (data) => upstream.send(data))
        upstream.on('message', (data) => client.send(data))
        client.on('close', () => upstream.close())
        upstream.on('close', () => client.close())
      })
    })

    upstream.on('error', () => {
      if (!open) socket.destroy()
    })
  }
}

function findFreePort([start, end]: [number, number]): Promise<number> {
  return new Promise((resolve, reject) => {
    let port = start
    const tryNext = () => {
      if (port > end) return reject(new Error('no free preview ports'))
      const srv = net.createServer()
      srv.once('error', () => {
        port++
        tryNext()
      })
      srv.listen(port, '127.0.0.1', () => {
        srv.close(() => resolve(port))
      })
    }
    tryNext()
  })
}
