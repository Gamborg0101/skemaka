"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronRight, Info } from "lucide-react"
import { InstallPrompt } from "@/components/pwa/InstallPrompt"

type Step = 1 | 2 | 3

const CURRENCIES = [
  { code: "EUR", label: "Euro (€)", symbol: "€" },
  { code: "USD", label: "US Dollar ($)", symbol: "$" },
  { code: "GBP", label: "British Pound (£)", symbol: "£" },
  { code: "DKK", label: "Danish Krone (kr)", symbol: "kr" },
  { code: "SEK", label: "Swedish Krona (kr)", symbol: "kr" },
  { code: "NOK", label: "Norwegian Krone (kr)", symbol: "kr" },
]

// Country drives the currency + time-format defaults. Limited to countries whose
// currency we support today (see VALID_CURRENCIES in orgService). "Other" lets
// anyone proceed with sensible EUR defaults.
const COUNTRIES: { code: string; name: string; currency: string; timeFormat: "12h" | "24h" }[] = [
  { code: "DK", name: "Denmark",        currency: "DKK", timeFormat: "24h" },
  { code: "SE", name: "Sweden",         currency: "SEK", timeFormat: "24h" },
  { code: "NO", name: "Norway",         currency: "NOK", timeFormat: "24h" },
  { code: "GB", name: "United Kingdom", currency: "GBP", timeFormat: "24h" },
  { code: "US", name: "United States",  currency: "USD", timeFormat: "12h" },
  { code: "IE", name: "Ireland",        currency: "EUR", timeFormat: "24h" },
  { code: "DE", name: "Germany",        currency: "EUR", timeFormat: "24h" },
  { code: "FR", name: "France",         currency: "EUR", timeFormat: "24h" },
  { code: "ES", name: "Spain",          currency: "EUR", timeFormat: "24h" },
  { code: "IT", name: "Italy",          currency: "EUR", timeFormat: "24h" },
  { code: "NL", name: "Netherlands",    currency: "EUR", timeFormat: "24h" },
  { code: "BE", name: "Belgium",        currency: "EUR", timeFormat: "24h" },
  { code: "AT", name: "Austria",        currency: "EUR", timeFormat: "24h" },
  { code: "PT", name: "Portugal",       currency: "EUR", timeFormat: "24h" },
  { code: "FI", name: "Finland",        currency: "EUR", timeFormat: "24h" },
  { code: "OTHER", name: "Other",       currency: "EUR", timeFormat: "24h" },
]

// Optional — tailors the starter job roles (see lib/seedDefaultRoles.ts).
const INDUSTRIES = [
  { value: "",            label: "Select (optional)" },
  { value: "restaurant",  label: "Restaurant" },
  { value: "cafe",        label: "Café / Bar" },
  { value: "retail",      label: "Retail / Store" },
  { value: "hospitality", label: "Hotel / Hospitality" },
  { value: "healthcare",  label: "Healthcare / Clinic" },
  { value: "other",       label: "Other" },
]

// Fallback only. The real options are fetched from the org right after it's
// created (see handleCreateOrg), so the dropdown always matches the job roles
// actually seeded in the database. Mirrors lib/seedDefaultRoles.ts.
const FALLBACK_ROLES = ["Staff", "Shift lead", "Manager"]

// Cycled through when a user adds a custom role inline, so new roles get varied
// colors. Must be valid color tags (see lib/validate.ts VALID_COLOR_TAGS).
const ROLE_COLORS = ["blue", "purple", "green", "orange", "yellow", "rose"]

// Sentinel option value that triggers the inline "add a role" input.
const ADD_ROLE = "__add_role__"

const STEPS = [
  { n: 1 as Step, label: "Your business" },
  { n: 2 as Step, label: "Your team" },
  { n: 3 as Step, label: "Get the app" },
]

// Explicit text + placeholder colors so inputs don't inherit the themed
// (possibly near-white) foreground on these intentionally light-themed pages.
const INPUT_CLASS =
  "w-full px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
