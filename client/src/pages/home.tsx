import { HomeSidebar } from '#/components/home-sidebar'
import { Button } from '#/components/ui/button.tsx'
import { SidebarInset, SidebarProvider } from '#/components/ui/sidebar'

export default function Page() {
  return (
    <SidebarProvider>
      <HomeSidebar />
      <SidebarInset>
        <div className="flex items-center justify-center h-full w-full">
          <div className="flex flex-col gap-4 items-center justify-center">
            <h3>What do you want to build today?</h3>
            <div className="rounded-3xl h-auto min-w-160 bg-secondary p-4 flex flex-col justify-center items-start gap-3">
              <textarea
                placeholder="Ask me anything"
                className="text-sm h-5 outline-none resize-none size-full"
                rows={1}
              />
              <Button variant="outline">Design Systems</Button>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
