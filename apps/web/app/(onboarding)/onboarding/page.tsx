"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Check, ChevronRight, ChevronLeft, Info, ShieldCheck } from "lucide-react"
import { InstallPrompt } from "@/components/pwa/InstallPrompt"
import { ROLE_COLOR_TOKENS } from "@/lib/roleColors"

type Step = 1 | 2 | 3

// Labels come from the onboarding.currencies catalog, keyed by code.
const CURRENCIES = [
  { code: "EUR", symbol: "€" },
  { code: "USD", symbol: "$" },
  { code: "GBP", symbol: "£" },
  { code: "DKK", symbol: "kr" },
  { code: "SEK", symbol: "kr" },
  { code: "NOK", symbol: "kr" },
] as const

// Country drives the currency + time-format defaults. Limited to countries whose
// currency we support today (see VALID_CURRENCIES in orgService). "Other" lets
// anyone proceed with sensible EUR defaults. Names come from the
// onboarding.countries catalog, keyed by code.
const COUNTRIES: { code: string; currency: string; timeFormat: "12h" | "24h" }[] = [
  { code: "DK", currency: "DKK", timeFormat: "24h" },
  { code: "SE", currency: "SEK", timeFormat: "24h" },
  { code: "NO", currency: "NOK", timeFormat: "24h" },
  { code: "GB", currency: "GBP", timeFormat: "24h" },
  { code: "US", currency: "USD", timeFormat: "12h" },
  { code: "IE", currency: "EUR", timeFormat: "24h" },
  { code: "DE", currency: "EUR", timeFormat: "24h" },
  { code: "FR", currency: "EUR", timeFormat: "24h" },
  { code: "ES", currency: "EUR", timeFormat: "24h" },
  { code: "IT", currency: "EUR", timeFormat: "24h" },
  { code: "NL", currency: "EUR", timeFormat: "24h" },
  { code: "BE", currency: "EUR", timeFormat: "24h" },
  { code: "AT", currency: "EUR", timeFormat: "24h" },
  { code: "PT", currency: "EUR", timeFormat: "24h" },
  { code: "FI", currency: "EUR", timeFormat: "24h" },
  { code: "OTHER", currency: "EUR", timeFormat: "24h" },
]

// Optional — tailors the starter job roles (see lib/seedDefaultRoles.ts).
// Labels come from the onboarding.industries catalog.
const INDUSTRIES = [
  { value: "", labelKey: "none" },
  { value: "restaurant", labelKey: "restaurant" },
  { value: "cafe", labelKey: "cafe" },
  { value: "retail", labelKey: "retail" },
  { value: "hospitality", labelKey: "hospitality" },
  { value: "healthcare", labelKey: "healthcare" },
  { value: "salon", labelKey: "salon" },
  { value: "fitness", labelKey: "fitness" },
  { value: "warehouse", labelKey: "warehouse" },
  { value: "cleaning", labelKey: "cleaning" },
  { value: "childcare", labelKey: "childcare" },
  { value: "security", labelKey: "security" },
  { value: "other", labelKey: "other" },
] as const

// Fallback only. The real options are fetched from the org right after it's
// created (see handleCreateOrg), so the dropdown always matches the job roles
// actually seeded in the database. Mirrors lib/seedDefaultRoles.ts.
const FALLBACK_ROLES = ["Staff", "Shift lead", "Manager"]

// Cycled through when a user adds a custom role inline, so new roles get varied
// colors. Uses the shared role-color palette (see lib/roleColors.ts).
const ROLE_COLORS = ROLE_COLOR_TOKENS

// Sentinel option value that triggers the inline "add a role" input.
const ADD_ROLE = "__add_role__"

const STEPS = [
  { n: 1 as Step, labelKey: "step1Label", descKey: "step1Desc" },
  { n: 2 as Step, labelKey: "step2Label", descKey: "step2Desc" },
  { n: 3 as Step, labelKey: "step3Label", descKey: "step3Desc" },
] as const

// Explicit text + placeholder colors so inputs don't inherit the themed
// (possibly near-white) foreground on these intentionally light-themed pages.
const INPUT_CLASS =
  "w-full px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
const SELECT_CLASS =
  "w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"

