import "server-only"
import type { Prisma } from "@/app/generated/prisma/client"
import { ServiceError } from "./errors"

/**
 * Seat licensing.
 *
 * `Organization.seats` is both the Stripe subscription quantity and the cap on
 * how many employees may be active at once. An org can never hold fewer than
 * {@link MIN_SEATS}, because the €19 base fee already includes that many.
 *
 * Every path that makes an employee active must reserve a seat first. There are
 * three of them, which is the whole reason this lives in one place:
 *   1. employeeService.createEmployee      — a new hire
 *   2. employeeService.updateEmployee      — flipping isActive false → true
 *   3. orgService (manager self-record)    — "count me as an employee" toggle
 *
 * Miss one and a manager can quietly exceed the seats they pay for.
 */

/** Seats included in the base fee. Mirrors SEATS_INCLUDED in lib/pricing.ts. */
export const MIN_SEATS = 5

type Tx = Prisma.TransactionClient

/**
 * Reserve one seat, or throw SEAT_LIMIT.
 *
 * ⚠️ MUST be called inside a `db.$transaction(...)`, passing that transaction's
 * client. It takes `SELECT … FOR UPDATE` on the organization row, which is what
 * makes the check-then-act safe: a second concurrent add blocks on the lock
 * until the first commits, and therefore sees the updated employee count.
 * Without the lock, two simultaneous adds both read `count = seats - 1`, both
 * pass, and the org ends up one seat over what it pays for.
 *
 * The insert/update that consumes the seat must happen in the SAME transaction,
 * otherwise the lock is released before the row exists and the race reopens.
 */
export async function assertSeatAvailable(tx: Tx, orgId: string): Promise<void> {
  // A due reduction is honoured here rather than by a cron or webhook: resolving
  // it inside the same locked read that enforces the cap means it can never be
  // late, double-applied, or lost to a missed event.
  //
  // `NOW() AT TIME ZONE 'UTC'`, not plain `NOW()`. Prisma maps DateTime to
  // `timestamp WITHOUT time zone` and writes UTC wall-clock into it, but NOW()
  // is a timestamptz — so comparing them makes Postgres reinterpret the stored
  // naive value in the SESSION's timezone. Under Europe/Copenhagen that fires a
  // scheduled reduction two hours early, silently dropping a seat the org is
  // still paying for. It only looks correct where the session happens to be UTC,
  // which is every CI runner and no guarantee at all. `AT TIME ZONE 'UTC'`
  // converts NOW() to the same naive-UTC basis the column is stored in, so the
  // comparison is correct under any session timezone.
  const rows = await tx.$queryRaw<
    { seats: number; subscriptionStatus: string }[]
  >`
    SELECT
      CASE
        WHEN "pendingSeats" IS NOT NULL
         AND "pendingSeatsEffectiveAt" IS NOT NULL
         AND "pendingSeatsEffectiveAt" <= (NOW() AT TIME ZONE 'UTC')
        THEN "pendingSeats"
        ELSE "seats"
      END AS "seats",
      "subscriptionStatus"::text AS "subscriptionStatus"
    FROM "Organization"
    WHERE "id" = ${orgId}
    FOR UPDATE
  `
  const org = rows[0]
  if (!org) throw new ServiceError("Organization not found", "NOT_FOUND")

  // Trials are unmetered on purpose. A restaurant evaluating Skemaka needs to
  // load its real team to judge it; capping that would defeat the trial. They
  // buy seats for whatever they have at checkout.
  if (org.subscriptionStatus === "TRIALING") return

  // PAST_DUE orgs are inside the 14-day grace (lib/billing.ts) — they have a
  // subscription, they are simply late. Adding seats they are not paying for
  // while already behind is exactly the wrong direction, so the cap applies.
  const active = await tx.employee.count({
    where: { organizationId: orgId, isActive: true },
  })

  if (active >= org.seats) {
    throw new ServiceError(
      `Your plan covers ${org.seats} employees and they are all active. Increase your plan to add another.`,
      "SEAT_LIMIT",
      { messageKey: "seatLimit", messageParams: { seats: org.seats } },
    )
  }
}

/**
 * Lowest seat count an org may reduce to: never below the base allowance, and
 * never below the people currently active — otherwise the period would roll
 * over with employees who have no seat. Reducing past this requires
 * deactivating someone first, which is a deliberate choice the manager makes,
 * never something we do on their behalf.
 */
export function minimumSeatsFor(activeEmployees: number): number {
  return Math.max(MIN_SEATS, activeEmployees)
}
