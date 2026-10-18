import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type AgentSessionEvent,
  type ModelRuntime,
} from '@earendil-works/pi-coding-agent'
import { createHttpHooks, RealFSProvider, VM } from '@earendil-works/gondolin'
import { config } from '../config.ts'
import { log, type Logger } from '../log.ts'
import type { SessionRecord, SessionStatus, SessionStore } from '../store/types.ts'
import { isAuthoritativeEvent, sanitizeEvent, type WireEvent } from './events.ts'
import { createSandboxExtension } from './extension.ts'
import { PreviewProxy } from './preview-proxy.ts'
import { walkWorkspace, type FileNode } from './files.ts'

export type Subscriber = {
  push(event: WireEvent): void
  close(): void
}

type Deps = {
  id: string
  store: SessionStore
  modelRuntime: ModelRuntime
  model?: unknown
  thinkingLevel?: unknown
  title?: string | null
  messageCount?: number
}

const GUEST_WORKSPACE = '/workspace'
const MAX_IN_MEMORY_EVENTS = 10_000

export class ForgeSession {
  readonly id: string
  readonly workspaceDir: string
  readonly title: string | null
  messageCount: number

  status: SessionStatus = 'creating'
  previewUrl: string | null = null
  sessionFile: string | null = null

  private readonly store: SessionStore
  private readonly modelRuntime: ModelRuntime
  private readonly model: unknown
  private readonly thinkingLevel: unknown
  private readonly sessionDir: string
  private readonly agentDir: string
  private readonly log: Logger

  private vm: VM | null = null
  private vmStarting: Promise<void> | null = null
  private provisioned = false
  private respawnRetries: number

  private agentSession: AgentSession | null = null
  private unsubscribe: (() => void) | null = null

  private seq = 0
  private events: WireEvent[] = []
  private subscribers = new Set<Subscriber>()

  private gatewayPort = 0
  private proxy: PreviewProxy | null = null
  private devPid: number | null = null
  private previewStarting = false
  private previewRetries = 0
  private watcher: fs.FSWatcher | null = null

  private lastActiveAt = Date.now()
  private disposed = false

  private constructor(deps: Deps, workspaceDir: string) {
    this.id = deps.id
    this.workspaceDir = workspaceDir
    this.title = deps.title ?? null
    this.messageCount = deps.messageCount ?? 0
    this.store = deps.store
    this.modelRuntime = deps.modelRuntime
    this.model = deps.model
    this.thinkingLevel = deps.thinkingLevel
    this.sessionDir = config.sessionDir
    this.agentDir = config.agentDir
    this.respawnRetries = config.vmRespawnRetries
    this.log = log.child(` [session ${this.id}]`)
  }

  static async create(deps: Deps): Promise<ForgeSession> {
    const workspaceDir = path.join(config.dataDir, 'workspaces', deps.id)
    await fsp.mkdir(workspaceDir, { recursive: true })
    const session = new ForgeSession(deps, workspaceDir)
    await session.init('create')
    return session
  }

  static async resume(deps: Deps, record: SessionRecord): Promise<ForgeSession> {
    const session = new ForgeSession(
      { ...deps, messageCount: record.messageCount },
      record.workspaceDir,
    )
    await session.init('resume', record.sessionFile ?? undefined)
    return session
  }