const SELECT_CLASS =
  "w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1
  const [orgName, setOrgName] = useState("")
  const [country, setCountry] = useState("")
  const [currency, setCurrency] = useState("EUR")
  const [industry, setIndustry] = useState("")
  // Captured silently from the browser — no question asked.
  const [timezone, setTimezone] = useState("")
  const [locale, setLocale] = useState("")

  // After step 1
  const [orgId, setOrgId] = useState<string | null>(null)

  // Step 2
  const [empName, setEmpName] = useState("")
  const [empEmail, setEmpEmail] = useState("")
  const [empRole, setEmpRole] = useState(FALLBACK_ROLES[0])
  const [availableRoles, setAvailableRoles] = useState<string[]>(FALLBACK_ROLES)
  const [addingRole, setAddingRole] = useState(false)
  const [newRole, setNewRole] = useState("")
  const [savingRole, setSavingRole] = useState(false)
  const [roleError, setRoleError] = useState<string | null>(null)
  const [empWage, setEmpWage] = useState("")
  const [addedEmployees, setAddedEmployees] = useState<string[]>([])
  const [addingEmp, setAddingEmp] = useState(false)
  const [empError, setEmpError] = useState<string | null>(null)

  // If user already has an org, redirect them away
  useEffect(() => {
    fetch("/api/me/context", { cache: "no-store" })
      .then((r) => { if (r.ok) router.replace("/schedule") })
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [router])

  // Capture timezone + locale silently, and pre-select the country (and thus
  // currency) from the browser locale's region so the user usually doesn't have
  // to change anything.
  useEffect(() => {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? "")
    } catch { /* ignore */ }
    const loc = typeof navigator !== "undefined" ? navigator.language : ""
    setLocale(loc)
    const region = loc.split("-")[1]?.toUpperCase()
    const match = COUNTRIES.find((c) => c.code === region)
    if (match) {
      setCountry(match.code)
      setCurrency(match.currency)
    }
  }, [])

  function handleCountryChange(code: string) {
    setCountry(code)
    const c = COUNTRIES.find((x) => x.code === code)
    if (c) setCurrency(c.currency)
  }

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault()
    if (!orgName.trim() || !country) return
    setLoading(true)
    setError(null)
    try {
      const timeFormat = COUNTRIES.find((c) => c.code === country)?.timeFormat ?? "24h"
      const r = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: orgName.trim(),
          currency,
          country,
          timezone,
          locale,
          industry: industry || undefined,
          timeFormat,
        }),
      })
      const data = await r.json() as { data?: { id: string }; error?: string }
      if (!r.ok) throw new Error(data.error ?? "Failed to create workspace")
      const newOrgId = data.data!.id
      setOrgId(newOrgId)
      // Load the org's actual job roles so the Team step only offers roles that
      // exist in the DB — otherwise the employee create is rejected with
      // "Job role X does not exist in this organization".
      try {
        const rr = await fetch(`/api/orgs/${newOrgId}/roles`, { cache: "no-store" })
        if (rr.ok) {
          const rd = await rr.json() as { data?: { name: string }[] }
          const names = (rd.data ?? []).map((x) => x.name)
          if (names.length > 0) {
            setAvailableRoles(names)
            setEmpRole(names[0])
          }
        }
      } catch {
        // keep FALLBACK_ROLES — they mirror the seed, so they still exist
      }
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  async function handleAddEmployee() {
    if (!orgId || !empName.trim() || !empEmail.trim()) return
    const wage = parseFloat(empWage)
    if (!(wage > 0)) {
      setEmpError("Enter an hourly wage greater than 0.")
      return
    }
    setAddingEmp(true)
    setEmpError(null)
    try {
      const r = await fetch(`/api/orgs/${orgId}/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: empName.trim(),
          email: empEmail.trim(),
          phone: null,
          jobRole: empRole,
          hourlyWage: wage,
          employmentType: "FULL_TIME",
          contractedHours: 37,
          notes: null,
        }),
      })
      const data = (await r.json()) as { error?: string }
      // Surface failures instead of silently pretending the employee was added —
      // otherwise a rejected POST (e.g. invalid wage) shows "added" but nothing
      // is persisted, and the employee never appears in Employees.
      if (!r.ok) throw new Error(data.error ?? "Failed to add employee")
      setAddedEmployees((prev) => [...prev, empName.trim()])
      setEmpName("")
      setEmpEmail("")
      setEmpWage("")
    } catch (err) {
      setEmpError(err instanceof Error ? err.message : "Failed to add employee")
    } finally {
      setAddingEmp(false)
    }
  }

  // Create a custom job role on the spot (e.g. "Sales associate") so the product
  // fits any industry, not just restaurants. The role is persisted immediately
  // so the employee create below accepts it.
  async function handleAddRole() {
    const name = newRole.trim()
    if (!orgId || !name) return
    const dupe = availableRoles.find((r) => r.toLowerCase() === name.toLowerCase())
    if (dupe) {
      setEmpRole(dupe)
      setAddingRole(false)
      setNewRole("")
      return
    }
    setSavingRole(true)
    setRoleError(null)
    try {
      const r = await fetch(`/api/orgs/${orgId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: ROLE_COLORS[availableRoles.length % ROLE_COLORS.length] }),
      })
      const data = (await r.json()) as { data?: { name: string }; error?: string }
      if (!r.ok) throw new Error(data.error ?? "Failed to add role")
      setAvailableRoles((prev) => [...prev, name])
      setEmpRole(name)
      setAddingRole(false)
      setNewRole("")
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : "Failed to add role")
    } finally {
      setSavingRole(false)
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="size-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-2xl font-bold text-gray-900 tracking-tight">Skemaka</div>

      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Step indicator */}
        <div className="flex border-b border-gray-100">
          {STEPS.map(({ n, label }) => (
            <div
              key={n}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors border-b-2 ${
                step === n
                  ? "border-blue-600 text-blue-600"
                  : step > n
                  ? "border-transparent text-green-600"
                  : "border-transparent text-gray-400"
              }`}
            >
              <span className={`size-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step > n ? "bg-green-100" : step === n ? "bg-blue-100" : "bg-gray-100"
              }`}>
                {step > n ? <Check className="size-3" /> : n}
              </span>
              {label}
            </div>
          ))}
        </div>

        <div className="p-8">
          {/* ── Step 1: Workspace ── */}
          {step === 1 && (
            <form onSubmit={handleCreateOrg} className="space-y-5">
              <div>
                <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">Step 1 of 3</p>
                <h2 className="text-lg font-semibold text-gray-900 mt-1">Set up your workspace</h2>
                <p className="text-sm text-gray-500 mt-1">A few details about your business. Next, you&apos;ll add your team.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Business name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. The Corner Café"
                  className={INPUT_CLASS}
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Country
                  </label>
                  <select
                    value={country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className={SELECT_CLASS}
                    required
                  >
                    <option value="" disabled>Select…</option>
                    {COUNTRIES.map(({ code, name }) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    {CURRENCIES.map(({ code, label }) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Industry <span className="normal-case font-normal text-gray-400">(optional — tailors your starter roles)</span>
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className={SELECT_CLASS}
                >
                  {INDUSTRIES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading || !orgName.trim() || !country}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Creating…" : (
                  <>Create workspace <ChevronRight className="size-4" /></>
                )}
              </button>
            </form>
          )}

          {/* ── Step 2: Add team ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">Step 2 of 3</p>
                <h2 className="text-lg font-semibold text-gray-900 mt-1">Add your team</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Add employees now, or go straight to your schedule and add them later.
                </p>
              </div>

              {addedEmployees.length > 0 && (
                <div className="space-y-1.5">
                  {addedEmployees.map((name) => (
                    <div key={name} className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="size-3.5 text-green-500 shrink-0" />
                      {name} added
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Name</label>
                  <input
                    type="text"
                    value={empName}
                    onChange={(e) => setEmpName(e.target.value)}
                    placeholder="Jane Smith"
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Email <span className="normal-case font-normal text-gray-400">(for shift portal access)</span>
                  </label>
                  <input
                    type="email"
                    value={empEmail}
                    onChange={(e) => setEmpEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Job role</label>
                    <select
                      value={empRole}
                      onChange={(e) => {
                        if (e.target.value === ADD_ROLE) { setAddingRole(true); setRoleError(null) }
                        else setEmpRole(e.target.value)
                      }}
                      className={SELECT_CLASS}
                    >
                      {availableRoles.map((r) => <option key={r} value={r}>{r}</option>)}
                      <option value={ADD_ROLE}>+ Add a role…</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Hourly wage</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                        {CURRENCIES.find((c) => c.code === currency)?.symbol ?? ""}
                      </span>
                      <input
                        type="number"
                        value={empWage}
                        onChange={(e) => { setEmpWage(e.target.value); setEmpError(null) }}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className={`${INPUT_CLASS} pl-9`}
                      />
                    </div>
                  </div>
                </div>
                {addingRole && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">New role</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newRole}
                        onChange={(e) => { setNewRole(e.target.value); setRoleError(null) }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddRole() } }}
                        placeholder="e.g. Sales associate"
                        className={INPUT_CLASS}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddRole}
                        disabled={savingRole || !newRole.trim()}
                        className="shrink-0 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {savingRole ? "Adding…" : "Add"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAddingRole(false); setNewRole(""); setRoleError(null) }}
                        className="shrink-0 px-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                    {roleError && <p className="text-xs text-red-600">{roleError}</p>}
                  </div>
                )}
                {empError && <p className="text-xs text-red-600">{empError}</p>}
                <button
                  onClick={handleAddEmployee}
                  disabled={addingEmp || !empName.trim() || !empEmail.trim() || !(parseFloat(empWage) > 0)}
                  className="w-full text-sm font-medium py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {addingEmp ? "Adding…" : "+ Add employee"}
                </button>
              </div>

              <button
                onClick={() => setStep(3)}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {addedEmployees.length > 0 ? "Continue" : "Add later"}
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}

          {/* ── Step 3: Install the app ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">Step 3 of 3</p>
                <h2 className="text-lg font-semibold text-gray-900 mt-1">Get the app</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Add Skemaka to your phone for one-tap access. You can always do this later.
                </p>
              </div>

              <InstallPrompt />

              <button
                onClick={() => router.push("/schedule")}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Finish — go to schedule
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm">
        <Info className="size-4 shrink-0 text-blue-500" />
        You can change any of this later in Settings.
      </div>
    </div>
  )
}
