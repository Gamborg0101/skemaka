"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { CalendarDays, CircleUser } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Bottom nav for the employee portal, mirroring the manager shell's mobile bar.
 *
 * Employees previously had no navigation at all: /portal was a single page
 * whose only link pointed at /schedule — a manager route they're redirected
 * away from — and there was no way to sign out from anywhere.
 *
 * Two destinations, both real. Availability is deliberately absent: it exists
 * only as a per-request token link the manager sends, with no standing
 * employee-scoped route behind it, and a tab leading nowhere is worse than no
 * tab. That route is worth building separately.
 */
export function EmployeeNav() {
  const t = useTranslations("portal")
  const pathname = usePathname()

  const items = [
    { href: "/portal", labelKey: "navShifts" as const, Icon: CalendarDays },
    { href: "/portal/account", labelKey: "navAccount" as const, Icon: CircleUser },
  ]

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 flex border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      {items.map(({ href, labelKey, Icon }) => {
        // /portal must not light up for /portal/account, so match it exactly.
        const active = href === "/portal" ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors min-w-0",
              active ? "text-blue-600 dark:text-white" : "text-gray-500 dark:text-gray-400",
            )}
          >
            <Icon className="size-5" />
            {t(labelKey)}
          </Link>
        )
      })}
    </nav>
  )
}
