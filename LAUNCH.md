# Skemaka — Launch Status & Runbook

> Single source of truth for go-live. Replaces `LAUNCH_CHECKLIST.md`,
> `GO_LIVE_RUNBOOK.md`, and `LAUNCH_PLAN.md` (2026-06 vintage — most of their
> content was done; the still-open items live here).
>
> **State as of 2026-07-12:** prod is live at **skemaka.com**, CI (typecheck +
> lint + unit tests) and the nightly E2E are green. What remains is mostly
> **operational** (consoles, keys, verification) — not engineering.

---

## 0. Owner todo — in order

1. [ ] **Merge PR #11 and #8**, then **#9** (retargets to `main` automatically).
       Vercel deploys `main` to prod.
2. [ ] **Stripe (live mode):** create the volume-tiered monthly price —
       tier 1 (up to 5 units) flat €19.00, tier 2 (6+ units) €3.50/unit —
       set it as `STRIPE_PRICE_ID` in Vercel, then mark **#10** ready and merge.
       Decide: existing €3 subscribers grandfathered or moved (§4).
3. [ ] **Web push live:** `npx web-push generate-vapid-keys` → set both keys in
       Vercel (§2), then `cd apps/web && npx prisma db push` against prod Neon
       to create `PushSubscription` (§3).
4. [ ] **One-time verifications (~30 min):** Stripe webhook 200s, crons
       registered, forced 429, Resend deliverability, Google OAuth consent
       published, test-login vars absent (§2, §4, §5).
5. [ ] **Backup drill:** confirm Neon PITR, restore once to a scratch branch,
       commit `docs/restore-runbook.md` (§3).

SMS registration (§5) and the App Store submission (§6) can trail the web launch.

---

## 1. Code in flight — merge order

