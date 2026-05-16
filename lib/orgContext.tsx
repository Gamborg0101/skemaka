"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { Organization, JobRole, ShiftTemplate } from "@/types"
import { updateOrgSettings } from "@/lib/orgSettings"

interface OrgContextValue {
  orgId: string
  org: Organization
  jobRoles: JobRole[]
  shiftTemplates: ShiftTemplate[]
  setShiftTemplates: React.Dispatch<React.SetStateAction<ShiftTemplate[]>>
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="size-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )
}

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "onboarding" | "ready">("loading")
  const [slowConnection, setSlowConnection] = useState(false)
  const [org, setOrg] = useState<Organization | null>(null)
  const [jobRoles, setJobRoles] = useState<JobRole[]>([])
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([])

  useEffect(() => {
    let cancelled = false
    const slowTimer = setTimeout(() => { if (!cancelled) setSlowConnection(true) }, 4000)
    async function fetchContext(retries = 3, delayMs = 1500) {
      for (let i = 0; i < retries; i++) {
        try {
          const r = await fetch("/api/me/context")
          if (r.status === 404) { if (!cancelled) setState("onboarding"); return }
          if (!r.ok) {
            if (i < retries - 1) await new Promise((res) => setTimeout(res, delayMs * (i + 1)))
            continue
          }
          const data = await r.json() as { data?: { org: Organization; jobRoles: JobRole[]; shiftTemplates: ShiftTemplate[] } }
          if (cancelled) return
          if (data.data) {
            setOrg(data.data.org)
            setJobRoles(data.data.jobRoles)
            setShiftTemplates(data.data.shiftTemplates)
            updateOrgSettings({ currency: data.data.org.currency })
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

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="size-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          {slowConnection && (
            <p className="text-xs text-gray-400 animate-pulse">Waking up the database…</p>
          )}
        </div>
      </div>
    )
  }

  if (state === "onboarding") {
    return <OnboardingRedirect />
  }

  if (!org) return null

  return (
    <OrgContext.Provider value={{ orgId: org.id, org, jobRoles, shiftTemplates, setShiftTemplates }}>
      {children}
    </OrgContext.Provider>
  )
}
