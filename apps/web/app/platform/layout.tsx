"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Bug, Shield, ScrollText } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV = [
  { label: "Organisations", href: "/platform", icon: LayoutDashboard },
  { label: "Audit log", href: "/platform/audit", icon: ScrollText },
  { label: "Errors", href: "/platform/errors", icon: Bug },
]

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950 text-white">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 flex flex-col border-r border-white/10">
        <div className="px-4 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-red-400 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-widest text-red-400">
              Platform
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5">Developer admin</p>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map(({ label, href, icon: Icon }) => {
            const active = href === "/platform" ? pathname === "/platform" : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-white/10 text-white font-medium"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-4 py-3 border-t border-white/10">
          <Link
            href="/schedule"
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← Back to app
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto bg-gray-50 text-gray-900">
        {children}
      </main>
    </div>
  )
}
