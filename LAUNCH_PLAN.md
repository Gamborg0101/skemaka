# Skemaka — Complete Launch Plan

> Owner: CTO. Source: pre-launch code audit (2026-06-13). Goal: get from "secure
> codebase" to "can safely charge paying customers," then to reliable and scalable.
>
> Phases: **1 Critical blockers → 2 Production hardening → 3 Scale readiness.**
> Every task has Goal / Implementation / Acceptance criteria / Test cases /
> Definition of Done. ROI ranking and an executable checklist are at the end.

---

## Part A — Issue register

Effort = focused engineering hours (one senior dev). Risk = consequence if shipped
to paying customers unfixed.

| # | Issue | Why it matters | Files likely touched | Effort | Risk if unfixed | Verdict |
|---|---|---|---|---|---|---|
| 1 | **Trial never expires** | Orgs default to `TRIALING`; only `CANCELED` is blocked. Checkout sets no `trial_period_days`. Customers use the product free forever. Direct revenue loss + no forcing function to convert. | `prisma/schema.prisma`, `lib/services/orgService.ts`, `lib/apiGuard.ts`, `lib/auth.ts` (JWT), `app/(manager)` billing banner | 10 | **High** — you cannot reliably monetize | **Must fix** |
| 2 | **PAST_DUE not enforced** | Failed payment → indefinite access. No dunning/grace. Revenue leak + ignores Stripe's recovery signals. | `lib/apiGuard.ts`, `app/api/webhooks/stripe/route.ts` | 5 | **High** — pay-failures still get full service | **Must fix** |
| 3 | **No production monitoring/alerting** | `console.*` only; no Sentry/APM. Prod 500s are invisible. You learn of outages from churned customers. | `apps/web/instrumentation.ts` (new), `app/error.tsx`, `package.json`, env | 6 | **High** — silent breakage on paying users | **Must fix** |
| 4 | **Pending prod migration** | `20260610143859_add_employee_wage_base` unapplied; prod runs pre-hardening code incl. the availability PII leak. | deploy step only | 1 | **High** — schema drift + live PII leak | **Must fix** |
| 5 | **GDPR: employee data-subject rights + export + DPA** | Account-holder erasure exists (`DELETE /api/me/account`), but employee PII (wage/phone/email) is manager-entered with no employee erasure/export, no public subprocessor list/DPA. EU legal exposure. | `app/api/orgs/[orgId]/employees/[employeeId]/route.ts`, new export endpoint, `/privacy`, `/legal/subprocessors` (new) | 12 | **Med-High** — regulatory + customer-trust | **Must fix** (legal pages) / **Should fix** (export tooling) |
| 6 | **Prod env + live Stripe webhook + rate-limit verification** | Rate limiting fails CLOSED if Upstash unset (good) but means a missed env silently breaks the API; webhook must point at prod; secrets must all be set. | Vercel env, Stripe dashboard, `vercel.json` | 3 | **High** — broken billing/API on day 1 | **Must fix** |
| 7 | **No verified backup / restore runbook** | Sole datastore is Neon. PITR depends on plan tier. No tested restore = potential unrecoverable loss. | docs/runbook (new), Neon settings | 3 | **High impact / low prob** — data loss | **Must fix** (verify) |
| 8 | **Webhook no idempotency / ordering guard** | Stripe retries + out-of-order `subscription.updated` can regress status (e.g. ACTIVE→PAST_DUE late). | `app/api/webhooks/stripe/route.ts`, `schema.prisma` (event ledger) | 5 | **Med** — wrong subscription state | **Should fix** |
| 9 | **Twilio SMS compliance** | No STOP/opt-out, no A2P 10DLC/sender registration. Carriers block unregistered traffic; legal risk. | `lib/sms.ts`, Twilio console | 6 | **Med** — blocked SMS / fines | **Should fix** |
| 10 | **No E2E / integration tests** | 143 unit tests but the money path (signup→checkout→webhook→access) and publish→SMS are untested end-to-end. | `apps/web/e2e/` (new Playwright), `ci.yml` | 12 | **Med** — regressions in critical flows | **Should fix** |
| 11 | **Guard-usage audit across org routes** | Tenant isolation is tested in `apiGuard`, not in every route's *use* of it. One missed call = cross-tenant leak. | all `app/api/orgs/[orgId]/**` | 4 | **High impact / low prob** — data leak | **Should fix** |
| 12 | **Dual-use invite token** | One 7-day `Employee.inviteToken` gates both portal invite and availability submission; expiry locks account-less employees out of availability. | `schema.prisma`, `lib/services/availabilityService.ts`, availability routes | 6 | **Low-Med** — UX/operational | **Can wait** |
| 13 | **Structured logging + request IDs** | `console.*` is unsearchable at scale; no correlation across a request. | `lib/log.ts` (new), API routes | 6 | **Low-Med** — slow incident response | **Can wait** |
| 14 | **Bug-report alerting** | Reports land in DB + single email; no digest/severity routing. | `app/api/bug-report/route.ts` | 2 | **Low** — missed reports | **Can wait** |
| 15 | **Shift time fields are strings** | `Shift.startTime/endTime` are `String`; overlap/duration logic is string-based, DST-fragile. | `schema.prisma`, `ShiftTimeline.tsx`, costs calc | 16 | **Low-Med** — subtle scheduling/cost bugs | **Can wait** |
| 16 | **Neon cold-start latency** | ~10–15s first hit after idle = poor first impression at low traffic. | keep-warm cron or Neon tier | 2 | **Low** — UX | **Can wait** |
| 17 | **Scrub Playwright files from git history** | 311 debug files in old commits; risk only if repo goes public. | git history (BFG) | 3 | **Low** (unless public) | **Can wait** |
| 18 | **Customer support surface** | Only bug-report→email. No helpdesk/status page/in-app support. | external tools | 4 | **Low-Med** — support load | **Can wait** |

