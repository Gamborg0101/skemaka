import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  Check, X, ShieldCheck, Lock, Download, AlertTriangle, GripVertical, Send,
  Coins, Smartphone, FileSpreadsheet, CalendarCheck, MessageSquare,
} from "lucide-react"
import { PRICE_PER_EMPLOYEE_MONTHLY, PLAN_CURRENCY, TRIAL_DAYS } from "@/lib/pricing"
import { PricingCalculator } from "@/components/marketing/PricingCalculator"
import { SchedulePreview } from "@/components/marketing/SchedulePreview"
import { DEMO_FLAGS, demoWeekSummary } from "@/lib/demo/demoData"
import { LogoLockup } from "@/components/brand/Logo"

const cost = demoWeekSummary()

// ── Trust signals ──────────────────────────────────────────────────────────────
const TRUST_SIGNALS = [
  { icon: Lock, title: "Payments handled by Stripe", description: "Card details never touch our servers." },
  { icon: ShieldCheck, title: "GDPR-compliant, EU-hosted", description: "Your team's data stays in the EU." },
  { icon: Download, title: "Your data is yours", description: "Export to CSV or delete everything, anytime." },
]

// ── The three things people actually use ───────────────────────────────────────
const BENEFITS = [
  { icon: Coins, title: "Live wage cost", text: "The week's labour total updates as you place each shift." },
  { icon: MessageSquare, title: "SMS when you publish", text: "Staff get their shifts texted to them — no group chat." },
  { icon: CalendarCheck, title: "Availability & time-off", text: "Staff send when they can work; requests land in one place." },
  { icon: AlertTriangle, title: "Conflict warnings", text: "Rostered someone who's off? Skemaka flags it before publish." },
  { icon: FileSpreadsheet, title: "CSV for payroll", text: "Export hours and pay for the bookkeeper in one click." },
  { icon: Smartphone, title: "Free staff app", text: "iPhone and Android. Staff see shifts and clock in." },
]

// ── Old way vs Skemaka (the contrast) ──────────────────────────────────────────
const OLD_WAY = [
  "Build it in a spreadsheet, then photograph it into the group chat",
  "“Can anyone cover Saturday?” — sent to twelve, one replies",
  "Find out you overspent on wages only once payroll lands",
  "Put someone on a day they'd already booked off",
]
const NEW_WAY = [
  "Drag names onto the week — copy last week and tweak in seconds",
  "Publish once; everyone gets their shifts by text and in the app",
  "Watch the wage total add up before you commit to the week",
  "Skemaka flags time-off and availability clashes before you publish",
]

// ── FAQ ─────────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "How do my staff get their shifts?",
    a: "You publish, and everyone gets a text with their shifts. They can also open the free app or a web link — no setup from them, no printing.",
  },
  {
    q: "Do staff need to create an account?",
    a: "No. You add them, they get an invite link. They sign in with Google or Apple and they're in — most are set up in under a minute.",
  },
  {
    q: "What does it actually cost?",
    a: `${PLAN_CURRENCY}${PRICE_PER_EMPLOYEE_MONTHLY} per active employee per month. Deactivate someone for the season and you stop paying for them. No tiers, no setup fee.`,
  },
  {
    q: "Can I export hours for payroll?",
    a: "Yes — the labour cost view exports to CSV with hours, wage, and total pay per person, ready for your bookkeeper or payroll software.",
  },
  {
    q: "Is there a contract?",
    a: `No. ${TRIAL_DAYS} days free with no card, then month to month. Cancel whenever — you keep access until the end of the period.`,
  },
  {
    q: "I run more than one venue.",
    a: "Each venue is its own workspace today. Multi-venue under one login is on the way — get in touch and we'll set you up.",
  },
]

// ── Page ─────────────────────────────────────────────────────────────────────
export const metadata = {
  title: "Skemaka — Rota & shift scheduling for restaurants",
  description:
    "Build the week's rota, see the wage cost before you publish, and text shifts to your team. Scheduling built for restaurants and cafés.",
}

