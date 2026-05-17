"use client"

import { useState } from "react"
import { PanelLeftOpen } from "lucide-react"
import { ManagerSidebar } from "@/components/manager/ManagerSidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ErrorBoundary } from "@/components/ErrorBoundary"

export function ManagerShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true)

  return (
    <TooltipProvider>
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {open && <ManagerSidebar onCollapse={() => setOpen(false)} />}

      <main className="flex-1 overflow-y-auto relative bg-white">
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