**Totals:** Must-fix ≈ 34h · Should-fix ≈ 33h · Can-wait ≈ 39h.

---

## Phase 1 — Critical blockers (before paying customers)

Minimum bar to charge money safely. Target: ~1 week (34h).

### 1.1 Enforce trial expiry (Issue #1)
- **Goal:** A trial has a fixed length; when it ends without an active subscription,
  the org is blocked (402) until they subscribe.
- **Technical implementation:**
  - Schema: add `trialEndsAt DateTime?` to `Organization`. Migration.
  - `orgService.createOrg`: set `trialEndsAt = now + 14 days` alongside the existing
    `TRIALING` default.
  - `lib/apiGuard.ts` `requireOrgMember`: block when
    `status === "TRIALING" && trialEndsAt && trialEndsAt < now` **and** no active
    subscription → return the existing 402 `SUBSCRIPTION_CANCELED`-style code
    (add `TRIAL_EXPIRED`). Apply on both fast (JWT) and slow (DB) paths.
  - `lib/auth.ts` JWT callback + `session` callback: include `trialEndsAt` so the
    fast path can decide without a DB hit; accept ≤30-min staleness (token maxAge).
  - UI: trial-countdown banner in the manager layout; CTA to `/billing`.
- **Acceptance criteria:** New org gets a 14-day trial; on day 15 with no sub, all
  `orgs/[orgId]/*` mutating + read routes return 402; subscribing clears the block
  immediately (after token refresh ≤30 min, or force re-issue on checkout success).
- **Test cases:** unit `requireOrgMember`: TRIALING+future→allow; TRIALING+past+no
  sub→402; TRIALING+past+ACTIVE→allow; ACTIVE→allow. Integration: create org, fast-
  forward clock (inject `now`), assert 402.
- **DoD:** migration applied in CI + prod; tests green; banner verified in
  screenshot; documented in `LAUNCH_CHECKLIST.md`.

