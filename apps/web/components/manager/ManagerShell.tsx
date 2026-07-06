"use client"

import { useState } from "react"
import { PanelLeftOpen } from "lucide-react"
import { ManagerSidebar } from "@/components/manager/ManagerSidebar"
import { SuperAdminBanner } from "@/components/manager/SuperAdminBanner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ErrorBoundary } from "@/components/ErrorBoundary"

export function ManagerShell({ children, superAdmin }: { children: React.ReactNode; superAdmin?: boolean }) {
  const [open, setOpen] = useState(true)

  return (
    <TooltipProvider>
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      {open ? (
        <ManagerSidebar onCollapse={() => setOpen(false)} superAdmin={superAdmin} />
      ) : (
        // Collapsed: a slim rail (in normal flow, not an overlay) so the reopen
        // button sits beside page content instead of on top of the header. The
        // h-14 header aligns with each page's title bar.
        <aside className="hidden md:flex flex-col shrink-0 w-12 bg-gray-900 dark:bg-gray-950">
          <div className="flex h-14 items-center justify-center border-b border-white/10">
            <button
              onClick={() => setOpen(true)}
              aria-label="Open sidebar"
              className="flex size-8 items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <PanelLeftOpen className="size-4" />
            </button>
          </div>
        </aside>
      )}

      <main className="flex-1 overflow-y-auto relative bg-white dark:bg-gray-900">
        <SuperAdminBanner />
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
    </div>
    </TooltipProvider>
  )
}
