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
      {open && <ManagerSidebar onCollapse={() => setOpen(false)} superAdmin={superAdmin} />}

      <main className="flex-1 overflow-y-auto relative bg-white dark:bg-gray-900">
        <SuperAdminBanner />
        {!open && (
          <button
            onClick={() => setOpen(true)}
            aria-label="Open sidebar"
            className="absolute top-3.5 left-3.5 z-20 flex size-8 items-center justify-center rounded-lg bg-gray-900 text-white shadow-md hover:bg-gray-700 transition-colors"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        )}
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
    </div>
    </TooltipProvider>
  )
}
