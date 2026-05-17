"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronRight } from "lucide-react"

type Step = 1 | 2

const CURRENCIES = [
  { code: "EUR", label: "Euro (€)" },
  { code: "USD", label: "US Dollar ($)" },
  { code: "GBP", label: "British Pound (£)" },
  { code: "DKK", label: "Danish Krone (kr)" },
  { code: "SEK", label: "Swedish Krona (kr)" },
  { code: "NOK", label: "Norwegian Krone (kr)" },
]

const DEFAULT_ROLES = ["Waiter", "Chef", "Bartender", "Manager", "Host", "Cashier"]

const STEPS = [
  { n: 1 as Step, label: "Workspace" },
  { n: 2 as Step, label: "Team" },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1
  const [orgName, setOrgName] = useState("")
  const [currency, setCurrency] = useState("EUR")

  // After step 1
  const [orgId, setOrgId] = useState<string | null>(null)

  // Step 2
  const [empName, setEmpName] = useState("")
  const [empEmail, setEmpEmail] = useState("")
  const [empRole, setEmpRole] = useState(DEFAULT_ROLES[0])
  const [empWage, setEmpWage] = useState("")
  const [addedEmployees, setAddedEmployees] = useState<string[]>([])
  const [addingEmp, setAddingEmp] = useState(false)

  // If user already has an org, redirect them away
  useEffect(() => {
    fetch("/api/me/context")
      .then((r) => { if (r.ok) router.replace("/schedule") })
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [router])

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault()
    if (!orgName.trim()) return
    setLoading(true)
    setError(null)
    try {
      const r = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName.trim(), currency }),
      })
      const data = await r.json() as { data?: { id: string }; error?: string }
      if (!r.ok) throw new Error(data.error ?? "Failed to create workspace")
      setOrgId(data.data!.id)
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  async function handleAddEmployee() {
    if (!orgId || !empName.trim() || !empEmail.trim()) return
    setAddingEmp(true)
    try {
      await fetch(`/api/orgs/${orgId}/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: empName.trim(),
          email: empEmail.trim(),
          phone: null,
          jobRole: empRole,
          hourlyWage: parseFloat(empWage) || 0,
          employmentType: "FULL_TIME",
          contractedHours: 37,
          notes: null,
        }),
      })
      setAddedEmployees((prev) => [...prev, empName.trim()])
      setEmpName("")
      setEmpEmail("")
      setEmpWage("")
    } catch {
      // non-critical — employee can be added later
    } finally {
      setAddingEmp(false)
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
                <h2 className="text-lg font-semibold text-gray-900">Set up your workspace</h2>
                <p className="text-sm text-gray-500 mt-1">Tell us about your business.</p>
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
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {CURRENCIES.map(({ code, label }) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading || !orgName.trim()}
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
                <h2 className="text-lg font-semibold text-gray-900">Add your team</h2>
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
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Job role</label>
                    <select
                      value={empRole}
                      onChange={(e) => setEmpRole(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {DEFAULT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Hourly wage</label>
                    <input
                      type="number"
                      value={empWage}
                      onChange={(e) => setEmpWage(e.target.value)}
                      placeholder="15.00"
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <button
                  onClick={handleAddEmployee}
                  disabled={addingEmp || !empName.trim() || !empEmail.trim()}
                  className="w-full text-sm font-medium py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {addingEmp ? "Adding…" : "+ Add employee"}
                </button>
              </div>

              <button
                onClick={() => router.push("/schedule")}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {addedEmployees.length > 0 ? "Go to schedule" : "Skip — go to schedule"}
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-400">All settings can be changed later.</p>
    </div>
  )
}
