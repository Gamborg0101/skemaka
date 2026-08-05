import "server-only"
import { db } from "@/lib/prisma"
import { logError, logWarn } from "@/lib/log"
import { buildDemoPlan, type DemoLocale, type DemoPlan } from "@/lib/demo/demoPlan"
import { checkDemoPlan, DemoIntegrityError } from "@/lib/demo/demoInvariants"

/**
 * Creates a fully-populated throwaway restaurant for the "try the live demo"
 * flow and returns the manager user to sign the visitor in as.
 *
 * This module is now only the *writer*. Everything about what the sandbox
 * contains lives in lib/demo/demoPlan.ts (pure, testable without a database),
 * and lib/demo/demoInvariants.ts proves that plan coherent before the first row
 * is written. See those files for the rules and the reasoning.
 *
 * The sandbox is the REAL product with realistic content:
 *  - 9 employees (per-locale name cast matching the marketing previews)
 *  - 8 past weeks: rolled-out shifts + clocked time entries (costs/timesheets
 *    look alive), a sick day or two, one cancelled shift
 *  - current + next week rolled out; weeks +2…+7 are private drafts, so the
 *    Roll out flow demos itself
 *  - an open availability request (with "can't work" days → Day Off badges),
 *    time-off (approved + pending), an open cover request, and an open shift
 *    offer with one accepted candidate
 *
 * Safety: `isDemo: true` (48h TTL via the cleanup cron, excluded from platform
 * metrics), all people live on DEMO_EMAIL_DOMAIN (lib/resend.ts refuses to
 * deliver there), employees have no phone/userId so SMS/push are impossible.
 */

export type { DemoLocale }

export interface DemoSeedResult {
  userId: string
  orgId: string
  email: string
  name: string
}

/** YYYY-MM-DD → the UTC midnight Date the schema stores. */
function utcDate(iso: string): Date {
  return new Date(iso + "T00:00:00Z")
}

/**
 * Validates the plan and throws before anything is written.
 *
 * The check runs in production too, not just in tests. It is a few hundred
 * Set lookups — invisible next to the DB writes that follow — and it fails
 * *safe*: nothing has been written yet, so there is nothing to roll back, and
 * the caller in lib/auth.ts turns the throw into the "couldn't start the demo"
 * state. A visitor who sees an error reads it as a hiccup; a visitor who sees
 * an empty grid reads it as "this product doesn't work".
 */
export function assertDemoPlan(plan: DemoPlan): void {
  const violations = checkDemoPlan(plan)

  for (const w of violations.filter((x) => x.severity === "warn")) {
    logWarn("demo", "sandbox invariant warning", { id: w.id, message: w.message, locale: plan.locale })
  }

  const errors = violations.filter((x) => x.severity === "error")
  if (errors.length > 0) {
    logError("demo", "refusing to seed an incoherent sandbox", {
      locale: plan.locale,
      violations: errors.map((e) => `${e.id}: ${e.message}`),
    })
    throw new DemoIntegrityError(errors)
  }
}

export async function seedDemoOrg(locale: DemoLocale): Promise<DemoSeedResult> {
  const plan = buildDemoPlan({ locale })
  assertDemoPlan(plan)
  return writeDemoPlan(plan)
}

