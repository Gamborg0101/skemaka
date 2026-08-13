# Skemaka — Codebase & Security Analysis (2026-07-05)

Scope: apps/web API surface, auth/authz, token flows, webhooks, rate limiting, notification paths. Branch: feat/pwa-install.

## Verdict

The security architecture is genuinely solid — noticeably above typical pre-launch SaaS. Every `/api/orgs/*` route calls `requireOrgMember`; manager-only actions check the role (inline or via `requireManagerRole`); Stripe webhooks verify signatures with replay protection (`ProcessedStripeEvent`); the Twilio inbound webhook validates `x-twilio-signature`; cron routes require `CRON_SECRET`; rate limiting fails **closed** in production when Upstash is missing and open only on transient errors; mobile auth uses short-lived single-use handoff codes; the JWT role claim is re-validated against the DB every 60 s so demoted/removed managers lose access quickly; invite claiming requires an emailed 6-digit code so a leaked join link alone can't hijack an identity; the public availability endpoint deliberately serializes only `{id, name, jobRole}`. Unit tests cover the risky modules (apiGuard, stripeWebhook, claimInvite, availabilityToken, smsOptOut — 18 test files).

No critical vulnerabilities found. The launch risk is concentrated in **broken flows** (see QA report) and the **logic gaps** below.

## High — logic gaps

1. **Weekly availability links die after 7 days.** Availability request emails link `/availability/${employee.inviteToken}` (`availabilityService.ts:122`), but `resolveInviteToken` requires `inviteExpiry > now` (`:175`), and `inviteExpiry` is only set at employee creation / manual re-invite (+7 days, `employeeService.ts:112,316`). Any availability request sent more than a week after an employee was invited emails them a dead link ("Invalid or expired token"). My QA org was fresh, so this never surfaced in testing — in production it breaks the flagship no-login availability flow for the whole team from week 2 onward. Fix: refresh `inviteExpiry` (or mint a purpose-specific availability token) whenever an availability request is created.

2. **Invite token is a multi-purpose credential.** The same token is the account-claim secret, the availability-link key, and never rotates after claim. The emailed-code step protects account claiming, but consider separate tokens per purpose so extending availability-link lifetime (fix #1) doesn't also extend the claim window indefinitely.

3. **Portal time-off requires `employeeId` for MANAGER callers** (`time-off/route.ts:75`) while the portal form never sends it → managers with employee records can't request time off (QA ISSUE-003).

4. **Sick-day client sends `00:00–00:00`**, server rejects equal times → feature 100 % broken (QA ISSUE-002; `useShiftMutations.ts:117` vs `shifts/route.ts:58`).

## Medium

5. **SMS results are ignored.** `sendPhoneVerificationSms` returns `false` on unconfigured/failed sends, but `me/phone/request-code` still responds `sent: true`; publish success toast says "employees notified by SMS" unconditionally. Silent notification loss in prod.

6. **Bearer-header middleware bypass is safe today, fragile tomorrow.** `proxy.ts:36` passes through any `/api/*` request bearing `Authorization: Bearer …`, relying on each handler to self-guard. All current handlers do (verified route-by-route), and `/api/admin` + `/api/platform` handlers re-check via cookie-based `auth()` (Bearer callers simply 401). But one future route added without `requireOrgMember` becomes silently unauthenticated. Consider an integration test that walks every `app/api/**/route.ts` and asserts a guard call, or move Bearer decoding into middleware.

7. **Mobile auth code single-use depends on Redis.** `mobile/redeem` falls through when Redis is unavailable (acknowledged in code) — a code could be redeemed twice during an Upstash outage. Codes expire in 2 min, so exposure is small; fine to accept, worth knowing.

8. **`weekStart` is `DateTime` in Postgres but treated as a date.** Stored values are timezone-shifted (`2026-06-28T22:00:00Z` for Monday 29 Jun local). It works because both writer and reader use the same conversion, but it contradicts the project's own "weekStart is always YYYY-MM-DD" convention and invites off-by-one bugs for orgs in other timezones — especially with "Locale & Time Zone" marked Coming soon. Consider `@db.Date` or a string column.

9. **Deploy-time env contract.** Fail-closed behaviors make several env vars load-bearing in production: `UPSTASH_*` (missing → all rate-limited endpoints 429), `SUPERADMIN_EMAIL` (missing → /platform locked), `TWILIO_*` (missing → silent SMS skip, see #5), `E2E_TEST_LOGIN`/`E2E_TEST_PASSWORD` (must NEVER be set — the login page's own comments are good; add a startup assert in `instrumentation.ts`). Also note `TWILIO_TO_OVERRIDE` must not leak into prod or every SMS goes to one phone.

## Low / hygiene

10. Generic client toasts swallow useful API error messages (`res.error` is available but often replaced with a canned string) — pattern across `useShiftMutations`/`useScheduleData`. The API's own error strings are safe to display.
11. `POST /api/orgs` allows multiple orgs per user (no existing-membership check found in handler). The product's model is one org per manager; onboarding UI prevents it, but the API doesn't. Low risk, worth an explicit guard.
12. Availability requests: no protection against duplicate OPEN requests for the same week (UI disables the button after send; API `createAvailabilityRequest` has no unique/status check).
13. `platform/errors` DELETE wipes all bug reports with no confirmation/audit trail — superadmin-only, but destructive.
14. Secrets hygiene is good: `.env*` gitignored (only `.env.example` tracked), no secrets in `NEXT_PUBLIC_*` beyond the Stripe publishable key.

## Suggested pre-launch order

1. Fix invite/claim funnel (QA ISSUE-001 + ISSUE-004: callbackUrl preservation + email sign-in method).
2. Fix availability-link expiry (this file, #1).
3. Fix sick-day and portal time-off (#3, #4).
4. Propagate SMS failures (#5) and verify Twilio + Upstash + AUTH_SECRET + SUPERADMIN_EMAIL in the prod env.
5. Add the availability-request send dialog (week + deadline picker — API already supports datetime deadlines).
6. Sweep client toasts to surface `res.error`.
