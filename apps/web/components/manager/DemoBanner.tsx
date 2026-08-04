"use client"

import { useFormStatus } from "react-dom"
import { useTranslations } from "next-intl"
import { Sparkles, ArrowRight, RotateCcw } from "lucide-react"
import { useOrg } from "@/lib/orgContext"

/**
 * Slim top bar shown only inside "try the live demo" sandboxes: reminds the
 * visitor the data is throwaway and routes them to a real signup. Both actions
 * are server actions (passed from the manager layout) because they need to
 * change the session — an authenticated /login visit would just bounce back
 * into the sandbox.
 */

/** Disables itself while the action runs, so a double click can't fire twice. */
function ResetButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 font-semibold hover:bg-white/25 transition-colors disabled:opacity-60"
    >
      <RotateCcw className={pending ? "size-3 animate-spin" : "size-3"} />
      {pending ? pendingLabel : label}
    </button>
  )
}

export function DemoBanner({
  exitAction,
  resetAction,
}: {
  exitAction: () => Promise<void>
  resetAction: () => Promise<void>
}) {
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
      {/* Saying plainly what the sandbox does NOT do turns "the email never
          arrived" from a bug into a documented boundary. */}
      <span className="hidden sm:inline text-white/70">{t("scope")}</span>
      <form action={resetAction} className="inline">
        <ResetButton label={t("reset")} pendingLabel={t("resetting")} />
      </form>
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
