"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { useTheme } from "next-themes"
import { useTranslations } from "next-intl"
import { CalendarDays, Users, ClipboardList, DollarSign, Settings, Building2, PanelLeftClose, UserCircle, CalendarX2, Sun, Moon, Monitor, Shield } from "lucide-react"
import { cn } from "@/lib/utils"
import { BugReportDialog } from "@/components/manager/BugReportDialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useOrg } from "@/lib/orgContext"
import { LogoMark } from "@/components/brand/Logo"

const BASE_NAV_ITEMS = [
  { key: "schedule",     shortKey: "scheduleShort",     href: "/schedule",     icon: CalendarDays, always: true },
  { key: "employees",    shortKey: "employeesShort",    href: "/employees",    icon: Users,        always: true },
  { key: "availability", shortKey: "availabilityShort", href: "/availability", icon: ClipboardList,always: true },
  { key: "costs",        shortKey: "costsShort",        href: "/costs",        icon: DollarSign,   always: true },
  { key: "timeOff",      shortKey: "timeOffShort",      href: "/time-off",     icon: CalendarX2,   always: false },
  { key: "myShifts",     shortKey: "myShiftsShort",     href: "/my-shifts",    icon: UserCircle,   always: true },
] as const

interface ManagerSidebarProps {
  onCollapse?: () => void
  /** Show the super-admin "Platform" entry (only the super admin sees it). */
  superAdmin?: boolean
}

function ThemeToggle() {
  const t = useTranslations("manager.nav")
  const { theme, setTheme } = useTheme()

  const options = [
    { value: "light",  icon: Sun,     label: t("themeLight") },
    { value: "dark",   icon: Moon,    label: t("themeDark") },
    { value: "system", icon: Monitor, label: t("themeSystem") },
  ] as const

  const current = options.find((o) => o.value === theme) ?? options[2]
  const next = options[(options.indexOf(current) + 1) % options.length]

  return (
    <button
      onClick={() => setTheme(next.value)}
      aria-label={t("themeSwitch", { next: next.label })}
      title={t("themeTitle", { current: current.label, next: next.label })}
      className="flex w-full items-center justify-center lg:justify-start gap-3 rounded-lg px-2 py-2 text-sm text-gray-400 hover:bg-white/8 hover:text-gray-200 transition-colors"
    >
      <current.icon className="size-4 shrink-0 text-gray-500" />
      <span className="hidden lg:block text-sm font-medium text-gray-300">{current.label}</span>
    </button>
  )
}

export function ManagerSidebar({ onCollapse, superAdmin }: ManagerSidebarProps) {
  const t = useTranslations("manager.nav")
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
          <div className="flex items-center gap-2 text-white lg:flex-1 [--logo-accent:#60a5fa]">
            <LogoMark className="size-7 shrink-0" />
            <span className="hidden lg:inline text-lg font-bold tracking-tight">Skemaka</span>
          </div>
          {onCollapse && (
            <button
              onClick={onCollapse}
              aria-label={t("collapseSidebar")}
              className="hidden lg:flex size-7 items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
            >
              <PanelLeftClose className="size-4" />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-1.5 lg:px-2 py-3 space-y-0.5">
          {navItems.map(({ key, href, icon: Icon }) => {
            const label = t(key)
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
            <DropdownMenuTrigger aria-label={t("orgMenu")} className="flex w-full items-center justify-center lg:justify-start gap-2.5 rounded-lg px-2 py-2 text-sm text-gray-400 hover:bg-white/8 hover:text-gray-200 transition-colors">
              <Building2 className="size-4 shrink-0 text-gray-500" />
              <span className="hidden lg:block flex-1 truncate text-left font-medium text-gray-300">{org.name}</span>
              <Settings className="hidden lg:block size-3.5 shrink-0 text-gray-500" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-48">
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                {t("orgSettings")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/billing")}>
                {t("billing")}
              </DropdownMenuItem>
              {superAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/platform")}>
                    <Shield className="size-4 text-red-500" />
                    {t("platform")}
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => signOut({ redirectTo: "/login" })}
              >
                {t("signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 flex border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        {navItems.map(({ shortKey, href, icon: Icon }) => {
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
              {t(shortKey)}
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
          {t("settings")}
        </Link>
      </div>
    </>
  )
}
