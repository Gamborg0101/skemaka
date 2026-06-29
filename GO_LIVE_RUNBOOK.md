# Skemaka — Go-Live Ops & Human Runbook

> The code-level launch work is done (see `LAUNCH_PLAN.md` for the engineering side).
> Everything below is **operational or human** — it cannot be done from the repo.
> Work top to bottom: each phase gates the next. Check boxes as you go.

---

## 0. Pre-flight (do first, ~30 min)

- [ ] Confirm you can access every console: **Vercel**, **Neon**, **Stripe**, **Twilio**,
      **Resend**, **Upstash**, **Google Cloud (OAuth)**, **Apple Developer / App Store Connect**.
- [ ] Decide the production domain (e.g. `app.skemaka.com`) — several steps below hard-code it.
- [ ] Pick the launch window (low-traffic; you'll run a migration against prod).

---

## 1. Land the code

- [ ] Commit the branch `mobile-appstore-prep` and open a PR to `main`.
- [ ] Confirm CI `verify` job is green (typecheck + lint + unit tests).
- [ ] Merge to `main`. Vercel auto-builds prod from `main`.
- [ ] **Gotcha:** the build will **fail fast** if any required env var (Step 2) is missing —
      `instrumentation.ts` asserts them on startup. Set env *before* promoting the deploy.

---

## 2. Production environment variables (Vercel → Project → Settings → Environment Variables, scope = Production)

**Required (build refuses to start without these — listed in `instrumentation.ts`):**

- [ ] `DATABASE_URL` — Neon **pooled** connection string
- [ ] `DIRECT_URL` — Neon **direct** connection string (used by migrations)
- [ ] `AUTH_SECRET` — generate: `openssl rand -base64 32`
- [ ] `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — from Google Cloud OAuth client
- [ ] `NEXTAUTH_URL` — `https://<prod-domain>`
- [ ] `NEXT_PUBLIC_APP_URL` — `https://<prod-domain>`
- [ ] `STRIPE_SECRET_KEY` — **live** key (`sk_live_…`)
- [ ] `STRIPE_WEBHOOK_SECRET` — from the live webhook you create in Step 4
- [ ] `STRIPE_PRICE_ID` — **live** recurring price id
- [ ] `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — rate limiting (API **fails closed** if unreachable)
- [ ] `RESEND_API_KEY` — transactional email
- [ ] `SUPERADMIN_EMAIL` — receives bug reports + crash alerts + daily digest; also grants ADMIN role
- [ ] `CRON_SECRET` — protects the cron endpoints; `openssl rand -hex 32`

**Also set (used by features, not asserted at startup):**

- [ ] `STRIPE_PUBLISHABLE_KEY` — live (`pk_live_…`)
- [ ] `RESEND_FROM_EMAIL` — e.g. `noreply@skemaka.com` (domain must be verified in Resend)
- [ ] `MOBILE_TOKEN_MAX_AGE` — mobile bearer-token lifetime
- [ ] `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` — SMS (see Step 7).
      **Note:** these are **not in `.env.example`** yet — add them there too.

**Must NEVER be set in production** (test/CI only — they'd open a login bypass or break the DB driver):

- [ ] ⛔ `E2E_TEST_LOGIN`, `E2E_TEST_PASSWORD`, `NEON_WS_PROXY`, `TWILIO_TO_OVERRIDE` — confirm absent.

> Verify after deploy: a successful boot with no `[startup] Missing required environment variables` error in logs.

---

## 3. Database migration (prod Neon)

Two migrations are pending in prod: `20260613120000_billing_enforcement` and
`20260628120000_sms_opt_out`.

- [ ] From a machine with prod `DATABASE_URL`/`DIRECT_URL` exported:
      `cd apps/web && npx prisma migrate deploy`
- [ ] Confirm clean: `npx prisma migrate status` → **no pending migrations**.
- [ ] Spot-check the backfill: existing `TRIALING` orgs now have a `trialEndsAt`
      (the billing migration sets it to deploy + 14 days).
- [ ] Smoke test: log in on prod, load the schedule, hit a public availability link →
      returns no wage/phone/email (PII scoping).

---

## 4. Stripe (live mode)

- [ ] In the Stripe Dashboard (live mode) create/confirm the **subscription Price**; copy its id → `STRIPE_PRICE_ID`.
- [ ] Create a **webhook endpoint** → `https://<prod-domain>/api/webhooks/stripe`.
- [ ] Subscribe to exactly these events:
      `checkout.session.completed`, `customer.subscription.updated`,
      `customer.subscription.deleted`, `invoice.payment_failed`.
- [ ] Copy the endpoint's **signing secret** → `STRIPE_WEBHOOK_SECRET` (Step 2), redeploy.
- [ ] Test: Stripe CLI `stripe trigger checkout.session.completed` (or send a test event) →
      endpoint returns **200**; a replay of the same event returns `{ "duplicate": true }`.
- [ ] **Dunning drill (recommended):** use a Stripe **test clock** to simulate
      `invoice.payment_failed` → org goes `PAST_DUE` → 14-day grace → then 402.

---

## 5. Cron jobs (Vercel)

`vercel.json` declares two crons; Vercel registers them automatically on deploy.

- [ ] Confirm both appear under Vercel → Project → Cron Jobs:
      `/api/cron/cleanup` (weekly, Sun 03:00) and `/api/cron/bug-report-digest` (daily 07:00).
- [ ] Confirm `CRON_SECRET` is set (Step 2) — endpoints return 401 without it.
- [ ] Manually trigger each once and confirm 200 + expected log line.

---

## 6. Rate limiting (Upstash) verification

- [ ] Confirm `UPSTASH_*` set and reachable from prod.
- [ ] Hit a public endpoint >20×/10s → observe **429**.
- [ ] Confirm logs do **not** contain a "Rate limiting is DISABLED" line.

---

## 7. Twilio SMS compliance & wiring

Code handles STOP/START/HELP + a suppression list; the carrier registration is human.

- [ ] Register **A2P 10DLC** brand + campaign (or the local equivalent for your market).
      Until registered, carriers may filter/block messages.
- [ ] Set `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` (Step 2).
- [ ] Configure the Twilio phone number's **inbound message webhook** →
      `https://<prod-domain>/api/webhooks/twilio/sms` (POST). This powers STOP/START/HELP.
- [ ] Test: text **STOP** to the number → reply suppressed; confirm a row in `SmsOptOut`.
      Text **START** → re-subscribed (row removed).
- [ ] Confirm outbound messages include the "Reply STOP to opt out." footer.

---

## 8. Google OAuth

- [ ] In Google Cloud Console, add the prod redirect URI:
      `https://<prod-domain>/api/auth/callback/google`.
- [ ] **Publish** the OAuth consent screen (or add the App Store reviewer's demo email as a
      Test user) so "Continue with Google" is not blocked.

---

## 9. Backups & data safety (Neon)

- [ ] Confirm the Neon plan tier provides **PITR** (point-in-time restore) and note the window.
- [ ] Run a **restore drill**: restore to a scratch branch/DB, confirm it's queryable,
      record the RTO (time taken).
- [ ] Commit a short restore runbook to `docs/` (steps + who to call).

---

## 10. Mobile / App Store (from `apps/mobile/APP_STORE_SUBMISSION.md`)

- [ ] Replace **both** `EXPO_PUBLIC_API_URL: "https://REPLACE-WITH-PRODUCTION-DOMAIN"` in
      `apps/mobile/eas.json` (`build.preview` **and** `build.production`) with the prod domain.
      *(Without this the app talks to localhost and every request fails on-device.)*
- [ ] Fill `eas.json` submit creds: `appleId`, `ascAppId`, `appleTeamId` (currently empty).
- [ ] Apple Developer: enroll + enable **"Sign in with Apple"** on App ID `com.skemaka.app`.
- [ ] Seed a **demo MANAGER account** (e.g. `appreview@skemaka.app`) in an org with realistic
      data: several employees, a published week, a couple of pending availability + time-off requests.
- [ ] Enter demo creds in App Store Connect **Sign-In Information** fields + review notes.
- [ ] Set a **Support email/URL** in App Store Connect.
- [ ] Confirm `/privacy`, `/terms`, `/subprocessors` render publicly (no login wall) on prod.
- [ ] Verify accessibility items in `APP_STORE_SUBMISSION.md` on a real device.
- [ ] `eas build` → `eas submit`.

---

## 11. First nightly E2E (after merge)

- [ ] Trigger the new **e2e** CI job manually (`workflow_dispatch`) once to validate it
      (it's scaffolded but hasn't run yet). Fix any wsproxy/seed issues surfaced on first run.
- [ ] Confirm it's green, then let it run on its nightly schedule (04:00 UTC).

---

## 12. Go / No-Go gate

**GO only when:** Steps 1–6 + 8–9 are checked (the money path, env, migration, backups, OAuth).
Steps 7 (SMS) and 10 (mobile) can trail web launch if SMS/mobile aren't day-one critical.

### Post-launch watch (first 48h)
- [ ] Watch Vercel logs for `level:"error"` JSON lines (new structured logger) — correlate by `requestId`.
- [ ] Confirm the first bug-report email + the daily digest arrive at `SUPERADMIN_EMAIL`.
- [ ] Confirm Stripe webhook delivery dashboard shows 200s, no retries piling up.
