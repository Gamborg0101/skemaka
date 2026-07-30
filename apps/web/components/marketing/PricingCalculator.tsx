"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import {
  PRICE_PER_EMPLOYEE_MONTHLY,
  MONTHLY_MINIMUM,
  MINIMUM_COVERS_STAFF,
  PLAN_CURRENCY,
  monthlyTotal,
  formatPrice,
} from "@/lib/pricing"

const MIN = 1
const MAX = 60

/**
 * Interactive "what will I pay?" estimator. Mirrors the exact billing formula:
 * {@link monthlyTotal} = max(minimum, active employees × per-employee rate).
 * Pure client state — no network, safe to render anywhere on the marketing page.
 */
export function PricingCalculator() {
  const t = useTranslations("marketing.calculator")
  // Start inside the minimum band so the first thing a visitor sees is the €19
  // entry price, not the per-employee rate that only applies above the floor.
  const [count, setCount] = useState(4)
  const total = monthlyTotal(count)
  // Below the break-even count the €19 floor applies, so the per-employee
  // maths would understate the bill — show the minimum framing instead.
  const atMinimum = count * PRICE_PER_EMPLOYEE_MONTHLY < MONTHLY_MINIMUM

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
          {atMinimum
            ? t("minimumLine", { currency: PLAN_CURRENCY, min: MONTHLY_MINIMUM })
            : t("perUnit", { count, currency: PLAN_CURRENCY, price: formatPrice(PRICE_PER_EMPLOYEE_MONTHLY) })}
        </p>
        <p className="text-4xl font-bold text-gray-900 tabular-nums">
          {PLAN_CURRENCY}{formatPrice(total)}
          <span className="ml-1 text-base font-medium text-gray-400">{t("perMonth")}</span>
        </p>
        <p className="text-xs text-gray-400 text-center px-4">
          {atMinimum
            ? t("noteMinimum", { covers: MINIMUM_COVERS_STAFF })
            : t("activeNote")}
        </p>
      </div>
    </div>
  )
}
