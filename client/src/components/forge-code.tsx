import * as React from 'react'
import {
  CaretRightIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
} from '@phosphor-icons/react'
import { cn } from 'cn'
import type { FileNode } from '#/lib/forge-api'

type FileContent = {
  path: string
  content: string
  binary: boolean
  truncated: boolean
}

type Props = {
  files: FileNode[]
  readFile: (path: string) => Promise<FileContent | null>
}

export function ForgeCode({ files, readFile }: Props) {
  const [selected, setSelected] = React.useState<string | null>(null)
  const [content, setContent] = React.useState<FileContent | null>(null)
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})

  React.useEffect(() => {
    if (!selected) return
    let alive = true
    void readFile(selected).then((c) => {
      if (alive && c) setContent(c)
    })
    return () => {
      alive = false
    }
  }, [selected, readFile])

  const toggle = (path: string) => setExpanded((prev) => ({ ...prev, [path]: !prev[path] }))

  return (
    <div className="flex h-full min-h-0 bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-muted/20 md:flex">
        <div className="flex h-10 items-center gap-2 border-b px-3 text-xs font-medium text-muted-foreground">
          <FolderIcon className="size-4" />
          Explorer
          <span className="ml-auto rounded-full border px-2 py-0.5 text-[10px]">Read-only</span>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {files.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              selected={selected}
              expanded={expanded}
              onSelect={setSelected}
              onToggle={toggle}
            />
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-10 items-center gap-2 border-b bg-muted/20 px-3 text-xs">
          <FileTextIcon className="size-3.5 text-primary" />
          <span className="truncate font-medium">{content?.path ?? 'select a file'}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {content ? (
            <pre className="p-4 text-xs leading-relaxed">
              {content.content || (content.truncated ? '(file too large)' : '(empty)')}
            </pre>
          ) : (
            <p className="p-4 text-xs text-muted-foreground">No file selected.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function TreeNode({
  node,
  depth,
  selected,
  expanded,
  onSelect,
  onToggle,
}: {
  node: FileNode
  depth: number
  selected: string | null
  expanded: Record<string, boolean>
  onSelect: (path: string) => void
  onToggle: (path: string) => void
}) {
  const paddingLeft = 8 + depth * 12

  if (node.type === 'dir') {
    const open = expanded[node.path] ?? depth < 1
    return (
      <div>
        <button
          type="button"
          onClick={() => onToggle(node.path)}
          className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          style={{ paddingLeft }}
        >
          <CaretRightIcon className={cn('size-3 shrink-0 transition-transform', open && 'rotate-90')} />
          {open ? (
            <FolderOpenIcon className="size-3.5 shrink-0 text-primary/70" />
          ) : (
            <FolderIcon className="size-3.5 shrink-0 text-primary/70" />
          )}
          <span className="truncate font-medium">{node.name}</span>
        </button>
        {open &&
          node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selected={selected}
              expanded={expanded}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
      </div>
    )
  }

  const active = selected === node.path
  return (
    <button
      type="button"
      onClick={() => onSelect(node.path)}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground',
        active && 'bg-muted font-medium text-foreground',
      )}
      style={{ paddingLeft: paddingLeft + 12 }}
    >
      <FileTextIcon className={cn('size-3.5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
      <span className="truncate">{node.name}</span>
    </button>
  )
}
