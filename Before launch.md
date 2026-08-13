# Before Launch — Skemaka Go-to-Market Checklist

> **Single source of truth for go-live.** Absorbed `LAUNCH.md` (2026-07-12
> runbook) on 2026-08-13; that file is now a pointer stub. Earlier ancestors:
> `LAUNCH_CHECKLIST.md`, `GO_LIVE_RUNBOOK.md`, `LAUNCH_PLAN.md` (2026-06).
>
> Prod is live at **skemaka.com**. CI (typecheck + lint + unit) and the nightly
> E2E are green. What remains is mostly **operational** — consoles, keys,
> verification — not engineering.

## 📋 TODO — picking this back up (as of 2026-08-13)

A launch-readiness audit ran on 2026-08-12. Its code findings shipped in
**PR #42 — merged to `main` 2026-08-12** (deployed to prod via Vercel).
Verified there by execution: typecheck 6/6 · lint 0 errors · unit 596 ·
integration 29 under both UTC and UTC+14 · e2e 17 · production build ·
migrations replayed from empty with no drift.

What is left needs either a device or your signature.

**Re-verified 2026-08-13 by execution:** typecheck 6/6 green · lint 0 errors /
14 warnings · **672 tests passing** (596 web + 76 new in `packages/api`) ·
`npm audit` 20 advisories, **0 of them in `apps/web`** · `eas.json` ios creds
still empty · `checks: ["pkce", "state"]` present in both auth files · Stripe
webhook handles exactly the four expected events ·
`20260709000000_add_push_subscriptions` migration exists, so schema and
migrations are in sync.