### 1.2 Enforce PAST_DUE with grace period (Issue #2)
- **Goal:** Failed payment grants a bounded grace window, then blocks.
- **Technical implementation:** rely on Stripe as source of truth. Add
  `pastDueSince DateTime?` to `Organization`, set on `invoice.payment_failed`
  webhook, cleared on `customer.subscription.updated`→active. In `requireOrgMember`,
  block when `status === "PAST_DUE" && pastDueSince < now - 14d`. Surface
  `pastDueSince` in JWT.
- **Acceptance criteria:** PAST_DUE within 14d → allowed (with warning banner);
  beyond 14d → 402; payment recovery → immediate restore on next webhook.
- **Test cases:** webhook `invoice.payment_failed` sets `pastDueSince`; guard unit
  tests for in-grace vs expired; recovery clears the field.
- **DoD:** tests green; banner shown during grace; Stripe test-clock dunning run
  documented.

### 1.3 Production error monitoring (Issue #3)
- **Goal:** Every prod exception and unhandled rejection is captured and alerts.
- **Technical implementation:** add Sentry (`@sentry/nextjs`) via
  `instrumentation.ts` + client/server config; wire `app/error.tsx` and route
  catch blocks to `captureException`; set alert rule (error-rate spike + new
  issue) to email/Slack; scrub PII (wage, email) in `beforeSend`.
- **Acceptance criteria:** a deliberately thrown error in a route appears in
  Sentry within 1 min with release + request context, no PII.
- **Test cases:** hit a debug route that throws → Sentry event present; verify
  `beforeSend` strips known PII fields.
- **DoD:** alert fires to a real inbox; DSN in prod env; release tagging on deploy.

### 1.4 Deploy + apply pending migration (Issue #4)
- **Goal:** Prod runs the hardened code with current schema.
- **Technical implementation:** merge to `main`; `cd apps/web && npx prisma migrate
  deploy` against prod Neon (uses `DIRECT_URL`); confirm Vercel prod build.
- **Acceptance criteria:** `npx prisma migrate status` shows no pending; availability
  public endpoint returns PII-scoped payload in prod.
- **Test cases:** curl prod `/api/availability/[token]` → no wage/phone/email.
- **DoD:** migration logged; smoke test of login + schedule load on prod.

### 1.5 Production env, live Stripe webhook, rate-limit verification (Issue #6)
- **Goal:** All required secrets set; billing + rate limiting actually live.
- **Technical implementation:** set every var from `.env.example` in Vercel prod
  (AUTH_SECRET, STRIPE_* live keys, STRIPE_WEBHOOK_SECRET for the prod endpoint,
  STRIPE_PRICE_ID live, UPSTASH_*, CRON_SECRET, SUPERADMIN_EMAIL, RESEND_*,
  TWILIO_*); register the live webhook → `/api/webhooks/stripe`; confirm Upstash
  is reachable from prod (else API fails closed).
- **Acceptance criteria:** Stripe test event delivered + 200; >20 req/10s to a
  public endpoint returns 429 in prod.
- **Test cases:** Stripe CLI `trigger checkout.session.completed` against prod;
  load-loop a public route to observe 429.
- **DoD:** webhook shows delivered events; rate-limit 429 observed; no
  "Rate limiting is DISABLED" log line in prod.

### 1.6 Legal pages live + backup verification (Issues #5 partial, #7)
- **Goal:** `/privacy` + `/terms` render on prod domain; backups proven.
- **Technical implementation:** confirm legal routes render publicly; add a
  `/legal/subprocessors` list (Neon, Stripe, Twilio, Resend, Vercel, Upstash,
  Google); confirm Neon PITR tier; perform one **restore drill** to a scratch DB
  and document the runbook.
- **Acceptance criteria:** pages reachable unauthenticated; restore drill produces
  a working DB copy; runbook checked into `docs/`.
- **Test cases:** anonymous GET `/privacy`, `/terms`, `/legal/subprocessors` → 200;
  restore drill RTO recorded.
- **DoD:** runbook merged; App Store reviewer can reach legal pages.

---

## Phase 2 — Production hardening (reliability)

Target: ~1–1.5 weeks (33h). Do soon after / overlapping launch.

