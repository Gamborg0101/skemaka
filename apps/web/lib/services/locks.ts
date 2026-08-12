import "server-only"
import type { Prisma } from "@/app/generated/prisma/client"

/**
 * Row locks for check-then-act invariants.
 *
 * Several rules in this app are "look for a clash, then write if there is none":
 * one open time entry per employee, one live shift per employee per date. Under
 * Postgres READ COMMITTED — which is what Neon gives us — two concurrent
 * requests both run the check before either writes, both see a clean slate, and
 * both write. A double-click is enough. The result is wrong paid hours, or one
 * person rostered twice for the same day.
 *
 * The fix is the pattern {@link import("./seats").assertSeatAvailable} already
 * uses for the seat cap: take `SELECT … FOR UPDATE` on a row that every
 * competing request must go through, so the second one blocks until the first
 * commits and then sees its write.
 *
 * **Why not a unique index?** Both invariants are partial — "where clockOut IS
 * NULL", "where cancelledAt IS NULL" — and Prisma cannot express a partial
 * unique index. It would have to live in hand-written SQL only, and production
 * schema changes go out with `prisma db push`, which makes the database match
 * `schema.prisma`: it would drop the index without a word, exactly when it was
 * still believed to be there. A lock the application takes cannot be dropped by
 * a deploy. If production ever moves to `migrate deploy`, add the indexes too —
 * belt and braces — but the locks are what make the rules hold today.
 */

type Tx = Prisma.TransactionClient

/**
 * Lock one employee's row for the rest of the transaction, serializing every
 * concurrent write scoped to that employee. Returns false when no such employee
 * exists in this org, which callers should treat as NOT_FOUND — the lookup and
 * the lock are the same query, so there is no window between them.
 *
 * ⚠️ Only meaningful inside `db.$transaction(...)`, and the write it protects
 * must happen in that same transaction — the lock is released on commit, so a
 * write that lands afterwards races exactly as before.
 */
export async function lockEmployee(tx: Tx, orgId: string, employeeId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Employee"
    WHERE "id" = ${employeeId} AND "organizationId" = ${orgId}
    FOR UPDATE
  `
  return rows.length > 0
}

/**
 * Lock one week's schedule row, serializing the bulk rota writes (starter week,
 * copy previous week, duplicate a week). Each of those checks "does this week
 * already have shifts?" and then inserts many rows; two of them at once — a
 * double-clicked "Copy last week" — would otherwise both pass the check and
 * duplicate the entire rota.
 */
export async function lockSchedule(tx: Tx, orgId: string, scheduleId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Schedule"
    WHERE "id" = ${scheduleId} AND "organizationId" = ${orgId}
    FOR UPDATE
  `
  return rows.length > 0
}
