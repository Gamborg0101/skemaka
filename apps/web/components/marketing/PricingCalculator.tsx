"use client"

import { useState } from "react"
import { TrendingDown } from "lucide-react"
import { useTranslations } from "next-intl"
import {
  PRICE_PER_EMPLOYEE_MONTHLY,
  PLAN_CURRENCY,
  monthlyTotal,
  breakEvenLabourHoursPerMonth,
  ROI_ASSUMED_HOURLY_WAGE,
} from "@/lib/pricing"

const MIN = 1
const MAX = 60

/**
 * Interactive "what will I pay?" estimator. Mirrors the exact billing formula:
 * active employees × {@link PRICE_PER_EMPLOYEE_MONTHLY}. Pure client state — no
 * network, safe to render anywhere on the marketing page.
 */
export function PricingCalculator() {
  const t = useTranslations("marketing.calculator")
  const [count, setCount] = useState(8)
  const total = monthlyTotal(count)
  // Break-even framing: how little avoided over-scheduling covers the bill.
  const breakEvenHrs = breakEvenLabourHoursPerMonth(count)
  const breakEvenMinPerWeek = Math.round((breakEvenHrs * 12 / 52) * 60)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor="emp-count" className="text-sm font-medium text-gray-700">
          {t("label")}
        </label>
        <span className="text-sm font-semibold text-gray-900 tabular-nums">
          {t("employees", { count })}
        </span>
      </div>

      <input
        id="emp-count"
        type="range"
        min={MIN}
        max={MAX}
        value={count}
        onChange={(e) => setCount(Number(e.target.value))}
        className="mt-4 w-full accent-slate-900"
        aria-describedby="price-estimate"
      />
      <div className="mt-1 flex justify-between text-xs text-gray-400 tabular-nums">
        <span>{MIN}</span>
        <span>{MAX}+</span>
      </div>

      <div
        id="price-estimate"
        className="mt-6 flex flex-col items-center gap-1 rounded-xl bg-gray-50 py-6"
      >
        <p className="text-sm text-gray-500 tabular-nums">
          {count} × {PLAN_CURRENCY}{PRICE_PER_EMPLOYEE_MONTHLY}
        </p>
        <p className="text-4xl font-bold text-gray-900 tabular-nums">
          {PLAN_CURRENCY}{total}
          <span className="ml-1 text-base font-medium text-gray-400">{t("perMonth")}</span>
        </p>
        <p className="text-xs text-gray-400">
          {t("activeNote")}
        </p>
      </div>

      {/* Break-even: reframes the price as a return, not just a cost. */}
      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <TrendingDown className="mt-0.5 size-4 shrink-0 text-green-600" />
        <p className="text-xs leading-relaxed text-green-900">
          {t.rich("breakEven", {
            currency: PLAN_CURRENCY,
            wage: ROI_ASSUMED_HOURLY_WAGE,
            min: breakEvenMinPerWeek,
            b: (chunks) => <span className="font-semibold tabular-nums">{chunks}</span>,
          })}
        </p>
      </div>
    </div>
  )
}
