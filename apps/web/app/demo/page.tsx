import Link from "next/link"
import { AlertTriangle, ArrowRight } from "lucide-react"
import {
  DEMO_RESTAURANT,
  DEMO_DAYS,
  DEMO_STAFF,
  DEMO_SHIFTS,
  DEMO_TIME_OFF,
  DEMO_FLAGS,
  ROLE_STYLES,
  demoWeekSummary,
  hoursForStaff,
  type DemoShift,
} from "@/lib/demo/demoData"

export const metadata = {
  title: "Demo restaurant — Skemaka",
  description: "See a full week's schedule, labour cost, and availability for a sample restaurant — no signup.",
}

const { currency } = DEMO_RESTAURANT

function ShiftChip({ shift, role, flagged }: { shift: DemoShift; role: keyof typeof ROLE_STYLES; flagged: boolean }) {
  return (
    <div
      className={[
        "rounded-md border px-1.5 py-1 text-[11px] font-medium leading-tight tabular-nums",
        ROLE_STYLES[role].chip,
        flagged ? "ring-2 ring-red-500 ring-offset-1" : "",
      ].join(" ")}
    >
      <span className="flex items-center gap-1">
        {flagged && <AlertTriangle className="size-3 text-red-600 shrink-0" />}
        {shift.start}–{shift.end}
      </span>
    </div>
  )
}

export default function DemoPage() {
  const summary = demoWeekSummary()
  const shiftMap = new Map<string, DemoShift>()
  for (const s of DEMO_SHIFTS) shiftMap.set(`${s.staffId}:${s.day}`, s)
  const timeOffSet = new Set(DEMO_TIME_OFF.map((t) => `${t.staffId}:${t.day}`))
  const flagSet = new Set(DEMO_FLAGS.map((f) => `${f.staffId}:${f.day}`))

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Sticky demo banner — sets expectations and routes to the real trial */}
      <div className="sticky top-0 z-20 bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">
            <span className="font-semibold">You&apos;re in the demo restaurant.</span>{" "}
            <span className="text-white/60">This is sample data — nothing here is saved.</span>
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-colors"
          >
            Start your own free trial <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{DEMO_RESTAURANT.name}</h1>
            <p className="text-sm text-gray-500">{DEMO_RESTAURANT.tagline} · {DEMO_RESTAURANT.weekLabel}</p>
          </div>
          <div className="flex gap-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">This week</p>
              <p className="text-xl font-bold text-gray-900 tabular-nums">{summary.totalHours}h</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Wage cost</p>
              <p className="text-xl font-bold text-gray-900 tabular-nums">{currency}{summary.totalCost.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Avg rate</p>
              <p className="text-xl font-bold text-gray-900 tabular-nums">{currency}{summary.avgRate}</p>
            </div>
          </div>
        </div>

        {/* Conflict callout — the "Skemaka catches it" moment */}
        {DEMO_FLAGS.length > 0 && (
          <div data-shot="conflict" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
              <AlertTriangle className="size-4" /> {DEMO_FLAGS.length} thing{DEMO_FLAGS.length > 1 ? "s" : ""} to fix before publishing
            </p>
            <ul className="mt-2 space-y-1 text-sm text-red-700">
              {DEMO_FLAGS.map((f) => (
                <li key={`${f.staffId}:${f.day}`}>• {f.note}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
          {Object.entries(ROLE_STYLES).map(([role, style]) => (
            <span key={role} className="inline-flex items-center gap-1.5">
              <span className={`size-2.5 rounded-full ${style.dot}`} /> {role}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full ring-2 ring-red-500" /> Conflict
          </span>
        </div>

        {/* Week grid */}
        <div data-shot="rota" className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="min-w-[720px]">
            {/* Day header */}
            <div className="grid grid-cols-[180px_repeat(7,minmax(0,1fr))] border-b border-gray-200 bg-gray-50">
              <div className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                Staff
              </div>
              {DEMO_DAYS.map((d, i) => (
                <div
                  key={d}
                  className={`px-2 py-2.5 text-center text-xs font-semibold ${i === 0 ? "text-gray-300" : "text-gray-600"}`}
                >
                  {d}
                  {i === 0 && <span className="block text-[9px] font-normal text-gray-300">Closed</span>}
                </div>
              ))}
            </div>

            {/* Staff rows */}
            {DEMO_STAFF.map((staff, rowIdx) => (
              <div
                key={staff.id}
                className={`grid grid-cols-[180px_repeat(7,minmax(0,1fr))] border-b border-gray-100 last:border-0 ${rowIdx % 2 ? "bg-gray-50/50" : "bg-white"}`}
              >
                {/* Name */}
                <div className="px-4 py-3 flex items-center gap-2.5 min-w-0">
                  <span className={`size-2 rounded-full shrink-0 ${ROLE_STYLES[staff.role].dot}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{staff.name}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {staff.title} · {hoursForStaff(staff.id)}/{staff.contractedHours}h
                    </p>
                  </div>
                </div>

                {/* Day cells */}
                {DEMO_DAYS.map((_, day) => {
                  const key = `${staff.id}:${day}`
                  const shift = shiftMap.get(key)
                  const isOff = timeOffSet.has(key)
                  const flagged = flagSet.has(key)
                  return (
                    <div key={day} className="border-l border-gray-100 p-1.5">
                      {shift ? (
                        <ShiftChip shift={shift} role={staff.role} flagged={flagged} />
                      ) : isOff ? (
                        <div className="rounded-md bg-gray-100 px-1.5 py-1 text-[11px] font-medium text-gray-400 text-center">
                          Off
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 rounded-2xl bg-slate-900 px-6 py-8 text-center">
          <h2 className="text-xl font-bold text-white">Your schedule could look like this in 20 minutes.</h2>
          <p className="mt-2 text-sm text-slate-400">14 days free · {currency}3 per active employee/mo · no credit card.</p>
          <Link
            href="/login"
            className="mt-5 inline-flex items-center justify-center h-11 px-8 rounded-lg bg-white text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-colors"
          >
            Start free trial
          </Link>
        </div>
      </div>
    </div>
  )
}
