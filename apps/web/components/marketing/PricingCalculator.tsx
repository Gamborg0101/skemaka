"use client"

import { useState } from "react"
import { PRICE_PER_EMPLOYEE_MONTHLY, PLAN_CURRENCY, monthlyTotal } from "@/lib/pricing"

const MIN = 1
const MAX = 60

/**
 * Interactive "what will I pay?" estimator. Mirrors the exact billing formula:
 * active employees × {@link PRICE_PER_EMPLOYEE_MONTHLY}. Pure client state — no
 * network, safe to render anywhere on the marketing page.
 */
export function PricingCalculator() {
  const [count, setCount] = useState(8)
  const total = monthlyTotal(count)

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
          {count} × {PLAN_CURRENCY}{PRICE_PER_EMPLOYEE_MONTHLY}
        </p>
        <p className="text-4xl font-bold text-gray-900 tabular-nums">
          {PLAN_CURRENCY}{total}
          <span className="ml-1 text-base font-medium text-gray-400">/month</span>
        </p>
        <p className="text-xs text-gray-400">
          You only pay for active staff — deactivate someone and your bill drops next cycle.
        </p>
      </div>
    </div>
  )
}
