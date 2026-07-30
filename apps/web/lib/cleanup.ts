import { db } from "@/lib/prisma"
import { RETENTION } from "@/lib/cleanupConfig"
import { DEMO_EMAIL_DOMAIN, DEMO_TTL_HOURS } from "@/lib/demo/constants"
import type { CleanupPreview, CleanupResult } from "@/lib/cleanupConfig"

export { RETENTION } from "@/lib/cleanupConfig"
export type { CleanupPreview, CleanupResult } from "@/lib/cleanupConfig"

function cutoff(months: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d
}

export async function previewCleanup(orgId: string): Promise<CleanupPreview> {
  const [schedules, availability, events] = await Promise.all([
    db.schedule.count({
      where: { organizationId: orgId, weekStart: { lt: cutoff(RETENTION.schedules.months) } },
    }),
    db.availabilityRequest.count({
      where: { organizationId: orgId, weekStart: { lt: cutoff(RETENTION.availability.months) } },
    }),
    db.schedulingEvent.count({
      where: { organizationId: orgId, createdAt: { lt: cutoff(RETENTION.events.months) } },
    }),
  ])
  return { schedules, availability, events, total: schedules + availability + events }
}

export async function runCleanupForOrg(orgId: string): Promise<CleanupPreview> {
  const scheduleCutoff     = cutoff(RETENTION.schedules.months)
  const availabilityCutoff = cutoff(RETENTION.availability.months)
  const eventCutoff        = cutoff(RETENTION.events.months)

  // Disassociate duplicates that reference old schedules before deleting them,
  // to avoid FK constraint violations when the source schedule is deleted.
  const oldScheduleIds = (await db.schedule.findMany({
    where: { organizationId: orgId, weekStart: { lt: scheduleCutoff } },
    select: { id: true },
  })).map((s) => s.id)

  if (oldScheduleIds.length > 0) {
    await db.schedule.updateMany({
      where: { sourceScheduleId: { in: oldScheduleIds } },
      data:  { sourceScheduleId: null },
    })
  }

  const [deletedSchedules, deletedAvailability, deletedEvents] = await Promise.all([
    db.schedule.deleteMany({
      where: { organizationId: orgId, weekStart: { lt: scheduleCutoff } },
    }),
    db.availabilityRequest.deleteMany({
      where: { organizationId: orgId, weekStart: { lt: availabilityCutoff } },
    }),
    db.schedulingEvent.deleteMany({
      where: { organizationId: orgId, createdAt: { lt: eventCutoff } },
    }),
  ])

  const schedules    = deletedSchedules.count
  const availability = deletedAvailability.count
  const events       = deletedEvents.count
  return { schedules, availability, events, total: schedules + availability + events }
}

/**
 * Delete expired "try the live demo" sandboxes: demo orgs older than
 * DEMO_TTL_HOURS (org cascade wipes everything org-scoped) plus their demo
 * users, which aren't org-cascaded. Users are matched by the unroutable demo
 * email domain and only removed once they have no memberships left.
 */
export async function cleanupDemoSandboxes(): Promise<{ orgs: number; users: number }> {
  const ttlCutoff = new Date(Date.now() - DEMO_TTL_HOURS * 60 * 60 * 1000)
  const { count: orgs } = await db.organization.deleteMany({
    where: { isDemo: true, createdAt: { lt: ttlCutoff } },
  })
  const { count: users } = await db.user.deleteMany({
    where: {
      email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` },
      createdAt: { lt: ttlCutoff },
      memberships: { none: {} },
    },
  })
  return { orgs, users }
}

export async function runGlobalCleanup(): Promise<CleanupResult> {
  const demo = await cleanupDemoSandboxes()

  const orgs = await db.organization.findMany({ select: { id: true } })

  const deletedSessions = await db.session.deleteMany({
    where: { expires: { lt: new Date() } },
  })

  let schedules = 0
  let availability = 0
  let events = 0

  for (const org of orgs) {
    const result = await runCleanupForOrg(org.id)
    schedules    += result.schedules
    availability += result.availability
    events       += result.events
  }

  return {
    schedules,
    availability,
    events,
    total: schedules + availability + events,
    sessions: deletedSessions.count,
    demoOrgs: demo.orgs,
    demoUsers: demo.users,
  }
}
