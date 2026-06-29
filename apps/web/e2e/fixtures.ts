/**
 * Shared identifiers for the E2E dataset. Imported by both the seed
 * (prisma/seed-e2e.ts) and the specs so they never drift. Kept side-effect-free
 * so importing it never touches the database.
 */
export const E2E = {
  // Orgs
  orgActive: "e2e_org_active",
  orgOther: "e2e_org_other",
  orgExpired: "e2e_org_expired",
  // Manager users
  managerActive: "managerA@e2e.test",
  managerOther: "managerB@e2e.test",
  managerExpired: "managerExpired@e2e.test",
  // Claim flow
  claimer: "claimer@e2e.test",
  inviteToken: "e2e-invite-token-001",
} as const
