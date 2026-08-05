"use client"

import { useState } from "react"
import { ArrowLeftRight, Clock, X } from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import type { CoverRequestStatus } from "@/types"

type Active = { id: string; status: Extract<CoverRequestStatus, "OPEN" | "CLAIMED"> }

/**
 * Per-shift control on My Shifts: offer a shift up for a teammate to cover, or
 * withdraw an offer. Optimistic local state; the parent seeds `initial` from any
 * request already in flight.
 */
export function OfferCoverButton({
  orgId,
  shiftId,
  initial = null,
}: {
  orgId: string
  shiftId: string
  initial?: Active | null
}) {
  const tToast = useTranslations("manager.toasts")
  const t = useTranslations("portal.offerCover")
  const [active, setActive] = useState<Active | null>(initial)
  const [busy, setBusy] = useState(false)

  async function offer() {
    setBusy(true)
    try {
      const r = await fetch(`/api/orgs/${orgId}/cover-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId }),
      })
      const res = (await r.json()) as { data?: { id: string; status: string }; error?: string }
      if (!r.ok || !res.data) throw new Error(res.error ?? t("errOffer"))
      setActive({ id: res.data.id, status: "OPEN" })
      toast.success(tToast("coverOffered"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errGeneric"))
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    if (!active) return
    setBusy(true)
    try {
      const r = await fetch(`/api/orgs/${orgId}/cover-requests/${active.id}`, { method: "DELETE" })
      const res = (await r.json()) as { error?: string }
      if (!r.ok) throw new Error(res.error ?? t("errWithdraw"))
      setActive(null)
      toast.success(tToast("coverOfferWithdrawn"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errGeneric"))
    } finally {
      setBusy(false)
    }
  }

  if (active) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
          <Clock className="size-3.5" />
          {active.status === "CLAIMED" ? t("claimed") : t("offered")}
        </span>
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-40 transition-colors"
        >
          <X className="size-3.5" /> {t("withdraw")}
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={offer}
      disabled={busy}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
    >
      <ArrowLeftRight className="size-3.5" />
      {busy ? t("offering") : t("offer")}
    </button>
  )
}
