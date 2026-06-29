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
  // Manager users (lowercase — the auth provider lowercases the email before lookup)
  managerActive: "manager-a@e2e.test",
  managerOther: "manager-b@e2e.test",
  managerExpired: "manager-expired@e2e.test",
  // Claim flow
  claimer: "claimer@e2e.test",
  inviteToken: "e2e-invite-token-001",
} as const
