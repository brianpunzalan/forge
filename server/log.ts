import fs from 'node:fs'
import path from 'node:path'

type Level = 'info' | 'warn' | 'error'

export type Logger = {
  info(message: string, data?: Record<string, unknown>): void
  warn(message: string, data?: Record<string, unknown>): void
  error(message: string, data?: Record<string, unknown>): void
  child(prefix: string): Logger
}

const LOG_FILE = process.env.FORGE_LOG_FILE ?? path.join(process.cwd(), '.forge', 'server.log')

function emit(level: Level, prefix: string, message: string, data?: Record<string, unknown>): void {
  const suffix = data && Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : ''
  const line = `[${new Date().toISOString()}] [forge]${prefix} ${message}${suffix}`
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true })
    fs.appendFileSync(LOG_FILE, line + '\n')
  } catch {
    // ignore logging failures
  }
}

export function createLogger(prefix = ''): Logger {
  return {
    info: (message, data) => emit('info', prefix, message, data),
    warn: (message, data) => emit('warn', prefix, message, data),
    error: (message, data) => emit('error', prefix, message, data),
    child: (childPrefix) => createLogger(prefix + childPrefix),
  }
}

export const log = createLogger()
