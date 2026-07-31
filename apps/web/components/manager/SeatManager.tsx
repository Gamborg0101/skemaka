"use client"

import { useEffect, useState } from "react"
import { Users, Minus, Plus, Clock } from "lucide-react"
import { monthlyTotal, formatPrice, PLAN_CURRENCY, PRICE_PER_EMPLOYEE_MONTHLY } from "@/lib/pricing"

interface SeatState {
  seats: number
  pendingSeats: number | null
  pendingSeatsEffectiveAt: string | null
  activeEmployees: number
  minSeats: number
}

interface SeatChangeResult {
  seats: number
  pendingSeats: number | null
  chargedNow: number
  effective: "immediately" | "next_period"
}

const MAX_SEATS = 500

/**
 * Seat count + what it costs, on the billing page.
 *
 * The point of this panel is that nobody should meet their bill for the first
 * time on Stripe's checkout page. It always shows the current price, what a
 * change would cost, and when it takes effect — before the manager commits.
 */
export function SeatManager({ orgId, trialing }: { orgId: string; trialing: boolean }) {
  const [state, setState] = useState<SeatState | null>(null)
  const [draft, setDraft] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/orgs/${orgId}/billing/seats`)
      .then((r) => r.json())
      .then((body: { data?: SeatState }) => {
        if (cancelled || !body.data) return
        setState(body.data)
        setDraft(body.data.seats)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [orgId])

  if (!state || draft === null) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 px-5 py-4">
        <p className="text-sm text-gray-400">Loading plan…</p>
      </div>
    )
  }

  const changed = draft !== state.seats
  const currentTotal = monthlyTotal(state.seats)
  const draftTotal = monthlyTotal(draft)
  const isIncrease = draft > state.seats
  // Every employee above the base costs the same, so the one-off is simply the
  // difference × the per-employee rate.
  const oneOff = isIncrease ? (draft - state.seats) * PRICE_PER_EMPLOYEE_MONTHLY : 0

  async function save() {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const r = await fetch(`/api/orgs/${orgId}/billing/seats`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seats: draft }),
      })
      const body = await r.json() as { data?: SeatChangeResult; error?: string }
      if (!r.ok || !body.data) throw new Error(body.error ?? "Could not update your plan")

      setState((s) => s && {
        ...s,
        seats: body.data!.seats,
        pendingSeats: body.data!.pendingSeats,
      })
      setDraft(body.data.seats)
      setNotice(
        body.data.effective === "immediately"
          ? body.data.chargedNow > 0
            ? `Added. ${PLAN_CURRENCY}${formatPrice(body.data.chargedNow / 100)} for the rest of this month will appear on your next invoice.`
            : "Your plan is updated."
          : `Scheduled. Your plan covers ${body.data.seats} employees until your next bill, then ${body.data.pendingSeats}.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setDraft(state!.seats)
    } finally {
      setSaving(false)
    }
  }

  const clamp = (n: number) => Math.max(state.minSeats, Math.min(MAX_SEATS, n))

  // Functional updates, not `clamp(draft ± 1)`: two clicks inside one React
  // batch would both read the same stale `draft` and the second would
  // overwrite the first, so a fast double-click only moved the count by one.

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 px-5 py-4">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 size-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
          <Users className="size-4 text-gray-500 dark:text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Your plan</p>
          <p className="text-sm text-gray-500 mt-0.5">
            {state.activeEmployees} active · your plan covers {state.seats} employees
            {trialing && " — add freely during your trial"}
          </p>

          <div className="mt-4 flex items-center gap-3">
            <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-600">
              <button
                type="button"
                onClick={() => setDraft((d) => clamp((d ?? 0) - 1))}
                disabled={saving || draft <= state.minSeats}
                aria-label="One fewer employee"
                className="px-2.5 py-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Minus className="size-4" />
              </button>
              <span className="px-3 text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums min-w-[2.5rem] text-center">
                {draft}
              </span>
              <button
                type="button"
                onClick={() => setDraft((d) => clamp((d ?? 0) + 1))}
                disabled={saving || draft >= MAX_SEATS}
                aria-label="One more employee"
                className="px-2.5 py-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Plus className="size-4" />
              </button>
            </div>

            <span className="text-sm text-gray-500 tabular-nums">
              {PLAN_CURRENCY}{formatPrice(changed ? draftTotal : currentTotal)}/month
            </span>
          </div>

          {/* Say what will happen BEFORE they commit, not after. */}
          {changed && (
            <p className="mt-3 text-xs text-gray-500 leading-relaxed">
              {isIncrease ? (
                <>
                  Available straight away.{" "}
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {PLAN_CURRENCY}{formatPrice(oneOff)}
                  </span>{" "}
                  for the rest of this month, then {PLAN_CURRENCY}{formatPrice(draftTotal)}/month.
                </>
              ) : (
                <>
                  Your plan covers {state.seats} employees until your next bill, then {draft} at{" "}
                  {PLAN_CURRENCY}{formatPrice(draftTotal)}/month. No refund for the current month.
                </>
              )}
            </p>
          )}

          {draft <= state.minSeats && state.activeEmployees >= state.minSeats && !changed && (
            <p className="mt-3 text-xs text-gray-400 leading-relaxed">
              To go lower, deactivate an employee first — we never deactivate anyone for you.
            </p>
          )}

          {state.pendingSeats !== null && !changed && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <Clock className="size-3.5 mt-px shrink-0" />
              Dropping to {state.pendingSeats} employees at your next bill.
            </p>
          )}

          {notice && <p className="mt-3 text-xs text-green-700 dark:text-green-400">{notice}</p>}
          {error && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>

        {changed && (
          <button
            onClick={save}
            disabled={saving}
            className="shrink-0 text-sm font-medium bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors self-center"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        )}
      </div>
    </div>
  )
}
