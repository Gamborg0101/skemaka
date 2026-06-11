# Launch Checklist

Updated 2026-06-11. The previous version of this file (2026-05-15) is fully
resolved — Stripe webhook, subscription enforcement, billing UI, availability
flow, error boundaries, org settings persistence, and the cleanup cron are all
implemented and verified. This is the current list.

---

## 🔴 Blockers — before taking customers / App Store submission

- [ ] **Deploy the merged branch to production and run the DB migration**
  - `security-hardening` is now merged; prod still runs the old code with the
    availability PII leak until deployed.
  - Run `npx prisma migrate deploy` (from `apps/web/`) against prod Neon —
    migration `20260610143859_add_employee_wage_base` is pending.
  - The App Store reviewer hits the production API; deploy must precede submission.

- [ ] **App Store human-prep items** (full detail in `apps/mobile/APP_STORE_SUBMISSION.md`)
  - Seed the demo MANAGER review account with realistic data.
  - Fill EAS submit credentials (`appleId`, `ascAppId`, `appleTeamId`).
  - Publish/verify the Google OAuth consent screen.
  - Confirm `/privacy` and `/terms` render publicly on the production domain.

## 🟠 High — decisions and gaps

- [ ] **`PAST_DUE` is not enforced** — only `CANCELED` blocks API access (402).
  A failed payment currently grants indefinite access. Decide on a grace
  policy (e.g. 14 days past due → treat as cancelled) and implement it in
  `lib/apiGuard.ts`.

- [ ] **JWT staleness window** — `subscriptionStatus` and `orgId` are cached in
  the JWT, so cancellation/removal only bites when the token refreshes.
  Decide whether the token lifetime is an acceptable window or add a
  periodic server-side re-check.

- [ ] **Lint is not a CI gate** — `apps/web` has ~37 pre-existing eslint errors
  (mostly react-hooks rules). Clean them up, then add `pnpm lint` to
  `.github/workflows/ci.yml`.

## 🟡 Medium

- [ ] **Invite-token dual use** — the same 7-day `Employee.inviteToken` gates
  both portal invites and availability submission. After expiry, account-less
  employees cannot submit availability without a manual re-invite. Consider
  separate per-request availability tokens.

- [ ] **Monitoring** — bug reports land in the DB (`/platform/errors`), but
  nothing alerts you. Consider Sentry or an email digest for new BugReports.

- [ ] **Playwright debug logs remain in git history** — deleted and gitignored
  now, but the 311 files exist in old commits. If the repo ever goes public,
  scrub history first.

## ⚪ Done (verified 2026-06-11)

- [x] Stripe webhook with signature verification + customer-hijack guard
- [x] Subscription enforcement (402 on CANCELED in `requireOrgMember`)
- [x] Billing UI with Stripe Checkout + Customer Portal
- [x] Availability flow end-to-end, rate-limited, PII-scoped responses
- [x] **Per-employee subscription quantity sync** (checkout quantity = active
      employees; re-synced on employee add/deactivate/delete)
- [x] Org settings persistence (`settings` JSON column + PATCH endpoint)
- [x] Error boundaries (`app/error.tsx`, manager-level)
- [x] Cleanup cron wired in `vercel.json` (Sundays 03:00 UTC)
- [x] Wage/time-entry audit logging with actor ids
- [x] Mobile refresh-token revocation on membership loss
- [x] CI: typecheck + 143 unit tests on every push (`.github/workflows/ci.yml`)
- [x] Tests covering tenant isolation (`apiGuard`), Stripe webhook mapping,
      availability PII regression, and billing quantity sync
