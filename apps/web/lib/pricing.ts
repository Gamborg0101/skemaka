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
