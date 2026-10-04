import * as React from 'react'
import {
  ChatCircleDotsIcon,
  DotsThreeIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from '@phosphor-icons/react'
import { NavUser } from '#/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '#/components/ui/sidebar'
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
        variant="ghost"
        size="icon-sm"
        className="cursor-e-resize"
        onClick={() => toggleSidebar()}
      >
        <img src={logoSrc} alt="Forge" className="size-5 rounded" />
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2 px-1">
      <img src={logoSrc} alt="Forge" className="size-7 rounded-lg" />
      <span className="text-sm font-semibold">Forge</span>
      <SidebarTrigger className="ml-auto" />
    </div>
  )
}

export function HomeSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarHeaderTrigger />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="pt-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="New chat" className="font-medium">
                <PlusIcon weight="bold" />
                <span>New chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>Chats</SidebarGroupLabel>
          <SidebarGroupAction
            aria-label="Search chats"
            title="Search chats"
            className="hover:bg-sidebar-accent"
          >
            <MagnifyingGlassIcon />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {chatData.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    render={<a href={item.url} />}
                  >
                    <ChatCircleDotsIcon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                  <SidebarMenuAction
                    showOnHover
                    aria-label={`Options for ${item.title}`}
                  >
                    <DotsThreeIcon weight="bold" />
                  </SidebarMenuAction>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