export default function OnboardingPage() {
  const t = useTranslations("onboarding")
  const tCommon = useTranslations("common")
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

      // If the org already exists (user went back to step 1 to fix something),
      // update it in place instead of creating a duplicate.
      if (orgId) {
        const r = await fetch(`/api/orgs/${orgId}`, {
          method: "PATCH",
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
        const data = await r.json() as { error?: string }
        if (!r.ok) throw new Error(data.error ?? t("step1.errUpdate"))
        setStep(2)
        return
      }

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
      if (!r.ok) throw new Error(data.error ?? t("step1.errCreate"))
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
      setError(err instanceof Error ? err.message : tCommon("somethingWentWrong"))
    } finally {
      setLoading(false)
    }
  }

  async function handleAddEmployee() {
    if (!orgId || !empName.trim() || !empEmail.trim()) return
    const wage = parseFloat(empWage)
    if (!(wage > 0)) {
      setEmpError(t("step2.wageError"))
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
      if (!r.ok) throw new Error(data.error ?? t("step2.errAddEmployee"))
      setAddedEmployees((prev) => [...prev, empName.trim()])
      setEmpName("")
      setEmpEmail("")
      setEmpWage("")
    } catch (err) {
      setEmpError(err instanceof Error ? err.message : t("step2.errAddEmployee"))
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
      if (!r.ok) throw new Error(data.error ?? t("step2.errAddRole"))
      setAvailableRoles((prev) => [...prev, name])
      setEmpRole(name)
      setAddingRole(false)
      setNewRole("")
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : t("step2.errAddRole"))
    } finally {
      setSavingRole(false)
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="size-6 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(0,440px)_1fr]">
      {/* ── Brand panel (desktop) ── */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-blue-950 px-10 py-12 text-white lg:flex">
        {/* soft decorative glows */}
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -left-20 bottom-0 size-72 rounded-full bg-blue-600/10 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/skemaka-mark-white.svg" alt="" className="size-8" />
            <span className="text-lg font-bold tracking-tight">Skemaka</span>
          </div>

          <h1 className="mt-16 text-3xl font-bold leading-tight tracking-tight">
            {t("brand.title1")}<br />{t("brand.title2")}
          </h1>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-300">
            {t("brand.sub")}
          </p>

          <ol className="mt-12 space-y-5">
            {STEPS.map(({ n, labelKey, descKey }) => {
              const done = step > n
              const active = step === n
              return (
                <li key={n} className="flex items-start gap-3.5">
                  <span
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                      done
                        ? "border-blue-400 bg-blue-400 text-slate-900"
                        : active
                        ? "border-blue-400 bg-blue-400/15 text-white"
                        : "border-white/20 text-slate-400"
                    }`}
                  >
                    {done ? <Check className="size-3.5" /> : n}
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${active || done ? "text-white" : "text-slate-400"}`}>{t(`steps.${labelKey}`)}</p>
                    <p className="text-xs text-slate-400">{t(`steps.${descKey}`)}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="size-4 text-blue-400" />
          {t("brand.trialNote")}
        </div>
      </aside>

      {/* ── Form panel ── */}
      <main className="flex min-h-screen flex-col">
        {/* Mobile brand header + progress */}
        <div className="bg-gradient-to-r from-slate-900 to-blue-950 px-5 py-5 text-white lg:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/skemaka-mark-white.svg" alt="" className="size-6" />
              <span className="text-base font-bold tracking-tight">Skemaka</span>
            </div>
            <span className="text-xs font-medium text-slate-300">{t("brand.stepOf", { step })}</span>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-blue-400 transition-all duration-300"
              style={{ width: `${(step / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex flex-1 items-start justify-center px-5 py-10 sm:px-10 lg:items-center">
          <div className="w-full max-w-md">
          {/* ── Step 1: Workspace ── */}
          {step === 1 && (
            <form onSubmit={handleCreateOrg} className="space-y-5">
              <div>
                <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">{t("brand.stepOf", { step: 1 })}</p>
                <h2 className="text-lg font-semibold text-gray-900 mt-1">{t("step1.title")}</h2>
                <p className="text-sm text-gray-500 mt-1">{t("step1.sub")}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  {t("step1.nameLabel")}
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder={t("step1.namePlaceholder")}
                  className={INPUT_CLASS}
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    {t("step1.countryLabel")}
                  </label>
                  <select
                    value={country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className={SELECT_CLASS}
                    required
                  >
                    <option value="" disabled>{t("step1.selectPlaceholder")}</option>
                    {COUNTRIES.map(({ code }) => (
                      <option key={code} value={code}>{t(`countries.${code}` as "countries.DK")}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    {t("step1.currencyLabel")}
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    {CURRENCIES.map(({ code }) => (
                      <option key={code} value={code}>{t(`currencies.${code}`)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  {t("step1.industryLabel")} <span className="normal-case font-normal text-gray-400">{t("step1.industryOptional")}</span>
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className={SELECT_CLASS}
                >
                  {INDUSTRIES.map(({ value, labelKey }) => (
                    <option key={value} value={value}>{t(`industries.${labelKey}`)}</option>
                  ))}
                </select>
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading || !orgName.trim() || !country}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (orgId ? tCommon("saving") : tCommon("creating")) : (
                  <>{orgId ? t("step1.saveBtn") : t("step1.createBtn")} <ChevronRight className="size-4" /></>
                )}
              </button>
            </form>
          )}

          {/* ── Step 2: Add team ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">{t("brand.stepOf", { step: 2 })}</p>
                <h2 className="text-lg font-semibold text-gray-900 mt-1">{t("step2.title")}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {t("step2.sub")}
                </p>
              </div>

              {addedEmployees.length > 0 && (
                <div className="space-y-1.5">
                  {addedEmployees.map((name) => (
                    <div key={name} className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="size-3.5 text-green-500 shrink-0" />
                      {t("step2.added", { name })}
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{t("step2.nameLabel")}</label>
                  <input
                    type="text"
                    value={empName}
                    onChange={(e) => setEmpName(e.target.value)}
                    placeholder={t("step2.namePlaceholder")}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    {t("step2.emailLabel")} <span className="normal-case font-normal text-gray-400">{t("step2.emailNote")}</span>
                  </label>
                  <input
                    type="email"
                    value={empEmail}
                    onChange={(e) => setEmpEmail(e.target.value)}
                    placeholder={t("step2.emailPlaceholder")}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{t("step2.roleLabel")}</label>
                    <select
                      value={empRole}
                      onChange={(e) => {
                        if (e.target.value === ADD_ROLE) { setAddingRole(true); setRoleError(null) }
                        else setEmpRole(e.target.value)
                      }}
                      className={SELECT_CLASS}
                    >
                      {availableRoles.map((r) => <option key={r} value={r}>{r}</option>)}
                      <option value={ADD_ROLE}>{t("step2.addRoleOption")}</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{t("step2.wageLabel")}</label>
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
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{t("step2.newRoleLabel")}</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newRole}
                        onChange={(e) => { setNewRole(e.target.value); setRoleError(null) }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddRole() } }}
                        placeholder={t("step2.newRolePlaceholder")}
                        className={INPUT_CLASS}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddRole}
                        disabled={savingRole || !newRole.trim()}
                        className="shrink-0 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {savingRole ? tCommon("adding") : tCommon("add")}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAddingRole(false); setNewRole(""); setRoleError(null) }}
                        className="shrink-0 px-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        {tCommon("cancel")}
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
                  {addingEmp ? tCommon("adding") : t("step2.addEmployee")}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(null) }}
                  className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft className="size-4" /> {tCommon("back")}
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex flex-1 items-center justify-center gap-2 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {addedEmployees.length > 0 ? tCommon("continue") : t("step2.addLater")}
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Install the app ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">{t("brand.stepOf", { step: 3 })}</p>
                <h2 className="text-lg font-semibold text-gray-900 mt-1">{t("step3.title")}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {t("step3.sub")}
                </p>
              </div>

              <InstallPrompt />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft className="size-4" /> {tCommon("back")}
                </button>
                <button
                  onClick={() => router.push("/schedule")}
                  className="flex flex-1 items-center justify-center gap-2 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t("step3.finish")}
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}
          <div className="mt-6 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-600">
            <Info className="size-4 shrink-0 text-blue-500" />
            {t("changeLater")}
          </div>
          </div>
        </div>
      </main>
    </div>
  )
}
