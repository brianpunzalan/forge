import path from 'node:path'
import os from 'node:os'

const env = process.env

export const config = {
  /** HTTP port for the Fastify control plane. */
  port: Number(env.PORT ?? 3000),
  /** Directory where Forge keeps per-session workspaces and state. */
  dataDir: path.resolve(env.FORGE_DATA_DIR ?? path.join(process.cwd(), '.forge')),
  /** Directory where Pi stores its session JSONL files. */
  sessionDir: path.resolve(
    env.FORGE_SESSION_DIR ?? path.join(process.cwd(), '.forge', 'sessions'),
  ),
  /** Pi global config dir (auth.json / models.json live here). */
  agentDir: env.PI_AGENT_DIR ?? path.join(os.homedir(), '.pi', 'agent'),
  /** Postgres connection string. Empty = in-memory store (no durability). */
  databaseUrl: env.DATABASE_URL ?? '',
  /** Model reference in `<provider>/<model>` form (e.g. deepseek/deepseek-v4-flash). */
  model: env.FORGE_MODEL ?? '',
  /** Shared token protecting the chat API. Set via FORGE_AUTH_TOKEN. */
  authToken: env.FORGE_AUTH_TOKEN ?? '',
  /** Cookie name for the auth token. */
  authCookieName: env.FORGE_AUTH_COOKIE ?? 'forge_token',
  /** Idle time before a live session is torn down. */
  idleTtlMs: Number(env.FORGE_IDLE_TTL_MS ?? 15 * 60_000),
  /** Max concurrent live sessions. */
  maxLiveSessions: Number(env.FORGE_MAX_SESSIONS ?? 10),
  /** Port range used for per-session preview proxies. */
  previewPortStart: Number(env.FORGE_PREVIEW_PORT_START ?? 4100),
  previewPortEnd: Number(env.FORGE_PREVIEW_PORT_END ?? 4500),
  /** Vite dev server port inside the guest. */
  guestDevPort: Number(env.FORGE_GUEST_DEV_PORT ?? 5173),
  /** How long to wait for the dev server to become ready. */
  devServerTimeoutMs: Number(env.FORGE_DEV_SERVER_TIMEOUT_MS ?? 60_000),
  /** Per-step timeout for guest provisioning (apk/npm) so it can't hang forever. */
  provisionTimeoutMs: Number(env.FORGE_PROVISION_TIMEOUT_MS ?? 180_000),
  /** VM crash respawn retry budget. */
  vmRespawnRetries: Number(env.FORGE_VM_RESPAWN_RETRIES ?? 2),
}

export type Config = typeof config