### 2.1 Webhook idempotency + ordering (Issue #8)
- **Goal:** Stripe events process exactly once and never regress on stale events.
- **Implementation:** add `ProcessedStripeEvent { id @id, createdAt }`; at webhook
  start, upsert event.id, skip if seen. For `subscription.updated`, compare against
  the latest known subscription state/`current_period`/event timestamp before
  writing.
- **Acceptance criteria:** replaying the same event is a no-op; an older event
  delivered after a newer one does not overwrite newer state.
- **Test cases:** duplicate-event test → single DB write; out-of-order test →
  newer state preserved.
- **DoD:** unit tests added to `stripeWebhook.test.ts`; ledger purged by cleanup cron.

### 2.2 Twilio SMS compliance (Issue #9)
- **Goal:** Compliant, deliverable SMS.
- **Implementation:** register A2P 10DLC brand/campaign (or local equivalent for
  target market); add STOP/HELP handling + opt-out suppression list checked in
  `lib/sms.ts`; include opt-out language; store consent timestamp on employee.
- **Acceptance criteria:** STOP suppresses future SMS to that number; sender is
  registered; opt-out text present.
- **Test cases:** send to STOP-listed number → skipped + logged; registration
  status verified in console.
- **DoD:** suppression respected in `sms.ts`; consent captured at employee create.

### 2.3 E2E money-path + critical-flow tests (Issue #10)
- **Goal:** Automated coverage of the flows that lose money/data if broken.
- **Implementation:** Playwright suite: signup→onboarding→checkout (Stripe test)→
  webhook→access; trial-expiry block; publish-schedule→SMS (mock); time-off
  approve→grey-out; invite→claim→employee access. Add a CI job (can be nightly to
  control minutes).
- **Acceptance criteria:** suite green against a seeded test DB; fails if any
  critical flow breaks.
- **Test cases:** the flows above, each asserting final state + access control.
- **DoD:** E2E job in `ci.yml`; flake rate <2% over 10 runs.

### 2.4 Guard-usage audit (Issue #11)
- **Goal:** Prove every org-scoped route enforces tenant isolation.
- **Implementation:** script/grep every `app/api/orgs/[orgId]/**/route.ts` for a
  `requireOrgMember(orgId, …)` call before any DB access; add a lint/test that
  fails CI if a handler reads `params.orgId` without the guard. Add cross-tenant
  E2E (org A token → org B 403).
- **Acceptance criteria:** 100% of org routes call the guard; cross-tenant E2E 403.
- **Test cases:** automated route inventory test; A-vs-B access test.
- **DoD:** inventory test in CI; no unguarded routes.

### 2.5 GDPR employee export + erasure (Issue #5 remainder)
- **Goal:** Honor data-subject requests for employees, not just account holders.
- **Implementation:** manager-triggered employee data export (JSON) + hard-delete
  endpoint that removes Employee + related shifts/time-entries/availability;
  document the manual DPA process; publish privacy notice covering employee data.
- **Acceptance criteria:** export returns all PII for one employee; erasure removes
  all rows; both audit-logged.
- **Test cases:** export shape test; erasure cascade test (no orphans).
- **DoD:** endpoints shipped + audit-logged; DPA template available to customers.

### 2.6 Structured logging + bug-report alerting (Issues #13, #14)
- **Goal:** Searchable logs with request correlation; no missed reports.
- **Implementation:** `lib/log.ts` wrapping a JSON logger with a per-request id
  (from middleware); replace hot-path `console.*`; daily BugReport digest email +
  immediate alert on `errorMessage` (crash) reports.
- **Acceptance criteria:** logs queryable by request id; crash report triggers
  immediate email.
- **Test cases:** log includes request id; crash bug-report sends email.
- **DoD:** logger adopted in API routes; digest cron live.

---

## Phase 3 — Scale readiness (100 / 500 / 1000 orgs)

Target: incremental; gate on metrics, not calendar.

