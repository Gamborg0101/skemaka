/**
 * Public pricing shown on the marketing site.
 *
 * ⚠️ MUST match the unit amount of the Stripe price referenced by
 * STRIPE_PRICE_ID. Billing is PER ACTIVE EMPLOYEE — the checkout subscribes with
 * `quantity = activeSeatCount` and re-syncs on every employee change
 * (see lib/services/billingService.ts). If you change the Stripe price, change
 * this constant in the same commit.
 */
export const PRICE_PER_EMPLOYEE_MONTHLY = 3
export const PLAN_CURRENCY = "€"
export const TRIAL_DAYS = 14

/** Monthly total for a given active-employee count. */
export function monthlyTotal(activeEmployees: number): number {
  return Math.max(0, activeEmployees) * PRICE_PER_EMPLOYEE_MONTHLY
}

// ── Marketing ROI estimates ─────────────────────────────────────────────────
// These are illustrative, clearly-labelled estimates used ONLY on the marketing
// site to make the "saves time and money" claim concrete. They are not billing
// figures — keep them conservative and defensible.

/** Typical minutes spent building the week the old way (spreadsheet + chat). */
export const MANUAL_SCHEDULING_MINUTES = 120
/** Typical minutes to build the week in Skemaka. */
export const SKEMAKA_SCHEDULING_MINUTES = 20
/** Rough hospitality hourly wage used for the break-even estimate. */
export const ROI_ASSUMED_HOURLY_WAGE = 14

const WEEKS_PER_MONTH = 52 / 12

/** Estimated scheduling hours saved per month (manager's own time). */
export function hoursSavedPerMonth(): number {
  const savedPerWeek = MANUAL_SCHEDULING_MINUTES - SKEMAKA_SCHEDULING_MINUTES
  return Math.round((savedPerWeek * WEEKS_PER_MONTH) / 60)
}

/**
 * How much avoided over-scheduling (in labour hours/month) covers the bill —
 * i.e. the break-even: monthly cost ÷ an assumed hourly wage.
 */
export function breakEvenLabourHoursPerMonth(activeEmployees: number): number {
  return monthlyTotal(activeEmployees) / ROI_ASSUMED_HOURLY_WAGE
}
