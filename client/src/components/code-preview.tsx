import * as React from 'react'
import {
  CaretRightIcon,
  FileCodeIcon,
  FileCssIcon,
  FileHtmlIcon,
  FileMdIcon,
  FileTextIcon,
  FileTsIcon,
  FileTsxIcon,
  FolderIcon,
  FolderOpenIcon,
  FoldersIcon,
} from '@phosphor-icons/react'
import { Highlight, themes } from 'prism-react-renderer'
import { cn } from 'cn'

type FileNode = {
  name: string
  path: string
  language?: string
  code?: string
  children?: FileNode[]
}

const fileTree: FileNode[] = [
  {
    name: 'src',
    path: 'src',
    children: [
      {
        name: 'App.tsx',
        path: 'src/App.tsx',
        language: 'tsx',
        code: `import { StatsCard } from './components/StatsCard'
import { RevenueChart } from './components/RevenueChart'
import { RecentOrders } from './components/RecentOrders'

const stats = [
  { label: 'Revenue', value: '$48,120', delta: '+12.4%' },
  { label: 'Customers', value: '2,340', delta: '+5.1%' },
  { label: 'Orders', value: '1,204', delta: '-1.8%' },
  { label: 'Conversion', value: '3.6%', delta: '+0.4%' },
]

export default function App() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-500">
          Welcome back. Here's what's happening today.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatsCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-5">
        <RevenueChart className="lg:col-span-3" />
        <RecentOrders className="lg:col-span-2" />
      </section>
    </main>
  )
}
`,
      },
      {
        name: 'main.tsx',
        path: 'src/main.tsx',
        language: 'tsx',
        code: `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element not found')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
`,
      },
      {
        name: 'index.css',
        path: 'src/index.css',
        language: 'css',
        code: `@import 'tailwindcss';

:root {
  color-scheme: light;
}

body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
`,
      },
      {
        name: 'components',
        path: 'src/components',
        children: [
          {
            name: 'StatsCard.tsx',
            path: 'src/components/StatsCard.tsx',
            language: 'tsx',
            code: `import { ArrowUpRight } from '@phosphor-icons/react'

type StatsCardProps = {
  label: string
  value: string
  delta: string
}

export function StatsCard({ label, value, delta }: StatsCardProps) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
        <ArrowUpRight className="size-3" />
        {delta}
      </p>
    </div>
  )
}
`,
          },
          {
            name: 'RevenueChart.tsx',
            path: 'src/components/RevenueChart.tsx',
            language: 'tsx',
            code: `const data = [
  { month: 'Jan', value: 38 },
  { month: 'Feb', value: 52 },
  { month: 'Mar', value: 44 },
  { month: 'Apr', value: 66 },
  { month: 'May', value: 58 },
  { month: 'Jun', value: 82 },
  { month: 'Jul', value: 74 },
]

const max = Math.max(...data.map((point) => point.value))

export function RevenueChart({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-slate-900">Revenue</p>
        <div className="mt-4 flex h-40 items-end gap-2">
          {data.map((point) => (
            <div
              key={point.month}
              className="flex flex-1 flex-col items-center gap-2"
            >
              <div
                className="w-full rounded-t-md bg-violet-500"
                style={{ height: \`\${(point.value / max) * 100}%\` }}
              />
              <span className="text-[10px] text-slate-400">
                {point.month}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
`,
          },
          {
            name: 'RecentOrders.tsx',
            path: 'src/components/RecentOrders.tsx',
            language: 'tsx',
            code: `const orders = [
  { id: '#3210', customer: 'Olivia Martin', amount: '$1,999', status: 'Paid' },
  { id: '#3209', customer: 'Jackson Lee', amount: '$39.00', status: 'Paid' },
  { id: '#3208', customer: 'Isabella Nguyen', amount: '$299.00', status: 'Pending' },
  { id: '#3207', customer: 'William Kim', amount: '$99.00', status: 'Paid' },
]

export function RecentOrders({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-slate-900">Recent orders</p>
        <ul className="mt-4 space-y-3">
          {orders.map((order) => (
            <li key={order.id} className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                {order.customer.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-900">
                  {order.customer}
                </p>
                <p className="text-[11px] text-slate-500">{order.id}</p>
              </div>
              <span className="text-xs font-medium text-slate-900">
                {order.amount}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
`,
          },
        ],
      },
    ],
  },
  {
    name: 'package.json',
    path: 'package.json',
    language: 'json',
    code: `{
  "name": "pulse",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@phosphor-icons/react": "^2.1.10",
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^6.1.0",
    "tailwindcss": "^4.3.3",
    "typescript": "~6.0.2",
    "vite": "^8.2.2"
  }
}
`,
  },
  {
    name: 'vite.config.ts',
    path: 'vite.config.ts',
    language: 'typescript',
    code: `import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
`,
  },
  {
    name: 'README.md',
    path: 'README.md',
    language: 'markdown',
    code: `# Pulse

A modern analytics dashboard built with React, TypeScript and Tailwind CSS.

## Getting started

    pnpm install
    pnpm dev

## Features

- Revenue, customers, orders and conversion metrics
- Monthly revenue chart
- Recent orders table
`,
  },
]