**Cleared 2026-08-13:** `packages/api` test suite written (76 tests) · the four
stale screenshots deleted · `docs/restore-runbook.md` drafted (procedure only —
the drill itself is still owed) · one real bug found and fixed in
`cancelCoverRequest` · `packages/api` React pin realigned 18 → 19.1.0 · **the
lapsed-trial paywall (PR #44, live on prod)** · **Resend domain verified and
proven by a real send** · **live Stripe price confirmed Graduated** · **web
Google sign-in verified against production**.

### 🎯 The day someone subscribes — do these in order

1. **Upgrade Twilio off trial** — before the manager invites any staff (see below).
2. **Watch the Stripe webhook delivery log.** checkout → `checkout.session.completed`
   → `ACTIVE` → unlock has never run for real. A wrong `STRIPE_WEBHOOK_SECRET`
   returns 400 and Stripe retries for ~3 days while the customer stays locked out.
3. **Register for VAT** (Stripe → Settings → Tax → Registrations → Denmark).
   Prices are tax-exclusive, so until this exists you collect no VAT and may owe
   it out of the €19.

### ⏭️ What is actually left

1. ~~**Subscribe** at skemaka.com~~ — **deferred by owner until the first
   paying customer** (2026-08-13). It costs ~€0.55 net (you pay your own Stripe
   account; only the fee is lost), but the owner would rather land a customer
   first. Consequence: **your own org stays 402-locked**, so you cannot use the
   real app day to day — use `/demo` for demos, which creates a fresh
   throwaway org that is not locked. New customers are unaffected: they get a
   clean 14-day trial on signup.

   Note what stays untested until someone pays: the **full money path**
   (checkout → `checkout.session.completed` webhook → `ACTIVE` → unlock). The
   webhook is the piece most likely to be misconfigured, and the first person
   to exercise it will be a real customer. Watch the Stripe delivery log the
   moment that happens.
2. ~~**Walk the new-signup path on prod**~~ — **done 2026-08-13.** Real signup
   via magic link → onboarding → employee → **invite email delivered** → claim
   → active account. It works. Four rough edges found and fixed in **PR #49**
   (onboarding discarding the first employee, `/verify-phone` having no exit,
   English starter job roles, untranslated "Check your email"). All eight
   manager routes also load clean with zero failed requests. **Cleanup owed:**
   delete org `QA Test — slet mig` (`cmsrazzoa000104jrhoce9oe8`) and the
   `gamborgc+trial@` / `gamborgc+staff@` users.
3. **Mobile Google sign-in** — the only untested piece of the PKCE change.
4. Owner-deferred to the first paying customer: **Stripe Tax**, **Twilio**,
   **App Store submission**.
5. Everything under 🟡 and 🟢 below (PITR drill, uptime, `expo@57`,
   `migrate deploy`, lint warnings).

---

### 🔴 Do first — one unverified change is now live in prod

- [x] ~~**Web Google sign-in**~~ — **verified working 2026-08-13** against
      production. Signed fully out (`/api/auth/session` empty), clicked
      Continue with Google, landed back authenticated on `/schedule`. There is
      no route to a session except the OAuth callback, so `checks: ["pkce",
      "state"]` is good on web. **Mobile is still untested** — and mobile is the
      half that was actually at risk, since PKCE was removed for it in May 2026.
- [ ] **Test Google sign-in, MOBILE.** PR #42 restored
      `checks: ["pkce", "state"]` (Auth.js's default). PKCE was removed in May
      2026 during mobile work (`7c6b214`), so that flow may have depended on its
      absence — and it is the one change that could not be verified without a
      device. It is in prod now, so this is a live-traffic risk, not a
      pre-merge one.
      - Web: incognito → `/login` → Continue with Google → should land on
        `/schedule`. Failure looks like `/login?error=OAuthCallbackError`.
      - Mobile: Expo app → Google sign-in (leaves for the system browser and
        returns via `/api/auth/mobile/complete`).
      - If mobile breaks: revert `["pkce", "state"]` → `["state"]` in
        `apps/web/auth.config.ts` **and** `apps/web/lib/auth.ts`. The real fix is
        the `code_verifier` cookie's sameSite/partitioning, not weakening every
        browser sign-in again.

---

### 🔴 Blocking a first paying customer — yours, not the code's

- [x] ~~**The lapsed-trial dead end**~~ — **fixed 2026-08-13 (PR #44).** Found by
      looking at prod: **skemaka.com has been returning 402 on every API call
      since ~2026-07-16** (org created 2026-07-02 + 14-day trial). No client
      code handled 402 at all, so `/schedule` rendered *"Ingen medarbejdere
      endnu — tilføj din første medarbejder"*: a lapsed customer was shown what
      reads as **deleted data**, with no route to pay. There is now a paywall
      that says what happened, promises the data is safe, and links to
      `/billing`; `/billing` itself stays reachable and its banner no longer
      claims "Full access during your trial" while the account is locked.
      **Your org is still locked** — subscribing is what unlocks it, which is
      gated on the Stripe price below.

- [x] ~~**Live Stripe price**~~ — **verified correct 2026-08-13.**
      `price_1Tz01bLAqyypKJ3eb4CN0ZSf` (lookup key `per_employee_monthly_v3`) is
      **Graduated**: `0–5 → €19.00 flat + €0/unit`, `6+ → €3.50/unit`. That is
      exactly `lib/pricing.ts` (`19 + 3.50 × max(0, n−5)`). Confirmed live by
      creating a real checkout session (`cs_live_…`), which also proves
      `STRIPE_PRICE_ID` in Vercel points at it. **Caveat: the TEST-mode price
      (`price_1To92u…`) is Volume, not Graduated**, so test-mode checkout math
      diverges from live above 5 seats. Worth aligning; not a launch item.
- [x] ~~**Migrate existing subscriptions off the old €3 price**~~ — **moot.**
      The live price shows **0 active subscriptions**, so there is nobody to
      grandfather. This item can be deleted.
- [x] ~~**Resend verified domain**~~ — **done 2026-08-13.** `skemaka.com` is
      verified (DKIM + SPF + MX, region eu-west-1, DNS managed at Vercel) and
      `RESEND_FROM_EMAIL` is `Skemaka <noreply@skemaka.com>` in Vercel and
      `.env.local`. Proven end to end: a live send from `noreply@skemaka.com`
      landed in the **primary inbox, not spam**. Before this the account had
      zero verified domains and the sandbox sender delivered only to the account
      owner, so employees received nothing, silently.
- [ ] **Stripe Tax registration.** Prices are tax **Exclusive**, so VAT is added
      on top (€19 → €23.75 for a Danish customer) — but nothing is collected
      until a registration exists. Dashboard → Tax → Registrations → Denmark
      (needs the CVR). **Deferred by owner to the first paying customer**; the
      risk of deferring is that the first sale collects no VAT while you may
      still owe it out of the €19.
- [ ] **Twilio trial → paid — do it the moment someone subscribes, before the
      manager invites their staff.** Owner's call 2026-08-13: deferred to the
      first paying customer, which works because payment and staff invites are
      separate steps with a natural gap between them.
      Why the timing matters: claiming an invite sends the employee to phone
      verification, and a Twilio trial only texts numbers pre-verified in its
      console — so if staff are invited while still on the trial, **every one of
      them meets "We couldn't send a code" on first contact with the product**,
      and the manager is who hears about it. Confirmed live during the signup
      walk with a real number. PR #49 added a "Skip for now" exit so it is not a
      dead end, but it is still a red error in front of every new employee.
      On a trial, messages also arrive prefixed "Sent from a Twilio trial
      account", and sends are logged rather than thrown, so it fails silently.
- [ ] **Check the live Stripe delivery log right after the first real
      subscription.** A wrong `STRIPE_WEBHOOK_SECRET` returns 400 and Stripe
      retries for ~3 days. Note the webhook now returns **500 and stays
      retryable** on a genuine processing failure instead of a false
      `200 duplicate`, so failures show up as retries rather than silence.

---

### 🔴 One-time console verification (~30 min, from the old LAUNCH.md §2/§4/§5)

**Prod env vars** (Vercel → Settings → Environment Variables). Required at boot
— a deploy fails fast listing anything missing (`instrumentation.ts`):
`DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`,
`NEXTAUTH_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`,
`RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`, `SUPERADMIN_EMAIL`, `CRON_SECRET`, and
Upstash (`UPSTASH_REDIS_REST_*` or `KV_REST_API_*`). Prod boots today, so these
are set.

- [ ] **Web push keys.** The push code (`PushSubscription` model, service
      worker) is in `main` even though PR #9 was closed. To make it actually
      send: `npx web-push generate-vapid-keys` → set
      `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` (optional
      `VAPID_SUBJECT`, defaults to mailto:support@skemaka.com), then
      `cd apps/web && npx prisma db push` against prod Neon to create the
      `PushSubscription` table. Verified no-op without the keys — safe to defer.
- [ ] **Twilio env** (if SMS is day-one): `TWILIO_ACCOUNT_SID`,
      `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` present in prod.
- [ ] ⛔ **Confirm absent in prod:** `E2E_TEST_LOGIN`, `E2E_TEST_PASSWORD`,
      `TWILIO_TO_OVERRIDE` — all three are enforced: boot refuses if set
      (`instrumentation.ts` `FORBIDDEN_ENV_VARS`). Also confirm `NEON_WS_PROXY`
      is absent — **this one is not boot-enforced**, it just silently rewires
      the Neon connection (`lib/prisma.ts:10`), so it needs an eyeball.
- [ ] **Stripe webhook:** live endpoint `https://skemaka.com/api/webhooks/stripe`
      subscribes to exactly `checkout.session.completed`,
      `customer.subscription.updated`, `customer.subscription.deleted`,
      `invoice.payment_failed` — and shows 200s in the delivery dashboard.
- [ ] **Rate limiting:** >20 req/10 s to a public endpoint → 429; no
      "Rate limiting is DISABLED" in prod logs (API fails closed without Upstash).
- [ ] **Crons:** Vercel → Cron Jobs shows `/api/cron/cleanup` (**daily** 03:00)
      and `/api/cron/bug-report-digest` (daily 07:00); trigger each once → 200.
      (The old runbook said cleanup runs Sundays — `apps/web/vercel.json` has
      `0 3 * * *`, i.e. daily. Verify against the daily schedule.)
- [x] ~~**Email**~~ — done 2026-08-13: domain verified, a live send from
      `noreply@skemaka.com` reached the primary inbox (not spam). Still worth
      re-checking that a real *invite* and a real *publish* deliver once you
      have staff on the roster, since those go through the template path.
- [ ] **Google OAuth:** consent screen **published** (not testing mode); prod
      redirect URI `https://skemaka.com/api/auth/callback/google` present.
      (Pairs with the PKCE test above.)
- [ ] **DB schema sanity:** `npx prisma migrate status` / Neon console — prod
      has all tables through the newest migration,
      `20260730230000_pending_seats_effective_at`. (Locally the migration
      folder is complete and matches `schema.prisma`, including
      `20260709000000_add_push_subscriptions` — the check is whether *prod*
      has caught up, since prod is applied with `db push`.)
- [ ] **SMS compliance** (if day-one): sender registration for the target market
      — A2P 10DLC is US-only; for Denmark/EU register the sender / alphanumeric
      ID with Twilio. Inbound webhook
      `https://skemaka.com/api/webhooks/twilio/sms` configured; text STOP →
      suppressed + `SmsOptOut` row; START → restored.
- [ ] **Recommended once:** dunning drill with a Stripe test clock —
      `invoice.payment_failed` → PAST_DUE → 14-day grace → 402.

---

### 🟡 Next, once someone is paying

- [ ] **Neon PITR restore drill** — still never done, and outstanding in every
      version of this doc since June. `docs/restore-runbook.md` now exists as a
      **written but undrilled** procedure: branch-not-in-place restore, the
      FK/duplicate-schedule/Stripe-field traps, and the cleanup steps. What it
      cannot supply is the part that needs your console — **confirm the Neon
      plan's PITR retention window** (the single most important number: an
      incident older than the window is unrecoverable), then restore once to a
      scratch branch, confirm it is queryable, and fill in the `⟨fill in⟩`
      blanks. Until then there is no tested answer to "I dropped the wrong org".
- [ ] **Uptime check + alerting.** Client crashes now POST to `/api/bug-report`
      (persisted, emailed, visible on `/platform/errors`), but the digest is
      daily and nothing watches whether the site is up. Today's monitoring is
      structured JSON logs (search Vercel by `requestId`) + that digest to
      `SUPERADMIN_EMAIL`. No Sentry — known gap, accepted for launch.
- [ ] **`expo@57`** clears the last 20 npm advisories (9 moderate, 11 high).
      Confirmed 2026-08-13: `npm audit --workspace apps/web` = **0
      vulnerabilities**, so none of this touches the deployed web app — it is
      all React Native / Expo build tooling (metro, @expo/prebuild-config,
      xcode, image-size, postcss, uuid). Currently on `expo@~54.0.35`. A major
      — give it its own window, before App Store submission.
- [x] ~~**Test `packages/api`**~~ — **done 2026-08-13.** 76 tests across
      `src/__tests__/{client,api,hooks}.test.ts`, wired into `npm run test` via
      turbo. Covers the bearer/refresh logic (single-flight refresh on
      concurrent 401s, no retry loop, proactive expiry), pagination, response
      unwrapping, and every hook's query key, `enabled` gate and cache
      invalidation. Found and fixed one real bug (below); `packages/api` was
      also pinned to React 18 while both apps run 19.1.0 — now aligned.
- [x] ~~**The list hooks silently truncate**~~ — **fixed 2026-08-13.**
      `useEmployees` now goes through `listEmployees`, and `useTimeOff` through a
      new `listTimeOff(client, orgId, filters)`; both page in full via
      `getAllPages`, carrying the filters onto every page. Previously they read
      `res.data` off a single request and stopped at the server default — 100
      for employees, **50 for time-off**, which accumulates and so would have
      bitten first. Covered by two new hook tests.
- [x] ~~**Malformed env vars boot happily**~~ — **fixed 2026-08-13.**
      `instrumentation.ts` checked only that the required vars were *present*.
      `STRIPE_PRICE_ID` and `STRIPE_SECRET_KEY` are adjacent in Vercel's
      alphabetical list, so a swap deploys green and fails at the first attempt
      to pay. It now also validates the documented prefixes (`price_`, `sk_`,
      `whsec_`, `re_`, `postgres://`, https URLs — localhost allowed so a local
      production build still starts).
- [ ] **Move production to `migrate deploy`.** It uses `db push` today, which
      makes the DB match `schema.prisma` and therefore silently drops anything
      Prisma cannot express — which is why the two rota/clock invariants are
      enforced with `SELECT … FOR UPDATE` (`lib/services/locks.ts`) rather than
      partial unique indexes. Once on `migrate deploy`, add the indexes too.

---

### 🟢 Loose ends

- [x] ~~Decide on four stale screenshot files~~ — **deleted 2026-08-13.**
      `00-login-dark.png`, `dark-login.png`, `verify-login-dark.png`,
      `verify-login-light.png` were May-era one-off theme QA artifacts, absent
      from the CLAUDE.md screenshot table and superseded by `00-login.png`
      (retaken 2026-08-12). Removed with `git rm`, so `git revert` brings them
      back if you disagree. What remains matches the documented table.
- [ ] `qa-01-schedule.png` in the repo root — left alone. It is **untracked and
      gitignored** (`.gitignore:64` `/*.png`), so deleting it is not
      recoverable; your call, but nothing depends on it.
- [ ] 14 `react-hooks/set-state-in-effect` lint warnings — still exactly 14
      (0 errors). Cascading renders in `lib/useScheduleData.ts:60`,
      `components/pwa/usePushSubscription.ts:51` and a few dialogs. A
      performance smell, invisible at current data sizes.
- [ ] `lib/orgSettings.ts:6` still carries the repo's only TODO (confirmed:
      1 repo-wide) — "replace with real API calls to
      `/api/orgs/[orgId]/settings`". The module-level client singleton is what
      forces `"use client"` on every consumer.

---

### 📱 Mobile / App Store — deferred by owner to the first paying customer

`eas.json` already points at `https://skemaka.com`. Detail in
`apps/mobile/APP_STORE_SUBMISSION.md`.

- [ ] Fill `eas.json` `submit.production.ios` creds: `appleId`, `ascAppId`,
      `appleTeamId` — confirmed 2026-08-13, all three are still `""`
- [ ] Apple Developer: enable "Sign in with Apple" on `com.skemaka.app`
- [ ] Seed a demo MANAGER review account with realistic data; enter creds in
      App Store Connect + support email/URL
- [ ] `eas build` → `eas submit`

---

## Go / No-Go

**GO for web when:** the PKCE sign-in test passes · Stripe live price created and
`STRIPE_PRICE_ID` set · env vars confirmed (including the ⛔ absent list) ·
webhook verified · rate-limit / cron / email / OAuth checks pass · backup drill
done. SMS and mobile may trail if not day-one critical.

**First 48 h:** watch Vercel logs for `level:"error"` lines (correlate by
`requestId`); confirm the daily digest arrives; watch Stripe webhook deliveries
for retries piling up.

---

## Post-launch backlog (gate on metrics — from the old Phase 3)

- E2E for the full Stripe checkout money path (webhook + guard logic is
  unit/E2E tested; the checkout redirect flow itself is not).
- Load-test hot endpoints at ~100-org scale; verify indexes with EXPLAIN.
- Keep-warm cron for Neon cold starts; per-org (not per-IP) rate limits.
- Nightly Stripe quantity reconciliation against active seat counts.
- Convert `Shift.startTime/endTime` strings to real time types.
- Scrub old Playwright debug files from git history if the repo ever goes public.

Then: ship 🚀