### 3.1 Database scaling & query hygiene — for ~100 orgs
- **Goal:** Stay fast as row counts grow.
- **Implementation:** enable Prisma/Neon slow-query logging; load-test the hot
  endpoints (`/api/me/context`, schedules-by-week, costs) with 100 orgs ×
  ~30 employees × 52 weeks of shifts seeded; confirm existing composite indexes
  (`organizationId,date` etc.) are used (EXPLAIN); move heavy reads to the Neon
  read replica if needed. Convert `Shift` time strings to real `time`/`timestamptz`
  (Issue #15) before overlap/cost logic gets heavier.
- **Acceptance criteria:** p95 < 300ms (warm) on hot endpoints at 100-org seed.
- **Test cases:** k6/Artillery scenario; EXPLAIN shows index scans, no seq scans
  on large tables.
- **DoD:** load-test report in `docs/`; slow-query alerts wired.

### 3.2 Connection pooling & cold-start — for ~500 orgs
- **Goal:** Survive concurrency spikes (Mon-morning roster publishing).
- **Implementation:** verify pooled `DATABASE_URL` (PgBouncer) vs `DIRECT_URL`
  split is correct under load; tune Prisma pool; add a keep-warm cron (Issue #16)
  to hide Neon cold starts; consider Neon autoscaling/scale-to-zero settings;
  cache `/api/me/context` per-user briefly.
- **Acceptance criteria:** no pool-exhaustion errors at 500-org concurrency burst;
  cold-start p99 acceptable.
- **Test cases:** burst load test (publish storm); observe error rate 0.
- **DoD:** pool config documented; keep-warm live; burst test passes.

### 3.3 Rate-limit, billing & ops at 1000 orgs
- **Goal:** Fair limits, accurate billing, observability at scale.
- **Implementation:** revisit the global 20 req/10s window — make per-user/per-org
  rather than per-IP (shared restaurant NAT) and tier by endpoint; reconcile Stripe
  quantities nightly against `activeSeatCount` to catch drift from missed
  `syncSubscriptionQuantitySafe` fire-and-forget calls; dashboards for MRR, churn,
  error budget; on-call rotation + status page (Issue #18); scrub git history
  (Issue #17) if open-sourcing.
- **Acceptance criteria:** no false 429s for multi-employee NAT; nightly billing
  reconciliation report shows 0 drift; dashboards live.
- **Test cases:** simulate 10 employees behind one IP submitting availability →
  no 429; introduce a quantity drift → reconciliation corrects it.
- **DoD:** per-org limiter shipped; reconciliation cron + dashboards in prod.

---

## Part B — ROI ranking (highest business value first)

| Rank | Task | Why it wins | Effort | Phase |
|---|---|---|---|---|
| 1 | **1.4 Deploy + migration** | Unblocks everything; closes live PII leak; ~1h | 1 | P1 |
| 2 | **1.1 Trial expiry** | Without it you literally cannot make money | 10 | P1 |
| 3 | **1.5 Prod env + live webhook** | Billing/API simply don't work otherwise | 3 | P1 |
| 4 | **1.3 Error monitoring** | Cheap insurance against silent, churn-causing outages | 6 | P1 |
| 5 | **1.2 PAST_DUE grace** | Stops revenue leak on failed payments | 5 | P1 |
| 6 | **1.6 Legal pages + backup drill** | Gates App Store + EU sales; prevents catastrophic loss | 3 | P1 |
| 7 | **2.4 Guard-usage audit** | Low effort, prevents catastrophic cross-tenant leak | 4 | P2 |
| 8 | **2.1 Webhook idempotency** | Protects billing correctness as volume grows | 5 | P2 |
| 9 | **2.3 E2E money-path tests** | Prevents regressions in the flows that pay you | 12 | P2 |
| 10 | **2.5 GDPR export/erasure** | Removes legal/customer-trust blocker for EU | 12 | P2 |
| 11 | **2.2 Twilio compliance** | Keeps a headline feature deliverable + legal | 6 | P2 |
| 12 | **2.6 Logging + alerting** | Faster incident response, lower support cost | 8 | P2 |
| 13 | **3.1 DB scaling/query hygiene** | Needed before ~100 orgs; pre-empts slowdowns | 16 | P3 |
| 14 | **3.2 Pooling + cold-start** | Survives publish-storm concurrency | 6 | P3 |
| 15 | **3.3 Per-org limits + reconciliation** | Fairness + billing accuracy at scale | 12 | P3 |

---

## Part C — Executable launch checklist

### 🔴 Phase 1 — must complete before charging
- [ ] **1.4a** Merge hardened branch to `main`
- [ ] **1.4b** `cd apps/web && npx prisma migrate deploy` against prod Neon
- [ ] **1.4c** `npx prisma migrate status` shows **no pending**
- [ ] **1.4d** Smoke test: login + schedule load on prod; availability endpoint returns no PII
- [ ] **1.5a** Set all prod env vars (AUTH_SECRET, STRIPE_* live, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID live, UPSTASH_*, CRON_SECRET, SUPERADMIN_EMAIL, RESEND_*, TWILIO_*)
- [ ] **1.5b** Register live Stripe webhook → `/api/webhooks/stripe`; send test event → 200
- [ ] **1.5c** Confirm rate limiting live in prod (force a 429; no "DISABLED" log)
- [ ] **1.1a** Add `trialEndsAt` to schema + migration
- [ ] **1.1b** Set `trialEndsAt = now+14d` in `orgService.createOrg`
- [ ] **1.1c** Enforce trial expiry in `requireOrgMember` (fast + slow path)
- [ ] **1.1d** Add `trialEndsAt` to JWT + session callbacks
- [ ] **1.1e** Trial-countdown banner + `/billing` CTA in manager layout
- [ ] **1.1f** Unit tests: trialing-future/expired/active matrix green
- [ ] **1.2a** Add `pastDueSince`; set on `invoice.payment_failed`, clear on recovery
- [ ] **1.2b** Enforce 14-day PAST_DUE grace in `requireOrgMember`
- [ ] **1.2c** PAST_DUE warning banner; unit + Stripe test-clock dunning verified
- [ ] **1.3a** Install + configure `@sentry/nextjs` (instrumentation + error.tsx)
- [ ] **1.3b** Alert rule to real inbox/Slack; `beforeSend` PII scrub
- [ ] **1.3c** Throw test error → event appears in Sentry < 1 min
- [ ] **1.6a** `/privacy`, `/terms` render on prod domain (anonymous 200)
- [ ] **1.6b** Publish `/legal/subprocessors`
- [ ] **1.6c** Confirm Neon PITR tier; run restore drill; commit runbook to `docs/`

### 🟠 Phase 2 — production hardening (soon after launch)
- [ ] **2.4** Guard-usage audit: 100% org routes call `requireOrgMember`; CI inventory test; cross-tenant 403 E2E
- [ ] **2.1** Webhook idempotency ledger + ordering guard; duplicate/out-of-order tests
- [ ] **2.3** Playwright E2E money-path + critical flows; CI job
- [ ] **2.5** GDPR employee export + erasure endpoints (audit-logged); DPA template
- [ ] **2.2** Twilio A2P registration + STOP/opt-out suppression in `lib/sms.ts`
- [ ] **2.6** Structured logger + request IDs; BugReport crash alert + daily digest

### 🟢 Phase 3 — scale readiness (gate on metrics)
- [ ] **3.1** Seed 100-org dataset; load test hot endpoints; EXPLAIN index usage; convert `Shift` time fields to real time types; slow-query alerts
- [ ] **3.2** Verify pooled vs direct URL under load; tune pool; keep-warm cron; brief context cache
- [ ] **3.3** Per-user/per-org rate limits; nightly Stripe quantity reconciliation; MRR/churn/error dashboards; status page; scrub git history if open-sourcing

### Go/No-Go gate for paying customers
**GO only when every 🔴 Phase 1 box is checked.** Phase 2 may trail launch by days;
Phase 3 is metric-gated.
