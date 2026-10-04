import * as React from 'react'
import {
  ArrowSquareOutIcon,
  CodeIcon,
  DeviceMobileIcon,
  EyeIcon,
  MonitorIcon,
} from '@phosphor-icons/react'
import { cn } from 'cn'
import { AppPreview } from '#/components/app-preview'
import { AppSidebar } from '#/components/app-sidebar'
import { CodePreview } from '#/components/code-preview'
import { MobileSidebarTrigger } from '#/components/mobile-sidebar-trigger'
import { Button } from '#/components/ui/button'
import { SidebarInset, SidebarProvider } from '#/components/ui/sidebar'

export default function Page({ prompt }: { prompt?: string }) {
  const [view, setView] = React.useState<'preview' | 'code'>('preview')
  const [device, setDevice] = React.useState<'desktop' | 'mobile'>('desktop')

  return (
    <SidebarProvider
      style={{ '--sidebar-width': '20rem' } as React.CSSProperties}
    >
      <AppSidebar key={prompt} prompt={prompt} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-sm">
          <MobileSidebarTrigger className="-ml-1 md:hidden" />
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">
              {view === 'code' ? 'Code' : 'Preview'}
            </span>
            {view === 'preview' && (
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground"
                aria-label="Open preview in a new window"
                title="Open preview in a new window"
              >
                <ArrowSquareOutIcon />
              </Button>
            )}
            <span className="text-muted-foreground">·</span>
            <span className="hidden text-muted-foreground sm:inline">
              {view === 'code' ? 'Read-only' : 'localhost:5173'}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {view === 'preview' && (
              <div className="hidden items-center rounded-md border p-0.5 sm:flex">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={cn(
                    'rounded-sm',
                    device === 'desktop' && 'bg-muted',
                  )}
                  aria-label="Desktop preview"
                  aria-pressed={device === 'desktop'}
                  onClick={() => setDevice('desktop')}
                >
                  <MonitorIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={cn(
                    'rounded-sm',
                    device === 'mobile' && 'bg-muted',
                  )}
                  aria-label="Mobile preview"
                  aria-pressed={device === 'mobile'}
                  onClick={() => setDevice('mobile')}
                >
                  <DeviceMobileIcon />
                </Button>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="px-3"
              onClick={() =>
                setView((prev) => (prev === 'code' ? 'preview' : 'code'))
              }
            >
              {view === 'code' ? <EyeIcon /> : <CodeIcon />}
              <span className="hidden sm:inline">
                {view === 'code' ? 'Preview' : 'Code'}
              </span>
            </Button>
          </div>
        </header>

        <div className="flex flex-1 flex-col overflow-hidden">
          {view === 'code' ? (
            <CodePreview />
          ) : device === 'mobile' ? (
            <div className="flex flex-1 justify-center overflow-auto bg-muted/20 p-6">
              <div className="w-full max-w-[380px] self-start">
                <div className="rounded-[2.5rem] border-[10px] border-neutral-900 bg-neutral-900 shadow-2xl">
                  <div className="@container flex h-[720px] flex-col overflow-hidden rounded-[1.8rem] bg-background">
                    <div className="relative flex h-8 shrink-0 items-center justify-between px-5 text-[10px] font-semibold">
                      <span>9:41</span>
                      <span className="absolute top-1.5 left-1/2 h-4 w-20 -translate-x-1/2 rounded-full bg-neutral-900" />
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <span className="size-1.5 rounded-full bg-current" />
                        <span className="size-1.5 rounded-full bg-current opacity-60" />
                        <span className="h-2 w-4 rounded-sm border border-current" />
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <AppPreview />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="@container flex-1 overflow-auto">
              <AppPreview />
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
