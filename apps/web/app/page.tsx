import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Check } from "lucide-react"

// ── Pricing constants — update these to change what the landing page shows ────
const PLAN_PRICE_MONTHLY = 49
const PLAN_CURRENCY = "€"
const TRIAL_DAYS = 14

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

// ── How it works steps ────────────────────────────────────────────────────────
const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Collect availability",
    description: "Send a link to your team. Staff fill in when they're free before you ever open the schedule.",
  },
  {
    step: "2",
    title: "Build the schedule",
    description: "Drag employees onto the timeline. Costs update live so you never go over budget.",
  },
  {
    step: "3",
    title: "Publish to your team",
    description: "One click and every employee sees their shifts on their phone — no printing, no group chats.",
  },
]

// ── Feature showcase items ─────────────────────────────────────────────────────
const FEATURE_SHOWCASE = [
  {
    title: "Drag-and-drop scheduling",
    description:
      "Build the week's rota in minutes. Move shifts, fill gaps, and publish to your whole team in one click.",
    screenshot: "/screenshots/01-schedule.png",
    alt: "Skemaka schedule grid showing weekly rota",
  },
  {
    title: "Live labour costs",
    description:
      "Wage spend updates as you place each shift — so you never go over budget. Export to CSV for payroll in one click.",
    screenshot: "/screenshots/04-costs.png",
    alt: "Skemaka labour costs overview",
  },
  {
    title: "Availability & time-off",
    description:
      "Staff submit availability and time-off requests. You approve or deny in one place — they're automatically blocked from conflicting shifts.",
    screenshot: "/screenshots/03-availability.png",
    alt: "Skemaka availability requests screen",
  },
]

// ── Browser frame mockup ──────────────────────────────────────────────────────
function BrowserFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 bg-[#1e2433] px-4 py-3 border-b border-white/5">
        <span className="size-3 rounded-full bg-red-500/80" />
        <span className="size-3 rounded-full bg-yellow-500/80" />
        <span className="size-3 rounded-full bg-green-500/80" />
        <div className="ml-4 flex-1 bg-white/5 rounded-md h-5 max-w-xs" />
      </div>
      {/* Screenshot */}
      <div className="relative w-full aspect-[16/9] bg-slate-800">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover object-top"
          priority
          sizes="(max-width: 768px) 100vw, 896px"
        />
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
            <Link
              href="#how-it-works"
              className="w-full sm:w-auto inline-flex items-center justify-center h-11 px-8 rounded-lg border border-white/15 text-sm font-medium text-white/70 hover:text-white hover:border-white/30 transition-colors"
            >
              See how it works
            </Link>
          </div>
        </div>

        {/* Browser frame mockup */}
        <div className="relative max-w-4xl mx-auto px-6 pt-10 pb-20">
          <BrowserFrame
            src="/screenshots/07-schedule-timeline.png"
            alt="Skemaka schedule timeline view"
          />
        </div>
      </div>

      {/* ── Social proof strip ────────────────────────────────────────────── */}
      <div className="border-b border-gray-100 bg-white py-6">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-3">
            Trusted by restaurant teams across Europe
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 text-gray-500 text-sm">
            <span className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900">500+</span> shifts scheduled weekly
            </span>
            <span className="hidden sm:block text-gray-200">|</span>
            <span className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900">50+</span> teams onboarded
            </span>
            <span className="hidden sm:block text-gray-200">|</span>
            <span className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900">{TRIAL_DAYS}-day</span> free trial
            </span>
          </div>
        </div>
      </div>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-gray-50 py-24 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
              How it works
            </h2>
            <p className="mt-3 text-base text-gray-500 max-w-lg mx-auto">
              From blank canvas to published schedule in three simple steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
            {HOW_IT_WORKS.map(({ step, title, description }) => (
              <div key={step} className="flex flex-col items-center text-center md:items-start md:text-left">
                <div className="flex items-center justify-center size-14 rounded-2xl bg-slate-900 text-white text-2xl font-bold mb-5 shrink-0">
                  {step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature showcase ──────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
              Everything you need to run a tight schedule
            </h2>
            <p className="mt-3 text-base text-gray-500 max-w-lg mx-auto">
              One tool for the full scheduling workflow — from collecting availability to exporting hours for payroll.
            </p>
          </div>

          <div className="space-y-28">
            {FEATURE_SHOWCASE.map(({ title, description, screenshot, alt }, index) => {
              const isEven = index % 2 === 0
              return (
                <div
                  key={title}
                  className={`flex flex-col gap-12 items-center ${isEven ? "lg:flex-row" : "lg:flex-row-reverse"}`}
                >
                  {/* Text */}
                  <div className="flex-1 lg:max-w-md">
                    <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 mb-5">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                        Feature {index + 1}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 tracking-tight mb-4">{title}</h3>
                    <p className="text-base text-gray-500 leading-relaxed">{description}</p>
                    <Link
                      href="/login"
                      className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 hover:text-slate-600 transition-colors"
                    >
                      Try it free →
                    </Link>
                  </div>

                  {/* Screenshot */}
                  <div className="flex-1 w-full">
                    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-lg shadow-gray-200/80">
                      <div className="relative w-full aspect-[16/10] bg-gray-100">
                        <Image
                          src={screenshot}
                          alt={alt}
                          fill
                          className="object-cover object-top"
                          sizes="(max-width: 1024px) 100vw, 560px"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <section className="bg-gray-50 border-t border-b border-gray-100 py-24">
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

      {/* ── Bottom CTA ────────────────────────────────────────────────────── */}
      <section className="bg-slate-900 relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="pointer-events-none absolute -top-40 right-0 size-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="relative max-w-3xl mx-auto px-6 py-24 text-center">
          <h2 className="text-4xl font-bold text-white tracking-tight">
            Ready to stop scheduling on WhatsApp?
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Start your {TRIAL_DAYS}-day free trial. No credit card required.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center h-12 px-10 rounded-lg bg-white text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-colors shadow-sm"
            >
              Get started free
            </Link>
            <p className="text-sm text-slate-500">
              {TRIAL_DAYS} days free · then {PLAN_CURRENCY}{PLAN_PRICE_MONTHLY}/mo
            </p>
          </div>
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
