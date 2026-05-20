"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { useTheme } from "next-themes"
import { CalendarDays, Users, ClipboardList, DollarSign, Settings, Building2, PanelLeftClose, UserCircle, CalendarX2, Sun, Moon, Monitor } from "lucide-react"
import { cn } from "@/lib/utils"
import { BugReportDialog } from "@/components/manager/BugReportDialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { useOrg } from "@/lib/orgContext"

const BASE_NAV_ITEMS = [
  { label: "Schedule",     short: "Schedule", href: "/schedule",     icon: CalendarDays, always: true },
  { label: "Employees",    short: "Staff",    href: "/employees",    icon: Users,        always: true },
  { label: "Availability", short: "Avail",    href: "/availability", icon: ClipboardList,always: true },
  { label: "Labor Cost",   short: "Costs",    href: "/costs",        icon: DollarSign,   always: true },
  { label: "Time Off",     short: "Time Off", href: "/time-off",     icon: CalendarX2,   always: false },
  { label: "My Shifts",    short: "Shifts",   href: "/my-shifts",    icon: UserCircle,   always: true },
]

interface ManagerSidebarProps {
  onCollapse?: () => void
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const options = [
    { value: "light",  icon: Sun,     label: "Light" },
    { value: "dark",   icon: Moon,    label: "Dark" },
    { value: "system", icon: Monitor, label: "System" },
  ] as const

  const current = options.find((o) => o.value === theme) ?? options[2]
  const next = options[(options.indexOf(current) + 1) % options.length]

  return (
    <button
      onClick={() => setTheme(next.value)}
      aria-label={`Switch to ${next.label} theme`}
      title={`Theme: ${current.label} — click for ${next.label}`}
      className="flex w-full items-center justify-center lg:justify-start gap-3 rounded-lg px-2 py-2 text-sm text-gray-400 hover:bg-white/8 hover:text-gray-200 transition-colors"
    >
      <current.icon className="size-4 shrink-0 text-gray-500" />
      <span className="hidden lg:block text-sm font-medium text-gray-300">{current.label}</span>
    </button>
  )
}

export function ManagerSidebar({ onCollapse }: ManagerSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { org, timeOffEnabled } = useOrg()
  const navItems = BASE_NAV_ITEMS.filter((item) => item.always || timeOffEnabled)

  return (
    <>
      {/* Sidebar: icon-only at md (768px), full at lg (1024px) */}
      <aside className="hidden md:flex flex-col shrink-0 bg-gray-900 dark:bg-gray-950 w-14 lg:w-60 transition-[width] duration-200">
        {/* Logo */}
        <div className="flex h-14 items-center justify-center lg:justify-start px-2 lg:px-4 border-b border-white/10 gap-2">
          <span className="text-lg font-bold tracking-tight text-white lg:flex-1">
            <span className="lg:hidden">S</span>
            <span className="hidden lg:inline">Skemaka</span>
          </span>
          {onCollapse && (
            <button
              onClick={onCollapse}
              aria-label="Collapse sidebar"
              className="hidden lg:flex size-7 items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
            >
              <PanelLeftClose className="size-4" />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-1.5 lg:px-2 py-3 space-y-0.5">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/")
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={cn(
                  "flex items-center justify-center lg:justify-start gap-3 rounded-lg px-2 lg:px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-white/15 text-white"
                    : "text-gray-400 hover:bg-white/8 hover:text-gray-100"
                )}
              >
                <Icon className={cn("size-4 shrink-0", active ? "text-white" : "text-gray-500")} />
                <span className="hidden lg:block">{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Separator before footer */}
        <div className="mx-2 lg:mx-3 border-t border-white/10" />

        {/* Theme toggle */}
        <div className="px-1.5 lg:px-2 pt-2">
          <ThemeToggle />
        </div>

        {/* Bug report */}
        <div className="px-1.5 lg:px-2 pb-1">
          <BugReportDialog />
        </div>

        {/* Org footer */}
        <div className="p-2 lg:p-3">
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Organization settings menu" className="flex w-full items-center justify-center lg:justify-start gap-2.5 rounded-lg px-2 py-2 text-sm text-gray-400 hover:bg-white/8 hover:text-gray-200 transition-colors">
              <Building2 className="size-4 shrink-0 text-gray-500" />
              <span className="hidden lg:block flex-1 truncate text-left font-medium text-gray-300">{org.name}</span>
              <Settings className="hidden lg:block size-3.5 shrink-0 text-gray-500" />
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

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 flex border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        {navItems.map(({ short, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors min-w-0",
                active ? "text-blue-600 dark:text-white" : "text-gray-500 dark:text-gray-400"
              )}
            >
              <Icon className="size-5" />
              {short}
            </Link>
          )
        })}
        <Link
          href="/settings"
          className={cn(
            "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors min-w-0",
            pathname === "/settings" ? "text-blue-600 dark:text-white" : "text-gray-500 dark:text-gray-400"
          )}
        >
          <Settings className="size-5" />
          Settings
        </Link>
      </div>
    </>
  )
}
