import { db } from "@/lib/prisma"
import { Prisma } from "@/app/generated/prisma/client"

/**
 * Single source of truth for recording who changed important information.
 *
 * Every mutation of sensitive data (wages, time entries, currency, access,
 * membership) should call this so we can always answer "who changed this, and
 * when". The actor's user id is always recorded.
 *
 * Fire-and-forget: a failed audit write must never block or fail the underlying
 * mutation, so callers do not await this and errors are logged, not thrown.
 */
export type AuditInput = {
  orgId: string
  actorUserId: string
  action: string                       // e.g. "TIME_ENTRY_UPDATED"
  entity?: string                      // e.g. "TimeEntry:<id>"
  before?: Prisma.InputJsonValue
  after?: Prisma.InputJsonValue
}

export function recordAudit(input: AuditInput): void {
  void db.schedulingEvent
    .create({
      data: {
        organizationId: input.orgId,
        eventType: input.action,
        payload: {
          actorUserId: input.actorUserId,
          entity: input.entity ?? null,
          before: input.before ?? null,
          after: input.after ?? null,
          at: new Date().toISOString(),
        },
      },
    })
    .catch((err) => console.error(`[audit] failed to record ${input.action}`, err))
}
