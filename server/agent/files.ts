import fs from 'node:fs'
import path from 'node:path'

export type FileNode = {
  name: string
  path: string
  type: 'file' | 'dir'
  size: number
  binary: boolean
  children?: FileNode[]
}

const EXCLUDED = new Set([
  'node_modules',
  '.git',
  'dist',
  '.vite',
  'build',
  '.next',
  '.nuxt',
  '.output',
])

const MAX_TEXT_FILE_BYTES = 200 * 1024

function isProbablyBinary(filePath: string): boolean {
  const fd = fs.openSync(filePath, 'r')
  const buf = Buffer.alloc(512)
  let read = 0
  try {
    read = fs.readSync(fd, buf, 0, 512, 0)
  } catch {
    return false
  } finally {
    fs.closeSync(fd)
  }
  for (let i = 0; i < read; i++) {
    if (buf[i] === 0) return true
  }
  return false
}

export function walkWorkspace(root: string): FileNode[] {
  const walk = (dir: string, rel: string): FileNode[] => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return []
    }
    const nodes: FileNode[] = []
    for (const entry of entries) {
      if (EXCLUDED.has(entry.name)) continue
      if (entry.name.startsWith('.') && entry.name !== '.env.example') continue
      const abs = path.join(dir, entry.name)
      const childRel = rel ? path.join(rel, entry.name) : entry.name
      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: childRel,
          type: 'dir',
          size: 0,
          binary: false,
          children: walk(abs, childRel),
        })
      } else if (entry.isFile()) {
        let size = 0
        try {
          size = fs.statSync(abs).size
        } catch {
          // ignore
        }
        const binary = size > MAX_TEXT_FILE_BYTES || isProbablyBinary(abs)
        nodes.push({ name: entry.name, path: childRel, type: 'file', size, binary })
      }
    }
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return nodes
  }
  return walk(root, '')
}