  private async init(mode: 'create' | 'resume', sessionFile?: string): Promise<void> {
    this.status = mode === 'create' ? 'creating' : 'resuming'
    this.log.info(mode === 'create' ? 'creating session' : 'resuming session', {
      workspaceDir: this.workspaceDir,
    })

    if (mode === 'create') {
      await this.store.createSession({
        id: this.id,
        title: this.title,
        workspaceDir: this.workspaceDir,
        sessionFile: null,
        status: this.status,
        model: null,
        lastSeq: 0,
        messageCount: 0,
        previewUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    } else {
      await this.store.updateSession(this.id, {
        status: 'resuming',
        workspaceDir: this.workspaceDir,
      })
    }

    // VM is created lazily on first tool use / preview start.
    await this.createAgentSession(mode, sessionFile)
    this.startWatcher()

    this.status = 'idle'
    await this.store.updateSession(this.id, { status: 'idle', sessionFile: this.sessionFile })

    if (mode === 'resume') {
      // Deterministic preview restart — the user must not re-prompt.
      void this.startPreview()
    }
  }

  private async createVm(): Promise<VM> {
    this.log.info('creating sandbox VM')
    const hooks = createHttpHooks({
      allowedHosts: ['registry.npmjs.org', 'dl-cdn.alpinelinux.org'],
    })
    // NOTE: gondolin 0.13's `autoStart: false` + manual `vm.start()` is broken
    // (throws "sandbox is stopped"). Laziness is instead achieved by deferring
    // `createVm()` itself until the first tool use / preview start.
    const vm = await VM.create({
      sessionLabel: `forge-${this.id}`,
      httpHooks: hooks.httpHooks,
      dns: { mode: 'synthetic' },
      vfs: { mounts: { [GUEST_WORKSPACE]: new RealFSProvider(this.workspaceDir) } },
      memory: '1G',
      // On macOS the QEMU/HVF backend idle-pauses the VM by default; resuming
      // then re-syncs the guest clock and can fail with "guest time sync timed
      // out". Disable the idle pause so long tool runs (npm install) are stable.
      sandbox: { qemuIdlePauseMs: 0 },
    })
    this.log.info('sandbox VM created', { vmId: vm.id })
    return vm
  }

  private async createAgentSession(mode: 'create' | 'resume', sessionFile?: string): Promise<void> {
    const loader = new DefaultResourceLoader({
      cwd: this.workspaceDir,
      agentDir: this.agentDir,
      extensionFactories: [
        createSandboxExtension({
          getVm: () => this.getVm(),
          cwd: this.workspaceDir,
          onVmFailure: () => void this.onVmFailure(),
        }),
      ],
    })
    await loader.reload()

    const sessionManager =
      mode === 'resume' && sessionFile
        ? SessionManager.open(sessionFile, this.sessionDir, this.workspaceDir)
        : SessionManager.create(this.workspaceDir, this.sessionDir, { id: this.id })

    const { session } = await createAgentSession({
      cwd: this.workspaceDir,
      agentDir: this.agentDir,
      modelRuntime: this.modelRuntime,
      model: this.model as never,
      thinkingLevel: this.thinkingLevel as never,
      sessionManager,
      settingsManager: SettingsManager.inMemory(),
      tools: ['read', 'bash', 'edit', 'write'],
      resourceLoader: loader,
    })

    this.agentSession = session
    this.sessionFile = session.sessionFile ?? sessionManager.getSessionFile() ?? null
    this.unsubscribe = session.subscribe((event) => this.handleAgentEvent(event))
  }

  private async getVm(): Promise<VM> {
    if (!this.vm) this.vm = await this.createVm()
    return this.vm
  }

  async ensureVmStarted(): Promise<void> {
    if (this.vmStarting) return this.vmStarting
    const run = async () => {
      // getVm() lazily creates + boots the VM (autoStart defaults to true).
      this.log.info('booting sandbox VM')
      await this.getVm()
      await this.provisionGuest()
      this.log.info('sandbox VM ready')
    }
    this.vmStarting = run()
    try {
      await this.vmStarting
    } finally {
      this.vmStarting = null
    }
  }

  private async provisionGuest(): Promise<void> {
    if (this.provisioned) return
    try {
      const vm = await this.getVm()
      const has = (cmd: string) =>
        vm.exec(`command -v ${cmd} || echo missing`).then((r) => r.stdout.trim() !== 'missing')

      // The base image already ships node + npm. Only install them if missing.
      if (!(await has('node')) || !(await has('npm'))) {
        this.log.info('provisioning: apk add nodejs npm')
        this.emitControl('provisioning', { step: 'apk add nodejs npm' })
        await vm.exec('apk add --no-cache nodejs npm', {
          signal: AbortSignal.timeout(config.provisionTimeoutMs),
        })
      }
      this.provisioned = true
      this.log.info('sandbox provisioned')
      this.emitControl('provisioned', {})
    } catch (err) {
      // Best-effort: node/npm may still be usable. Never block the preview on
      // provisioning failures (e.g. a slow global-install step).
      this.log.error('provision failed (non-fatal)', { error: String(err) })
      this.emitControl('provision_error', { message: String(err) })
      this.provisioned = true
    }
  }

  async prompt(message: string, streamingBehavior?: 'steer' | 'followUp'): Promise<void> {
    if (!this.agentSession) throw new Error('session not ready')
    this.lastActiveAt = Date.now()
    this.log.info('prompt', {
      behavior: streamingBehavior ?? 'direct',
      message: message.slice(0, 120),
    })
    await this.agentSession.prompt(message, streamingBehavior ? { streamingBehavior } : {})
    if (!this.sessionFile && this.agentSession.sessionFile) {
      this.sessionFile = this.agentSession.sessionFile
      await this.store.updateSession(this.id, { sessionFile: this.sessionFile })
    }
  }

  async abort(): Promise<void> {
    const session = this.agentSession
    if (!session) return
    session.clearQueue()
    await session.abort()
  }

  isStreaming(): boolean {
    return this.agentSession?.isStreaming ?? false
  }

  async subscribe(subscriber: Subscriber, afterSeq: number): Promise<() => void> {
    // Replay the authoritative gap that has fallen out of the in-memory buffer
    // (or the whole history when the buffer is empty, e.g. a resumed session).
    const oldestInMemory = this.events[0]?.seq
    if (oldestInMemory === undefined || afterSeq < oldestInMemory) {
      const stored = await this.store.getEvents(this.id, afterSeq)
      for (const e of stored) {
        if (oldestInMemory === undefined || e.seq < oldestInMemory) {
          subscriber.push({ seq: e.seq, kind: 'agent', event: e.payload as AgentSessionEvent })
        }
      }
    }
    for (const ev of this.events) {
      if (ev.seq > afterSeq) subscriber.push(ev)
    }
    this.subscribers.add(subscriber)
    this.lastActiveAt = Date.now()
    this.log.info('sse subscriber attached', { afterSeq, subscribers: this.subscribers.size })
    return () => {
      this.subscribers.delete(subscriber)
    }
  }

  private handleAgentEvent(raw: AgentSessionEvent): void {
    const event = sanitizeEvent(raw)
    this.seq++
    this.push({ seq: this.seq, kind: 'agent', event })

    if (isAuthoritativeEvent(event)) {
      void this.store.appendEvent(this.id, { seq: this.seq, type: event.type, payload: event })
    }

    if (event.type === 'tool_execution_start') {
      this.log.info('tool start', { tool: event.toolName })
    } else if (event.type === 'tool_execution_end') {
      this.log.info('tool end', {
        tool: event.toolName,
        isError: event.isError,
        durationMs: event.durationMs,
      })
    } else if (event.type === 'message_end' && event.message?.role === 'assistant') {
      this.messageCount++
      void this.store.updateSession(this.id, { messageCount: this.messageCount })
    }

    if (event.type === 'agent_start') {
      this.log.info('agent started (streaming)')
      this.status = 'running'
      void this.store.updateSession(this.id, { status: 'running' })
    } else if (event.type === 'agent_settled') {
      this.log.info('agent settled (idle)')
      this.status = 'idle'
      this.respawnRetries = config.vmRespawnRetries
      void this.store.updateSession(this.id, { status: 'idle', lastSeq: this.seq })
      void this.startPreview()
    } else if (event.type === 'tool_execution_end' && event.isError) {
      const details = String((event.result as { details?: unknown } | undefined)?.details ?? '')
      if (/(closed|disconnect|eof|aborted|not connected|connection|transport)/i.test(details)) {
        void this.onVmFailure()
      }
    }
  }

  emitControl(type: string, data?: unknown): void {
    this.seq++
    this.push({ seq: this.seq, kind: 'control', type, data })
  }

  private push(event: WireEvent): void {
    this.events.push(event)
    if (this.events.length > MAX_IN_MEMORY_EVENTS) {
      this.events.splice(0, this.events.length - MAX_IN_MEMORY_EVENTS)
    }
    for (const subscriber of this.subscribers) subscriber.push(event)
    this.lastActiveAt = Date.now()
  }

  async startPreview(): Promise<void> {
    if (this.previewStarting || this.disposed || this.previewUrl) return
    this.previewStarting = true
    try {
      // Cheap host-side check first: don't boot the VM just to discover there
      // is nothing to preview (e.g. the agent answered with text only).
      const hasNodeModules = fs.existsSync(path.join(this.workspaceDir, 'node_modules'))
      const pkg = readPackageJson(this.workspaceDir)
      this.log.info('preview check', { hasNodeModules, hasDevScript: Boolean(pkg?.scripts?.dev) })
      if (!hasNodeModules || !pkg?.scripts?.dev) {
        const reason = !hasNodeModules ? 'node_modules missing' : 'no dev script'
        this.log.info('preview unavailable', { reason })
        this.emitControl('preview_unavailable', { reason })
        return
      }
      await this.ensureVmStarted()

      const vm = await this.getVm()
      vm.setIngressRoutes([{ prefix: '/', port: config.guestDevPort, stripPrefix: false }])
      const ingress = await vm.enableIngress({
        listenHost: '127.0.0.1',
        listenPort: 0,
        allowWebSockets: true,
      })
      this.gatewayPort = ingress.port

      const pm = detectPackageManager(this.workspaceDir)
      const devArgs = `--host 0.0.0.0 --port ${config.guestDevPort}`
      const devCmd = pm === 'npm' ? `npm run dev -- ${devArgs}` : `${pm} run dev ${devArgs}`
      this.log.info('starting dev server', { pm, devCmd })
      const started = await vm.exec(
        `cd ${GUEST_WORKSPACE} && nohup ${devCmd} > /tmp/forge-dev.log 2>&1 & echo $!`,
      )
      this.devPid = Number(started.stdout.trim()) || null

      await this.pollDevServer(vm)

      const proxy = new PreviewProxy(this.gatewayPort, [
        config.previewPortStart,
        config.previewPortEnd,
      ])
      await proxy.start()
      this.proxy = proxy
      this.previewUrl = `http://localhost:${proxy.port}`
      await this.store.updateSession(this.id, { previewUrl: this.previewUrl })
      this.previewRetries = 0
      this.log.info('preview ready', { url: this.previewUrl })
      this.emitControl('preview_ready', { url: this.previewUrl })
    } catch (err) {
      this.log.error('preview failed', { error: String(err) })
      this.emitControl('preview_error', { message: String(err) })
      if (this.previewRetries < 3) {
        this.previewRetries++
        const delay = 4000
        this.log.info('scheduling preview retry', { attempt: this.previewRetries, delay })
        setTimeout(() => {
          if (!this.disposed) void this.startPreview()
        }, delay)
      }
    } finally {
      this.previewStarting = false
    }
  }

  private async pollDevServer(vm: VM): Promise<void> {
    const deadline = Date.now() + config.devServerTimeoutMs
    while (Date.now() < deadline) {
      const res = await vm.exec(`curl -sf http://127.0.0.1:${config.guestDevPort}/`).catch(() => null)
      if (res && res.ok) return
      await new Promise((r) => setTimeout(r, 500))
    }
    throw new Error('dev server did not become ready in time')
  }

  private async stopPreview(): Promise<void> {
    if (this.proxy) {
      await this.proxy.stop().catch(() => {})
      this.proxy = null
    }
    if (this.devPid && this.vm) {
      await this.vm.exec(`kill ${this.devPid} 2>/dev/null || true`).catch(() => {})
      this.devPid = null
    }
    if (this.previewUrl) {
      this.previewUrl = null
      await this.store.updateSession(this.id, { previewUrl: null })
      this.emitControl('preview_stopped', {})
    }
  }

  private async onVmFailure(): Promise<void> {
    if (this.disposed) return
    if (this.respawnRetries > 0) {
      this.respawnRetries--
      this.emitControl('vm_respawn', { retriesLeft: this.respawnRetries })
      try {
        await this.respawnVm()
        await this.ensureVmStarted()
      } catch (err) {
        this.emitControl('vm_respawn_failed', { message: String(err) })
        await this.degrade()
      }
    } else {
      await this.degrade()
    }
  }

  private async respawnVm(): Promise<void> {
    this.log.info('respawn VM')
    const old = this.vm
    this.vm = await this.createVm()
    this.provisioned = false
    if (old) await old.close().catch(() => {})
    this.emitControl('vm_respawned', {})
  }

  private async degrade(): Promise<void> {
    this.log.error('session degraded')
    this.status = 'degraded'
    await this.store.updateSession(this.id, { status: 'degraded' })
    this.emitControl('session_degraded', {})
  }

  private startWatcher(): void {
    let timer: NodeJS.Timeout | null = null
    try {
      this.watcher = fs.watch(this.workspaceDir, { recursive: true }, () => {
        if (timer) return
        timer = setTimeout(() => {
          timer = null
          this.emitControl('files_changed', {})
        }, 300)
      })
    } catch {
      this.watcher = null
    }
  }

  listFiles(): FileNode[] {
    return walkWorkspace(this.workspaceDir)
  }

  touch(): void {
    this.lastActiveAt = Date.now()
  }

  isIdle(timestamp = Date.now()): boolean {
    return timestamp - this.lastActiveAt > config.idleTtlMs
  }

  async teardown(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.log.info('teardown start')
    this.status = 'stopping'
    await this.store.updateSession(this.id, { status: 'stopping' })
    this.emitControl('session_stopping', {})

    this.unsubscribe?.()
    this.unsubscribe = null
    try {
      this.agentSession?.dispose()
    } catch {
      // ignore
    }
    this.agentSession = null

    await this.stopPreview()
    if (this.vm) {
      await this.vm.close().catch(() => {})
      this.vm = null
    }
    this.watcher?.close()
    this.watcher = null

    this.status = 'stopped'
    await this.store.updateSession(this.id, { status: 'stopped' })
    this.log.info('teardown complete (stopped)')
    this.emitControl('session_stopped', {})

    for (const subscriber of this.subscribers) subscriber.close()
    this.subscribers.clear()
  }
}

function readPackageJson(dir: string): { scripts?: Record<string, string> } | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }
  } catch {
    return null
  }
}

function detectPackageManager(dir: string): 'pnpm' | 'npm' | 'yarn' {
  if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) return 'pnpm'
  if (fs.existsSync(path.join(dir, 'yarn.lock'))) return 'yarn'
  return 'npm'
}
