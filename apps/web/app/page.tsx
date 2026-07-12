import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import {
  Check, X, ShieldCheck, Lock, Download, AlertTriangle, GripVertical, Send,
  Coins, Smartphone, FileSpreadsheet, CalendarCheck, MessageSquare, Clock, Wallet,
} from "lucide-react"
import {
  PRICE_PER_EMPLOYEE_MONTHLY, PLAN_CURRENCY, TRIAL_DAYS,
  hoursSavedPerMonth, MANUAL_SCHEDULING_MINUTES, SKEMAKA_SCHEDULING_MINUTES,
} from "@/lib/pricing"
import { PricingCalculator } from "@/components/marketing/PricingCalculator"
import { SchedulePreview } from "@/components/marketing/SchedulePreview"
import { LangQuerySync, LocaleToggle } from "@/components/marketing/LocaleToggle"
import { DEMO_FLAGS, demoWeekSummary } from "@/lib/demo/demoData"
import { LogoLockup } from "@/components/brand/Logo"

const cost = demoWeekSummary()
const savedHrsMonth = hoursSavedPerMonth()
const manualHrs = Math.round(MANUAL_SCHEDULING_MINUTES / 60)

// ── Page ─────────────────────────────────────────────────────────────────────
export async function generateMetadata() {
  const t = await getTranslations("marketing.meta")
  return { title: t("title"), description: t("description") }
}