async function writeDemoPlan(plan: DemoPlan): Promise<DemoSeedResult> {
  const org = await db.organization.create({
    data: {
      name: plan.org.name,
      slug: plan.org.slug,
      isDemo: true,
      // Demo orgs are always TRIALING so the seat cap never applies, but set it
      // to match the cast anyway — a demo that silently sits over its limit
      // would be a confusing thing to inherit later.
      seats: plan.org.seats,
      subscriptionStatus: "TRIALING",
      trialEndsAt: new Date(plan.now.getTime() + 7 * 24 * 60 * 60 * 1000),
      currency: plan.org.currency,
      country: plan.org.country,
      locale: plan.org.locale,
      industry: "restaurant",
      settings: plan.org.settings,
    },
  })

  const user = await db.user.create({
    data: { name: plan.manager.name, email: plan.manager.email, role: "MANAGER" },
  })
  await db.membership.create({
    data: { userId: user.id, organizationId: org.id, role: "MANAGER" },
  })

  await db.jobRole.createMany({
    data: plan.jobRoles.map((r) => ({ organizationId: org.id, name: r.name, color: r.color })),
  })

  await db.shiftTemplate.createMany({
    data: plan.shiftTemplates.map((t) => ({ organizationId: org.id, ...t })),
  })

  await db.employee.createMany({
    data: plan.employees.map((e) => ({
      id: e.id,
      organizationId: org.id,
      name: e.name,
      email: e.email,
      phone: null,
      // Linking the manager's own row to their account is what makes the
      // employee half of the product work in a sandbox: cover, shift offers
      // and availability all resolve the caller's employee record, and a
      // visitor who wasn't on the roster had none to resolve.
      userId: e.isManager ? user.id : null,
      jobRole: e.jobRole,
      hourlyWage: e.hourlyWage,
      contractedHours: e.contractedHours,
      employmentType: e.employmentType,
      isActive: true,
    })),
  })

  await db.schedule.createMany({
    data: plan.schedules.map((s) => ({
      id: s.id,
      organizationId: org.id,
      weekStart: utcDate(s.weekStart),
      publishedAt: s.publishedAt,
    })),
  })

  const shiftResult = await db.shift.createMany({
    data: plan.shifts.map((s) => ({
      id: s.id,
      scheduleId: s.scheduleId,
      organizationId: org.id,
      employeeId: s.employeeId,
      date: utcDate(s.date),
      startTime: s.startTime,
      endTime: s.endTime,
      breakMinutes: s.breakMinutes,
      jobRole: s.jobRole,
      colorTag: s.colorTag,
      notes: s.notes,
      publishedAt: s.publishedAt,
      cancelledAt: s.cancelledAt,
    })),
  })

  if (plan.timeEntries.length > 0) {
    await db.timeEntry.createMany({
      data: plan.timeEntries.map((t) => ({
        organizationId: org.id,
        employeeId: t.employeeId,
        shiftId: t.shiftId,
        clockIn: t.clockIn,
        clockOut: t.clockOut,
        breakMinutes: t.breakMinutes,
      })),
    })
  }

  // Cheap tripwire for a silent partial write — never fatal, the sandbox is
  // still usable and the visitor should not be turned away over it.
  if (shiftResult?.count !== undefined && shiftResult.count !== plan.shifts.length) {
    logWarn("demo", "shift write count did not match the plan", {
      expected: plan.shifts.length,
      written: shiftResult.count,
    })
  }

  const availability = await db.availabilityRequest.create({
    data: {
      organizationId: org.id,
      weekStart: utcDate(plan.availability.weekStart),
      deadline: plan.availability.deadline,
      status: "OPEN",
    },
  })
  for (const sub of plan.availability.submissions) {
    const submission = await db.availabilitySubmission.create({
      data: { requestId: availability.id, employeeId: sub.employeeId, organizationId: org.id },
    })
    await db.availabilityDay.createMany({
      data: sub.days.map((d) => ({
        submissionId: submission.id,
        date: utcDate(d.date),
        isAvailable: d.isAvailable,
        startTime: d.startTime,
        endTime: d.endTime,
      })),
    })
  }

  await db.timeOffRequest.createMany({
    data: plan.timeOff.map((t) => ({
      organizationId: org.id,
      employeeId: t.employeeId,
      startDate: utcDate(t.startDate),
      endDate: utcDate(t.endDate),
      reason: t.reason,
      status: t.status,
    })),
  })

  await db.shiftCoverRequest.create({
    data: {
      organizationId: org.id,
      shiftId: plan.coverRequest.shiftId,
      requesterEmployeeId: plan.coverRequest.requesterEmployeeId,
      status: "OPEN",
      note: plan.coverRequest.note,
    },
  })

  await db.shiftOffer.create({
    data: {
      organizationId: org.id,
      date: utcDate(plan.shiftOffer.date),
      startTime: plan.shiftOffer.startTime,
      endTime: plan.shiftOffer.endTime,
      jobRole: plan.shiftOffer.jobRole,
      breakMinutes: plan.shiftOffer.breakMinutes,
      note: plan.shiftOffer.note,
      deadline: plan.shiftOffer.deadline,
      status: "OPEN",
      createdByUserId: user.id,
      recipients: {
        create: plan.shiftOffer.recipients.map((r) => ({
          employeeId: r.employeeId,
          response: r.response,
          respondedAt: r.response === "ACCEPTED" ? new Date(plan.now.getTime() - 2 * 60 * 60 * 1000) : null,
        })),
      },
    },
  })

  return { userId: user.id, orgId: org.id, email: plan.manager.email, name: plan.manager.name }
}
