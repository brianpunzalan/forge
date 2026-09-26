import * as React from 'react'
import { PlusCircleIcon } from '@phosphor-icons/react'
import { SearchForm } from '#components/search-form'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '#components/ui/sidebar'
import logoSrc from '#/assets/logo.png'
import { Button } from './ui/button'

const chatData = [
  {
    title: 'News brief JSON review',
    url: '#',
  },
  {
    title: 'Plant based meat for gout',
    url: '#',
  },
]

const SidebarHeaderTrigger = () => {
  const { state, toggleSidebar } = useSidebar()

  if (state === 'collapsed') {
    return (
      <Button
        data-sidebar="trigger"
        data-slot="sidebar-trigger"
        variant="outline"
        size="icon-sm"
        className="p-1 cursor-e-resize"
        onClick={() => toggleSidebar()}
      >
        <img src={logoSrc} alt="Forge" className="size-full" />
      </Button>
    )
  }

  return (
    <header className="inline-flex justify-between group-data-[state=collapsed]:justify-center items-center">
      <div className="group-data-[state=collapsed]:hidden inline-flex gap-2 items-center">
        <img
          src={logoSrc}
          alt="Forge"
          className="p-1 size-7 group-data-[state=collapsed]:w-full"
        />{' '}
        <span className="leading-3.5">Forge</span>
      </div>
      <SidebarTrigger className="-ml-1" />
    </header>
  )
}

export function HomeSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar()
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarHeaderTrigger />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenuItem>
            <SidebarMenuButton render={<a href="#" />}>
              <PlusCircleIcon size={32} /> New Chat
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarGroup>
        {state === 'expanded' && (
          <SidebarGroup>
            <SidebarGroupLabel>Chats</SidebarGroupLabel>
            <SidebarGroupContent>
              {/* <SearchForm /> */}
              <SidebarMenu>
                {chatData.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton render={<a href={item.url} />}>
                      {item.title}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