export default async function HomePage() {
  const session = await auth()
  if (session?.user) redirect("/schedule")

  const t = await getTranslations("marketing")
  const bold = (chunks: React.ReactNode) => (
    <span className="font-semibold text-gray-900">{chunks}</span>
  )

  const trustSignals = [
    { icon: Lock, title: t("trust.stripeTitle"), description: t("trust.stripeText") },
    { icon: ShieldCheck, title: t("trust.gdprTitle"), description: t("trust.gdprText") },
    { icon: Download, title: t("trust.dataTitle"), description: t("trust.dataText") },
  ]
  const benefits = [
    { icon: Coins, title: t("benefits.wageTitle"), text: t("benefits.wageText") },
    { icon: MessageSquare, title: t("benefits.smsTitle"), text: t("benefits.smsText") },
    { icon: CalendarCheck, title: t("benefits.availabilityTitle"), text: t("benefits.availabilityText") },
    { icon: AlertTriangle, title: t("benefits.conflictTitle"), text: t("benefits.conflictText") },
    { icon: FileSpreadsheet, title: t("benefits.csvTitle"), text: t("benefits.csvText") },
    { icon: Smartphone, title: t("benefits.appTitle"), text: t("benefits.appText") },
  ]
  const oldWay = [t("problem.old1"), t("problem.old2"), t("problem.old3"), t("problem.old4")]
  const newWay = [t("problem.new1"), t("problem.new2"), t("problem.new3"), t("problem.new4")]
  // Localized display text for the demo conflict flags rendered below. Keyed
  // 1:1 with DEMO_FLAGS — update these keys if the demo data changes.
  const flagNotes = [t("deep.flag1"), t("deep.flag2")]
  const faqs = [1, 2, 3, 4, 5, 6].map((i) => ({
    q: t(`faq.q${i}` as `faq.q1`),
    a: t(`faq.a${i}` as `faq.a1`, {
      currency: PLAN_CURRENCY,
      price: PRICE_PER_EMPLOYEE_MONTHLY,
      days: TRIAL_DAYS,
    }),
  }))

  return (
    <div className="min-h-dvh bg-white">
      <LangQuerySync />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 left-1/4 size-[28rem] rounded-full bg-blue-600/10 blur-3xl" />

        <nav className="relative max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <LogoLockup className="text-white [--logo-accent:#60a5fa]" wordClassName="text-lg" />
          <div className="flex items-center gap-5">
            <LocaleToggle variant="dark" />
            <Link href="/demo" className="text-sm font-medium text-white/60 hover:text-white transition-colors">{t("nav.demo")}</Link>
            <Link href="/login" className="text-sm font-medium text-white/60 hover:text-white transition-colors">{t("nav.signIn")}</Link>
          </div>
        </nav>

        {/* Centred headline */}
        <div className="relative max-w-3xl mx-auto px-6 pt-12 text-center">
          <p className="text-sm font-semibold text-blue-400 mb-4">{t("hero.kicker")}</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-[1.1] tracking-tight">
            {t("hero.title1")}<br className="hidden sm:block" /> {t("hero.title2")}
          </h1>
          <p className="mt-5 text-lg text-slate-400 leading-relaxed max-w-xl mx-auto">
            {t("hero.subtitle")}
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login" className="inline-flex items-center justify-center h-11 px-7 rounded-lg bg-white text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
              {t("hero.ctaTrial")}
            </Link>
            <Link href="/demo" className="inline-flex items-center justify-center h-11 px-7 rounded-lg border border-white/15 text-sm font-medium text-white/80 hover:text-white hover:border-white/30 transition-colors">
              {t("hero.ctaDemo")}
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            {t("hero.priceLine", { days: TRIAL_DAYS, currency: PLAN_CURRENCY, price: PRICE_PER_EMPLOYEE_MONTHLY })}
          </p>
        </div>

        {/* Annotated product preview — small cards tell you what you're seeing */}
        <div className="relative max-w-2xl mx-auto px-6 pt-12 pb-8">
          <div className="relative">
            <SchedulePreview />
            <div className="hidden sm:flex absolute -right-5 top-9 items-center gap-2 rounded-xl bg-white shadow-xl ring-1 ring-black/5 px-3 py-2">
              <Coins className="size-4 text-emerald-600 shrink-0" />
              <div className="text-left">
                <p className="text-[11px] font-semibold text-gray-900 leading-none">{t("hero.wageLiveTitle")}</p>
                <p className="text-[10px] text-gray-400 mt-1">{t("hero.wageLiveSub")}</p>
              </div>
            </div>
            <div className="hidden sm:flex absolute -left-5 bottom-10 items-center gap-2 rounded-xl bg-white shadow-xl ring-1 ring-black/5 px-3 py-2">
              <AlertTriangle className="size-4 text-red-500 shrink-0" />
              <div className="text-left">
                <p className="text-[11px] font-semibold text-gray-900 leading-none">{t("hero.conflictTitle")}</p>
                <p className="text-[10px] text-gray-400 mt-1">{t("hero.conflictSub")}</p>
              </div>
            </div>
          </div>

          {/* Plain legend so the colours are obvious */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded bg-amber-400" /> {t("hero.legendKitchen")}</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded bg-blue-400" /> {t("hero.legendFoh")}</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded bg-purple-400" /> {t("hero.legendBar")}</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded ring-2 ring-red-500" /> {t("hero.legendConflict")}</span>
          </div>
        </div>

        <div className="relative pb-16 text-center">
          <p className="text-xs text-slate-500">{t("hero.replaces")}</p>
        </div>
      </div>

      {/* ── Trust strip ───────────────────────────────────────────────────── */}
      <div className="border-b border-gray-100 bg-white py-8">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {trustSignals.map(({ icon: Icon, title, description }) => (
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
            {t("problem.title")}
          </h2>
          <p className="mt-4 text-lg text-gray-500 leading-relaxed">
            {t("problem.body")}
          </p>
          <div className="mt-10 grid md:grid-cols-2 gap-6">
            {/* The old way */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-7">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                {t("problem.oldLabel")}
              </p>
              <ul className="mt-5 space-y-3.5">
                {oldWay.map((line) => (
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
                {t("problem.newLabel")}
              </p>
              <ul className="mt-5 space-y-3.5">
                {newWay.map((line) => (
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
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight text-center">{t("how.title")}</h2>
          <div className="mt-12 grid md:grid-cols-3 gap-8">
            {[
              { n: 1, icon: CalendarCheck, title: t("how.step1Title"), text: t("how.step1Text") },
              { n: 2, icon: GripVertical, title: t("how.step2Title"), text: t("how.step2Text") },
              { n: 3, icon: Send, title: t("how.step3Title"), text: t("how.step3Text") },
            ].map(({ n, icon: Icon, title, text }) => (
              <div key={n} className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="inline-flex items-center justify-center size-9 rounded-lg bg-slate-900 text-white">
                    <Icon className="size-4" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{t("how.stepLabel", { n })}</span>
                </div>
                <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Solution deep-dives (live visuals, not screenshots) ────────────── */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6 space-y-20">

          {/* Build the schedule */}
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{t("deep.buildTitle")}</h3>
              <p className="mt-3 text-gray-500 leading-relaxed">
                {t("deep.buildBody")}
              </p>
            </div>
            <SchedulePreview />
          </div>

          {/* Wage cost */}
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className="lg:order-2">
              <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{t("deep.costTitle")}</h3>
              <p className="mt-3 text-gray-500 leading-relaxed">
                {t("deep.costBody")}
              </p>
            </div>
            <div className="lg:order-1 grid grid-cols-3 gap-3">
              {[
                { label: t("deep.statThisWeek"), value: `${cost.totalHours}h` },
                { label: t("deep.statWageCost"), value: `${PLAN_CURRENCY}${cost.totalCost.toLocaleString()}` },
                { label: t("deep.statAvgRate"), value: `${PLAN_CURRENCY}${cost.avgRate}` },
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
              <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{t("deep.catchTitle")}</h3>
              <p className="mt-3 text-gray-500 leading-relaxed">
                {t("deep.catchBody")}
              </p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
                <AlertTriangle className="size-4" /> {t("deep.conflictsHeader", { count: DEMO_FLAGS.length })}
              </p>
              <ul className="mt-2 space-y-1.5 text-sm text-red-700">
                {flagNotes.map((note) => (
                  <li key={note}>• {note}</li>
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
            {t("benefits.title")}
          </h2>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-8">
            {benefits.map(({ icon: Icon, title, text }) => (
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

      {/* ── What it saves you (time + money) ───────────────────────────────── */}
      <section className="py-20 border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight text-center">
            {t("savings.title")}
          </h2>
          <p className="mt-3 text-center text-base text-gray-500">
            {t("savings.subtitle")}
          </p>
          <div className="mt-10 grid md:grid-cols-2 gap-6">
            {/* Hours */}
            <div className="rounded-2xl border border-gray-200 bg-white p-7">
              <div className="flex items-center gap-3">
                <span className="size-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Clock className="size-5 text-blue-600" />
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{t("savings.hoursLabel")}</p>
              </div>
              <p className="mt-5 text-3xl font-bold text-gray-900 tracking-tight">
                {t("savings.hoursAmount", { hrs: manualHrs })} <span className="text-gray-300">→</span> {t("savings.hoursTo", { min: SKEMAKA_SCHEDULING_MINUTES })}
                <span className="ml-1 text-base font-medium text-gray-400">{t("savings.perWeek")}</span>
              </p>
              <p className="mt-3 text-sm text-gray-500 leading-relaxed">
                {t.rich("savings.hoursBody", { hours: savedHrsMonth, b: bold })}
              </p>
            </div>
            {/* Money */}
            <div className="rounded-2xl border border-gray-200 bg-white p-7">
              <div className="flex items-center gap-3">
                <span className="size-10 rounded-xl bg-green-50 flex items-center justify-center">
                  <Wallet className="size-5 text-green-600" />
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{t("savings.moneyLabel")}</p>
              </div>
              <p className="mt-5 text-3xl font-bold text-gray-900 tracking-tight">{t("savings.moneyTitle")}</p>
              <p className="mt-3 text-sm text-gray-500 leading-relaxed">
                {t.rich("savings.moneyBody", {
                  currency: PLAN_CURRENCY,
                  price: PRICE_PER_EMPLOYEE_MONTHLY,
                  b: bold,
                })}
              </p>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-gray-400">
            {t("savings.estimateNote")}
          </p>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <section className="py-20 border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">{t("pricing.title")}</h2>
            <p className="mt-3 text-base text-gray-500">
              <span className="font-semibold text-gray-900">{t("pricing.subBold", { currency: PLAN_CURRENCY, price: PRICE_PER_EMPLOYEE_MONTHLY })}</span>{" "}
              {t("pricing.subRest")}
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 items-start">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="bg-slate-900 px-8 py-7 text-center">
                <div className="flex items-end justify-center gap-1">
                  <span className="text-5xl font-bold text-white tabular-nums">{PLAN_CURRENCY}{PRICE_PER_EMPLOYEE_MONTHLY}</span>
                  <span className="text-white/40 pb-1.5 text-base">{t("pricing.priceUnit")}</span>
                </div>
                <p className="mt-2 text-sm text-white/35">{t("pricing.trialNote", { days: TRIAL_DAYS })}</p>
              </div>
              <div className="px-8 py-6 space-y-2.5">
                {[
                  t("pricing.feature1"),
                  t("pricing.feature2"),
                  t("pricing.feature3"),
                  t("pricing.feature4"),
                  t("pricing.feature5"),
                ].map((f) => (
                  <div key={f} className="flex items-center gap-3">
                    <Check className="size-4 text-green-600 shrink-0" />
                    <span className="text-sm text-gray-700">{f}</span>
                  </div>
                ))}
              </div>
              <div className="px-8 pb-7">
                <Link href="/login" className="flex w-full h-11 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 transition-colors">
                  {t("pricing.cta", { days: TRIAL_DAYS })}
                </Link>
                <p className="mt-3 text-center text-xs text-gray-400">{t("pricing.noCard")}</p>
              </div>
            </div>

            <div className="lg:pt-2">
              <p className="text-sm font-semibold text-gray-900 mb-3">{t("pricing.calcHeading")}</p>
              <PricingCalculator />
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight text-center mb-10">
            {t("faq.title")}
          </h2>
          <div className="divide-y divide-gray-100 border-y border-gray-100">
            {faqs.map(({ q, a }) => (
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
            {t("cta.title")}
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            {t("cta.subtitle")}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/login" className="inline-flex items-center justify-center h-12 px-10 rounded-lg bg-white text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
              {t("cta.trial")}
            </Link>
            <Link href="/demo" className="inline-flex items-center justify-center h-12 px-10 rounded-lg border border-white/15 text-sm font-medium text-white/80 hover:text-white hover:border-white/30 transition-colors">
              {t("cta.demo")}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <LogoLockup className="text-slate-900" markClassName="size-6" wordClassName="text-sm font-semibold" />
          <nav className="flex items-center gap-6">
            <Link href="/demo" className="hover:text-gray-600 transition-colors">{t("footer.demo")}</Link>
            <Link href="/terms" className="hover:text-gray-600 transition-colors">{t("footer.terms")}</Link>
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">{t("footer.privacy")}</Link>
            <LocaleToggle variant="light" />
          </nav>
          <span>© {new Date().getFullYear()} Skemaka ApS</span>
        </div>
      </footer>

    </div>
  )
}
