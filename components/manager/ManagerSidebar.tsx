"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { CalendarDays, Users, ClipboardList, DollarSign, Settings, Building2, PanelLeftClose } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

const NAV_ITEMS = [
  { label: "Schedule", href: "/schedule", icon: CalendarDays },
  { label: "Employees", href: "/employees", icon: Users },
  { label: "Availability", href: "/availability", icon: ClipboardList },
  { label: "Labor Cost", href: "/costs", icon: DollarSign },
]

// Mock org name — TODO: fetch from /api/organizations/current
const MOCK_ORG_NAME = "The Daily Grind"

interface ManagerSidebarProps {
  onCollapse?: () => void
}

export function ManagerSidebar({ onCollapse }: ManagerSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <>
      {/* Desktop / tablet sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-gray-900">
        {/* Logo */}
        <div className="flex h-14 items-center px-4 border-b border-white/10 gap-2">
          <span className="text-lg font-bold tracking-tight text-white flex-1">Skemaka</span>
          {onCollapse && (
            <button
              onClick={onCollapse}
              aria-label="Collapse sidebar"
              className="size-7 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
            >
              <PanelLeftClose className="size-4" />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/")
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-white/15 text-white"
                    : "text-gray-400 hover:bg-white/8 hover:text-gray-100"
                )}
              >
                <Icon className={cn("size-4 shrink-0", active ? "text-white" : "text-gray-500")} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Separator before org footer */}
        <div className="mx-3 border-t border-white/10" />

        {/* Org footer */}
        <div className="p-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-gray-400 hover:bg-white/8 hover:text-gray-200 transition-colors">
              <Building2 className="size-4 shrink-0 text-gray-500" />
              <span className="flex-1 truncate text-left font-medium text-gray-300">{MOCK_ORG_NAME}</span>
              <Settings className="size-3.5 shrink-0 text-gray-500" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-48">
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                Organization settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/billing")}>
                Billing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => signOut({ redirectTo: "/login" })}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Tablet icon-only sidebar (md collapsed) — shown between 768px and our full sidebar breakpoint) */}
      {/* We use a narrower variant at exactly md by overriding with a narrower class if needed */}
      {/* Mobile: top bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 flex border-t border-gray-200 bg-white">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors",
                active ? "text-blue-600" : "text-gray-500"
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          )
        })}
      </div>
    </>
  )
}