export default async function HomePage() {
  const session = await auth()
  if (session?.user) redirect("/schedule")

  return (
    <div className="min-h-dvh bg-white">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 left-1/4 size-[28rem] rounded-full bg-blue-600/10 blur-3xl" />

        <nav className="relative max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <LogoLockup className="text-white [--logo-accent:#60a5fa]" wordClassName="text-lg" />
          <div className="flex items-center gap-5">
            <Link href="/demo" className="text-sm font-medium text-white/60 hover:text-white transition-colors">See the demo</Link>
            <Link href="/login" className="text-sm font-medium text-white/60 hover:text-white transition-colors">Sign in →</Link>
          </div>
        </nav>

        {/* Centred headline */}
        <div className="relative max-w-3xl mx-auto px-6 pt-12 text-center">
          <p className="text-sm font-semibold text-blue-400 mb-4">Rota software for restaurants &amp; cafés</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-[1.1] tracking-tight">
            Do the rota in 20 minutes —<br className="hidden sm:block" /> not on a Sunday night.
          </h1>
          <p className="mt-5 text-lg text-slate-400 leading-relaxed max-w-xl mx-auto">
            Build the week, watch the wage cost add up as you go, then text everyone their
            shifts. Instead of a spreadsheet and chasing cover on WhatsApp.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login" className="inline-flex items-center justify-center h-11 px-7 rounded-lg bg-white text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
              Start free trial
            </Link>
            <Link href="/demo" className="inline-flex items-center justify-center h-11 px-7 rounded-lg border border-white/15 text-sm font-medium text-white/80 hover:text-white hover:border-white/30 transition-colors">
              See the demo restaurant →
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            {TRIAL_DAYS} days free · then {PLAN_CURRENCY}{PRICE_PER_EMPLOYEE_MONTHLY} per active employee/mo · no card needed
          </p>
        </div>

        {/* Annotated product preview — small cards tell you what you're seeing */}
        <div className="relative max-w-2xl mx-auto px-6 pt-12 pb-8">
          <div className="relative">
            <SchedulePreview />
            <div className="hidden sm:flex absolute -right-5 top-9 items-center gap-2 rounded-xl bg-white shadow-xl ring-1 ring-black/5 px-3 py-2">
              <Coins className="size-4 text-emerald-600 shrink-0" />
              <div className="text-left">
                <p className="text-[11px] font-semibold text-gray-900 leading-none">Wage cost, live</p>
                <p className="text-[10px] text-gray-400 mt-1">updates as you add shifts</p>
              </div>
            </div>
            <div className="hidden sm:flex absolute -left-5 bottom-10 items-center gap-2 rounded-xl bg-white shadow-xl ring-1 ring-black/5 px-3 py-2">
              <AlertTriangle className="size-4 text-red-500 shrink-0" />
              <div className="text-left">
                <p className="text-[11px] font-semibold text-gray-900 leading-none">Conflict caught</p>
                <p className="text-[10px] text-gray-400 mt-1">Tom&apos;s on leave — flagged</p>
              </div>
            </div>
          </div>

          {/* Plain legend so the colours are obvious */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded bg-amber-400" /> Kitchen</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded bg-blue-400" /> Front of house</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded bg-purple-400" /> Bar</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded ring-2 ring-red-500" /> Conflict</span>
          </div>
        </div>

        <div className="relative pb-16 text-center">
          <p className="text-xs text-slate-500">Replaces the spreadsheet, the WhatsApp group, and the printout on the fridge.</p>
        </div>
      </div>

      {/* ── Trust strip ───────────────────────────────────────────────────── */}
      <div className="border-b border-gray-100 bg-white py-8">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {TRUST_SIGNALS.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex items-start gap-3">
              <Icon className="size-5 text-slate-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-900">{title}</p>
                <p className="text-xs text-gray-500">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── The problem ────────────────────────────────────────────────────── */}
      <section className="py-20 border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
            The rota shouldn&apos;t eat your evening
          </h2>
          <p className="mt-4 text-lg text-gray-500 leading-relaxed">
            Most places still run it off a spreadsheet and a group chat. So every week you&apos;re
            guessing who&apos;s free, missing that someone booked Friday off, and only finding out
            you went over on wages once payroll lands.
          </p>
          <div className="mt-10 grid md:grid-cols-2 gap-6">
            {/* The old way */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-7">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                The Sunday-night way
              </p>
              <ul className="mt-5 space-y-3.5">
                {OLD_WAY.map((line) => (
                  <li key={line} className="flex items-start gap-3 text-gray-500">
                    <X className="size-4 text-gray-300 shrink-0 mt-0.5" />
                    <span className="text-sm leading-relaxed">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* With Skemaka */}
            <div className="rounded-2xl border-2 border-slate-900 bg-white p-7 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-900">
                With Skemaka
              </p>
              <ul className="mt-5 space-y-3.5">
                {NEW_WAY.map((line) => (
                  <li key={line} className="flex items-start gap-3 text-gray-800">
                    <Check className="size-4 text-green-600 shrink-0 mt-0.5" />
                    <span className="text-sm leading-relaxed">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── How a week works ───────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-20 border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight text-center">How a week works</h2>
          <div className="mt-12 grid md:grid-cols-3 gap-8">
            {[
              { n: 1, icon: CalendarCheck, t: "Staff send availability", d: "They tap the days they can work from a link. No more asking around." },
              { n: 2, icon: GripVertical, t: "You build the rota", d: "Drag names onto days. The wage total adds up live, so an expensive week shows up before you publish it." },
              { n: 3, icon: Send, t: "Publish — everyone knows", d: "One tap texts everyone their shifts and puts them in the app. Nothing on the fridge." },
            ].map(({ n, icon: Icon, t, d }) => (
              <div key={n} className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="inline-flex items-center justify-center size-9 rounded-lg bg-slate-900 text-white">
                    <Icon className="size-4" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Step {n}</span>
                </div>
                <h3 className="text-base font-semibold text-gray-900">{t}</h3>
                <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Solution deep-dives (live visuals, not screenshots) ────────────── */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6 space-y-20">

          {/* Build the rota */}
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Build the rota by dragging names</h3>
              <p className="mt-3 text-gray-500 leading-relaxed">
                Drop people onto shifts. Copy last week and tweak it. It&apos;s the bit you do every
                week — so it&apos;s built to be fast, not clever.
              </p>
            </div>
            <SchedulePreview />
          </div>

          {/* Wage cost */}
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className="lg:order-2">
              <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Know the cost before you publish</h3>
              <p className="mt-3 text-gray-500 leading-relaxed">
                Every shift adds to the running wage total. Spot the heavy Saturday while you can
                still change it — not when payroll lands.
              </p>
            </div>
            <div className="lg:order-1 grid grid-cols-3 gap-3">
              {[
                { label: "This week", value: `${cost.totalHours}h` },
                { label: "Wage cost", value: `${PLAN_CURRENCY}${cost.totalCost.toLocaleString()}` },
                { label: "Avg rate", value: `${PLAN_CURRENCY}${cost.avgRate}` },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-4 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{s.label}</p>
                  <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Catch problems */}
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Catch problems before staff do</h3>
              <p className="mt-3 text-gray-500 leading-relaxed">
                Put someone on a day they&apos;re off, or one they marked unavailable, and Skemaka
                tells you — before you publish, not after the complaint.
              </p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
                <AlertTriangle className="size-4" /> {DEMO_FLAGS.length} things to fix before publishing
              </p>
              <ul className="mt-2 space-y-1.5 text-sm text-red-700">
                {DEMO_FLAGS.map((f) => (
                  <li key={`${f.staffId}:${f.day}`}>• {f.note}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Benefit grid ───────────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-20 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight text-center">
            Everything a restaurant rota actually needs
          </h2>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-8">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-3">
                <span className="shrink-0 size-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                  <Icon className="size-4 text-slate-700" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{title}</p>
                  <p className="mt-0.5 text-sm text-gray-500 leading-relaxed">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <section className="py-20 border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Pay for who&apos;s working</h2>
            <p className="mt-3 text-base text-gray-500">
              <span className="font-semibold text-gray-900">{PLAN_CURRENCY}{PRICE_PER_EMPLOYEE_MONTHLY} per active employee / month.</span>{" "}
              No tiers, no setup fee, cancel anytime.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 items-start">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="bg-slate-900 px-8 py-7 text-center">
                <div className="flex items-end justify-center gap-1">
                  <span className="text-5xl font-bold text-white tabular-nums">{PLAN_CURRENCY}{PRICE_PER_EMPLOYEE_MONTHLY}</span>
                  <span className="text-white/40 pb-1.5 text-base">/ employee / mo</span>
                </div>
                <p className="mt-2 text-sm text-white/35">{TRIAL_DAYS} days free — billed only for active staff</p>
              </div>
              <div className="px-8 py-6 space-y-2.5">
                {[
                  "Only pay for active staff",
                  "Unlimited rotas, shifts & history",
                  "Availability, time-off & SMS alerts",
                  "Labour cost + CSV payroll export",
                  "Free staff app (iOS & Android)",
                ].map((f) => (
                  <div key={f} className="flex items-center gap-3">
                    <Check className="size-4 text-green-600 shrink-0" />
                    <span className="text-sm text-gray-700">{f}</span>
                  </div>
                ))}
              </div>
              <div className="px-8 pb-7">
                <Link href="/login" className="flex w-full h-11 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 transition-colors">
                  Start {TRIAL_DAYS}-day free trial
                </Link>
                <p className="mt-3 text-center text-xs text-gray-400">No credit card required</p>
              </div>
            </div>

            <div className="lg:pt-2">
              <p className="text-sm font-semibold text-gray-900 mb-3">What will it cost me?</p>
              <PricingCalculator />
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight text-center mb-10">
            Questions owners ask
          </h2>
          <div className="divide-y divide-gray-100 border-y border-gray-100">
            {FAQS.map(({ q, a }) => (
              <details key={q} className="group py-4">
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <span className="text-sm font-semibold text-gray-900 pr-4">{q}</span>
                  <span className="text-gray-400 group-open:rotate-45 transition-transform text-lg leading-none">+</span>
                </summary>
                <p className="mt-3 text-sm text-gray-500 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────────────────── */}
      <section className="bg-slate-900">
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Get next week&apos;s rota off WhatsApp.
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Try it on the demo restaurant, or start free with your own team.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/login" className="inline-flex items-center justify-center h-12 px-10 rounded-lg bg-white text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
              Start free trial
            </Link>
            <Link href="/demo" className="inline-flex items-center justify-center h-12 px-10 rounded-lg border border-white/15 text-sm font-medium text-white/80 hover:text-white hover:border-white/30 transition-colors">
              See the demo →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <LogoLockup className="text-slate-900" markClassName="size-6" wordClassName="text-sm font-semibold" />
          <nav className="flex items-center gap-6">
            <Link href="/demo" className="hover:text-gray-600 transition-colors">Demo</Link>
            <Link href="/terms" className="hover:text-gray-600 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy</Link>
          </nav>
          <span>© {new Date().getFullYear()} Skemaka ApS</span>
        </div>
      </footer>

    </div>
  )
}