function flatten(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap((node) =>
    node.children ? flatten(node.children) : [node],
  )
}

const allFiles = flatten(fileTree)

function FileGlyph({ name, className }: { name: string; className?: string }) {
  if (name.endsWith('.tsx')) return <FileTsxIcon className={className} />
  if (name.endsWith('.ts')) return <FileTsIcon className={className} />
  if (name.endsWith('.css')) return <FileCssIcon className={className} />
  if (name.endsWith('.html')) return <FileHtmlIcon className={className} />
  if (name.endsWith('.md')) return <FileMdIcon className={className} />
  if (name.endsWith('.json')) return <FileCodeIcon className={className} />
  return <FileTextIcon className={className} />
}

function TreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
  expanded,
  onToggle,
}: {
  node: FileNode
  depth: number
  selectedPath: string
  onSelect: (path: string) => void
  expanded: Record<string, boolean>
  onToggle: (path: string) => void
}) {
  const paddingLeft = 8 + depth * 12

  if (node.children) {
    const isOpen = expanded[node.path] ?? false
    return (
      <div>
        <button
          type="button"
          onClick={() => onToggle(node.path)}
          className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          style={{ paddingLeft }}
        >
          <CaretRightIcon
            className={cn(
              'size-3 shrink-0 transition-transform',
              isOpen && 'rotate-90',
            )}
          />
          {isOpen ? (
            <FolderOpenIcon className="size-3.5 shrink-0 text-primary/70" />
          ) : (
            <FolderIcon className="size-3.5 shrink-0 text-primary/70" />
          )}
          <span className="truncate font-medium">{node.name}</span>
        </button>
        {isOpen &&
          node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
      </div>
    )
  }

  const isActive = selectedPath === node.path

  return (
    <button
      type="button"
      onClick={() => onSelect(node.path)}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        isActive && 'bg-muted font-medium text-foreground',
      )}
      style={{ paddingLeft }}
    >
      <span className="size-3 shrink-0" />
      <FileGlyph
        name={node.name}
        className={cn(
          'size-3.5 shrink-0',
          isActive ? 'text-primary' : 'text-muted-foreground',
        )}
      />
      <span className="truncate">{node.name}</span>
    </button>
  )
}

export function CodePreview() {
  const [selectedPath, setSelectedPath] = React.useState('src/App.tsx')
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({
    src: true,
    'src/components': true,
  })

  const selectedFile =
    allFiles.find((file) => file.path === selectedPath) ?? allFiles[0]

  const toggleFolder = (path: string) =>
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }))

  return (
    <div className="flex h-full min-h-0 bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-muted/20 md:flex">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3 text-xs font-medium text-muted-foreground">
          <FoldersIcon className="size-4" />
          Explorer
        </div>
        <div className="flex-1 overflow-auto p-2">
          {fileTree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              selectedPath={selectedPath}
              onSelect={setSelectedPath}
              expanded={expanded}
              onToggle={toggleFolder}
            />
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b bg-muted/20 px-3">
          <FileGlyph
            name={selectedFile.name}
            className="size-3.5 shrink-0 text-primary"
          />
          <span className="text-xs font-medium">{selectedFile.name}</span>
          <span className="hidden truncate text-xs text-muted-foreground sm:inline">
            {selectedFile.path}
          </span>
          <span className="ml-auto rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            Read-only
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <Highlight
            theme={themes.oneLight}
            code={selectedFile.code ?? ''}
            language={selectedFile.language ?? 'text'}
          >
            {({ style, tokens, getLineProps, getTokenProps }) => (
              <pre
                className="min-w-max p-4 text-xs leading-relaxed"
                style={{ ...style, background: 'transparent' }}
              >
                {tokens.map((line, index) => {
                  const lineProps = getLineProps({ line })
                  return (
                    <div
                      key={index}
                      {...lineProps}
                      className={cn('flex', lineProps.className)}
                    >
                      <span className="w-10 shrink-0 select-none pr-4 text-right text-muted-foreground/50">
                        {index + 1}
                      </span>
                      <span className="whitespace-pre">
                        {line.map((token, key) => (
                          <span key={key} {...getTokenProps({ token })} />
                        ))}
                      </span>
                    </div>
                  )
                })}
              </pre>
            )}
          </Highlight>
        </div>
      </div>
    </div>
  )
}
