"use client"

import { useTranslations } from "next-intl"
import { Sparkles, ArrowRight } from "lucide-react"
import { useOrg } from "@/lib/orgContext"

/**
 * Slim top bar shown only inside "try the live demo" sandboxes: reminds the
 * visitor the data is throwaway and routes them to a real signup. The CTA is a
 * server action (passed from the manager layout) because the visitor must be
 * signed OUT of the demo user first — an authenticated /login visit would just
 * bounce back into the sandbox.
 */
export function DemoBanner({ exitAction }: { exitAction: () => Promise<void> }) {
  const { org } = useOrg()
  const t = useTranslations("manager.demoBanner")
  if (!org.isDemo) return null

  return (
    <div
      data-demo-banner
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-blue-600 px-4 py-1.5 text-center text-[13px] font-medium text-white"
    >
      <span className="inline-flex items-center gap-1.5">
        <Sparkles className="size-3.5 shrink-0" />
        {t("text")}
      </span>
      <form action={exitAction} className="inline">
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 font-semibold hover:bg-white/25 transition-colors"
        >
          {t("cta")}
          <ArrowRight className="size-3" />
        </button>
      </form>
    </div>
  )
}
