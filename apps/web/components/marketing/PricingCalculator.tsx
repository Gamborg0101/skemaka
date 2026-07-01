"use client"

import { useState } from "react"
import { PRICE_PER_EMPLOYEE_MONTHLY, MONTHLY_MINIMUM, PLAN_CURRENCY, monthlyTotal, formatPrice } from "@/lib/pricing"

const MIN = 1
const MAX = 60

// Largest staff count still covered by the monthly minimum (below this the floor
// applies). 19 / 3.5 → 5, so 1–5 staff all land on the €19 minimum.
const MIN_COVERS = Math.floor(MONTHLY_MINIMUM / PRICE_PER_EMPLOYEE_MONTHLY)

/**
 * Interactive "what will I pay?" estimator. Mirrors the exact billing formula:
 * {@link monthlyTotal} = max(minimum, active employees × per-employee rate).
 * Pure client state — no network, safe to render anywhere on the marketing page.
 */
export function PricingCalculator() {
  const [count, setCount] = useState(8)
  const total = monthlyTotal(count)
  const atMinimum = count * PRICE_PER_EMPLOYEE_MONTHLY < MONTHLY_MINIMUM

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor="emp-count" className="text-sm font-medium text-gray-700">
          How many staff do you schedule?
        </label>
        <span className="text-sm font-semibold text-gray-900 tabular-nums">
          {count} {count === 1 ? "employee" : "employees"}
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
            ? `${PLAN_CURRENCY}${MONTHLY_MINIMUM}/mo minimum`
            : `${count} × ${PLAN_CURRENCY}${formatPrice(PRICE_PER_EMPLOYEE_MONTHLY)}`}
        </p>
        <p className="text-4xl font-bold text-gray-900 tabular-nums">
          {PLAN_CURRENCY}{formatPrice(total)}
          <span className="ml-1 text-base font-medium text-gray-400">/month</span>
        </p>
        <p className="text-xs text-gray-400">
          {atMinimum
            ? `Covers up to ${MIN_COVERS} active staff — you only pay more as you grow.`
            : "You only pay for active staff — deactivate someone and your bill drops next cycle."}
        </p>
      </div>
    </div>
  )
}