| PR | What | Prerequisite before merge |
|---|---|---|
| [#8](https://github.com/Gamborg0101/skemaka/pull/8) | Timesheet CSV export | None — no schema changes, merge when CI is green |
| [#9](https://github.com/Gamborg0101/skemaka/pull/9) | Web push notifications | None to **merge** (verified no-op without VAPID keys). To go **live**: set VAPID env vars + create `PushSubscription` table (see §3) |
| [#10](https://github.com/Gamborg0101/skemaka/pull/10) | Pricing: €3.50/employee, €19 minimum | **Blocked (draft):** create the live volume-tiered Stripe price first, set it as `STRIPE_PRICE_ID`, and decide migration for existing subs on the old €3 price |

Merging to `main` auto-deploys prod via Vercel.

---

## 2. Production environment (Vercel → Settings → Environment Variables)

Required at boot — a deploy **fails fast** listing anything missing
(`instrumentation.ts`): `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`,
`AUTH_GOOGLE_SECRET`, `NEXTAUTH_URL`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `RESEND_API_KEY`,
`NEXT_PUBLIC_APP_URL`, `SUPERADMIN_EMAIL`, `CRON_SECRET`, and Upstash
(`UPSTASH_REDIS_REST_*` or `KV_REST_API_*`). Prod boots today, so these are set.

- [ ] **Web push (for PR #9):** `npx web-push generate-vapid-keys` →
      `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, optional
      `VAPID_SUBJECT` (defaults to mailto:support@skemaka.com).
- [ ] **Twilio (if SMS is day-one):** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
      `TWILIO_FROM_NUMBER` — confirm present in prod.
- [ ] ⛔ Confirm **absent** in prod: `E2E_TEST_LOGIN`, `E2E_TEST_PASSWORD`
      (login backdoor — boot refuses if set), `NEON_WS_PROXY`,
      `TWILIO_TO_OVERRIDE`.

---

## 3. Database (prod Neon)

Prod schema is applied with `prisma db push`; migration files exist for the
nightly E2E, so the two must be kept in sync (see CLAUDE.md).

- [ ] After merging PR #9: `cd apps/web && npx prisma db push` against prod
      (creates `PushSubscription`). Until then push is a silent no-op — safe.
- [ ] Sanity check: `npx prisma migrate status` / Neon console — confirm prod
      has all tables through `20260709000000_add_push_subscriptions`.
- [ ] **Backup drill (still outstanding):** confirm the Neon plan gives PITR and
      its window; restore to a scratch branch once, confirm queryable, record
      time taken; commit the steps as `docs/restore-runbook.md`.

---

## 4. Stripe (live mode)

Webhook handler has signature verification, an idempotency ledger
(`ProcessedStripeEvent`), and customer-hijack guarding. Trial expiry (14 d) and
PAST_DUE grace (14 d → 402) are enforced in `lib/apiGuard.ts`.

- [ ] Confirm the live webhook endpoint `https://skemaka.com/api/webhooks/stripe`
      subscribes to exactly: `checkout.session.completed`,
      `customer.subscription.updated`, `customer.subscription.deleted`,
      `invoice.payment_failed` — and shows 200s in the delivery dashboard.
- [ ] For PR #10: create the **volume-tiered** recurring monthly price —
      tier 1 (up to 5 units) flat €19.00; tier 2 (6+ units) €3.50/unit.
      Volume tiers bill the whole quantity at the matched tier ⇒ exactly
      `max(19, n × 3.50)`, matching `lib/pricing.ts`. Then update
      `STRIPE_PRICE_ID` and redeploy.
- [ ] Decide + execute migration of existing subscriptions on the old €3 price
      (grandfather or move).
- [ ] Recommended once: dunning drill with a Stripe test clock —
      `invoice.payment_failed` → PAST_DUE → 14-day grace → 402.

---

## 5. Verify live services (one-time smoke, ~30 min)

- [ ] **Rate limiting:** >20 req/10 s to a public endpoint → 429; no
      "Rate limiting is DISABLED" in prod logs (API fails closed without Upstash).
- [ ] **Crons:** Vercel → Cron Jobs shows `/api/cron/cleanup` (Sun 03:00) and
      `/api/cron/bug-report-digest` (daily 07:00); trigger each once → 200.
- [ ] **Email:** Resend domain verified; invite + publish emails deliver
      (not spam-foldered) from `RESEND_FROM_EMAIL`.
- [ ] **SMS compliance (if day-one):** sender registration for the target
      market (A2P 10DLC is US-only; for Denmark/EU register the sender /
      alphanumeric ID with Twilio). Inbound webhook
      `https://skemaka.com/api/webhooks/twilio/sms` configured; text STOP →
      suppressed + `SmsOptOut` row; START → restored.
- [ ] **Google OAuth:** consent screen **published** (not testing mode);
      prod redirect URI `https://skemaka.com/api/auth/callback/google` present.
- [ ] **Monitoring decision:** today = structured JSON logs (search Vercel logs
      by `requestId`) + bug-report email/daily digest to `SUPERADMIN_EMAIL`.
      No Sentry. Either accept that for launch or add `@sentry/nextjs` later —
      known gap, not a blocker.

---

## 6. Mobile / App Store (can trail the web launch)

`eas.json` already points at `https://skemaka.com`. Remaining (detail in
`apps/mobile/APP_STORE_SUBMISSION.md`):

- [ ] Fill `eas.json` submit creds: `appleId`, `ascAppId`, `appleTeamId`.
- [ ] Apple Developer: enable "Sign in with Apple" on `com.skemaka.app`.
- [ ] Seed a demo MANAGER review account with realistic data; enter creds in
      App Store Connect + support email/URL.
- [ ] `eas build` → `eas submit`.

---

## 7. Go / No-Go

**GO for web when:** PRs merged per §1 · §2 env confirmed · §3 schema synced ·
§4 webhook verified · §5 rate-limit/cron/email/OAuth checks pass · backup drill
done. SMS (§5) and mobile (§6) may trail if not day-one critical.

**First 48 h:** watch Vercel logs for `level:"error"` lines (correlate by
`requestId`); confirm the daily digest arrives; watch Stripe webhook deliveries
for retries piling up.

---

## 8. Later (post-launch, gate on metrics — from the old Phase 3)

- E2E for the full Stripe checkout money path (webhook + guard logic is
  unit/E2E tested; the checkout redirect flow itself is not).
- Load-test hot endpoints at ~100-org scale; verify indexes with EXPLAIN.
- Keep-warm cron for Neon cold starts; per-org (not per-IP) rate limits.
- Nightly Stripe quantity reconciliation against active seat counts.
- Convert `Shift.startTime/endTime` strings to real time types.
- Scrub old Playwright debug files from git history if the repo ever goes public.
