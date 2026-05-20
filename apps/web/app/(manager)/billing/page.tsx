"use client"

import { useState } from "react"
import { CreditCard, Receipt, Zap, AlertTriangle, CheckCircle, XCircle } from "lucide-react"
import { useOrg } from "@/lib/orgContext"
import type { SubscriptionStatus } from "@/types"

function StatusBanner({ status }: { status: SubscriptionStatus }) {
  if (status === "TRIALING") {
    return (
      <div className="rounded-xl border border-blue-200 dark:border-gray-700 bg-blue-50 dark:bg-gray-800/60 px-5 py-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-blue-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
            <Zap className="size-4 text-blue-600 dark:text-gray-300" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-900 dark:text-gray-100">Free trial</p>
            <p className="text-sm text-blue-700 dark:text-gray-400">Full access during your trial — subscribe to continue when it ends.</p>
          </div>
        </div>
      </div>
    )
  }
  if (status === "ACTIVE") {
    return (
      <div className="rounded-xl border border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-950/40 px-5 py-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-green-100 dark:bg-green-900/60 flex items-center justify-center shrink-0">
            <CheckCircle className="size-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-green-900 dark:text-green-200">Subscription active</p>
            <p className="text-sm text-green-700 dark:text-green-300">Your plan is active. Use the customer portal to manage payment details and invoices.</p>
          </div>
        </div>
      </div>
    )
  }
  if (status === "PAST_DUE") {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/40 px-5 py-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center shrink-0">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Payment failed</p>
            <p className="text-sm text-amber-700 dark:text-amber-300">Your last payment didn&apos;t go through. Update your payment method to keep your account active.</p>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/40 px-5 py-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="size-9 rounded-lg bg-red-100 dark:bg-red-900/60 flex items-center justify-center shrink-0">
          <XCircle className="size-4 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-red-900 dark:text-red-200">Subscription cancelled</p>
          <p className="text-sm text-red-700 dark:text-red-300">Your subscription has ended. Resubscribe to regain full access.</p>
        </div>
      </div>
    </div>
  )
}

export default function BillingPage() {
  const { org } = useOrg()
  const [loading, setLoading] = useState<"portal" | "checkout" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const status = org.subscriptionStatus
  const usesPortal = status === "ACTIVE" || status === "PAST_DUE"

  async function openPortal() {
    setLoading("portal")
    setError(null)
    try {
      const r = await fetch(`/api/orgs/${org.id}/billing/portal`, { method: "POST" })
      const data = await r.json() as { url?: string; error?: string }
      if (!r.ok || !data.url) throw new Error(data.error ?? "Failed to open billing portal")
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(null)
    }
  }

  async function openCheckout() {
    setLoading("checkout")
    setError(null)
    try {
      const r = await fetch(`/api/orgs/${org.id}/billing/checkout`, { method: "POST" })
      const data = await r.json() as { url?: string; error?: string }
      if (!r.ok || !data.url) throw new Error(data.error ?? "Failed to start checkout")
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(null)
    }
  }

  const primaryLabel =
    status === "TRIALING" ? "Subscribe now" :
    status === "ACTIVE" ? "Manage billing" :
    status === "PAST_DUE" ? "Update payment method" :
    "Resubscribe"

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Billing</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your subscription and payment details.
        </p>
      </div>

      <StatusBanner status={status} />

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-start gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 px-5 py-4">
          <div className="mt-0.5 size-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
            <CreditCard className="size-4 text-gray-500 dark:text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Payment &amp; subscription</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {usesPortal
                ? "Update your payment method or cancel your subscription."
                : "Start a subscription to continue after your trial."}
            </p>
          </div>
          <button
            onClick={usesPortal ? openPortal : openCheckout}
            disabled={loading !== null}
            className="shrink-0 text-sm font-medium bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-center"
          >
            {loading === (usesPortal ? "portal" : "checkout") ? "Loading…" : primaryLabel}
          </button>
        </div>

        <div className="flex items-start gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 px-5 py-4">
          <div className="mt-0.5 size-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
            <Receipt className="size-4 text-gray-500 dark:text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Invoices</p>
            <p className="text-sm text-gray-500 mt-0.5">Download past invoices from the customer portal.</p>
          </div>
          {org.subscriptionStatus !== "TRIALING" ? (
            <button
              onClick={openPortal}
              disabled={loading !== null}
              className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 transition-colors self-center"
            >
              {loading === "portal" ? "Loading…" : "Open portal"}
            </button>
          ) : (
            <span className="shrink-0 text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full self-center">
              No invoices yet
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
