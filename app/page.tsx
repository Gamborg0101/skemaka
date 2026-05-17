import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Calendar, DollarSign, Clock, Users, Shield, TrendingUp, Check } from "lucide-react"

// ── Pricing constants — update these to change what the landing page shows ────
const PLAN_PRICE_MONTHLY = 49
const PLAN_CURRENCY = "€"
const TRIAL_DAYS = 14

// ── Feature tiles ─────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Calendar,
    title: "Drag-and-drop scheduling",
    description: "Build the week's rota in minutes. Move shifts, fill gaps, and publish to your whole team in one click.",
  },
  {
    icon: DollarSign,
    title: "Live labour costs",
    description: "Wage spend updates as you place each shift — so you never go over budget.",
  },
  {
    icon: Clock,
    title: "Collect availability before you schedule",
    description: "Send a link to your team. They fill in when they're free. You schedule around it.",
  },
  {
    icon: Users,
    title: "Staff see their shifts on their phone",
    description: "Everyone on your team gets a personal shift view — no printing, no group chats.",
  },
  {
    icon: Shield,
    title: "Time-off management",
    description: "Staff submit requests. Approve or deny in one place — they're automatically blocked from that shift.",
  },
  {
    icon: TrendingUp,
    title: "Hours worked & payroll export",
    description: "See total hours and wage cost per person each week. Export to a spreadsheet for payroll.",
  },
]

// ── Plan feature list ─────────────────────────────────────────────────────────
const PLAN_FEATURES = [
  "Unlimited employees",
  "Drag-and-drop weekly scheduling",
  "Live labour cost tracking",
  "Availability & time-off requests",
  "Employee shift portal",
  "Payroll & cost CSV exports",
  "Schedule publishing",
  "Priority support",
]

// ── Shift preview ─────────────────────────────────────────────────────────────
const PREVIEW_SHIFTS = [
  { name: "Casper G.", role: "Supervisor", start: 10, end: 18, color: "bg-slate-400" },
  { name: "Sarah C.",  role: "Barista",    start: 7,  end: 15, color: "bg-blue-400"  },
  { name: "Tom E.",    role: "Kitchen",    start: 9,  end: 15, color: "bg-orange-400" },
  { name: "Mia A.",    role: "Cashier",    start: 11, end: 19, color: "bg-green-400"  },
]
const DAY_START = 6
const DAY_END = 22
const DAY_SPAN = DAY_END - DAY_START

function ShiftPreview() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2 mb-5">
        <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-[11px] font-medium text-white/40 uppercase tracking-widest">
          Week 20 · Live schedule
        </span>
      </div>
      <div className="space-y-3">
        {PREVIEW_SHIFTS.map((s) => {
          const offsetPct = ((s.start - DAY_START) / DAY_SPAN) * 100
          const widthPct  = ((s.end   - s.start)  / DAY_SPAN) * 100
          return (
            <div key={s.name} className="flex items-center gap-3">
              <div className="w-20 shrink-0">
                <p className="text-[12px] font-medium text-white/75 truncate">{s.name}</p>
                <p className="text-[10px] text-white/30">{s.role}</p>
              </div>
              <div className="relative flex-1 h-5">
                <div
                  className={`absolute h-full rounded-md ${s.color} opacity-75`}
                  style={{ left: `${offsetPct}%`, width: `${widthPct}%` }}
                />
              </div>
              <span className="text-[10px] text-white/25 w-16 text-right tabular-nums">
                {s.start}:00–{s.end}:00
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-white/5 flex justify-between text-[9px] text-white/15 tabular-nums">
        {["06", "09", "12", "15", "18", "21"].map((h) => (
          <span key={h}>{h}:00</span>
        ))}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export const metadata = {
  title: "Skemaka — Staff scheduling, done right",
  description:
    "Build weekly rosters, track labour costs, and collect staff availability. Scheduling built for restaurants and hospitality teams.",
}

export default async function HomePage() {
  const session = await auth()
  if (session?.user) redirect("/schedule")

  return (
    <div className="min-h-dvh bg-white">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="pointer-events-none absolute -top-40 -left-40 size-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-1/3 size-96 rounded-full bg-indigo-600/10 blur-3xl" />

        {/* Nav */}
        <nav className="relative max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <span className="text-lg font-bold text-white tracking-tight">Skemaka</span>
          <Link
            href="/login"
            className="text-sm font-medium text-white/60 hover:text-white transition-colors"
          >
            Sign in →
          </Link>
        </nav>

        {/* Copy */}
        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 mb-8">
            <span className="size-1.5 rounded-full bg-green-400" />
            <span className="text-xs font-medium text-white/50">
              {TRIAL_DAYS}-day free trial · then {PLAN_CURRENCY}{PLAN_PRICE_MONTHLY}/mo · No credit card required
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-white leading-tight tracking-tight max-w-3xl mx-auto">
            Build your week&apos;s rota<br className="hidden sm:block" /> in minutes.
          </h1>
          <p className="mt-5 text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
            No spreadsheets, no WhatsApp groups. Skemaka gives your team a live rota —
            with costs, availability, and time-off all in one place.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center h-11 px-8 rounded-lg bg-white text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-colors shadow-sm"
            >
              Start free trial
            </Link>
          </div>
        </div>

        {/* Schedule preview */}
        <div className="relative max-w-2xl mx-auto px-6 pt-8 pb-20">
          <ShiftPreview />
        </div>
      </div>

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <section className="bg-gray-50 border-b border-gray-100 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
              Simple, transparent pricing
            </h2>
            <p className="mt-3 text-base text-gray-500">
              One plan. Everything included. Cancel anytime.
            </p>
          </div>

          <div className="max-w-sm mx-auto rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-slate-900 px-8 py-8 text-center relative overflow-hidden">
              <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              />
              <p className="relative text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">
                All-inclusive
              </p>
              <div className="relative flex items-end justify-center gap-1">
                <span className="text-5xl font-bold text-white tabular-nums">
                  {PLAN_CURRENCY}{PLAN_PRICE_MONTHLY}
                </span>
                <span className="text-white/40 pb-1.5 text-base">/month</span>
              </div>
              <p className="relative mt-2 text-sm text-white/35">
                {TRIAL_DAYS} days free, then {PLAN_CURRENCY}{PLAN_PRICE_MONTHLY}/mo
              </p>
            </div>

            <div className="px-8 py-7 space-y-3">
              {PLAN_FEATURES.map((feat) => (
                <div key={feat} className="flex items-center gap-3">
                  <Check className="size-4 text-green-600 shrink-0" />
                  <span className="text-sm text-gray-700">{feat}</span>
                </div>
              ))}
            </div>

            <div className="px-8 pb-8">
              <Link
                href="/login"
                className="flex w-full h-11 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                Start {TRIAL_DAYS}-day free trial
              </Link>
              <p className="mt-3 text-center text-xs text-gray-400">
                No credit card required
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
            Everything you need to run a tight schedule
          </h2>
          <p className="mt-3 text-base text-gray-500 max-w-lg mx-auto">
            One tool for the full scheduling workflow — from collecting availability to exporting hours for payroll.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex flex-col gap-3">
              <div className="size-10 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                <Icon className="size-5 text-white/70" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <span className="font-semibold text-gray-900 tracking-tight">Skemaka</span>
          <nav className="flex items-center gap-6">
            <Link href="/terms" className="hover:text-gray-600 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy</Link>
          </nav>
          <span>© {new Date().getFullYear()} Skemaka ApS</span>
        </div>
      </footer>

    </div>
  )
}
