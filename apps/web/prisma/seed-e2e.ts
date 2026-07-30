/**
 * Deterministic dataset for the Playwright E2E suite (e2e/*.spec.ts).
 *
 * Idempotent: every entity uses a fixed id and is upserted, so this can run on a
 * fresh CI database repeatedly. Pairs with the env-gated "e2e" credentials
 * provider in lib/auth.ts — the seeded users sign in by email + E2E_TEST_PASSWORD.
 *
 *   npm run seed:e2e
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { neonConfig } from "@neondatabase/serverless"
import { E2E } from "../e2e/fixtures"

// CI / local-testing only: route the Neon serverless driver at a local wsproxy so
// the seed can run against a plain Postgres container (mirrors lib/prisma.ts).
if (process.env.NEON_WS_PROXY) {
  neonConfig.wsProxy = () => process.env.NEON_WS_PROXY!
  neonConfig.useSecureWebSocket = false
  neonConfig.pipelineConnect = false
  neonConfig.pipelineTLS = false
}

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL ?? "" })
const db = new PrismaClient({ adapter })

const DAY = 24 * 60 * 60 * 1000

async function upsertManager(opts: {
  orgId: string
  orgName: string
  slug: string
  status: "ACTIVE" | "TRIALING"
  trialEndsAt: Date | null
  email: string
}) {
  await db.organization.upsert({
    where: { id: opts.orgId },
    create: {
      id: opts.orgId,
      name: opts.orgName,
      slug: opts.slug,
      subscriptionStatus: opts.status,
      trialEndsAt: opts.trialEndsAt,
    },
    update: { subscriptionStatus: opts.status, trialEndsAt: opts.trialEndsAt },
  })

  const user = await db.user.upsert({
    where: { email: opts.email },
    create: { email: opts.email, name: opts.email },
    update: {},
  })

  await db.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: opts.orgId } },
    create: { userId: user.id, organizationId: opts.orgId, role: "MANAGER" },
    update: { role: "MANAGER" },
  })

  await db.jobRole.upsert({
    where: { organizationId_name: { organizationId: opts.orgId, name: "Barista" } },
    create: { organizationId: opts.orgId, name: "Barista", color: "#3b82f6" },
    update: {},
  })

  return user
}

async function main() {
  // Org with an active subscription — full access.
  await upsertManager({
    orgId: E2E.orgActive,
    orgName: "E2E Active Org",
    slug: "e2e-active-org",
    status: "ACTIVE",
    trialEndsAt: null,
    email: E2E.managerActive,
  })

  // A second active org, owned by a different manager — for cross-tenant tests.
  await upsertManager({
    orgId: E2E.orgOther,
    orgName: "E2E Other Org",
    slug: "e2e-other-org",
    status: "ACTIVE",
    trialEndsAt: null,
    email: E2E.managerOther,
  })

  // Org whose trial has already lapsed — must be paywalled (402).
  await upsertManager({
    orgId: E2E.orgExpired,
    orgName: "E2E Expired Trial Org",
    slug: "e2e-expired-org",
    status: "TRIALING",
    trialEndsAt: new Date(Date.now() - 1 * DAY),
    email: E2E.managerExpired,
  })

  // Invite/claim flow: an employee with a live invite token in the active org,
  // plus an unaffiliated user who will claim it.
  await db.employee.upsert({
    where: { id: "e2e_emp_invite" },
    create: {
      id: "e2e_emp_invite",
      organizationId: E2E.orgActive,
      name: "Invite Target",
      email: "claim-target@e2e.test",
      jobRole: "Barista",
      hourlyWage: 15,
      inviteToken: E2E.inviteToken,
      inviteExpiry: new Date(Date.now() + 7 * DAY),
    },
    update: { inviteToken: E2E.inviteToken, inviteExpiry: new Date(Date.now() + 7 * DAY), userId: null },
  })

  await db.user.upsert({
    where: { email: E2E.claimer },
    create: { email: E2E.claimer, name: "Claimer" },
    update: {},
  })

  console.log("E2E seed complete.")
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err)
    await db.$disconnect()
    process.exit(1)
  })
