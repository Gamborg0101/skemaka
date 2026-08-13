"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import type { Organization, JobRole, ShiftTemplate } from "@/types"
import { updateOrgSettings, type DayHours } from "@/lib/orgSettings"
import { shouldShowPaywall, type BillingBlock } from "@/lib/billing"
import { BillingPaywall } from "@/components/manager/BillingPaywall"

interface OrgContextValue {
  orgId: string
  org: Organization
  jobRoles: JobRole[]
  setJobRoles: React.Dispatch<React.SetStateAction<JobRole[]>>
  shiftTemplates: ShiftTemplate[]
  setShiftTemplates: React.Dispatch<React.SetStateAction<ShiftTemplate[]>>
  timeOffEnabled: boolean
  setTimeOffEnabled: React.Dispatch<React.SetStateAction<boolean>>
  availabilityWindowWeeks: number
  setAvailabilityWindowWeeks: React.Dispatch<React.SetStateAction<number>>
  /** True when a super admin is viewing/editing this org via "acting-as". */
  acting: boolean
  /**
   * Non-null when the org is locked out of paid features (the same condition
   * behind the API's 402). Consumers mostly don't need this — OrgProvider swaps
   * the whole UI for the paywall — but `/billing` stays reachable and uses it
   * to describe the real state instead of the raw subscription status.
   */
  billingBlock: BillingBlock | null
}

const OrgContext = createContext<OrgContextValue | null>(null)

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error("useOrg must be used within OrgProvider")
  return ctx
}

function OnboardingRedirect() {
  const router = useRouter()
  useEffect(() => { router.push("/onboarding") }, [router])
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="size-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )
}

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "onboarding" | "error" | "ready">("loading")
  const [slowConnection, setSlowConnection] = useState(false)
  const [org, setOrg] = useState<Organization | null>(null)
  const [jobRoles, setJobRoles] = useState<JobRole[]>([])
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([])
  const [timeOffEnabled, setTimeOffEnabled] = useState(true)
  const [availabilityWindowWeeks, setAvailabilityWindowWeeks] = useState(1)
  const [acting, setActing] = useState(false)
  const [billingBlock, setBillingBlock] = useState<BillingBlock | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false
    const slowTimer = setTimeout(() => { if (!cancelled) setSlowConnection(true) }, 4000)
    async function fetchContext(retries = 3, delayMs = 1500) {
      for (let i = 0; i < retries; i++) {
        try {
          const r = await fetch("/api/me/context", { cache: "no-store" })
          if (r.status === 404) { if (!cancelled) setState("onboarding"); return }
          if (!r.ok) {
            if (i < retries - 1) await new Promise((res) => setTimeout(res, delayMs * (i + 1)))
            else if (!cancelled) setState("error")
            continue
          }
          const data = await r.json() as { data?: { org: Organization; jobRoles: JobRole[]; shiftTemplates: ShiftTemplate[]; acting?: boolean; billing?: BillingBlock | null } }
          if (cancelled) return
          if (data.data) {
            setOrg(data.data.org)
            setJobRoles(data.data.jobRoles)
            setShiftTemplates(data.data.shiftTemplates)
            setActing(data.data.acting === true)
            setBillingBlock(data.data.billing ?? null)
            const { org } = data.data
            const enabled = org.settings?.timeOffEnabled !== false
            setTimeOffEnabled(enabled)
            setAvailabilityWindowWeeks(org.settings?.availabilityWindowWeeks ?? 1)
            updateOrgSettings({
              currency: org.currency,
              timeOffEnabled: enabled,
              timeFormat: org.settings?.timeFormat ?? "24h",
              includeManagerInSchedule: org.settings?.includeManagerInSchedule === true,
              ...(org.settings?.hours ? { hours: org.settings.hours as DayHours[] } : {}),
              ...(org.settings?.defaultScheduleView
                ? { defaultScheduleView: org.settings.defaultScheduleView }
                : {}),
              ...(typeof org.settings?.fullTimeHours === "number"
                ? { fullTimeHours: org.settings.fullTimeHours }
                : {}),
              ...(typeof org.settings?.reducedFullTimeHours === "number"
                ? { reducedFullTimeHours: org.settings.reducedFullTimeHours }
                : {}),
              ...(typeof org.settings?.timelineBufferHours === "number"
                ? { timelineBufferHours: org.settings.timelineBufferHours }
                : {}),
            })
            setState("ready")
          } else {
            setState("onboarding")
          }
          return
        } catch {
          if (i < retries - 1) await new Promise((res) => setTimeout(res, delayMs * (i + 1)))
        }
      }
      if (!cancelled) setState("onboarding")
    }
    fetchContext()
    return () => { cancelled = true; clearTimeout(slowTimer) }
  }, [])

  // Must be called unconditionally before any early returns — Rules of Hooks.
  const ctxValue = useMemo(
    () => org ? { orgId: org.id, org, jobRoles, setJobRoles, shiftTemplates, setShiftTemplates, timeOffEnabled, setTimeOffEnabled, availabilityWindowWeeks, setAvailabilityWindowWeeks, acting, billingBlock } : null,
    [org, jobRoles, shiftTemplates, timeOffEnabled, availabilityWindowWeeks, acting, billingBlock]
  )

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <div className="size-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          {slowConnection && (
            <p className="text-xs text-gray-400 animate-pulse">Waking up the database…</p>
          )}
        </div>
      </div>
    )
  }

  if (state === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Could not connect to the server. Please check your connection and try again.
          </p>
          <button
            onClick={() => { setState("loading"); window.location.reload() }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (state === "onboarding") {
    return <OnboardingRedirect />
  }

  if (!ctxValue) return null

  // Swap the entire manager shell for the paywall when billing is blocked —
  // /billing itself stays reachable so the call to action leads somewhere.
  // Still inside the provider: /billing reads `billingBlock` from context.
  return (
    <OrgContext.Provider value={ctxValue}>
      {shouldShowPaywall(billingBlock, pathname ?? "", acting)
        ? <BillingPaywall code={billingBlock!.code} />
        : children}
    </OrgContext.Provider>
  )
}
