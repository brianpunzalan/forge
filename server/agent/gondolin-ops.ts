import path from 'node:path'
import type {
  BashOperations,
  EditOperations,
  ReadOperations,
  WriteOperations,
} from '@earendil-works/pi-coding-agent'
import type { VM } from '@earendil-works/gondolin'

const GUEST_WORKSPACE = '/workspace'

function toGuestPath(localCwd: string, localPath: string): string {
  const rel = path.relative(localCwd, localPath)
  if (rel === '') return GUEST_WORKSPACE
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`path escapes workspace: ${localPath}`)
  }
  return path.posix.join(GUEST_WORKSPACE, rel.split(path.sep).join(path.posix.sep))
}

function sniffImageMimeType(buf: Buffer): string | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png'
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg'
  }
  if (buf.length >= 6 && buf.subarray(0, 6).toString('ascii') === 'GIF87a') return 'image/gif'
  if (buf.length >= 6 && buf.subarray(0, 6).toString('ascii') === 'GIF89a') return 'image/gif'
  if (buf.length >= 12 && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  return null
}

function sanitizeEnv(env?: NodeJS.ProcessEnv): Record<string, string> | undefined {
  if (!env) return undefined
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') out[key] = value
  }
  return out
}

export function createReadOps(vm: VM, localCwd: string): ReadOperations {
  return {
    readFile: async (absolutePath) => {
      const guestPath = toGuestPath(localCwd, absolutePath)
      return vm.fs.readFile(guestPath)
    },
    access: async (absolutePath) => {
      const guestPath = toGuestPath(localCwd, absolutePath)
      await vm.fs.access(guestPath)
    },
    detectImageMimeType: async (absolutePath) => {
      const guestPath = toGuestPath(localCwd, absolutePath)
      const head = await vm.fs.readFile(guestPath).catch(() => Buffer.alloc(0))
      return sniffImageMimeType(head)
    },
  }
}

export function createWriteOps(vm: VM, localCwd: string): WriteOperations {
  return {
    writeFile: async (absolutePath, content) => {
      const guestPath = toGuestPath(localCwd, absolutePath)
      await vm.fs.writeFile(guestPath, content)
    },
    mkdir: async (dir) => {
      const guestDir = toGuestPath(localCwd, dir)
      await vm.fs.mkdir(guestDir, { recursive: true })
    },
  }
}

export function createEditOps(vm: VM, localCwd: string): EditOperations {
  const read = createReadOps(vm, localCwd)
  const write = createWriteOps(vm, localCwd)
  return {
    readFile: read.readFile,
    access: read.access,
    writeFile: write.writeFile,
  }
}

export function createBashOps(vm: VM, localCwd: string): BashOperations {
  return {
    exec: async (command, cwd, { onData, signal, timeout, env }) => {
      const guestCwd = toGuestPath(localCwd, cwd)

      const ac = new AbortController()
      const onAbort = () => ac.abort()
      signal?.addEventListener('abort', onAbort, { once: true })

      let timedOut = false
      const timer =
        timeout && timeout > 0
          ? setTimeout(() => {
              timedOut = true
              ac.abort()
            }, timeout * 1000)
          : undefined

      try {
        const proc = vm.exec(['/bin/bash', '-lc', command], {
          cwd: guestCwd,
          stdout: 'pipe',
          stderr: 'pipe',
          signal: ac.signal,
          env: sanitizeEnv(env),
        })
        for await (const chunk of proc.output()) {
          onData(chunk.data)
        }
        const result = await proc
        return { exitCode: result.exitCode }
      } catch (err) {
        if (signal?.aborted) throw new Error('aborted')
        if (timedOut) throw new Error(`timeout:${timeout}`)
        throw err
      } finally {
        if (timer) clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
      }
    },
  }
}
